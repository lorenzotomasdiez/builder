/**
 * Build-Infra — Infrastructure generation orchestrator
 *
 * Orchestrates a sequential workflow of specialist agents that generate
 * complete infrastructure for FastAPI + Celery + PostgreSQL + Redis + Astro projects.
 *
 * Workflow: initializer → planner → builder → tester
 *
 * Agents are defined in .pi/agents/infra-*.md
 * Team is defined in .pi/agents/build-infra.yaml
 *
 * Progress is tracked via:
 * - progress.md (session state, handoff instructions)
 * - feature-list.json (feature completion status)
 *
 * Commands:
 *   /build-infra         — Start infrastructure generation
 *   /build-infra-status  — Show current progress
 *   /build-infra-resume  — Resume from last checkpoint
 *
 * Usage: pi -e extensions/build-infra.ts
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { spawn, exec } from "child_process";
import { readdirSync, readFileSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

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
	file: string;
	template: string;
	test: string;
	depends_on: string[];
	passes: boolean;
	status: "idle" | "in_progress" | "done" | "failed" | "skipped";
	attempts: number;
	skip: boolean;
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
				if (!file.startsWith("infra-")) continue;
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
	const done = list.features.filter(f => f.status === "done" || f.passes).length;
	const current = list.features.find(f => f.status === "in_progress")?.id || "none";
	
	return { done, total, current };
}

// ── Artifact Validation ─────────────────────────

function validateInitializerArtifacts(cwd: string): { valid: boolean; missing: string[] } {
	const required = ['detected-stack.json', 'feature-list.json', 'infra-spec.md', 'progress.md'];
	const missing = required.filter(f => !existsSync(join(cwd, f)));
	return { valid: missing.length === 0, missing };
}

function validatePlannerArtifacts(cwd: string): { valid: boolean; missing: string[] } {
	const required = ['infra-plan.md'];
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

function getNextPendingFeature(list: FeatureList | null): Feature | null {
	if (!list) return null;
	
	return list.features.find(f => 
		f.status === "idle" && 
		!f.passes && 
		!f.skip &&
		f.depends_on.every(depId => {
			const dep = list.features.find(d => d.id === depId);
			return dep && dep.passes;
		})
	) || null;
}

function hasPendingFeatures(list: FeatureList | null): boolean {
	return getNextPendingFeature(list) !== null;
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

// ── Test Runner ────────────────────────────────

async function runTest(testCommand: string, cwd: string): Promise<TestResult> {
	const startTime = Date.now();
	try {
		const { stdout, stderr } = await execAsync(testCommand, {
			cwd,
			timeout: 120000, // 2 minute timeout
			maxBuffer: 1024 * 1024 * 10, // 10MB buffer
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
	}
): void {
	const path = join(cwd, 'progress.md');
	if (!existsSync(path)) return;
	
	const existing = readFileSync(path, 'utf-8');
	
	// Extract existing session log content
	const logMatch = existing.match(/(## Session Log[\s\S]*)$/);
	const existingLog = logMatch ? logMatch[1] : '## Session Log\n';
	
	// Create new entry
	const timestamp = new Date().toISOString();
	const entry = `\n### ${timestamp} — ${agentName}\n` +
		`- **Intent**: ${data.intent}\n` +
		(data.features ? `- **Features**: ${data.features.join(', ')}\n` : '') +
		`- **Result**: ${data.result}\n` +
		`- **Duration**: ${Math.round(data.duration / 1000)}s\n` +
		(data.commits && data.commits.length > 0 ? `- **Commits**: ${data.commits.join(', ')}\n` : '') +
		(data.errors ? `- **Errors**: ${data.errors}\n` : '- **Errors**: none\n');
	
	// Replace session log section
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

		const teamPath = join(cwd, ".pi", "agents", "build-infra.yaml");
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

		widgetCtx.ui.setWidget("build-infra", (_tui: any, theme: any) => {
			const text = new Text("", 0, 1);

			return {
				render(width: number): string[] {
					if (agentStates.size === 0) {
						text.setText(theme.fg("dim", "No agents loaded. Check .pi/agents/"));
						return text.render(width);
					}

					// Read current state
					let progress: ProgressState | null = null;
					let featureStats = { done: 0, total: 0, current: "none" };

					if (existsSync(progressPath)) {
						progress = parseProgressMd(readFileSync(progressPath, "utf-8"));
					}

					if (existsSync(featureListPath)) {
						featureStats = getFeatureStats(parseFeatureList(readFileSync(featureListPath, "utf-8")));
					}

					const lines: string[] = [];

					// Phase indicators
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

					// Feature progress (during build phase)
					const buildState = Array.from(agentStates.values()).find(s => s.phase === "build");
					if (buildState && featureStats.total > 0) {
						const progressStr = `Features: ${featureStats.done}/${featureStats.total}`;
						const currentStr = featureStats.current !== "none" ? ` (${featureStats.current})` : "";
						lines.push(theme.fg("muted", progressStr + currentStr));
					}

					// Current agent status
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

					// Health status from progress.md
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
		description: "Dispatch a task to a specialist agent in the build-infra workflow. Use infra-initializer, infra-planner, infra-builder, or infra-tester.",
		parameters: Type.Object({
			agent: Type.String({ description: "Agent name: infra-initializer, infra-planner, infra-builder, or infra-tester" }),
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
		description: "Execute the full build-infra workflow with mechanical enforcement. Validates artifacts, runs tests, and controls feature dispatch. Use this instead of dispatch_agent for automated execution.",
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
		description: "Run the test for a specific feature and update its status. Extension controls passes field.",
		parameters: Type.Object({
			feature_id: Type.String({ description: "Feature ID to verify" }),
		}),

		async execute(_toolCallId, params, _signal, onUpdate, _ctx) {
			const { feature_id } = params as { feature_id: string };
			
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
					content: [{ type: "text", text: `Running test for ${feature_id}...` }],
					details: { feature_id, status: "testing" },
				});
			}

			// Extension runs the test
			const testResult = await runTest(feature.test, projectCwd);

			// Extension updates feature status
			updateFeatureStatus(projectCwd, feature_id, {
				passes: testResult.passes,
				status: testResult.passes ? "done" : "failed",
				attempts: feature.attempts + 1,
			});

			// Append to session log
			appendSessionLog(projectCwd, "extension-verify", {
				intent: `Verify feature: ${feature_id}`,
				result: testResult.passes ? "PASSED" : "FAILED",
				features: [feature_id],
				duration: testResult.duration,
				errors: testResult.passes ? undefined : testResult.output.slice(0, 500),
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
					passes: testResult.passes,
					duration: testResult.duration,
					output: testResult.output,
				},
			};
		},

		renderCall(args, theme) {
			const featureId = (args as any).feature_id || "?";
			return new Text(
				theme.fg("toolTitle", theme.bold("verify_feature ")) +
				theme.fg("accent", featureId),
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
		description: "Get the next pending feature that has all dependencies satisfied.",
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

			return {
				content: [{
					type: "text",
					text: `Next feature: ${next.id}\n` +
						`Description: ${next.desc}\n` +
						`File: ${next.file}\n` +
						`Template: ${next.template}\n` +
						`Test: ${next.test}\n` +
						`Dependencies: ${next.depends_on.length > 0 ? next.depends_on.join(", ") : "none"}`
				}],
				details: { feature: next, stats },
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
		const result = await dispatchAgent("infra-initializer", 
			"Detect stack, generate feature list, create specs. Follow your agent instructions.", 
			ctx
		);

		if (result.exitCode !== 0) {
			return { success: false, message: "Initializer failed", error: result.output.slice(0, 500) };
		}

		// Validate artifacts
		const validation = validateInitializerArtifacts(projectCwd);
		if (!validation.valid) {
			return { 
				success: false, 
				message: "Missing artifacts", 
				error: `Initializer did not create required files: ${validation.missing.join(", ")}` 
			};
		}

		appendSessionLog(projectCwd, "infra-initializer", {
			intent: "Initialize infrastructure workflow",
			result: "completed",
			duration: result.elapsed,
		});

		return { success: true, message: "Stack detected, feature list generated" };
	}

	async function runPlanPhase(ctx: any, onUpdate: any): Promise<{ success: boolean; message: string; error?: string }> {
		// Check prerequisites
		const initValidation = validateInitializerArtifacts(projectCwd);
		if (!initValidation.valid) {
			return { 
				success: false, 
				message: "Prerequisites missing", 
				error: `Run init phase first. Missing: ${initValidation.missing.join(", ")}` 
			};
		}

		const result = await dispatchAgent("infra-planner", 
			"Read feature list and templates, create implementation plan with variable mappings. Follow your agent instructions.", 
			ctx
		);

		if (result.exitCode !== 0) {
			return { success: false, message: "Planner failed", error: result.output.slice(0, 500) };
		}

		// Validate artifacts
		const validation = validatePlannerArtifacts(projectCwd);
		if (!validation.valid) {
			return { 
				success: false, 
				message: "Missing artifacts", 
				error: `Planner did not create infra-plan.md` 
			};
		}

		appendSessionLog(projectCwd, "infra-planner", {
			intent: "Create implementation plan",
			result: "completed",
			duration: result.elapsed,
		});

		return { success: true, message: "Implementation plan created" };
	}

	async function runBuildPhase(ctx: any, onUpdate: any): Promise<{ success: boolean; message: string; error?: string }> {
		// Check prerequisites
		const planValidation = validatePlannerArtifacts(projectCwd);
		if (!planValidation.valid) {
			return { 
				success: false, 
				message: "Prerequisites missing", 
				error: `Run plan phase first. Missing: ${planValidation.missing.join(", ")}` 
			};
		}

		const list = readFeatureList(projectCwd);
		if (!list) {
			return { success: false, message: "No feature list", error: "feature-list.json not found" };
		}

		let built = 0;
		let failed = 0;
		const startTime = Date.now();

		while (hasPendingFeatures(readFeatureList(projectCwd))) {
			const feature = getNextPendingFeature(readFeatureList(projectCwd));
			if (!feature) break;

			if (onUpdate) {
				onUpdate({
					content: [{ type: "text", text: `Building ${feature.id}...` }],
					details: { feature: feature.id, status: "building" },
				});
			}

			// Mark as in_progress
			updateFeatureStatus(projectCwd, feature.id, { status: "in_progress" });

			// Dispatch builder for ONE feature
			const buildResult = await dispatchAgent("infra-builder", 
				`Implement feature: ${feature.id}\n\nFile: ${feature.file}\nTemplate: ${feature.template}\n\nWrite the file, then STOP. Do NOT run tests or update feature-list.json passes field.`, 
				ctx
			);

			if (buildResult.exitCode !== 0) {
				updateFeatureStatus(projectCwd, feature.id, { 
					status: "failed", 
					attempts: feature.attempts + 1 
				});
				failed++;
				// Continue to next feature
				continue;
			}

			// Extension runs the test
			const testResult = await runTest(feature.test, projectCwd);

			// Extension updates status
			updateFeatureStatus(projectCwd, feature.id, {
				passes: testResult.passes,
				status: testResult.passes ? "done" : "failed",
				attempts: feature.attempts + 1,
			});

			if (testResult.passes) {
				built++;
			} else {
				failed++;
			}
		}

		appendSessionLog(projectCwd, "infra-builder", {
			intent: "Build infrastructure features",
			result: `built ${built}, failed ${failed}`,
			features: list.features.filter(f => f.status === "done").map(f => f.id),
			duration: Date.now() - startTime,
		});

		return { 
			success: failed === 0, 
			message: `Built ${built} features, ${failed} failed`,
			error: failed > 0 ? `${failed} features failed` : undefined
		};
	}

	async function runTestPhase(ctx: any, onUpdate: any): Promise<{ success: boolean; message: string; error?: string }> {
		const result = await dispatchAgent("infra-tester", 
			"Run end-to-end tests. Start docker-compose, run health checks, report status. Do NOT update passes field in feature-list.json.", 
			ctx
		);

		if (result.exitCode !== 0) {
			return { success: false, message: "Tester failed", error: result.output.slice(0, 500) };
		}

		appendSessionLog(projectCwd, "infra-tester", {
			intent: "Run end-to-end tests",
			result: "completed",
			duration: result.elapsed,
		});

		return { success: true, message: "All tests passed" };
	}

	// ── Commands ─────────────────────────────────

	pi.registerCommand("build-infra", {
		description: "Start infrastructure generation workflow",
		handler: async (_args, ctx) => {
			widgetCtx = ctx;
			ctx.ui.notify(
				"Starting build-infra workflow...\n\n" +
				"The orchestrator will dispatch to specialist agents:\n" +
				"1. infra-initializer — Detect stack, generate feature list\n" +
				"2. infra-planner — Create implementation plan\n" +
				"3. infra-builder — Implement features\n" +
				"4. infra-tester — Verify end-to-end\n\n" +
				"Use dispatch_agent tool to start.",
				"info"
			);
		},
	});

	pi.registerCommand("build-infra-status", {
		description: "Show current build-infra progress",
		handler: async (_args, ctx) => {
			widgetCtx = ctx;

			if (existsSync(progressPath)) {
				const progress = parseProgressMd(readFileSync(progressPath, "utf-8"));
				if (progress) {
					ctx.ui.notify(
						`Build-Infra Status:\n\n` +
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

			ctx.ui.notify("No progress.md found. Run infra-initializer first.", "warning");
		},
	});

	pi.registerCommand("build-infra-resume", {
		description: "Resume build-infra from last checkpoint",
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

	// ── System Prompt Override ───────────────────

	pi.on("before_agent_start", async (_event, _ctx) => {
		// Read progress to determine current phase
		let currentPhase = "init";
		let nextInstructions = "";

		if (existsSync(progressPath)) {
			const progress = parseProgressMd(readFileSync(progressPath, "utf-8"));
			if (progress) {
				currentPhase = progress.phase;
				
				// Extract next session instructions
				const content = readFileSync(progressPath, "utf-8");
				const instructionsMatch = content.match(/### Next Session Instructions\n([\s\S]*?)(?=\n---|\n##|$)/);
				if (instructionsMatch) {
					nextInstructions = instructionsMatch[1].trim();
				}
			}
		}

		// Build agent catalog
		const agentCatalog = Array.from(agentStates.values())
			.map(s => `### ${displayName(s.def.name)}\n**Dispatch as:** \`${s.def.name}\`\n**Phase:** ${s.phase.toUpperCase()}\n${s.def.description}\n**Tools:** ${s.def.tools}`)
			.join("\n\n");

		// Build progress summary
		let progressSummary = "No progress yet. Start with infra-initializer.";
		if (existsSync(progressPath)) {
			const progress = parseProgressMd(readFileSync(progressPath, "utf-8"));
			if (progress) {
				progressSummary = `Phase: ${progress.phase}, Progress: ${progress.featureProgress}, Health: ${progress.overallHealth}`;
			}
		}

		return {
			systemPrompt: `You are the build-infra orchestrator. You coordinate specialist agents to generate complete infrastructure for FastAPI + Astro projects.

## CRITICAL: Mechanical Enforcement

The EXTENSION controls the workflow, not agents:

- **Extension validates artifacts** — Missing infra-plan.md will block build phase
- **Extension dispatches per-feature** — Builder implements ONE feature, extension loops
- **Extension runs tests** — Agent writes code, extension verifies and sets passes:true
- **Extension logs sessions** — Session log is append-only, managed by extension

## Tools

Use these tools in order:

1. \`run_workflow\` — Execute full workflow with enforcement (recommended)
2. \`verify_artifacts\` — Check required files exist for a phase
3. \`get_next_feature\` — Get next pending feature with dependencies satisfied
4. \`verify_feature\` — Run test for a feature (extension controls passes)
5. \`dispatch_agent\` — Low-level agent dispatch (phases still enforced)

## Current State

${progressSummary}

${nextInstructions ? `## Next Session Instructions\n${nextInstructions}\n` : ""}

## Workflow

1. **INIT** — infra-initializer
   - Extension validates: detected-stack.json, feature-list.json, infra-spec.md, progress.md
   - Missing files = ERROR, workflow stops

2. **PLAN** — infra-planner
   - Extension validates: infra-plan.md exists
   - Missing file = ERROR, workflow stops

3. **BUILD** — infra-builder (per-feature loop)
   - Extension marks feature in_progress
   - Agent writes file, then STOPS
   - Extension runs test
   - Extension sets passes:true or false
   - Extension loops to next feature

4. **TEST** — infra-tester
   - Agent runs health checks
   - Extension logs results

## How to Work

**Recommended:** Use \`run_workflow\` with phase="all" for full automation.

**Manual:** Use \`get_next_feature\` → \`dispatch_agent\` → \`verify_feature\` per feature.

## Files

- progress.md — Session state (extension appends log)
- feature-list.json — Feature status (extension controls passes)
- infra-plan.md — Implementation plan (planner writes, extension validates)
- detected-stack.json — Stack detection (initializer writes)`,
		};
	});

	// ── Session Start ────────────────────────────

	pi.on("session_start", async (_event, _ctx) => {
		widgetCtx = _ctx;
		contextWindow = _ctx.model?.contextWindow || 0;

		// Clear old session files
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
			_ctx.ui.notify("No agents found. Check .pi/agents/infra-*.md files.", "warning");
			return;
		}

		pi.setActiveTools(["run_workflow", "verify_artifacts", "get_next_feature", "verify_feature", "dispatch_agent"]);

		// Check for existing progress
		let resumeMsg = "";
		if (existsSync(progressPath)) {
			const progress = parseProgressMd(readFileSync(progressPath, "utf-8"));
			if (progress) {
				resumeMsg = `\n\nFound existing progress:\nPhase: ${progress.phase}\nProgress: ${progress.featureProgress}\nUse /build-infra-resume to continue.`;
			}
		}

		_ctx.ui.setStatus("build-infra", `Build-Infra (${agentStates.size} agents)`);
		_ctx.ui.notify(
			`Build-Infra Workflow Ready\n\n` +
			`Agents: ${Array.from(agentStates.values()).map(s => displayName(s.def.name)).join(" → ")}\n\n` +
			`Commands:\n` +
			`/build-infra         Start workflow\n` +
			`/build-infra-status  Show progress\n` +
			`/build-infra-resume  Resume from checkpoint${resumeMsg}`,
			"info"
		);

		updateWidget();

		// Footer
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
					theme.fg("accent", "build-infra");
				const right = theme.fg("dim", `[${bar}] ${Math.round(pct)}% `);
				const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));

				return [truncateToWidth(left + pad + right, width)];
			},
		}));
	});
}
