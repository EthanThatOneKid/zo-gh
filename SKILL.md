---
name: zo-gh
description: >
  Use whenever the user connects GitHub to Zo Computer, needs a GitHub webhook
  that triggers a Zo agent, implements POST /api/github-webhook, verifies
  X-Hub-Signature-256 (HMAC), or dispatches /zo/ask on push, pull_request,
  issues, or workflow_run—including multi-repo or org-wide automation without
  polling. Self-contained appendix mirrors api-github-webhook.ts,
  register-webhook.sh, and send-test-webhook.ts so cloning is optional. Not for
  routine gh issue/PR queries without a webhook, generic CI debugging only, or
  GitHub App OAuth without a Zo webhook route.
metadata:
  author: etok.zo.computer
  version: "1.1.0"
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

**Your webhook URL** (GitHub “Payload URL” and target for test traffic):\
`https://<your-subdomain>.zo.space/api/github-webhook`

Export **`ZO_WEBHOOK_ENDPOINT`** to that full URL before running
`register-webhook.sh` or `send-test-webhook.ts`. If unset, both scripts default
to the maintainer reference Space (below)—override for any other deployment.

**Upstream reference** (compare or fork): Space
`https://etok.zo.space/api/github-webhook`, repo
`https://github.com/EthanThatOneKid/zo-gh`.

