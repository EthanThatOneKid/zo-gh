---
name: zo-gh
description: >
  Zo GitHub Webhook Agent: event-driven autonomous agents for GitHub repository
  activity. Dispatches Zo agents through /zo/ask on pushes, pull requests,
  issues, workflow runs, and more. No polling and no timers. The skill is
  self-contained: SKILL.md includes an appendix with verbatim copies of
  api-github-webhook.ts, register-webhook.sh, and send-test-webhook.ts, so a
  git clone is not required. Copy the route into the user's Zo Space as the
  POST /api/github-webhook handler. Use it for one repository, several
  repositories, or organization-wide webhooks. Created for Zo Computer.
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

# zo-gh ? GitHub Webhook Agent

Event-driven autonomous agents triggered by GitHub activity. When any GitHub
event fires, your Zo agent analyzes, logs, and responds ? with zero polling.

**Live endpoint:** `https://etok.zo.space/api/github-webhook` **Repo:**
`https://github.com/EthanThatOneKid/zo-gh`

| Audience | Canonical doc |
| -------- | --------------- |
| Humans ? setup, architecture, security, supported events, quick start | **[README.md](https://github.com/EthanThatOneKid/zo-gh/blob/master/README.md)** in this repo |
| Agents ? copy route into a Space, org/multi-repo patterns, checklists | **This file (SKILL.md)** |
| No git clone ? full route + CLI sources | **Appendix** at the end of **SKILL.md** |

**Maintainers:** after editing `webhook-agent/api-github-webhook.ts` or the
`scripts/` helpers, run `python scripts/build_skill_md.py` to refresh the
Appendix from those files.

## What this skill does

```
GitHub event fires (push, PR, issue, workflow, etc.)
  ? POST to https://etok.zo.space/api/github-webhook
    ? HMAC signature verified
    ? Event parsed, agent prompt built
      ? Autonomous Zo agent dispatched via [/zo/ask]()
        ? Agent analyzes, logs, and responds
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
common extensions ? add matching `switch` cases in that file if you want agent
behavior for those events.

## Space route implementation (for agents)

The **HTTP webhook handler** is **not** in `scripts/`. Treat these paths
distinctly:

| Artifact      | Repo path                                                     | Role                                                                                                                      |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Webhook route | `webhook-agent/api-github-webhook.ts`                         | Hono `Context` handler: `X-Hub-Signature-256`, `X-GitHub-Event`, JSON body, dispatches to `/zo/ask` for supported events. Same text in **Appendix**. |
| CLI helpers   | `scripts/register-webhook.sh`, `scripts/send-test-webhook.ts` | Register GitHub webhooks and send synthetic payloads **to** your endpoint; they do not implement the route. Verbatim copies in **Appendix**.               |

**When reproducing this on the user?s Zo Space**, do this in order:

1. **Copy or sync** the route into their Space as **`POST /api/github-webhook`**.
   Source options: the **Appendix** in this SKILL (no clone), or
   `webhook-agent/api-github-webhook.ts` from
   `https://github.com/EthanThatOneKid/zo-gh` (or the user?s fork). Keep the **same
   filename** as the reference unless Zo?s docs for their Space explicitly
   require a different convention.
2. If new files appear under `webhook-agent/` (for example in-space docs or
   shared modules), copy those **together** with the handler so behavior stays
   aligned with upstream.
3. **Do not** satisfy ?implement the webhook? by only adding `scripts/` ? those
   never replace the TypeScript route.
4. After the route is live, continue with secrets, webhook registration, and
   `bun send-test-webhook.ts ping` (or `bun scripts/send-test-webhook.ts ping` from
   a clone) as in the scenarios below.

## Deployment scenarios

### Scenario A ? Single repository

You want one repo's events to trigger your Zo agent.

**Steps:**

1. **Install the route** in the Zo Space (see **Space route implementation**
   above).
2. **Finish setup** ? Follow
   **[README ? Quick start](https://github.com/EthanThatOneKid/zo-gh/blob/master/README.md#quick-start)**:
   register the GitHub webhook (save **Appendix** `register-webhook.sh` and run
   it, use `./scripts/register-webhook.sh` from a clone, or use the GitHub web UI),
   save `GITHUB_WEBHOOK_SECRET` and `ZO_API_KEY` in Zo Secrets, run
   `bun send-test-webhook.ts ping` (or `bun scripts/send-test-webhook.ts ping` from
   a clone), then trigger a real event with `git push`.

Done. That one repo now drives your Zo agent on every event.

### Scenario B ? Multiple specific repositories

You want several repos (but not all) to trigger your agent.

**Option 1 ? Register individually:**

```bash
# Run once per repo
./scripts/register-webhook.sh owner repo-1
./scripts/register-webhook.sh owner repo-2
./scripts/register-webhook.sh owner repo-3
```

Each registration uses the same endpoint URL and the same secrets. All events
from each repo flow to the same Zo agent.

**Option 2 ? Bulk script (automation-friendly):**

```bash
# repos.txt ? one "owner/repo" per line
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

**Option 3 ? GitHub Actions dispatch (recommended for many repos):**

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

### Scenario C ? All repositories (organization-wide)

You want every repo in a GitHub organization to trigger your agent.

**Option 1 ? Organization webhook (recommended for full coverage):**

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

This fires on **every repository** in the organization ? no per-repo
registration needed.

**Option 2 ? GitHub Enterprise (server webhook):**

If using GitHub Enterprise Server, register a server-level webhook that captures
all org and repo events.

**Option 3 ? GitHub Actions template (org-level template):**

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

## Setup checklist

- [ ] `api-github-webhook.ts` installed on the Zo Space as `POST /api/github-webhook`
      (see **Space route implementation** or **Appendix**)
- [ ] `gh` CLI authenticated (`gh auth status`)
- [ ] Endpoint publicly accessible (`https://etok.zo.space/api/github-webhook`)
- [ ] Webhook registered (per-repo or org-level)
- [ ] `GITHUB_WEBHOOK_SECRET` saved in
      [Zo Settings ? Advanced ? Secrets](/?t=settings&s=advanced)
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

Same as **[README ? Security](https://github.com/EthanThatOneKid/zo-gh/blob/master/README.md#security)**:
HMAC verification on every payload, secrets only in Zo, timing-safe signature
comparison, and a public HTTPS URL for GitHub delivery.

## Troubleshooting

**Agent not firing:**

1. Check [Zo Computer logs](/?t=computer) for errors
2. Run `bun send-test-webhook.ts ping` (or `bun scripts/send-test-webhook.ts ping`
   from a clone) to confirm the endpoint receives requests
3. Verify `GITHUB_WEBHOOK_SECRET` in GitHub matches the one saved in Zo Secrets
   exactly
4. Confirm the webhook is active in **GitHub ? Settings ? Webhooks**

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

| Path                                  | What it does                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `webhook-agent/api-github-webhook.ts` | **Space route:** webhook HTTP handler (HMAC, event switch, `/zo/ask`). Copy into Zo; not run from the shell. **Appendix** has the same file verbatim.                 |
| `scripts/register-webhook.sh`         | Registers (or updates) a webhook on a repo. Fires all events. **Appendix** has the same script verbatim.                                                                |
| `scripts/send-test-webhook.ts`        | Sends synthetic payloads (`ping`, push, PR, issues, workflow_run) to hit the endpoint without triggering real GitHub events. **Appendix** has the same script verbatim. |

## Quick reference

- **Commands (register, ping, push):**
  [README ? Quick start](https://github.com/EthanThatOneKid/zo-gh/blob/master/README.md#quick-start)
- **Endpoint:** `https://etok.zo.space/api/github-webhook`
- **Repo:** `https://github.com/EthanThatOneKid/zo-gh`
- **No clone:** copy-paste sources are in **Appendix** below

## Appendix ? full sources (no clone required)

The blocks below are **verbatim** copies of the files in this repository at
`https://github.com/EthanThatOneKid/zo-gh`. Anyone with **only this SKILL.md**
can recreate the integration: save each block to a file using the **heading
filename**, install `api-github-webhook.ts` into the Zo Space as
`POST /api/github-webhook`, then run the shell script and Bun script from the
same directory. If both scripts live in **one folder** (not under `scripts/`),
run `./register-webhook.sh` and `bun send-test-webhook.ts ping` (drop the
`scripts/` path shown in some usage comments).

If your Space base URL is not `https://etok.zo.space`, edit `ENDPOINT` in
`register-webhook.sh` and `send-test-webhook.ts` before running.

### `api-github-webhook.ts` (Zo Space route)

```typescript
import type { Context } from "hono";
import { createHmac } from "crypto";

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";

function verifySignature(body: string, sig: string): boolean {
  if (!WEBHOOK_SECRET) return true; // skip verify if no secret set
  const expected =
    "sha256=" + createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
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
      agentInput = `A push event occurred on repository \`${p.repository?.full_name}\` to ref \`${p.ref}\`. ${commitCount} commit(s) were pushed. Last commit message: "${lastCommit?.message}". Author: ${lastCommit?.author?.name}. Log this event and summarize what changed.`;
      summary = `push to ${p.ref} in ${p.repository?.full_name}`;
      break;
    }
    case "pull_request": {
      const p = payload as EventMap["pull_request"];
      agentInput = `A pull_request event (action: ${p.action}) occurred on repository \`${payload.repository?.full_name}\`. PR #${p.number}: "${p.pull_request?.title}". Opened by ${p.pull_request?.user?.login}. Body: ${
        p.pull_request?.body || "(no description)"
      }. Review this PR description and summarize the changes, flag any missing information, and identify potential reviewers.`;
      summary = `PR #${p.number} ${p.action}: ${p.pull_request?.title}`;
      break;
    }
    case "issues": {
      const p = payload as EventMap["issues"];
      agentInput = `An issue event (action: ${p.action}) occurred on repository \`${payload.repository?.full_name}\`. Title: "${p.issue?.title}". Opened by ${p.issue?.user?.login}. Body: ${
        p.issue?.body || "(no description)"
      }. Triage this issue: is it a bug, feature, or question? Suggest labels, priority, and an initial response.`;
      summary = `issue "${p.issue?.title}" (${p.action})`;
      break;
    }
    case "workflow_run": {
      const p = payload as EventMap["workflow_run"];
      agentInput = `A workflow_run event (action: ${p.action}) occurred on repository \`${payload.repository?.full_name}\`. Workflow: "${p.workflow_run?.name}". Conclusion: ${
        p.workflow_run?.conclusion || "null"
      }. Branch: ${p.workflow_run?.head_branch}. Summarize the run status and note any failures.`;
      summary = `workflow ${p.workflow_run?.name} (${p.action}, conclusion: ${p.workflow_run?.conclusion})`;
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
# register-webhook.sh ? Registers a GitHub webhook on a repository.
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
#   - Public endpoint at https://etok.zo.space/api/github-webhook
#

set -e

OWNER="${1:-}"
REPO="${2:-}"
TOKEN="${GITHUB_TOKEN:-}"
SECRET="${GITHUB_WEBHOOK_SECRET:-}"
ENDPOINT="https://etok.zo.space/api/github-webhook"

usage() {
  echo "Usage: GITHUB_WEBHOOK_SECRET=<secret> GITHUB_TOKEN=<token> $0 <owner> <repo>"
  echo "  owner       GitHub repository owner (user or org)"
  echo "  repo        GitHub repository name"
  echo ""
  echo "Required env vars:"
  echo "  GITHUB_WEBHOOK_SECRET   same secret you will use in GitHub UI"
  echo "  GITHUB_TOKEN            GitHub classic PAT (repo scope)"
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
echo "? Webhook registered at: https://github.com/$OWNER/$REPO/settings/hooks"
echo "   Endpoint: $ENDPOINT"
echo "   Events: all (push, pull_request, issues, workflow_run, etc.)"
echo ""
echo "Next:"
echo "  1. Save GITHUB_WEBHOOK_SECRET in Zo Settings ? Advanced ? Secrets"
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
 */

const ENDPOINT = "https://etok.zo.space/api/github-webhook";

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
      body: "## Summary\nAdds webhook endpoint that triggers autonomous agents on GitHub events.\n\n## Motivation\nReplace scheduled polling with event-driven triggers.",
      user: { login: "test-user" },
      state: "open",
    },
    repository: { full_name: "test/zo-webhook-test" },
  },
  issues: {
    action: "opened",
    issue: {
      title: "Bug: agent sometimes ignores workflow_run events",
      body: "## Description\nWhen a workflow completes very quickly, the agent doesn't fire.\n\n## Steps to reproduce\n1. Trigger a fast workflow (<5s)\n2. Observe missing agent response",
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
      `Unknown event: ${eventType}. Available: ${Object.keys(payloads).join(
        ", ",
      )}`,
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
