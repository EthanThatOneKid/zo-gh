# Zo GitHub Webhook Agent

Event-driven autonomous agents triggered by GitHub repository activity — no polling, no scheduled timers. Built on [Zo Computer](https://etok.zo.space/affiliate).

[**Zo Computer**](https://etok.zo.space/affiliate) is a personal AI server that runs in the cloud with full tool access — files, calendar, email, browser, GitHub, and more. It ships with an agentic workflow engine that can be triggered on a schedule (RRULE/cron) or, as this project demonstrates, purely by external events via webhooks.

**Live endpoint:** `https://etok.zo.space/api/github-webhook`
**Docs:** `https://github.com/EthanThatOneKid/zo-gh`

---

## What this does

```
GitHub event fires (push, PR, issue, workflow, etc.)
  → POST to https://etok.zo.space/api/github-webhook
    → HMAC signature verified
    → Event parsed, agent prompt built
      → Autonomous Zo agent dispatched via /zo/ask
        → Agent analyzes, logs, and responds
```

This means your Zo agent can react to real-time GitHub activity — reviewing PRs, triaging issues, summarizing CI runs, logging commits — purely on-demand, driven by events rather than timers.

---

## Quick start

### 1. Register the webhook

```bash
export GITHUB_WEBHOOK_SECRET="your-secret"
export GITHUB_TOKEN="ghp_your_token"

./scripts/register-webhook.sh <owner> <repo>
```

This script registers a webhook on your repo that fires **all event types**. Alternatively, add it manually in **GitHub → Settings → Webhooks → Add webhook**:

| Field | Value |
|-------|-------|
| Payload URL | `https://etok.zo.space/api/github-webhook` |
| Content type | `application/json` |
| Secret | Use the same `GITHUB_WEBHOOK_SECRET` value |
| Events | **Let me select individual events → All events** |

### 2. Save secrets

In [Zo Settings → Advanced → Secrets](/?t=settings&s=advanced):

| Secret | Value |
|--------|--------|
| `GITHUB_WEBHOOK_SECRET` | The secret you entered in GitHub |
| `ZO_API_KEY` | From [Settings → Advanced → Access Tokens](/?t=settings&s=advanced) |

### 3. Test without touching GitHub

```bash
bun scripts/send-test-webhook.ts push
bun scripts/send-test-webhook.ts pull_request
bun scripts/send-test-webhook.ts issues
```

### 4. Trigger a real event

```bash
git commit -m "test" --allow-empty
git push
```

Watch your Zo Computer conversation fire with the agent response.

---

## Supported events

| Event | What the agent does |
|-------|---------------------|
| `push` | Summarizes commits, flags authors |
| `pull_request` | Reviews PR description, flags missing info, suggests reviewers |
| `issues` | Triage: bug vs feature vs question, suggests labels and priority |
| `workflow_run` | Summarizes CI/CD status, notes failures |
| `*` (any event) | Catch-all: logs and summarizes raw event |

GitHub requires HTTPS and a publicly accessible endpoint — `etok.zo.space` satisfies this out of the box.

---

## Architecture

```
zo-gh/
├── docs/
│   └── index.md              # Full setup walkthrough
├── scripts/
│   ├── register-webhook.sh  # Registers GitHub webhook (all events)
│   └── send-test-webhook.ts # Sends fake payloads for local testing
└── README.md
```

The webhook route is a **Zo Space API route** at `/api/github-webhook`. It:

1. Verifies the `X-Hub-Signature-256` HMAC header using `GITHUB_WEBHOOK_SECRET`
2. Parses `X-GitHub-Event` to route to the correct handler
3. Builds a tailored prompt per event type
4. Dispatches it to `/zo/ask` using `ZO_API_KEY`
5. Returns `{ received: true, event, summary, agentTriggered }`

---

## Security

- **HMAC verification** — every payload is verified with `X-Hub-Signature-256`. Requests with invalid signatures return `401`.
- **Secrets** — `GITHUB_WEBHOOK_SECRET` and `ZO_API_KEY` are stored as Zo secrets, never hardcoded or exposed in logs.
- **Timing-safe comparison** — uses a constant-time comparison to prevent timing attacks on the signature check.

---

## Reproducing this for your own Zo

1. **Create a Zo Space API route** at `/api/github-webhook` (copy the route code from this repo or the live endpoint)
2. **Create a GitHub repo** with `scripts/register-webhook.sh` and `scripts/send-test-webhook.ts`
3. **Register the webhook** on any repo you own — selecting **All events** (`*`) means it catches everything without re-registering
4. **Save two secrets** in [Zo Settings → Advanced → Secrets](/?t=settings&s=advanced):
   - `GITHUB_WEBHOOK_SECRET` — the value you entered in GitHub
   - `ZO_API_KEY` — from [Settings → Advanced → Access Tokens](/?t=settings&s=advanced)
5. **Push a commit** and watch your Zo agent fire

The endpoint is stateless — GitHub can be the only thing hitting it, and the agent still fires exactly when events occur.

---

## About Zo Computer

[Zo](https://etok.zo.space/affiliate) is a personal AI server that lives in the cloud. It runs your files, your automations, and your agents — with full access to your calendar, email, browser, GitHub, and more. This project is one example of hooking Zo's agentic workflow into the outside world via webhooks, enabling event-driven automation without any scheduled polling.

> Want your own Zo? Use [my affiliate link](https://etok.zo.space/affiliate) to get started.