| Audience                                                              | Canonical doc                                                                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Humans — one-page intro and repo tree on GitHub                       | **[README.md](https://github.com/EthanThatOneKid/zo-gh/blob/master/README.md)** (forks: use your `README.md`) |
| Agents — copy route into a Space, org/multi-repo patterns, checklists | **This file (SKILL.md)**                                                                                      |
| No git clone — full route + CLI sources                               | **Appendix** at the end of **SKILL.md**                                                                       |

### Read order

1. **Your webhook URL** and **Quick start** (secrets + `ZO_WEBHOOK_ENDPOINT`).
2. **Space route implementation** (install `POST /api/github-webhook`).
3. **Deployment scenarios** as needed; **Troubleshooting** if something fails.
4. **Appendix** only when saving verbatim sources or patching the handler
   offline.

### Not this skill

- One-off **`gh issue` / `gh pr`** help with no webhook or Zo route involved.
- **GitHub Actions authoring** without forwarding events to Zo.
- **OAuth / GitHub App registration** alone (this skill assumes webhook delivery
  to an existing Zo Space route).

**Maintainers:** if you edit `webhook-agent/api-github-webhook.ts` or anything
under `scripts/`, update the matching **Appendix** fenced blocks in this file so
they stay verbatim with those sources.

### Never commit these values

Do not put real **`GITHUB_WEBHOOK_SECRET`**, **`ZO_API_KEY`**, or
**`GITHUB_TOKEN`** in repos, gists, logs, or screenshots. Use
[Zo Secrets](/?t=settings&s=advanced) and GitHub **encrypted secrets** (e.g.
Actions). Rotate anything that leaks. HMAC validation is described in
[GitHub’s webhook delivery docs](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries).

## What this skill does

```
GitHub event fires (push, PR, issue, workflow, etc.)
  → POST to https://<your-subdomain>.zo.space/api/github-webhook
    → HMAC signature verified
    → Event parsed, agent prompt built
      → Autonomous Zo agent dispatched via [/zo/ask](https://docs.zocomputer.com/api#post-zo-ask)
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

## Quick start

### 1. Register the webhook

```bash
export ZO_WEBHOOK_ENDPOINT="https://<your-subdomain>.zo.space/api/github-webhook"
export GITHUB_WEBHOOK_SECRET="your-secret"
export GITHUB_TOKEN="ghp_your_token"

./scripts/register-webhook.sh <owner> <repo>
```

This script registers a webhook on your repo that fires **all event types**.
Alternatively, add it manually in **GitHub → Settings → Webhooks → Add
webhook**:

| Field        | Value                                              |
| ------------ | -------------------------------------------------- |
| Payload URL  | Same URL as **`ZO_WEBHOOK_ENDPOINT`** (your Space) |
| Content type | `application/json`                                 |
| Secret       | Use the same `GITHUB_WEBHOOK_SECRET` value         |
| Events       | **Let me select individual events → All events**   |

### 2. Save secrets

In [Zo Settings → Advanced → Secrets](/?t=settings&s=advanced):

| Secret                  | Value                                                               |
| ----------------------- | ------------------------------------------------------------------- |
| `GITHUB_WEBHOOK_SECRET` | The secret you entered in GitHub                                    |
| `ZO_API_KEY`            | From [Settings → Advanced → Access Tokens](/?t=settings&s=advanced) |

### 3. Ping without touching GitHub

```bash
bun scripts/send-test-webhook.ts ping
bun scripts/send-test-webhook.ts push
bun scripts/send-test-webhook.ts pull_request
bun scripts/send-test-webhook.ts issues
```

### 4. Trigger a real event

```bash
git commit -m "test" --allow-empty
git push
```

Watch your Zo Computer conversation for the agent response.

### Zo Space route sync

API routes (including `/api/github-webhook`) sync automatically when you update
them via the Zo API. There is no separate manual deploy step for the route
itself.

## Space route implementation (for agents)

The **HTTP webhook handler** is **not** in `scripts/`. Treat these paths
distinctly:

| Artifact      | Repo path                                                     | Role                                                                                                                                                 |
| ------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Webhook route | `webhook-agent/api-github-webhook.ts`                         | Hono `Context` handler: `X-Hub-Signature-256`, `X-GitHub-Event`, JSON body, dispatches to `/zo/ask` for supported events. Same text in **Appendix**. |
| CLI helpers   | `scripts/register-webhook.sh`, `scripts/send-test-webhook.ts` | Register GitHub webhooks and send synthetic payloads **to** your endpoint; they do not implement the route. Verbatim copies in **Appendix**.         |

**When reproducing this on the user's Zo Space**, do this in order:

1. **Copy or sync** the route into their Space as
   **`POST /api/github-webhook`**. Source options: the **Appendix** in this
   SKILL (no clone), or `webhook-agent/api-github-webhook.ts` from
   `https://github.com/EthanThatOneKid/zo-gh` (or the user's fork). Keep the
   **same filename** as the reference unless Zo's docs for their Space
   explicitly require a different convention.
2. If new files appear under `webhook-agent/` (for example in-space docs or
   shared modules), copy those **together** with the handler so behavior stays
   aligned with upstream.
3. **Do not** satisfy "implement the webhook" by only adding `scripts/` — those
   never replace the TypeScript route.
4. After the route is live, continue with secrets, webhook registration, and
   `bun send-test-webhook.ts ping` (or `bun scripts/send-test-webhook.ts ping`
   from a clone) as in the scenarios below.

## Deployment scenarios

### Scenario A — Single repository

You want one repo's events to trigger your Zo agent.

**Steps:**

1. **Install the route** in the Zo Space (see **Space route implementation**
   above).
2. **Finish setup** — Follow **[Quick start](#quick-start)** above: register the
   GitHub webhook (save **Appendix** `register-webhook.sh` and run it, use
   `./scripts/register-webhook.sh` from a clone, or use the GitHub web UI), save
   `GITHUB_WEBHOOK_SECRET` and `ZO_API_KEY` in Zo Secrets, run
   `bun send-test-webhook.ts ping` (or `bun scripts/send-test-webhook.ts ping`
   from a clone), then trigger a real event with `git push`.

Done. That one repo now drives your Zo agent on every event.

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
  ZO_WEBHOOK_ENDPOINT="https://<your-subdomain>.zo.space/api/github-webhook" \
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
        env:
          ZO_WEBHOOK_ENDPOINT: ${{ secrets.ZO_WEBHOOK_ENDPOINT }}
        run: |
          curl -X POST "$ZO_WEBHOOK_ENDPOINT" \
            -H "Content-Type: application/json" \
            -H "X-GitHub-Event: ${{ github.event_name }}" \
            -H "X-GitHub-Delivery: ${{ github.run_id }}" \
            -d '{"repo": "${{ github.repository }}", "event": "${{ github.event_name }}", "payload": ${{ toJson(github.event)) }}'
```

Add repository secret **`ZO_WEBHOOK_ENDPOINT`** in GitHub (**Settings → Secrets
and variables → Actions**) with your full webhook URL (same value you use
locally).

Then add this workflow to each repo you want to instrument (via GitHub Actions
reuse or manually). Keep the webhook registration on the central config repo to
manage secrets in one place.

### Scenario C — All repositories (organization-wide)

You want every repo in a GitHub organization to trigger your agent.

**Option 1 — Organization webhook (recommended for full coverage):**

Organization webhooks fire on all repos in the org. Register once at the org
level:

```bash
# Register org-level webhook (set ZO_WEBHOOK_ENDPOINT first)
export ZO_WEBHOOK_ENDPOINT="https://<your-subdomain>.zo.space/api/github-webhook"
gh api orgs/<org>/hooks -X POST \
  -F config_url="$ZO_WEBHOOK_ENDPOINT" \
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
        env:
          ZO_WEBHOOK_ENDPOINT: ${{ secrets.ZO_WEBHOOK_ENDPOINT }}
        run: |
          curl -X POST "$ZO_WEBHOOK_ENDPOINT" \
            -H "Content-Type: application/json" \
            -H "X-GitHub-Event: ${{ github.event_name }}" \
            -H "X-GitHub-Delivery: ${{ github.run_id }}" \
            -d '{"repo": "${{ github.repository }}", "event": "${{ github.event_name }}"}'
```

Then all org repos can reference this template with:

```yaml
uses: .github/reusable-workflows/zo-gh.yml
```

## Setup checklist

- [ ] `api-github-webhook.ts` installed on the Zo Space as
      `POST /api/github-webhook` (see **Space route implementation** or
      **Appendix**)
- [ ] `gh` CLI authenticated (`gh auth status`)
- [ ] **`ZO_WEBHOOK_ENDPOINT`** set locally (and in GitHub Actions secrets if
      using workflows)
- [ ] Endpoint publicly reachable at that URL (HTTPS)
- [ ] Webhook registered (per-repo or org-level)
- [ ] `GITHUB_WEBHOOK_SECRET` saved in
      [Zo Settings → Advanced → Secrets](/?t=settings&s=advanced)
- [ ] `ZO_API_KEY` saved in the same place
- [ ] Pinged with `bun send-test-webhook.ts ping` or
      `bun scripts/send-test-webhook.ts ping` (or another synthetic event)
- [ ] Real event triggered and agent confirmed firing

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

## Security model

- **HMAC verification** — every payload is verified with `X-Hub-Signature-256`;
  invalid signatures return `401`. Do not disable verification in production; if
  `GITHUB_WEBHOOK_SECRET` is unset in the route, the reference handler skips
  verification (development only)—set the secret in Zo before going live.
- **Secrets** — `GITHUB_WEBHOOK_SECRET` and `ZO_API_KEY` live in Zo Secrets
  only, never hardcoded or exposed in logs. Never commit tokens or webhook
  secrets to git (see **Never commit these values** above).
- **Timing-safe comparison** — constant-time signature check to reduce timing
  attacks.
- **Public HTTPS** — GitHub requires a reachable URL for webhook delivery.

## Troubleshooting

**Agent not firing:**

1. Check [Zo Computer logs](/?t=computer) for errors
2. Run `bun send-test-webhook.ts ping` (or
   `bun scripts/send-test-webhook.ts ping` from a clone) to confirm the endpoint
   receives requests
3. Verify `GITHUB_WEBHOOK_SECRET` in GitHub matches the one saved in Zo Secrets
   exactly
4. Confirm the webhook is active in **GitHub → Settings → Webhooks**

**401 Invalid signature / connection refused:**

- Confirm GitHub’s webhook **Payload URL** exactly matches
  **`ZO_WEBHOOK_ENDPOINT`** (including `https://` and path
  `/api/github-webhook`).
- Re-copy `GITHUB_WEBHOOK_SECRET` into both GitHub and Zo; a single stray space
  breaks HMAC.

**Webhook not registering:**

- Ensure `gh auth status` shows authentication
- Confirm `GITHUB_TOKEN` has `repo` scope (classic PAT required for repo-level
  webhooks)
- For org-level webhooks, the token needs `admin:org` scope

**Events arriving but agent misbehaving:**

- Check the response from `/zo/ask` in your conversation
- Verify `ZO_API_KEY` is valid and has not been revoked
- Review the agent prompt in the webhook route and adjust as needed

## Scripts reference

| Path                                  | What it does                                                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webhook-agent/api-github-webhook.ts` | **Space route:** webhook HTTP handler (HMAC, event switch, `/zo/ask`). Copy into Zo; not run from the shell. **Appendix** has the same file verbatim.                   |
| `scripts/register-webhook.sh`         | Registers (or updates) a webhook on a repo. Fires all events. **Appendix** has the same script verbatim.                                                                |
| `scripts/send-test-webhook.ts`        | Sends synthetic payloads (`ping`, push, PR, issues, workflow_run) to hit the endpoint without triggering real GitHub events. **Appendix** has the same script verbatim. |

## Quick reference

- **Commands (register, ping, push):** [Quick start](#quick-start)
- **Endpoint:** your `ZO_WEBHOOK_ENDPOINT` (default reference:
  `https://etok.zo.space/api/github-webhook`)
- **Repo:** `https://github.com/EthanThatOneKid/zo-gh` (fork for your own
  changes)
- **No clone:** copy-paste sources are in **Appendix** below

## Appendix — full sources (no clone required)

The blocks below are **verbatim** copies of the files in this repository at
`https://github.com/EthanThatOneKid/zo-gh`. Anyone with **only this SKILL.md**
can recreate the integration: save each block to a file using the **heading
filename**, install `api-github-webhook.ts` into the Zo Space as
`POST /api/github-webhook`, then run the shell script and Bun script from the
same directory. If both scripts live in **one folder** (not under `scripts/`),
run `./register-webhook.sh` and `bun send-test-webhook.ts ping` (drop the
`scripts/` path shown in some usage comments).

Set **`ZO_WEBHOOK_ENDPOINT`** to your Space URL before running
`register-webhook.sh` or `send-test-webhook.ts` (see **Quick start**). Only if
you omit it do the scripts default to the reference etok URL.

### `api-github-webhook.ts` (Zo Space route)

```typescript
import type { Context } from "hono";
import { createHmac } from "crypto";

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";

function verifySignature(body: string, sig: string): boolean {
  if (!WEBHOOK_SECRET) return true; // skip verify if no secret set
  const expected = "sha256=" +
    createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

type EventMap = {
  push: {
    repository: string;
    ref: string;
    commits: Array<{ message: string; author: { name: string } }>;
  };
  pull_request: {
    action: string;
    number: number;
    pull_request: { title: string; body: string; user: { login: string } };
  };
  issues: {
    action: string;
    issue: { title: string; body: string; user: { login: string } };
  };
  workflow_run: {
    action: string;
    workflow_run: { name: string; conclusion: string; head_branch: string };
  };
};

async function triggerAgent(
  input: string,
  metadata: Record<string, unknown> = {},
) {
  const zoKey = process.env.ZO_API_KEY;
  if (!zoKey) return { ok: false, error: "ZO_API_KEY not set" };

  const response = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: {
      Authorization: zoKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      input,
      model_name: "vercel:minimax/minimax-m2.7",
      output_format: {
        type: "object",
        properties: { summary: { type: "string" } },
        required: ["summary"],
      },
    }),
  });

  const data = await response.json();
  return { ok: true, agentOutput: data.output };
}

export default async (c: Context) => {
  const sig = c.req.header("x-hub-signature-256") || "";
  const event = c.req.header("x-github-event") || "";
  const deliveryId = c.req.header("x-github-delivery") || "";

  const body = await c.req.text();

  if (!verifySignature(body, sig)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  console.log(`[github-webhook] event=${event} delivery=${deliveryId}`);

  const payload = JSON.parse(body);

  let agentInput = "";
  let summary = "";

  switch (event) {
    case "ping": {
      return c.json({
        received: true,
        event: "ping",
        message: "Webhook connected successfully",
      });
    }
    case "push": {
      const p = payload as EventMap["push"];
      const commitCount = p.commits?.length || 0;
      const lastCommit = p.commits?.[commitCount - 1];
      agentInput =
        `A push event occurred on repository \`${p.repository?.full_name}\` to ref \`${p.ref}\`. ${commitCount} commit(s) were pushed. Last commit message: "${lastCommit?.message}". Author: ${lastCommit?.author?.name}. Log this event and summarize what changed.`;
      summary = `push to ${p.ref} in ${p.repository?.full_name}`;
      break;
    }
    case "pull_request": {
      const p = payload as EventMap["pull_request"];
      agentInput =
        `A pull_request event (action: ${p.action}) occurred on repository \`${payload.repository?.full_name}\`. PR #${p.number}: "${p.pull_request?.title}". Opened by ${p.pull_request?.user?.login}. Body: ${
          p.pull_request?.body || "(no description)"
        }. Review this PR description and summarize the changes, flag any missing information, and identify potential reviewers.`;
      summary = `PR #${p.number} ${p.action}: ${p.pull_request?.title}`;
      break;
    }
    case "issues": {
      const p = payload as EventMap["issues"];
      agentInput =
        `An issue event (action: ${p.action}) occurred on repository \`${payload.repository?.full_name}\`. Title: "${p.issue?.title}". Opened by ${p.issue?.user?.login}. Body: ${
          p.issue?.body || "(no description)"
        }. Triage this issue: is it a bug, feature, or question? Suggest labels, priority, and an initial response.`;
      summary = `issue "${p.issue?.title}" (${p.action})`;
      break;
    }
    case "workflow_run": {
      const p = payload as EventMap["workflow_run"];
      agentInput =
        `A workflow_run event (action: ${p.action}) occurred on repository \`${payload.repository?.full_name}\`. Workflow: "${p.workflow_run?.name}". Conclusion: ${
          p.workflow_run?.conclusion || "null"
        }. Branch: ${p.workflow_run?.head_branch}. Summarize the run status and note any failures.`;
      summary =
        `workflow ${p.workflow_run?.name} (${p.action}, conclusion: ${p.workflow_run?.conclusion})`;
      break;
    }
    default: {
      return c.json({ received: true, skipped: `event ${event} not handled` });
    }
  }

  const result = await triggerAgent(agentInput);
  console.log(
    `[github-webhook] agent triggered for ${summary}:`,
    JSON.stringify(result),
  );

  return c.json({ received: true, event, summary, agentTriggered: result.ok });
};
```

### `register-webhook.sh`

```bash
#!/usr/bin/env bash
#
# register-webhook.sh — Registers a GitHub webhook on a repository.
# Fires ALL event types so any future events are covered without re-registering.
#
# Usage:
#   export GITHUB_WEBHOOK_SECRET="your-secret"
#   export GITHUB_TOKEN="ghp_..."          # classic PAT with repo scope
#   ./scripts/register-webhook.sh <owner> <repo>
#
# Requirements:
#   - gh CLI authenticated: gh auth status
#   - GITHUB_WEBHOOK_SECRET env var set
#   - GITHUB_TOKEN env var set (or pass --token)
#   - ZO_WEBHOOK_ENDPOINT (recommended): full URL to POST /api/github-webhook on your Zo Space
#     e.g. https://<subdomain>.zo.space/api/github-webhook
#     Defaults to https://etok.zo.space/api/github-webhook if unset (reference deployment only).
#

