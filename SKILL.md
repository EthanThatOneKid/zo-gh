---
name: zo-gh
description: >
  Zo GitHub Webhook Agent — event-driven autonomous agents triggered by GitHub
  repository activity. Fires Zo agents via /zo/ask on push, PR, issues, workflow
  runs, and more. No polling, no timers. The live handler is
  webhook-agent/api-github-webhook.ts; copy that file (and any siblings under
  webhook-agent/) into the user’s Zo Space as POST /api/github-webhook — repo-root
  scripts/ only register webhooks and send synthetic pings. Use this skill to set up,
  configure, and customize webhook agents for one repo, multiple repos, or an entire
  GitHub organization. Created for Zo Computer.
metadata:
  author: etok.zo.computer
  topics:
    - github
    - webhooks
    - automation
    - agents
    - ci-cd
compatibility: "Created for Zo Computer"
---

# zo-gh — GitHub Webhook Agent

Event-driven autonomous agents triggered by GitHub activity. When any GitHub
event fires, your Zo agent analyzes, logs, and responds — with zero polling.

**Live endpoint:** `https://etok.zo.space/api/github-webhook` **Repo:**
`https://github.com/EthanThatOneKid/zo-gh`

---

## What this skill does

```
GitHub event fires (push, PR, issue, workflow, etc.)
  → POST to https://etok.zo.space/api/github-webhook
    → HMAC signature verified
    → Event parsed, agent prompt built
      → Autonomous Zo agent dispatched via /zo/ask
        → Agent analyzes, logs, and responds
```

| Event           | What the agent does                                                         |
| --------------- | --------------------------------------------------------------------------- |
| `ping`          | GitHub hook validation; handler returns success (no `/zo/ask` in reference) |
| `push`          | Summarizes commits, flags authors                                           |
| `pull_request`  | Reviews PR description, flags missing info, suggests reviewers              |
| `issues`        | Triage: bug vs feature vs question, suggests labels + priority              |
| `workflow_run`  | Summarizes CI/CD status, notes failures                                     |
| `issue_comment` | Contextual analysis of the comment                                          |
| `release`       | Summarizes release notes and flags contributors                             |
| `*` (any event) | Catch-all: logs and summarizes raw event                                    |

The reference **`webhook-agent/api-github-webhook.ts`** implements `ping`,
`push`, `pull_request`, `issues`, and `workflow_run` (with `/zo/ask` except
`ping`). Rows such as `issue_comment`, `release`, and generic `*` describe
common extensions — add matching `switch` cases in that file if you want agent
behavior for those events.

---

## Space route implementation (for agents)

The **HTTP webhook handler** is **not** in `scripts/`. Treat these paths
distinctly:

| Artifact      | Repo path                                                     | Role                                                                                                                      |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Webhook route | `webhook-agent/api-github-webhook.ts`                         | Hono `Context` handler: `X-Hub-Signature-256`, `X-GitHub-Event`, JSON body, dispatches to `/zo/ask` for supported events. |
| CLI helpers   | `scripts/register-webhook.sh`, `scripts/send-test-webhook.ts` | Register GitHub webhooks and send synthetic payloads **to** your endpoint; they do not implement the route.               |

**When reproducing this on the user’s Zo Space**, do this in order:

1. **Copy or sync** `webhook-agent/api-github-webhook.ts` from
   `https://github.com/EthanThatOneKid/zo-gh` (or the user’s fork) into their
   Space so it is exposed as **`POST /api/github-webhook`**. Keep the **same
   filename** as the reference unless Zo’s docs for their Space explicitly
   require a different convention.
2. If new files appear under `webhook-agent/` (for example in-space docs or
   shared modules), copy those **together** with the handler so behavior stays
   aligned with upstream.
3. **Do not** satisfy “implement the webhook” by only adding `scripts/` — those
   never replace the TypeScript route.
4. After the route is live, continue with secrets, webhook registration, and
   `bun scripts/send-test-webhook.ts ping` as in the scenarios below.

---

## Deployment scenarios

### Scenario A — Single repository

You want one repo's events to trigger your Zo agent.

**Steps:**

1. **Install the route** in the Zo Space (see **Space route implementation**
   above).
2. **Register the webhook** (one repo):

   ```bash
   export GITHUB_WEBHOOK_SECRET="your-secret"
   export GITHUB_TOKEN="ghp_your_token"
   ./scripts/register-webhook.sh <owner> <repo>
   ```

