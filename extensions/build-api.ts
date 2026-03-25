/**
 * Build-API — REST API generation orchestrator
 *
 * Orchestrates a sequential workflow of specialist agents that generate
 * REST API code following TDD from product-spec folder.
 *
 * Workflow: initializer → planner → builder → tester
 *
 * Agents are defined in .pi/agents/api-*.md
 * Team is defined in .pi/agents/build-api.yaml
 *
 * Progress is tracked via:
 * - progress.md (session state, handoff instructions)
 * - feature-list.json (feature completion status with TDD fields)
 *
 * Commands:
 *   /build-api         — Start API generation
 *   /build-api-status  — Show current progress
 *   /build-api-resume  — Resume from last checkpoint
 *
 * Usage: pi -e extensions/build-api.ts
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { spawn, exec } from "child_process";
import { readdirSync, readFileSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

// ── Test Environment ────────────────────────────

interface TestEnvironment {
	type: "docker" | "bare";
	composeFile: string | null;
	wrapCommand: (cmd: string) => string;
}

let cachedTestEnv: TestEnvironment | null = null;

async function detectTestEnvironment(cwd: string): Promise<TestEnvironment> {
	const composeFile = existsSync(join(cwd, 'docker-compose.dev.yml'))
		? 'docker-compose.dev.yml'
		: existsSync(join(cwd, 'docker-compose.yml'))
		? 'docker-compose.yml'
		: null;

	if (!composeFile) {
		return { type: "bare", composeFile: null, wrapCommand: (cmd) => cmd };
	}

	try {
		await execAsync('docker info', { cwd, timeout: 5000 });
		return {
			type: "docker",
			composeFile,
			wrapCommand: (cmd) => `docker compose -f ${composeFile} exec -T api ${cmd}`,
		};
	} catch {
		return { type: "bare", composeFile: null, wrapCommand: (cmd) => cmd };
	}
}

// ── Types ────────────────────────────────────────

interface AgentDef {
	name: string;
	description: string;
	tools: string;
	systemPrompt: string;
	file: string;
}

interface AgentState {
	def: AgentDef;
	phase: "init" | "plan" | "build" | "test";
	status: "pending" | "running" | "done" | "error";
	task: string;
	toolCount: number;
	elapsed: number;
	lastWork: string;
	contextPct: number;
	sessionFile: string | null;
	runCount: number;
	timer?: ReturnType<typeof setInterval>;
}

interface Feature {
	id: string;
	desc: string;
	file: string | null;
	test_file: string | null;
	template: string | null;
	test: string;
	depends_on: string[];
	passes: boolean;
	test_exists: boolean;
	implementation_exists: boolean;
	status: "idle" | "in_progress" | "done" | "failed" | "skipped" | "verification_pending";
	attempts: number;
	skip: boolean;
	tdd_phase: "red" | "green" | null;
}

interface FeatureList {
	features: Feature[];
}

interface TestResult {
	passes: boolean;
	output: string;
	exitCode: number;
	duration: number;
}

interface ProgressState {
	activeAgent: string;
	phase: string;
	featureProgress: string;
	currentFeature: string;
	overallHealth: string;
}

// ── Display Helpers ──────────────────────────────

function displayName(name: string): string {
	return name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function phaseDisplay(phase: string): string {
	switch (phase) {
		case "init": return "INIT";
		case "plan": return "PLAN";
		case "build": return "BUILD";
		case "test": return "TEST";
		default: return phase.toUpperCase();
	}
}

// ── YAML Parser ──────────────────────────────────

function parseTeamYaml(raw: string): string[] {
	const agents: string[] = [];
	for (const line of raw.split("\n")) {
		const match = line.match(/^\s+-\s+(.+)$/);
		if (match) {
			agents.push(match[1].trim());
		}
	}
	return agents;
}

// ── Frontmatter Parser ───────────────────────────

function parseAgentFile(filePath: string): AgentDef | null {
	try {
		const raw = readFileSync(filePath, "utf-8");
		const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
		if (!match) return null;

		const frontmatter: Record<string, string> = {};
		for (const line of match[1].split("\n")) {
			const idx = line.indexOf(":");
			if (idx > 0) {
				frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
			}
		}

		if (!frontmatter.name) return null;

		return {
			name: frontmatter.name,
			description: frontmatter.description || "",
			tools: frontmatter.tools || "read,grep,find,ls",
			systemPrompt: match[2].trim(),
			file: filePath,
		};
	} catch {
		return null;
	}
}

function scanAgentDirs(cwd: string): Map<string, AgentDef> {
	const dirs = [
		join(cwd, ".pi", "agents"),
	];

	const agents = new Map<string, AgentDef>();

	for (const dir of dirs) {
		if (!existsSync(dir)) continue;
		try {
			for (const file of readdirSync(dir)) {
				if (!file.endsWith(".md")) continue;
				if (!file.startsWith("api-")) continue;
				const fullPath = resolve(dir, file);
				const def = parseAgentFile(fullPath);
				if (def && !agents.has(def.name.toLowerCase())) {
					agents.set(def.name.toLowerCase(), def);
				}
			}
		} catch {}
	}

	return agents;
}

// ── Progress File Parser ─────────────────────────

function parseProgressMd(content: string): ProgressState | null {
	try {
		const activeAgentMatch = content.match(/\*\*Active agent\*\*:\s*(.+)/);
		const phaseMatch = content.match(/\*\*Current phase\*\*:\s*(.+)/);
		const featureProgressMatch = content.match(/\*\*Feature progress\*\*:\s*(.+)/);
		const currentFeatureMatch = content.match(/\*\*Current feature\*\*:\s*(.+)/);
		const healthMatch = content.match(/\*\*Overall health\*\*:\s*(.+)/);

		return {
			activeAgent: activeAgentMatch?.[1]?.trim() || "unknown",
			phase: phaseMatch?.[1]?.trim() || "init",
			featureProgress: featureProgressMatch?.[1]?.trim() || "0/?",
			currentFeature: currentFeatureMatch?.[1]?.trim() || "none",
			overallHealth: healthMatch?.[1]?.trim() || "unknown",
		};
	} catch {
		return null;
	}
}

// ── Feature List Parser ─────────────────────────

function parseFeatureList(content: string): FeatureList | null {
	try {
		return JSON.parse(content);
	} catch {
		return null;
	}
}

function getFeatureStats(list: FeatureList | null): { done: number; total: number; current: string } {
	if (!list) return { done: 0, total: 0, current: "none" };
	
	const total = list.features.length;
	const done = list.features.filter(f => f.status === "done" || f.status === "verification_pending" || f.passes).length;
	const current = list.features.find(f => f.status === "in_progress")?.id || "none";
	
	return { done, total, current };
}

// ── Artifact Validation ─────────────────────────

function validateInitializerArtifacts(cwd: string): { valid: boolean; missing: string[] } {
	const required = ['detected-conventions.json', 'feature-list.json', 'api-spec.md', 'progress.md'];
	const missing = required.filter(f => !existsSync(join(cwd, f)));
	return { valid: missing.length === 0, missing };
}

function validatePlannerArtifacts(cwd: string): { valid: boolean; missing: string[] } {
	const required = ['api-plan.md'];
	const missing = required.filter(f => !existsSync(join(cwd, f)));
	return { valid: missing.length === 0, missing };
}

// ── Feature List Operations ────────────────────

function readFeatureList(cwd: string): FeatureList | null {
	const path = join(cwd, 'feature-list.json');
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, 'utf-8'));
	} catch {
		return null;
	}
}

function writeFeatureList(cwd: string, list: FeatureList): void {
	const path = join(cwd, 'feature-list.json');
	writeFileSync(path, JSON.stringify(list, null, 2));
}

function getNextPendingFeature(list: FeatureList | null, exclude?: Set<string>): Feature | null {
	if (!list) return null;

	return list.features.find(f =>
		(f.status === "idle" || f.status === "verification_pending" || (f.status === "failed" && f.attempts < 10)) &&
		!f.passes &&
		!f.skip &&
		!(exclude?.has(f.id)) &&
		f.depends_on.every(depId => {
			const dep = list.features.find(d => d.id === depId);
			return dep && (dep.passes || dep.status === "verification_pending");
		})
	) || null;
}

function hasPendingFeatures(list: FeatureList | null, exclude?: Set<string>): boolean {
	return getNextPendingFeature(list, exclude) !== null;
}

function updateFeatureStatus(
	cwd: string, 
	featureId: string, 
	 updates: Partial<Feature>
): FeatureList | null {
	const list = readFeatureList(cwd);
	if (!list) return null;
	
	const feature = list.features.find(f => f.id === featureId);
    if (!feature) return null;
    
    Object.assign(feature, updates);
    writeFeatureList(cwd, list);
    return list;
}

// ── File Verification Helper ─────────────────────────

function verifyFeatureFiles(
    cwd: string, 
    feature: Feature
): { implExists: boolean; testExists: boolean; created: string[] } {
    const created: string[] = [];
    let implExists = !feature.file;
    let testExists = !feature.test_file;
    
    if (feature.file) {
        implExists = existsSync(join(cwd, feature.file));
        if (implExists) created.push(feature.file);
    }
    
    if (feature.test_file) {
        testExists = existsSync(join(cwd, feature.test_file));
        if (testExists) created.push(feature.test_file);
    }
    
    return { implExists, testExists, created };
}

// ── Git Commit Function ────────────────────────────────

async function commitFeature(
    cwd: string, 
    feature: Feature
): Promise<{ committed: boolean; hash?: string; error?: string }> {
    try {
        const { stdout: status } = await execAsync('git status --porcelain', { cwd, timeout: 5000 });
        if (!status.trim()) {
            return { committed: false };
        }
        
        await execAsync('git add -A', { cwd, timeout: 10000 });
        
        const message = `feat(api): add ${feature.id}\n\n${feature.desc}`;
        const { stdout: commitOut } = await execAsync(
            `git commit -m "${message.replace(/"/g, '\\"')}"`,
            { cwd, timeout: 10000 }
        );
        
        const hashMatch = commitOut.match(/\[([a-f0-9]+)\s/);
        const hash = hashMatch ? hashMatch[1] : undefined;
        
        return { committed: true, hash };
    } catch (error: any) {
        return { 
            committed: false, 
            error: error.message.includes('not a git') 
                ? 'Not a git repository' 
                : `Git error: ${error.message}` 
        };
    }
}

// ── Test Runner ────────────────────────────────

async function runTest(testCommand: string, cwd: string): Promise<TestResult> {
    const startTime = Date.now();

    if (!cachedTestEnv) {
        cachedTestEnv = await detectTestEnvironment(cwd);
    }
    const actualCommand = cachedTestEnv.wrapCommand(testCommand);

    try {
        const { stdout, stderr } = await execAsync(actualCommand, {
            cwd,
            timeout: 120000,
            maxBuffer: 1024 * 1024 * 10,
        });
        return {
            passes: true,
            output: stdout + stderr,
            exitCode: 0,
            duration: Date.now() - startTime,
        };
    } catch (error: any) {
        return {
            passes: false,
            output: error.stdout + error.stderr || error.message,
            exitCode: error.code || 1,
            duration: Date.now() - startTime,
        };
    }
}

// ── Session Log ────────────────────────────────

function initProgressMd(cwd: string): void {
	const path = join(cwd, 'progress.md');
	if (existsSync(path)) return;
	
	const content = `# API Generation Progress

**Project**: API Generation
**Generated**: ${new Date().toISOString().split('T')[0]}

## Current State

**Active agent**: none
**Current phase**: init
**Feature progress**: 0/?
**Current feature**: none
**Overall health**: on-track

## Session Log
`;
	writeFileSync(path, content);
}

function updateProgressState(
	cwd: string, 
	updates: {
		activeAgent?: string;
		phase?: string;
		featureProgress?: string;
		currentFeature?: string;
		overallHealth?: string;
	}
): void {
	const path = join(cwd, 'progress.md');
	if (!existsSync(path)) return;
	
	let content = readFileSync(path, 'utf-8');
	
	if (updates.activeAgent !== undefined) {
		content = content.replace(/\*\*Active agent\*\*:\s*.*/, `**Active agent**: ${updates.activeAgent}`);
	}
	if (updates.phase !== undefined) {
		content = content.replace(/\*\*Current phase\*\*:\s*.*/, `**Current phase**: ${updates.phase}`);
	}
	if (updates.featureProgress !== undefined) {
		content = content.replace(/\*\*Feature progress\*\*:\s*.*/, `**Feature progress**: ${updates.featureProgress}`);
	}
	if (updates.currentFeature !== undefined) {
		content = content.replace(/\*\*Current feature\*\*:\s*.*/, `**Current feature**: ${updates.currentFeature}`);
	}
	if (updates.overallHealth !== undefined) {
		content = content.replace(/\*\*Overall health\*\*:\s*.*/, `**Overall health**: ${updates.overallHealth}`);
	}
	
	writeFileSync(path, content);
}