set -e

OWNER="${1:-}"
REPO="${2:-}"
TOKEN="${GITHUB_TOKEN:-}"
SECRET="${GITHUB_WEBHOOK_SECRET:-}"
ENDPOINT="${ZO_WEBHOOK_ENDPOINT:-https://etok.zo.space/api/github-webhook}"

usage() {
  echo "Usage: GITHUB_WEBHOOK_SECRET=<secret> GITHUB_TOKEN=<token> $0 <owner> <repo>"
  echo "  owner       GitHub repository owner (user or org)"
  echo "  repo        GitHub repository name"
  echo ""
  echo "Required env vars:"
  echo "  GITHUB_WEBHOOK_SECRET   same secret you will use in GitHub UI"
  echo "  GITHUB_TOKEN            GitHub classic PAT (repo scope)"
  echo ""
  echo "Optional:"
  echo "  ZO_WEBHOOK_ENDPOINT     full webhook URL (default: reference etok.zo.space URL)"
  exit 1
}

if [[ -z "$OWNER" ]] || [[ -z "$REPO" ]]; then
  echo "ERROR: owner and repo are required"
  usage
fi

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: GITHUB_TOKEN not set"
  usage
fi

if [[ -z "$SECRET" ]]; then
  echo "ERROR: GITHUB_WEBHOOK_SECRET not set"
  usage