3. **Save secrets** in
   [Zo Settings → Advanced → Secrets](/?t=settings&s=advanced):
   - `GITHUB_WEBHOOK_SECRET` — the value you entered in GitHub
   - `ZO_API_KEY` — from
     [Settings → Advanced → Access Tokens](/?t=settings&s=advanced)

4. **Ping without touching GitHub:**

   ```bash
   bun scripts/send-test-webhook.ts ping
   bun scripts/send-test-webhook.ts push
   bun scripts/send-test-webhook.ts pull_request
   bun scripts/send-test-webhook.ts issues
   ```

5. **Trigger a real event:**
   ```bash
   git commit -m "test" --allow-empty && git push
   ```

Done. That one repo now drives your Zo agent on every event.

---

### Scenario B — Multiple specific repositories

You want several repos (but not all) to trigger your agent.

**Option 1 — Register individually:**

```bash
# Run once per repo
./scripts/register-webhook.sh owner repo-1
./scripts/register-webhook.sh owner repo-2
./scripts/register-webhook.sh owner repo-3
```

Each registration uses the same endpoint URL and the same secrets. All events
from each repo flow to the same Zo agent.

**Option 2 — Bulk script (automation-friendly):**

```bash
# repos.txt — one "owner/repo" per line
owner/repo-1
owner/repo-2
owner/repo-3

# Loop through them:
while IFS= read -r line; do
  owner_repo="${line//$'\r'/}"
  owner="${line%/*}"
  repo="${line#*/}"
  GITHUB_WEBHOOK_SECRET="your-secret" GITHUB_TOKEN="ghp_token" \
    ./scripts/register-webhook.sh "$owner" "$repo"
done < repos.txt
```

**Option 3 — GitHub Actions dispatch (recommended for many repos):**

Create a workflow in a central "zo-gh-config" repo that dispatches webhooks to
your endpoint:

```yaml
# .github/workflows/dispatch-webhooks.yml
name: Dispatch to Zo

on:
  push:
  pull_request:
  issues:
  workflow_run:

jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - name: Dispatch to Zo
        run: |
          curl -X POST https://etok.zo.space/api/github-webhook \
            -H "Content-Type: application/json" \
            -H "X-GitHub-Event: ${{ github.event_name }}" \
            -H "X-GitHub-Delivery: ${{ github.run_id }}" \
            -d '{"repo": "${{ github.repository }}", "event": "${{ github.event_name }}", "payload": ${{ toJson(github.event)) }}'
```

Then add this workflow to each repo you want to instrument (via GitHub Actions
reuse or manually). Keep the webhook registration on the central config repo to
manage secrets in one place.

---

### Scenario C — All repositories (organization-wide)

You want every repo in a GitHub organization to trigger your agent.

**Option 1 — Organization webhook (recommended for full coverage):**

Organization webhooks fire on all repos in the org. Register once at the org
level:

```bash
# Register org-level webhook
gh api orgs/<org>/hooks -X POST \
  -F config_url="https://etok.zo.space/api/github-webhook" \
  -F config_content_type="json" \
  -F config_secret="$GITHUB_WEBHOOK_SECRET" \
  -F events='["*"]' \
  -F active=true
```

This fires on **every repository** in the organization — no per-repo
registration needed.

**Option 2 — GitHub Enterprise (server webhook):**

If using GitHub Enterprise Server, register a server-level webhook that captures
all org and repo events.

**Option 3 — GitHub Actions template (org-level template):**

Create a reusable workflow in your organization's `.github` repository:

```yaml
# .github/reusable-workflows/zo-gh.yml
on:
  workflow_dispatch:
  push:
  pull_request:
  issues:
  workflow_run:

jobs:
  notify-zo:
    runs-on: ubuntu-latest
    steps:
      - name: Notify Zo
        run: |
          curl -X POST https://etok.zo.space/api/github-webhook \
            -H "Content-Type: application/json" \
            -H "X-GitHub-Event: ${{ github.event_name }}" \
            -H "X-GitHub-Delivery: ${{ github.run_id }}" \
            -d '{"repo": "${{ github.repository }}", "event": "${{ github.event_name }}"}'
```

Then all org repos can reference this template with:

```yaml
uses: .github/reusable-workflows/zo-gh.yml
```

---