function appendSessionLog(
    cwd: string, 
    agentName: string, 
    data: {
        intent: string;
        result: string;
        features?: string[];
        duration: number;
        commits?: string[];
        errors?: string;
        tdd_phase?: "red" | "green" | null;
        files_created?: string[];
    }
): void {
    const path = join(cwd, 'progress.md');
    if (!existsSync(path)) return;
    
    const existing = readFileSync(path, 'utf-8');
    
    const logMatch = existing.match(/(## Session Log[\s\S]*)$/);
    const existingLog = logMatch ? logMatch[1] : '## Session Log\n';
    
    const timestamp = new Date().toISOString();
    const entry = `\n### ${timestamp} — ${agentName}\n` +
        `- **Intent**: ${data.intent}\n` +
        (data.features ? `- **Features**: ${data.features.join(', ')}\n` : '') +
        (data.tdd_phase ? `- **TDD Phase**: ${data.tdd_phase}\n` : '') +
        (data.files_created && data.files_created.length > 0 ? `- **Files Created**: ${data.files_created.join(', ')}\n` : '') +
        `- **Result**: ${data.result}\n` +
        `- **Duration**: ${Math.round(data.duration / 1000)}s\n` +
        (data.commits && data.commits.length > 0 ? `- **Commits**: ${data.commits.join(', ')}\n` : '') +
        (data.errors ? `- **Errors**: ${data.errors}\n` : '- **Errors**: none\n');
    
    const updated = existing.replace(/## Session Log[\s\S]*$/, existingLog + entry);
    writeFileSync(path, updated);
}

// ── Extension ────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const agentStates: Map<string, AgentState> = new Map();
	let allAgentDefs: Map<string, AgentDef> = new Map();
	let teamOrder: string[] = [];
	let widgetCtx: any;
	let sessionDir = "";
	let contextWindow = 0;
	let progressPath = "";
	let featureListPath = "";
	let projectCwd = "";

	// ── Load Agents ──────────────────────────────

	function loadAgents(cwd: string) {
		projectCwd = cwd;
		sessionDir = join(cwd, ".pi", "agent-sessions");
		if (!existsSync(sessionDir)) {
			mkdirSync(sessionDir, { recursive: true });
		}

		progressPath = join(cwd, "progress.md");
		featureListPath = join(cwd, "feature-list.json");

		allAgentDefs = scanAgentDirs(cwd);

		const teamPath = join(cwd, ".pi", "agents", "build-api.yaml");
		if (existsSync(teamPath)) {
			try {
				teamOrder = parseTeamYaml(readFileSync(teamPath, "utf-8"));
			} catch {
				teamOrder = [];
			}
		}

		agentStates.clear();
		const phases: ("init" | "plan" | "build" | "test")[] = ["init", "plan", "build", "test"];
		
		for (let i = 0; i < teamOrder.length; i++) {
			const agentName = teamOrder[i];
			const def = allAgentDefs.get(agentName.toLowerCase());
			if (!def) continue;

			const key = def.name.toLowerCase().replace(/\s+/g, "-");
			const sessionFile = join(sessionDir, `${key}.json`);
			
			agentStates.set(def.name.toLowerCase(), {
				def,
				phase: phases[i] || "build",
				status: "pending",
				task: "",
				toolCount: 0,
				elapsed: 0,
				lastWork: "",
				contextPct: 0,
				sessionFile: existsSync(sessionFile) ? sessionFile : null,
				runCount: 0,
			});
		}
	}

	// ── Widget Rendering ─────────────────────────

	function updateWidget() {
		if (!widgetCtx) return;

		widgetCtx.ui.setWidget("build-api", (_tui: any, theme: any) => {
			const text = new Text("", 0, 1);

			return {
				render(width: number): string[] {
					if (agentStates.size === 0) {
						text.setText(theme.fg("dim", "No agents loaded. Check .pi/agents/"));
						return text.render(width);
					}

					let progress: ProgressState | null = null;
					let featureStats = { done: 0, total: 0, current: "none" };

					if (existsSync(progressPath)) {
						progress = parseProgressMd(readFileSync(progressPath, "utf-8"));
					}

					if (existsSync(featureListPath)) {
						featureStats = getFeatureStats(parseFeatureList(readFileSync(featureListPath, "utf-8")));
					}

					const lines: string[] = [];

					const phases = ["init", "plan", "build", "test"];
					const phaseLabels = phases.map(p => {
						const state = Array.from(agentStates.values()).find(s => s.phase === p);
						if (!state) return theme.fg("dim", `○ ${p.toUpperCase()}`);

						const statusIcon = state.status === "pending" ? "○"
							: state.status === "running" ? "●"
							: state.status === "done" ? "✓" : "✗";
						const statusColor = state.status === "pending" ? "dim"
							: state.status === "running" ? "accent"
							: state.status === "done" ? "success" : "error";

						return theme.fg(statusColor, `${statusIcon} ${p.toUpperCase()}`);
					});

					const phaseLine = phaseLabels.join(theme.fg("dim", " → "));
					lines.push(phaseLine);

					const buildState = Array.from(agentStates.values()).find(s => s.phase === "build");
					if (buildState && featureStats.total > 0) {
						const progressStr = `Features: ${featureStats.done}/${featureStats.total}`;
						const currentStr = featureStats.current !== "none" ? ` (${featureStats.current})` : "";
						lines.push(theme.fg("muted", progressStr + currentStr));
					}

					const runningAgent = Array.from(agentStates.values()).find(s => s.status === "running");
					if (runningAgent) {
						const elapsed = Math.round(runningAgent.elapsed / 1000);
						const work = runningAgent.lastWork.length > 50 
							? runningAgent.lastWork.slice(0, 47) + "..." 
							: runningAgent.lastWork;
						lines.push(theme.fg("accent", `● ${displayName(runningAgent.def.name)} (${elapsed}s)`));
						if (work) {
							lines.push(theme.fg("dim", `  ${work}`));
						}
					}

					if (progress) {
						const healthColor = progress.overallHealth === "on-track" ? "success"
							: progress.overallHealth === "blocked" ? "error" : "warning";
						lines.push(theme.fg(healthColor, `Status: ${progress.overallHealth}`));
					}

					text.setText(lines.join("\n"));
					return text.render(width);
				},
				invalidate() {
					text.invalidate();
				},
			};
		});
	}

	// ── Dispatch Agent ────────────────────────────

	function dispatchAgent(
		agentName: string,
		task: string,
		ctx: any,
	): Promise<{ output: string; exitCode: number; elapsed: number }> {
		const key = agentName.toLowerCase();
		const state = agentStates.get(key);
		if (!state) {
			return Promise.resolve({
				output: `Agent "${agentName}" not found.`,
				exitCode: 1,
				elapsed: 0,
			});
		}

		if (state.status === "running") {
			return Promise.resolve({
				output: `Agent "${displayName(state.def.name)}" is already running.`,
				exitCode: 1,
				elapsed: 0,
			});
		}

		state.status = "running";
		state.task = task;
		state.toolCount = 0;
		state.elapsed = 0;
		state.lastWork = "";
		state.runCount++;
		updateWidget();

		const startTime = Date.now();
		state.timer = setInterval(() => {
			state.elapsed = Date.now() - startTime;
			updateWidget();
		}, 1000);

		const model = ctx.model
			? `${ctx.model.provider}/${ctx.model.id}`
			: "openrouter/google/gemini-3-flash-preview";

		const agentKey = state.def.name.toLowerCase().replace(/\s+/g, "-");
		const agentSessionFile = join(sessionDir, `${agentKey}.json`);

		const args = [
			"--mode", "json",
			"-p",
			"--no-extensions",
			"--model", model,
			"--tools", state.def.tools,
			"--thinking", "off",
			"--append-system-prompt", state.def.systemPrompt,
			"--session", agentSessionFile,
		];

		if (state.sessionFile) {
			args.push("-c");
		}

		args.push(task);

		const textChunks: string[] = [];

		return new Promise((resolve) => {
			const proc = spawn("pi", args, {
				stdio: ["ignore", "pipe", "pipe"],
				env: { ...process.env },
			});

			let buffer = "";

			proc.stdout!.setEncoding("utf-8");
			proc.stdout!.on("data", (chunk: string) => {
				buffer += chunk;
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const event = JSON.parse(line);
						if (event.type === "message_update") {
							const delta = event.assistantMessageEvent;
							if (delta?.type === "text_delta") {
								textChunks.push(delta.delta || "");
								const full = textChunks.join("");
								const last = full.split("\n").filter((l: string) => l.trim()).pop() || "";
								state.lastWork = last;
								updateWidget();
							}
						} else if (event.type === "tool_execution_start") {
							state.toolCount++;
							updateWidget();
						} else if (event.type === "message_end") {
							const msg = event.message;
							if (msg?.usage && contextWindow > 0) {
								state.contextPct = ((msg.usage.input || 0) / contextWindow) * 100;
								updateWidget();
							}
						}
					} catch {}
				}
			});

			proc.stderr!.setEncoding("utf-8");
			proc.stderr!.on("data", () => {});

			proc.on("close", (code) => {
				clearInterval(state.timer);
				state.elapsed = Date.now() - startTime;
				state.status = code === 0 ? "done" : "error";

				if (code === 0) {
					state.sessionFile = agentSessionFile;
				}

				const full = textChunks.join("");
				state.lastWork = full.split("\n").filter((l: string) => l.trim()).pop() || "";
				updateWidget();

				ctx.ui.notify(
					`${displayName(state.def.name)} ${state.status} in ${Math.round(state.elapsed / 1000)}s`,
					state.status === "done" ? "success" : "error"
				);

				resolve({
					output: full,
					exitCode: code ?? 1,
					elapsed: state.elapsed,
				});
			});

			proc.on("error", (err) => {
				clearInterval(state.timer);
				state.status = "error";
				state.lastWork = `Error: ${err.message}`;
				updateWidget();
				resolve({
					output: `Error spawning agent: ${err.message}`,
					exitCode: 1,
					elapsed: Date.now() - startTime,
				});
			});
		});
	}

	// ── dispatch_agent Tool ───────────────────────

	pi.registerTool({
		name: "dispatch_agent",
		label: "Dispatch Agent",
		description: "Dispatch a task to a specialist agent in the build-api workflow. Use api-initializer, api-planner, api-builder, or api-tester.",
		parameters: Type.Object({
			agent: Type.String({ description: "Agent name: api-initializer, api-planner, api-builder, or api-tester" }),
			task: Type.String({ description: "Task description for the agent" }),
		}),

		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			const { agent, task } = params as { agent: string; task: string };

			if (onUpdate) {
				onUpdate({
					content: [{ type: "text", text: `Dispatching to ${agent}...` }],
					details: { agent, task, status: "dispatching" },
				});
			}

			const result = await dispatchAgent(agent, task, ctx);

			const truncated = result.output.length > 8000
				? result.output.slice(0, 8000) + "\n\n... [truncated]"
				: result.output;

			const status = result.exitCode === 0 ? "done" : "error";
			const summary = `[${agent}] ${status} in ${Math.round(result.elapsed / 1000)}s`;

			return {
				content: [{ type: "text", text: `${summary}\n\n${truncated}` }],
				details: {
					agent,
					task,
					status,
					elapsed: result.elapsed,
					exitCode: result.exitCode,
					fullOutput: result.output,
				},
			};
		},

		renderCall(args, theme) {
			const agentName = (args as any).agent || "?";
			const task = (args as any).task || "";
			const preview = task.length > 60 ? task.slice(0, 57) + "..." : task;
			return new Text(
				theme.fg("toolTitle", theme.bold("dispatch_agent ")) +
				theme.fg("accent", agentName) +
				theme.fg("dim", " — ") +
				theme.fg("muted", preview),
				0, 0,
			);
		},

		renderResult(result, options, theme) {
			const details = result.details as any;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			if (options.isPartial || details.status === "dispatching") {
				return new Text(
					theme.fg("accent", `● ${details.agent || "?"}`) +
					theme.fg("dim", " working..."),
					0, 0,
				);
			}

			const icon = details.status === "done" ? "✓" : "✗";
			const color = details.status === "done" ? "success" : "error";
			const elapsed = typeof details.elapsed === "number" ? Math.round(details.elapsed / 1000) : 0;
			const header = theme.fg(color, `${icon} ${details.agent}`) +
				theme.fg("dim", ` ${elapsed}s`);

			if (options.expanded && details.fullOutput) {
				const output = details.fullOutput.length > 4000
					? details.fullOutput.slice(0, 4000) + "\n... [truncated]"
					: details.fullOutput;
				return new Text(header + "\n" + theme.fg("muted", output), 0, 0);
			}

			return new Text(header, 0, 0);
		},
	});

	// ── run_workflow Tool ─────────────────────────

	pi.registerTool({
		name: "run_workflow",
		label: "Run Workflow",
		description: "Execute the full build-api workflow with mechanical enforcement. Validates artifacts, runs tests with TDD, and controls feature dispatch.",
		parameters: Type.Object({
			phase: Type.Optional(Type.String({ 
				description: "Phase to run: init, plan, build, test, or all (default: all)" 
			})),
		}),

		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			const { phase = "all" } = params as { phase?: string };
			const results: string[] = [];

			const phases = phase === "all" 
				? ["init", "plan", "build", "test"] 
				: [phase];

			for (const p of phases) {
				if (onUpdate) {
					onUpdate({
						content: [{ type: "text", text: `Starting ${p.toUpperCase()} phase...` }],
						details: { phase: p, status: "running" },
					});
				}

				try {
					let result;
					switch (p) {
						case "init":
							result = await runInitPhase(ctx, onUpdate);
							break;
						case "plan":
							result = await runPlanPhase(ctx, onUpdate);
							break;
						case "build":
							result = await runBuildPhase(ctx, onUpdate);
							break;
						case "test":
							result = await runTestPhase(ctx, onUpdate);
							break;
						default:
							result = { success: false, error: `Unknown phase: ${p}` };
					}

					if (!result.success) {
						results.push(`✗ ${p.toUpperCase()}: ${result.error}`);
						break;
					}
					results.push(`✓ ${p.toUpperCase()}: ${result.message}`);
				} catch (error: any) {
					results.push(`✗ ${p.toUpperCase()}: ${error.message}`);
					break;
				}
			}

			return {
				content: [{ type: "text", text: results.join("\n") }],
				details: { phases, results },
			};
		},

		renderCall(args, theme) {
			const phase = (args as any).phase || "all";
			return new Text(
				theme.fg("toolTitle", theme.bold("run_workflow ")) +
				theme.fg("accent", phase.toUpperCase()),
				0, 0,
			);
		},

		renderResult(result, options, theme) {
			const text = result.content[0];
			return new Text(text?.type === "text" ? text.text : "", 0, 0);
		},
	});

	// ── verify_artifacts Tool ─────────────────────

	pi.registerTool({
		name: "verify_artifacts",
		label: "Verify Artifacts",
		description: "Check that required artifacts exist for a given phase. Returns list of missing files.",
		parameters: Type.Object({
			phase: Type.String({ 
				description: "Phase to verify: init, plan, or build" 
			}),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const { phase } = params as { phase: string };
			
			let validation: { valid: boolean; missing: string[] };
			switch (phase) {
				case "init":
					validation = validateInitializerArtifacts(projectCwd);
					break;
				case "plan":
					validation = validatePlannerArtifacts(projectCwd);
					break;
				default:
					validation = { valid: false, missing: [`Unknown phase: ${phase}`] };
			}

			return {
				content: [{
					type: "text",
					text: validation.valid 
						? `✓ All artifacts present for ${phase}`
						: `✗ Missing artifacts: ${validation.missing.join(", ")}`
				}],
				details: validation,
			};
		},

		renderCall(args, theme) {
			const phase = (args as any).phase || "?";
			return new Text(
				theme.fg("toolTitle", theme.bold("verify_artifacts ")) +
				theme.fg("accent", phase),
				0, 0,
			);
		},

		renderResult(result, _options, theme) {
			const text = result.content[0];
			const isValid = text?.type === "text" && text.text.startsWith("✓");
			return new Text(
				theme.fg(isValid ? "success" : "error", text?.type === "text" ? text.text : ""),
				0, 0,
			);
		},
	});

	// ── verify_feature Tool ───────────────────────

	pi.registerTool({
		name: "verify_feature",
		label: "Verify Feature",
		description: "Run the test for a specific feature and update its status. Extension controls passes field. Supports TDD phases.",
		parameters: Type.Object({
			feature_id: Type.String({ description: "Feature ID to verify" }),
			phase: Type.Optional(Type.String({ 
				description: "TDD phase: red (test should fail) or green (test should pass)" 
			})),
		}),

		async execute(_toolCallId, params, _signal, onUpdate, _ctx) {
			const { feature_id, phase } = params as { feature_id: string; phase?: string };
			
			const list = readFeatureList(projectCwd);
			if (!list) {
				return {
					content: [{ type: "text", text: "✗ feature-list.json not found" }],
					details: { success: false, error: "feature-list.json not found" },
				};
			}

			const feature = list.features.find(f => f.id === feature_id);
			if (!feature) {
				return {
					content: [{ type: "text", text: `✗ Feature not found: ${feature_id}` }],
					details: { success: false, error: "Feature not found" },
				};
			}

			if (onUpdate) {
				onUpdate({
					content: [{ type: "text", text: `Running test for ${feature_id} (${phase || 'auto'})...` }],
					details: { feature_id, phase, status: "testing" },
				});
			}

			const testResult = await runTest(feature.test, projectCwd);

			const updates: Partial<Feature> = {
				passes: testResult.passes,
				attempts: feature.attempts + 1,
			};

			if (phase === "red") {
				updates.test_exists = true;
				updates.tdd_phase = "red";
				updates.status = "idle";  // reset so GREEN phase can be picked up
				updates.passes = false;
			} else if (phase === "green") {
				updates.implementation_exists = true;
				updates.tdd_phase = "green";
				updates.status = testResult.passes ? "done" : "failed";
			} else {
				updates.status = testResult.passes ? "done" : "failed";
			}

			updateFeatureStatus(projectCwd, feature_id, updates);

			appendSessionLog(projectCwd, "extension-verify", {
				intent: `Verify feature: ${feature_id}`,
				result: testResult.passes ? "PASSED" : "FAILED",
				features: [feature_id],
				duration: testResult.duration,
				errors: testResult.passes ? undefined : testResult.output.slice(0, 500),
				tdd_phase: phase as "red" | "green" | null,
			});

			return {
				content: [{
					type: "text",
					text: testResult.passes
						? `✓ ${feature_id}: PASSED (${testResult.duration}ms)`
						: `✗ ${feature_id}: FAILED\n\n${testResult.output.slice(0, 1000)}`
				}],
				details: {
					feature_id,
					phase,
					passes: testResult.passes,
					duration: testResult.duration,
					output: testResult.output,
				},
			};
		},

		renderCall(args, theme) {
			const featureId = (args as any).feature_id || "?";
			const phase = (args as any).phase;
			const phaseStr = phase ? ` (${phase})` : "";
			return new Text(
				theme.fg("toolTitle", theme.bold("verify_feature ")) +
				theme.fg("accent", featureId) +
				theme.fg("dim", phaseStr),
				0, 0,
			);
		},

		renderResult(result, _options, theme) {
			const text = result.content[0];
			const isSuccess = text?.type === "text" && text.text.startsWith("✓");
			return new Text(
				theme.fg(isSuccess ? "success" : "error", text?.type === "text" ? text.text : ""),
				0, 0,
			);
		},
	});

	// ── get_next_feature Tool ─────────────────────

	pi.registerTool({
		name: "get_next_feature",
		label: "Get Next Feature",
		description: "Get the next pending feature that has all dependencies satisfied. Includes TDD phase info.",
		parameters: Type.Object({}),

		async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
			const list = readFeatureList(projectCwd);
			if (!list) {
				return {
					content: [{ type: "text", text: "✗ feature-list.json not found" }],
					details: { error: "feature-list.json not found" },
				};
			}

			const next = getNextPendingFeature(list);
			const stats = getFeatureStats(list);

			if (!next) {
				return {
					content: [{
						type: "text",
						text: stats.done === stats.total
							? `✓ All features complete (${stats.done}/${stats.total})`
							: `⚠ No pending features with satisfied dependencies. Progress: ${stats.done}/${stats.total}`
					}],
					details: { complete: stats.done === stats.total, stats },
				};
			}

			const tddPhase = !next.test_exists ? "red" : !next.implementation_exists ? "green" : null;
			const phaseDesc = tddPhase === "red" ? "Write test first" 
				: tddPhase === "green" ? "Write implementation" 
				: "Verify";

			return {
				content: [{
					type: "text",
					text: `Next feature: ${next.id}\n` +
						`Description: ${next.desc}\n` +
						`TDD Phase: ${tddPhase || "N/A"} (${phaseDesc})\n` +
						`File: ${next.file || "N/A"}\n` +
						`Test file: ${next.test_file || "N/A"}\n` +
						`Template: ${next.template || "N/A"}\n` +
						`Test: ${next.test}\n` +
						`Dependencies: ${next.depends_on.length > 0 ? next.depends_on.join(", ") : "none"}\n` +
						`Progress: ${stats.done}/${stats.total}`
				}],
				details: { feature: next, stats, tddPhase },
			};
		},

		renderCall(_args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("get_next_feature")),
				0, 0,
			);
		},

		renderResult(result, _options, theme) {
			const text = result.content[0];
			return new Text(text?.type === "text" ? text.text : "", 0, 0);
		},
	});

	// ── Phase Execution Helpers ───────────────────

	async function runInitPhase(ctx: any, onUpdate: any): Promise<{ success: boolean; message: string; error?: string }> {
		initProgressMd(projectCwd);
		updateProgressState(projectCwd, { activeAgent: "api-initializer", phase: "init" });
		
		const result = await dispatchAgent("api-initializer", 
			"Read product-spec folder, generate feature list, Follow your agent instructions.", 
			ctx
		);

		if (result.exitCode !== 0) {
			updateProgressState(projectCwd, { overallHealth: "blocked" });
			return { success: false, message: "Initializer failed", error: result.output.slice(0, 500) };
		}

		const validation = validateInitializerArtifacts(projectCwd);
		if (!validation.valid) {
			updateProgressState(projectCwd, { overallHealth: "blocked" });
			return { 
				success: false, 
				message: "Missing artifacts", 
				error: `Initializer did not create required files: ${validation.missing.join(", ")}` 
			};
		}

		const featureStats = getFeatureStats(readFeatureList(projectCwd));
		updateProgressState(projectCwd, { 
			activeAgent: "none", 
			phase: "plan",
			featureProgress: `${featureStats.done}/${featureStats.total}`,
			overallHealth: "on-track"
		});

		appendSessionLog(projectCwd, "api-initializer", {
			intent: "Initialize API generation workflow",
			result: "completed",
			duration: result.elapsed,
		});

		return { success: true, message: "Product spec read, feature list generated" };
	}

	async function runPlanPhase(ctx: any, onUpdate: any): Promise<{ success: boolean; message: string; error?: string }> {
		const initValidation = validateInitializerArtifacts(projectCwd);
		if (!initValidation.valid) {
			return { 
				success: false, 
				message: "Prerequisites missing", 
				error: `Run init phase first. Missing: ${initValidation.missing.join(", ")}` 
			};
		}

		updateProgressState(projectCwd, { activeAgent: "api-planner", phase: "plan" });

		const result = await dispatchAgent("api-planner", 
			"Read feature list and templates, Create api-plan.md with variable mappings. This file is REQUIRED.", 
			ctx
		);

		if (result.exitCode !== 0) {
			updateProgressState(projectCwd, { overallHealth: "blocked" });
			return { success: false, message: "Planner failed", error: result.output.slice(0, 500) };
		}

		const validation = validatePlannerArtifacts(projectCwd);
		if (!validation.valid) {
			return { 
				success: false, 
				message: "Missing artifacts", 
				error: `Planner did not create api-plan.md. BUILD PHASE WILL BE BLOCKED.` 
			};
		}

		appendSessionLog(projectCwd, "api-planner", {
			intent: "Create implementation plan",
			result: "completed",
			duration: result.elapsed,
		});

		return { success: true, message: "Implementation plan created" };
	}

	async function runBuildPhase(ctx: any, onUpdate: any): Promise<{ success: boolean; message: string; error?: string }> {
		const planValidation = validatePlannerArtifacts(projectCwd);
		if (!planValidation.valid) {
			return { 
				success: false, 
				message: "Prerequisites missing", 
				error: `Run plan phase first. Missing: ${planValidation.missing.join(", ")}. BUILD BLOCKED.` 
			};
		}

		const list = readFeatureList(projectCwd);
		if (!list) {
			return { success: false, message: "No feature list", error: "feature-list.json not found" };
		}

		// Reset cached env so Docker availability is re-checked each build run
		cachedTestEnv = null;

		let built = 0;
		let failed = 0;
		let pending = 0;
		const startTime = Date.now();
		const triedThisSession = new Set<string>();

		while (hasPendingFeatures(readFeatureList(projectCwd), triedThisSession)) {
			const feature = getNextPendingFeature(readFeatureList(projectCwd), triedThisSession);
			if (!feature) break;
			triedThisSession.add(feature.id);

			const tddPhase = !feature.test_exists ? "red" : !feature.implementation_exists ? "green" : null;

			if (onUpdate) {
				onUpdate({
					content: [{ type: "text", text: `Building ${feature.id} (${tddPhase || "verify"})...` }],
					details: { feature: feature.id, tddPhase, status: "building" },
				});
			}

			// Snapshot files before builder runs
			const beforeFiles = verifyFeatureFiles(projectCwd, feature);

			updateFeatureStatus(projectCwd, feature.id, { status: "in_progress" });
			updateProgressState(projectCwd, {
				activeAgent: "api-builder",
				phase: "build",
				currentFeature: feature.id,
			});

			// verification_pending: both files exist, skip builder — just re-run test
			if (feature.status === "verification_pending" && tddPhase === null) {
				const testResult = await runTest(feature.test, projectCwd);
				const testUnavailable = testResult.exitCode !== 0 && (
					testResult.output.includes("command not found") ||
					testResult.output.includes("No module named") ||
					testResult.output.includes("pytest: not found") ||
					testResult.output.includes("docker: not found") ||
					testResult.output.includes("Error response from daemon") ||
					testResult.output.includes("container is not running") ||
					testResult.output.includes("No such service") ||
					testResult.output.includes("Cannot connect to the Docker daemon") ||
					testResult.exitCode === 127
				);
				if (testUnavailable) {
					updateFeatureStatus(projectCwd, feature.id, {
						status: "verification_pending",
						attempts: feature.attempts + 1,
					});
					pending++;
				} else {
					updateFeatureStatus(projectCwd, feature.id, {
						passes: testResult.passes,
						status: testResult.passes ? "done" : "failed",
						attempts: feature.attempts + 1,
					});
					if (testResult.passes) { built++; } else { failed++; }
				}
				continue;
			}

			let taskDesc: string;
			if (tddPhase === "red") {
				taskDesc = `TDD RED Phase: Write TEST for ${feature.id}\n\n` +
					`Test file: ${feature.test_file}\n` +
					`Template: ${feature.template || "N/A"}\n\n` +
					`Write the test file ONLY. Do NOT write implementation. STOP after writing test.`;
			} else if (tddPhase === "green") {
				taskDesc = `TDD GREEN Phase: Write IMPLEMENTATION for ${feature.id}\n\n` +
					`File: ${feature.file}\n` +
					`Template: ${feature.template || "N/A"}\n` +
					`Test file: ${feature.test_file}\n\n` +
					`Write implementation to pass the test. Do NOT run tests. STOP after writing implementation.`;
			} else {
				// Run diagnostic test to give builder actual failure context
				const diagnostic = await runTest(feature.test, projectCwd);
				const failSnippet = diagnostic.output.slice(-3000);
				taskDesc = `FIX failing tests for ${feature.id}\n\n` +
					`Implementation file: ${feature.file}\n` +
					`Test file: ${feature.test_file}\n\n` +
					`ACTUAL TEST OUTPUT (last run):\n\`\`\`\n${failSnippet}\n\`\`\`\n\n` +
					`Analyze the failure carefully:\n` +
					`1. If the IMPLEMENTATION is wrong: fix ${feature.file}\n` +
					`2. If the TEST has incorrect expectations (e.g., tests behavior the technology stack does not support, like bcrypt 72-char truncation): fix ${feature.test_file}\n` +
					`Fix whichever file is wrong. Do NOT run tests.`;
			}

			const buildResult = await dispatchAgent("api-builder", taskDesc, ctx);

			// Verify files after builder runs
			const afterFiles = verifyFeatureFiles(projectCwd, feature);
			const filesCreated = afterFiles.created.filter(f => !beforeFiles.created.includes(f));

			if (buildResult.exitCode !== 0) {
				updateFeatureStatus(projectCwd, feature.id, { 
					status: "failed", 
					attempts: feature.attempts + 1,
					test_exists: afterFiles.testExists,
					implementation_exists: afterFiles.implExists,
				});
				failed++;
				continue;
			}

			// Log file creation
			if (filesCreated.length > 0) {
				appendSessionLog(projectCwd, "api-builder", {
					intent: `Created files for ${feature.id}`,
					result: "files_created",
					features: [feature.id],
					duration: buildResult.elapsed,
					files_created: filesCreated,
				});
			}

			// Run test
			const testResult = await runTest(feature.test, projectCwd);

			// Detect if test infrastructure unavailable
			const testUnavailable = testResult.exitCode !== 0 && (
				testResult.output.includes("command not found") ||
				testResult.output.includes("No module named") ||
				testResult.output.includes("pytest: not found") ||
				testResult.output.includes("docker: not found") ||
				testResult.output.includes("Error response from daemon") ||
				testResult.output.includes("container is not running") ||
				testResult.output.includes("No such service") ||
					testResult.output.includes("Cannot connect to the Docker daemon") ||
				testResult.exitCode === 127
			);

			// Build updates based on actual file state
			const updates: Partial<Feature> = {
				attempts: feature.attempts + 1,
				test_exists: afterFiles.testExists,
				implementation_exists: afterFiles.implExists,
			};

			if (testUnavailable) {
				// FALLBACK: When tests can't run, use file verification
				updates.passes = false;  // Can't verify without tests
				updates.tdd_phase = tddPhase;

				if (tddPhase === "red") {
					// RED success = test file was written; no impl expected yet
					if (afterFiles.testExists) {
						updates.status = "idle";  // ready for GREEN phase
					} else {
						updates.status = "failed";
						failed++;
					}
				} else {
					// GREEN/verify success = both files must exist
					const allFilesExist = afterFiles.implExists && afterFiles.testExists;
					if (allFilesExist) {
						updates.status = "verification_pending";
						pending++;
					} else {
						updates.status = "failed";
						failed++;
					}
				}
			} else {
				// Normal path: tests run successfully
				if (tddPhase === "red") {
					updates.tdd_phase = "red";
					updates.passes = false;  // RED phase: no impl exists yet
					updates.status = afterFiles.testExists ? "idle" : "failed";  // idle → eligible for GREEN
					if (!afterFiles.testExists) failed++;
					// No built++ — feature needs GREEN phase next
				} else if (tddPhase === "green") {
					updates.tdd_phase = "green";
					updates.passes = testResult.passes;
					updates.status = testResult.passes ? "done" : "failed";
					if (testResult.passes) { built++; } else { failed++; }
				} else {
					updates.passes = testResult.passes;
					updates.status = testResult.passes ? "done" : "failed";
					if (testResult.passes) { built++; } else { failed++; }
				}
			}

			updateFeatureStatus(projectCwd, feature.id, updates);

			const updatedStats = getFeatureStats(readFeatureList(projectCwd));
			updateProgressState(projectCwd, {
				featureProgress: `${updatedStats.done}/${updatedStats.total}`,
			});

			// Commit if feature passed or verification pending
			if (updates.passes || updates.status === "verification_pending") {
				const commitResult = await commitFeature(projectCwd, feature);

				if (commitResult.committed) {
					appendSessionLog(projectCwd, "git", {
						intent: `Commit feature: ${feature.id}`,
						result: "committed",
						features: [feature.id],
						duration: 0,
						commits: [commitResult.hash || "unknown"],
					});
				}
			}
		}

		updateProgressState(projectCwd, {
			activeAgent: "none",
			currentFeature: "none",
			overallHealth: failed === 0 ? "on-track" : "blocked",
		});

		appendSessionLog(projectCwd, "api-builder", {
			intent: "Build API features with TDD",
			result: `built ${built}, pending ${pending}, failed ${failed}`,
			features: list.features.filter(f => f.status === "done" || f.status === "verification_pending").map(f => f.id),
			duration: Date.now() - startTime,
		});

		const failedIds = readFeatureList(projectCwd)?.features
			.filter(f => triedThisSession.has(f.id) && f.status === "failed")
			.map(f => f.id) ?? [];

		return {
			success: failed === 0,
			message: failed > 0
				? `Built ${built} features, ${pending} pending verification, ${failed} failed (${failedIds.join(", ")})`
				: `Built ${built} features, ${pending} pending verification, ${failed} failed`,
			error: failed > 0 ? `${failed} features failed: ${failedIds.join(", ")}` : undefined
		};
	}

	async function runTestPhase(ctx: any, onUpdate: any): Promise<{ success: boolean; message: string; error?: string }> {
		const result = await dispatchAgent("api-tester", 
			"Run full test suite with coverage. Report results. Do NOT update feature-list.json.", 
			ctx
		);

		if (result.exitCode !== 0) {
			return { success: false, message: "Tester failed", error: result.output.slice(0, 500) };
		}

		appendSessionLog(projectCwd, "api-tester", {
			intent: "Run end-to-end tests with coverage",
			result: "completed",
			duration: result.elapsed,
		});

		return { success: true, message: "All tests passed" };
	}

	// ── Commands ─────────────────────────────────

	pi.registerCommand("build-api", {
		description: "Start API generation workflow",
		handler: async (_args, ctx) => {
			widgetCtx = ctx;
			ctx.ui.notify(
				"Starting build-api workflow...\n\n" +
				"The orchestrator will dispatch to specialist agents:\n" +
				"1. api-initializer — Read product-spec, generate features\n" +
				"2. api-planner — Create implementation plan\n" +
				"3. api-builder — Implement features (TDD)\n" +
				"4. api-tester — Verify with coverage\n\n" +
				"Use run_workflow tool to start.",
				"info"
			);
		},
	});

	pi.registerCommand("build-api-status", {
		description: "Show current build-api progress",
		handler: async (_args, ctx) => {
			widgetCtx = ctx;

			if (existsSync(progressPath)) {
				const progress = parseProgressMd(readFileSync(progressPath, "utf-8"));
				if (progress) {
					ctx.ui.notify(
						`Build-API Status:\n\n` +
						`Phase: ${progress.phase}\n` +
						`Agent: ${progress.activeAgent}\n` +
						`Progress: ${progress.featureProgress}\n` +
						`Current: ${progress.currentFeature}\n` +
						`Health: ${progress.overallHealth}`,
						"info"
					);
					return;
				}
			}

			ctx.ui.notify("No progress.md found. Run api-initializer first.", "warning");
		},
	});

	pi.registerCommand("build-api-resume", {
	 description: "Resume build-api from last checkpoint",
        handler: async (_args, ctx) => {
            widgetCtx = ctx;

            if (!existsSync(progressPath)) {
                ctx.ui.notify("No progress.md found. Starting fresh...", "warning");
                return;
            }

            const progress = parseProgressMd(readFileSync(progressPath, "utf-8"));
            if (!progress) {
                ctx.ui.notify("Could not parse progress.md", "error");
                return;
            }

            ctx.ui.notify(
                `Resuming from:\n\n` +
                `Phase: ${progress.phase}\n` +
                `Agent: ${progress.activeAgent}\n` +
                `Progress: ${progress.featureProgress}\n\n` +
                `Use dispatch_agent to continue.`,
                "info"
            );
        },
    });

    pi.registerCommand("build-api-reset", {
        description: "Reset build-api (clears all session data)",
        handler: async (_args, ctx) => {
            widgetCtx = ctx;

            const sessDir = join(ctx.cwd, ".pi", "agent-sessions");
            if (existsSync(sessDir)) {
                for (const f of readdirSync(sessDir)) {
                    if (f.endsWith(".json")) {
                        try { unlinkSync(join(sessDir, f)); } catch {}
                    }
                }
            }

            const artifacts = ['api-plan.md', 'api-spec.md', 'feature-list.json', 'detected-conventions.json', 'progress.md'];
            for (const artifact of artifacts) {
                const path = join(ctx.cwd, artifact);
                if (existsSync(path)) {
                    try { unlinkSync(path); } catch {}
                }
            }

            ctx.ui.notify("Cleared all sessions and artifacts. Ready to start fresh.", "info");
        },
    });

	// ── System Prompt Override ───────────────────

	pi.on("before_agent_start", async (_event, _ctx) => {
		let currentPhase = "init";
		let nextInstructions = "";

		if (existsSync(progressPath)) {
			const progress = parseProgressMd(readFileSync(progressPath, "utf-8"));
			if (progress) {
				currentPhase = progress.phase;
				
				const content = readFileSync(progressPath, "utf-8");
				const instructionsMatch = content.match(/### Next Session Instructions\n([\s\S]*?)(?=\n---|\n##|$)/);
				if (instructionsMatch) {
					nextInstructions = instructionsMatch[1].trim();
				}
			}
		}

		const agentCatalog = Array.from(agentStates.values())
			.map(s => `### ${displayName(s.def.name)}\n**Dispatch as:** \`${s.def.name}\`\n**Phase:** ${s.phase.toUpperCase()}\n${s.def.description}\n**Tools:** ${s.def.tools}`)
			.join("\n\n");

		let progressSummary = "No progress yet. Start with api-initializer.";
		if (existsSync(progressPath)) {
			const progress = parseProgressMd(readFileSync(progressPath, "utf-8"));
			if (progress) {
				progressSummary = `Phase: ${progress.phase}, Progress: ${progress.featureProgress}, Health: ${progress.overallHealth}`;
			}
		}

		return {
			systemPrompt: `You are the build-api orchestrator. You coordinate specialist agents to generate REST API code with TDD enforcement.

## CRITICAL: Mechanical Enforcement + TDD

The EXTENSION controls the workflow, Agents follow TDD:

- **Extension validates artifacts** — Missing api-plan.md will block build phase
- **Extension dispatches per-feature** — Builder implements ONE feature per session
- **Extension runs tests** — Agent writes code, extension verifies and sets passes:true
- **TDD enforced** — Each feature goes through RED (write test) → GREEN (write impl)
- **Extension logs sessions** — Session log is append-only, managed by extension

## TDD Workflow

For each feature:

1. **RED Phase**: Builder writes TEST only (no implementation)
   - Extension verifies test fails (or passes if no impl needed)
   - Extension sets test_exists: true, tdd_phase: "red"

2. **GREEN Phase**: Builder writes IMPLEMENTATION
   - Extension runs test
   - Extension sets passes: true/false, tdd_phase: "green"

## Tools

Use these tools in order:

1. \`run_workflow\` — Execute full workflow with enforcement (recommended)
2. \`verify_artifacts\` — Check required files exist for a phase
3. \`get_next_feature\` — Get next pending feature with TDD phase info
4. \`verify_feature\` — Run test for a feature (extension controls passes)
5. \`dispatch_agent\` — Low-level agent dispatch (phases still enforced)

## Current State

${progressSummary}

${nextInstructions ? `## Next Session Instructions\n${nextInstructions}\n` : ""}

## Workflow

1. **INIT** — api-initializer
   - Extension validates: detected-conventions.json, feature-list.json, api-spec.md, progress.md
   - Missing files = ERROR, workflow stops

2. **PLAN** — api-planner
   - Extension validates: api-plan.md exists
   - Missing file = ERROR, workflow stops

3. **BUILD** — api-builder (per-feature loop with TDD)
   - Extension checks TDD phase (red or green)
   - For RED: Agent writes test, extension verifies
   - For GREEN: Agent writes implementation, extension runs test
   - Extension sets passes:true or false
   - Extension loops to next feature

4. **TEST** — api-tester
   - Agent runs full test suite with coverage
   - Extension logs results

## How to Work

**Recommended:** Use \`run_workflow\` with phase="all" for full automation.

**Manual:** Use \`get_next_feature\` → \`dispatch_agent\` → \`verify_feature\` per feature.

## Files

- progress.md — Session state (extension appends log)
- feature-list.json — Feature status with TDD fields (extension controls)
- api-plan.md — Implementation plan (planner writes, extension validates)
- detected-conventions.json — Code style detection (initializer writes)`,
		};
	});

	// ── Session Start ────────────────────────────

	pi.on("session_start", async (_event, _ctx) => {
		widgetCtx = _ctx;
		contextWindow = _ctx.model?.contextWindow || 0;

		const sessDir = join(_ctx.cwd, ".pi", "agent-sessions");
		if (existsSync(sessDir)) {
			for (const f of readdirSync(sessDir)) {
				if (f.endsWith(".json")) {
					try { unlinkSync(join(sessDir, f)); } catch {}
				}
			}
		}

		loadAgents(_ctx.cwd);

		if (agentStates.size === 0) {
			_ctx.ui.notify("No agents found. Check .pi/agents/api-*.md files.", "warning");
			return;
		}

		pi.setActiveTools(["run_workflow", "verify_artifacts", "get_next_feature", "verify_feature", "dispatch_agent"]);

		let resumeMsg = "";
		if (existsSync(progressPath)) {
			const progress = parseProgressMd(readFileSync(progressPath, "utf-8"));
			if (progress) {
				resumeMsg = `\n\nFound existing progress:\nPhase: ${progress.phase}\nProgress: ${progress.featureProgress}\nUse /build-api-resume to continue.`;
			}
		}

		_ctx.ui.setStatus("build-api", `Build-API (${agentStates.size} agents)`);
		_ctx.ui.notify(
			`Build-API Workflow Ready\n\n` +
			`Agents: ${Array.from(agentStates.values()).map(s => displayName(s.def.name)).join(" → ")}\n\n` +
			`TDD Enforcement: RED → GREEN per feature\n\n` +
			`Commands:\n` +
			`/build-api         Start workflow\n` +
			`/build-api-status  Show progress\n` +
			`/build-api-resume  Resume from checkpoint${resumeMsg}`,
			"info"
		);

		updateWidget();

		_ctx.ui.setFooter((_tui, theme, _footerData) => ({
			dispose: () => {},
			invalidate() {},
			render(width: number): string[] {
				const model = _ctx.model?.id || "no-model";
				const usage = _ctx.getContextUsage();
				const pct = usage ? usage.percent : 0;
				const filled = Math.round(pct / 10);
				const bar = "#".repeat(filled) + "-".repeat(10 - filled);

				const left = theme.fg("dim", ` ${model}`) +
					theme.fg("muted", " · ") +
					theme.fg("accent", "build-api");
				const right = theme.fg("dim", `[${bar}] ${Math.round(pct)}% `);
				const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));

				return [truncateToWidth(left + pad + right, width)];
			},
		}));
	});
}