fi

# Check gh auth
if ! gh auth status &>/dev/null; then
  echo "ERROR: gh CLI is not authenticated. Run: gh auth login"
  exit 1
fi

# Check if webhook already exists on this endpoint
EXISTING=$(gh api "repos/$OWNER/$REPO/hooks" \
  --jq '.[] | select(.config.url == "'"$ENDPOINT"'") | .id' 2>/dev/null || echo "")

if [[ -n "$EXISTING" ]]; then
  echo "Webhook already registered (id=$EXISTING). Updating..."
  gh api "repos/$OWNER/$REPO/hooks/$EXISTING" -X PATCH \
    -F config_url="$ENDPOINT" \
    -F config_content_type="json" \
    -F config_secret="$SECRET" \
    -F events='["*"]' \
    -F active=true &>/dev/null
  echo "Done. Updated existing webhook $EXISTING to fire all events."
else
  echo "Registering new webhook on $OWNER/$REPO..."
  RESP=$(gh api "repos/$OWNER/$REPO/hooks" -X POST \
    -F config_url="$ENDPOINT" \
    -F config_content_type="json" \
    -F config_secret="$SECRET" \
    -F events='["*"]' \
    -F active=true)
  WEBHOOK_ID=$(echo "$RESP" | jq -r '.id')
  echo "Webhook registered (id=$WEBHOOK_ID)."