## Setup checklist

- [ ] `webhook-agent/api-github-webhook.ts` installed on the Zo Space as
      `POST /api/github-webhook` (see **Space route implementation**)
- [ ] `gh` CLI authenticated (`gh auth status`)
- [ ] Endpoint publicly accessible (`https://etok.zo.space/api/github-webhook`)
- [ ] Webhook registered (per-repo or org-level)
- [ ] `GITHUB_WEBHOOK_SECRET` saved in
      [Zo Settings → Advanced → Secrets](/?t=settings&s=advanced)
- [ ] `ZO_API_KEY` saved in the same place
- [ ] Pinged with `bun scripts/send-test-webhook.ts ping` (or another synthetic
      event)
- [ ] Real event triggered and agent confirmed firing

---

## Customizing agent behavior

The webhook route at `/api/github-webhook` dispatches a tailored prompt to
`/zo/ask` per event type. Edit **`webhook-agent/api-github-webhook.ts`** in this
repository (or the synced copy in your Zo Space) to change what the agent does:

| Event          | Default prompt focus                                          |
| -------------- | ------------------------------------------------------------- |
| `push`         | Summarize commits, flag who authored what                     |
| `pull_request` | Review description, flag missing info, suggest reviewers      |
| `issues`       | Triage: bug vs feature vs question, suggest labels + priority |
| `workflow_run` | Summarize CI/CD status, note failures                         |
| `*`            | Log raw event, summarize what occurred                        |

You can extend the agent to:

- **Write results to files** in your workspace
- **Post GitHub comments** via the `gh` CLI
- **Create Linear issues** via the Linear API
- **Send Slack messages** via webhook
- **Trigger downstream automations** via `/zo/ask` chains

---

## Security model

| Protection               | How                                                                            |
| ------------------------ | ------------------------------------------------------------------------------ |
| HMAC verification        | `X-Hub-Signature-256` verified with `GITHUB_WEBHOOK_SECRET` on every request   |
| Secrets storage          | `GITHUB_WEBHOOK_SECRET` and `ZO_API_KEY` stored in Zo Secrets, never hardcoded |
| Timing-safe comparison   | Constant-time comparison prevents signature timing attacks                     |
| Public endpoint required | GitHub only delivers webhooks to publicly accessible HTTPS URLs                |

---

## Troubleshooting

**Agent not firing:**

1. Check [Zo Computer logs](/?t=computer) for errors
2. Run `bun scripts/send-test-webhook.ts ping` to confirm the endpoint receives
   requests
3. Verify `GITHUB_WEBHOOK_SECRET` in GitHub matches the one saved in Zo Secrets
   exactly
4. Confirm the webhook is active in **GitHub → Settings → Webhooks**

**Webhook not registering:**

- Ensure `gh auth status` shows authentication
- Confirm `GITHUB_TOKEN` has `repo` scope (classic PAT required for repo-level
  webhooks)
- For org-level webhooks, the token needs `admin:org` scope

**Events arriving but agent misbehaving:**

- Check the response from `/zo/ask` in your conversation
- Verify `ZO_API_KEY` is valid and has not been revoked
- Review the agent prompt in the webhook route and adjust as needed

---

## Scripts reference

| Path                                  | What it does                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `webhook-agent/api-github-webhook.ts` | **Space route:** webhook HTTP handler (HMAC, event switch, `/zo/ask`). Copy into Zo; not run from the shell.                 |
| `scripts/register-webhook.sh`         | Registers (or updates) a webhook on a repo. Fires all events.                                                                |
| `scripts/send-test-webhook.ts`        | Sends synthetic payloads (`ping`, push, PR, issues, workflow_run) to hit the endpoint without triggering real GitHub events. |

---

## Quick reference

```bash
# Register webhook on a repo
GITHUB_WEBHOOK_SECRET="secret" GITHUB_TOKEN="ghp_..." \
  ./scripts/register-webhook.sh owner repo

# Ping / simulate events locally
bun scripts/send-test-webhook.ts ping
bun scripts/send-test-webhook.ts push
bun scripts/send-test-webhook.ts pull_request
bun scripts/send-test-webhook.ts issues

# Trigger a real event
git commit -m "test" --allow-empty && git push
```

**Endpoint:** `https://etok.zo.space/api/github-webhook` **Repo:**
`https://github.com/EthanThatOneKid/zo-gh`
