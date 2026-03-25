# Bowser Workflow Examples

## Example User Stories

### E-commerce (HackerNews)

```yaml
stories:
  - name: "Front page loads with posts"
    url: "https://news.ycombinator.com/"
    workflow: |
      Navigate to https://news.ycombinator.com/
      Verify the front page loads successfully
      Verify at least 10 posts are visible, each with a title and a link

  - name: "Navigate to page two and back"
    url: "https://news.ycombinator.com/"
    workflow: |
      Navigate to https://news.ycombinator.com/
      Verify the front page loads with posts
      Click the 'More' link at the bottom of the page
      Verify page 2 loads with a new set of posts
      Click the browser back button
      Verify page 1 loads again with the original posts

  - name: "View top post comments"
    url: "https://news.ycombinator.com/"
    workflow: |
      Navigate to https://news.ycombinator.com/
      Verify the front page loads with posts
      Click the first post's comments link
      Verify the comments page loads
      Verify at least one comment is visible
```

### Local App (Generic)

```yaml
stories:
  - name: "Homepage loads with navigation"
    url: "http://localhost:3000"
    workflow: |
      Navigate to http://localhost:3000
      Verify the homepage loads successfully
      Verify a navigation bar is visible with at least 3 links
      Verify a hero section or main content area is present

  - name: "Login flow completes"
    url: "http://localhost:3000/login"
    workflow: |
      Navigate to http://localhost:3000/login
      Verify the login page loads with email and password fields
      Fill in email with "test@example.com"
      Fill in password with "password123"
      Click the login/submit button
      Verify the page redirects to a dashboard or authenticated view
```

## Example Automation Workflows

### Amazon Add-to-Cart

**Skill:** claude-bowser (needs real Chrome, already logged in)
**Mode:** headed (visible browser)

```
1. Navigate to https://www.amazon.com
2. Verify homepage loads (search bar visible)
3. Search for: {PROMPT}
4. Verify search results appear
5. Click first relevant result
6. Verify product detail page loads with title, price, "Add to Cart" button
7. Click "Add to Cart"
8. Verify cart confirmation appears
9. Click "Proceed to checkout" or navigate to cart
10. Verify checkout page loads with item visible
11. STOP — do not submit order
12. Report: item name, price, checkout confirmation
```

### Blog Summarizer

**Skill:** playwright-bowser (headless, no auth needed)
**Mode:** headless

```
1. Navigate to: {PROMPT}
2. Verify blog loads (article titles or post listings)
3. Identify most recent blog post
4. Click into latest post
5. Verify full post content loads
6. Read post title, date, and body content
7. Summarize post in 3-5 bullet points
8. Rate post out of 10 (relevance, depth, clarity)
9. Report: post title, date, summary bullets, rating
```

## Justfile Recipes

```just
# Layer 1 — Skill tests
test-playwright-skill prompt='Navigate to https://news.ycombinator.com and verify it loads':
  claude -p "Execute /playwright-bowser {{prompt}}"

test-chrome-skill prompt='Navigate to https://news.ycombinator.com and verify it loads':
  claude --chrome -p "Execute /claude-bowser {{prompt}}"

# Layer 2 — Agent tests
test-playwright-agent prompt='Navigate to https://news.ycombinator.com and verify it loads':
  claude -p "Spawn a playwright-bowser-agent with prompt: {{prompt}}"

test-chrome-agent prompt='Navigate to https://news.ycombinator.com and verify it loads':
  claude --chrome -p "Spawn a chrome-bowser-agent with prompt: {{prompt}}"

test-qa story='Front page loads with posts' url='https://news.ycombinator.com/':
  claude -p "Spawn a bowser-qa-agent for story '{{story}}' at {{url}}"

# Layer 3 — Orchestration
hop workflow prompt='':
  claude -p "/bowser:hop-automate {{workflow}} {{prompt}}"

ui-review *args='':
  claude -p "/ui-review {{args}}"

# Layer 4 — Ready-made automations
automate-amazon items='wireless earbuds':
  just hop amazon-add-to-cart "{{items}}" claude headed

summarize-blog url='https://example.com/blog':
  just hop blog-summarizer "{{url}}" playwright headless
```