fi

echo ""
echo "✅ Webhook registered at: https://github.com/$OWNER/$REPO/settings/hooks"
echo "   Endpoint: $ENDPOINT"
echo "   Events: all (push, pull_request, issues, workflow_run, etc.)"
echo ""
echo "Next:"
echo "  1. Save GITHUB_WEBHOOK_SECRET in Zo Settings → Advanced → Secrets"
echo "  2. Save ZO_API_KEY in the same place"
echo "  3. Ping: bun send-test-webhook.ts ping"
```

### `send-test-webhook.ts`

```typescript
#!/usr/bin/env bun
/**
 * send-test-webhook.ts
 *
 * Sends a synthetic GitHub webhook payload to the github-webhook route.
 * Use this to ping the endpoint without triggering real GitHub events.
 *
 * Usage:
 *   bun scripts/send-test-webhook.ts ping
 *   bun scripts/send-test-webhook.ts push
 *   bun scripts/send-test-webhook.ts pull_request
 *   bun scripts/send-test-webhook.ts issues
 *   bun scripts/send-test-webhook.ts workflow_run
 *
 * Set ZO_WEBHOOK_ENDPOINT to your Space URL (e.g. https://<subdomain>.zo.space/api/github-webhook).
 * If unset, defaults to the reference deployment at etok.zo.space.
 */

const ENDPOINT = process.env.ZO_WEBHOOK_ENDPOINT ??
  "https://etok.zo.space/api/github-webhook";

const payloads: Record<string, object> = {
  ping: {
    zen: "Design for failure.",
    hook_id: 1,
    hook: {
      type: "Repository",
      id: 1,
      name: "web",
      active: true,
      events: ["*"],
      config: {
        url: ENDPOINT,
        content_type: "json",
        insecure_ssl: "0",
      },
    },
  },
  push: {
    ref: "refs/heads/main",
    repository: { full_name: "test/zo-webhook-test" },
    commits: [
      {
        id: "abc123",
        message: "feat: add webhook agent proof of concept",
        author: { name: "Test User", email: "test@example.com" },
      },
      {
        id: "def456",
        message: "fix: correct signature verification logic",
        author: { name: "Test User", email: "test@example.com" },
      },
    ],
  },
  pull_request: {
    action: "opened",
    number: 42,
    pull_request: {
      title: "feat: event-driven agent triggering",
      body:
        "## Summary\nAdds webhook endpoint that triggers autonomous agents on GitHub events.\n\n## Motivation\nReplace scheduled polling with event-driven triggers.",
      user: { login: "test-user" },
      state: "open",
    },
    repository: { full_name: "test/zo-webhook-test" },
  },
  issues: {
    action: "opened",
    issue: {
      title: "Bug: agent sometimes ignores workflow_run events",
      body:
        "## Description\nWhen a workflow completes very quickly, the agent doesn't fire.\n\n## Steps to reproduce\n1. Trigger a fast workflow (<5s)\n2. Observe missing agent response",
      user: { login: "reporter-user" },
      labels: [{ name: "bug" }, { name: "P1" }],
    },
    repository: { full_name: "test/zo-webhook-test" },
  },
  workflow_run: {
    action: "completed",
    workflow_run: {
      name: "CI/CD Build",
      conclusion: "success",
      head_branch: "main",
      head_sha: "abc123def456",
    },
    repository: { full_name: "test/zo-webhook-test" },
  },
};

async function sendWebhook(eventType: string) {
  const payload = payloads[eventType];
  if (!payload) {
    console.error(
      `Unknown event: ${eventType}. Available: ${
        Object.keys(payloads).join(
          ", ",
        )
      }`,
    );
    process.exit(1);
  }

  console.log(`Sending ${eventType} event to ${ENDPOINT}...`);

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": eventType,
      "X-GitHub-Delivery": `ping-${Date.now()}`,
      // In production, add: X-Hub-Signature-256: sha256=...
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  console.log(`Status: ${response.status}`);
  console.log(`Response: ${text}`);
}

const eventType = Bun.argv[2];
if (!eventType) {
  console.error("Usage: bun scripts/send-test-webhook.ts <event>");
  console.error(`Available events: ${Object.keys(payloads).join(", ")}`);
  process.exit(1);
}

sendWebhook(eventType);
```
