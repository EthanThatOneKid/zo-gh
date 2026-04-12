# Zo GitHub Webhook Agent

Event-driven autonomous agents triggered by GitHub repository activity — no
polling, no scheduled timers. Built on
[Zo Computer](https://etok.zo.space/affiliate).

[**Zo Computer**](https://etok.zo.space/affiliate) is a personal AI server that
runs in the cloud with full tool access — files, calendar, email, browser,
GitHub, and more. It ships with an agentic workflow engine that can be triggered
on a schedule (RRULE/cron) or, as this project demonstrates, purely by external
events via webhooks.

**Zo Space (live):** https://etok.zo.space/

**Key routes on that space:**

| Path                  | Purpose                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `/api/github-webhook` | Receives GitHub webhook events and triggers the autonomous agent |
| `/docs`               | In-space documentation for the full setup                        |

**Repo docs:** https://github.com/EthanThatOneKid/zo-gh

## What this does

```
GitHub event fires (push, PR, issue, workflow, etc.)
  → POST to https://etok.zo.space/api/github-webhook
    → HMAC signature verified
    → Event parsed, agent prompt built
      → Autonomous Zo agent dispatched via /zo/ask
        → Agent analyzes, logs, and responds
```

This means your Zo agent can react to real-time GitHub activity — reviewing PRs,
triaging issues, summarizing CI runs, logging commits — purely on-demand, driven
by events rather than timers.

## Quick start

### 1. Register the webhook

```bash
export GITHUB_WEBHOOK_SECRET="your-secret"
export GITHUB_TOKEN="ghp_your_token"

./scripts/register-webhook.sh <owner> <repo>
```

This script registers a webhook on your repo that fires **all event types**.
Alternatively, add it manually in **GitHub → Settings → Webhooks → Add
webhook**:

| Field        | Value                                            |
| ------------ | ------------------------------------------------ |
| Payload URL  | `https://etok.zo.space/api/github-webhook`       |
| Content type | `application/json`                               |
| Secret       | Use the same `GITHUB_WEBHOOK_SECRET` value       |
| Events       | **Let me select individual events → All events** |

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

Watch your Zo Computer conversation fire with the agent response.

## Deploying the Zo Space

API routes (including `/api/github-webhook`) are synced automatically when you
update them via the Zo API. There is no separate manual deploy step for the
route itself.

## Supported events

| Event           | What the agent does                                              |
| --------------- | ---------------------------------------------------------------- |
| `ping`          | GitHub’s hook validation payload (same shape as a new webhook)   |
| `push`          | Summarizes commits, flags authors                                |
| `pull_request`  | Reviews PR description, flags missing info, suggests reviewers   |
| `issues`        | Triage: bug vs feature vs question, suggests labels and priority |
| `workflow_run`  | Summarizes CI/CD status, notes failures                          |
| `*` (any event) | Catch-all: logs and summarizes raw event                         |

## Use cases

- **Automated code review** — Fire an agent to review PRs on creation, flag
  missing tests, or check style
- **Issue triage** — Route new issues to appropriate agents or label them based
  on keywords
- **Security alerting** — React to vulnerability disclosures or secret exposure
  alerts
- **Documentation updates** — Trigger an agent to regenerate docs when code
  changes
- **Community management** — Welcome new contributors, respond to first-time PRs
- **CI/CD monitoring** — Summarize failed builds, track dependency updates

## Implications

| Aspect            | Benefit                                                   |
| ----------------- | --------------------------------------------------------- |
| **Cost**          | Zero polling = no wasted compute = lower costs            |
| **Latency**       | Near-instant response vs poll intervals (seconds/minutes) |
| **Scalability**   | One webhook handler scales easier than N polling agents   |
| **Orchestration** | Multiple repos can subscribe to the same webhook bus      |

## Architecture

```
zo-gh/
├── scripts/
│   ├── build_skill_md.py    # Refreshes SKILL.md Appendix from route + script sources
│   ├── register-webhook.sh  # Registers GitHub webhook (all events)
│   └── send-test-webhook.ts # Synthetic payloads (ping, push, …) to hit the route locally
├── webhook-agent/           # Zo Space bundle: api-github-webhook.ts → POST /api/github-webhook
├── SKILL.md                 # Agent skill + self-contained Appendix (sources; no clone required)
└── README.md                 # This file — setup, architecture, security
```

The webhook route is a **Zo Space API route** at `/api/github-webhook`. It:

1. Verifies the `X-Hub-Signature-256` HMAC header using `GITHUB_WEBHOOK_SECRET`
2. Parses `X-GitHub-Event` to route to the correct handler
3. Builds a tailored prompt per event type
4. Dispatches it to `/zo/ask` using `ZO_API_KEY`
5. Returns `{ received: true, event, summary, agentTriggered }`

## Security

- **HMAC verification** — every payload is verified with `X-Hub-Signature-256`.
  Requests with invalid signatures return `401`.
- **Secrets** — `GITHUB_WEBHOOK_SECRET` and `ZO_API_KEY` are stored as Zo
  secrets, never hardcoded or exposed in logs.
- **Timing-safe comparison** — uses a constant-time comparison to prevent timing
  attacks on the signature check.

## Reproducing this for your own Zo

You do **not** need to clone or fork this repository. **[SKILL.md](SKILL.md)**
ends with an **Appendix** containing the full sources for the Space route
(`api-github-webhook.ts`) and the CLI helpers (`register-webhook.sh`,
`send-test-webhook.ts`). Save those blocks to files, adjust `ENDPOINT` if your
Space URL is not `https://etok.zo.space`, then follow the steps in the skill.

If you already have the repo checked out, the same files live under
`webhook-agent/` and `scripts/`.

1. **Add the route** — Install the appendix (or
   [`webhook-agent/api-github-webhook.ts`](webhook-agent/api-github-webhook.ts))
   in your Zo Space as **`POST /api/github-webhook`**.
2. **Register the webhook** — Run the appendix `register-webhook.sh` (or
   `./scripts/register-webhook.sh` from a clone) so GitHub sends **All events**
   (`*`) to your endpoint.
3. **Save two secrets** in
   [Zo Settings → Advanced → Secrets](/?t=settings&s=advanced):
   - `GITHUB_WEBHOOK_SECRET` — the value you entered in GitHub
   - `ZO_API_KEY` — from
     [Settings → Advanced → Access Tokens](/?t=settings&s=advanced)
4. **Ping, then push** — Use the appendix `send-test-webhook.ts` (or
   `bun scripts/send-test-webhook.ts ping` from a clone), then push a commit and
   confirm the agent runs.

The endpoint is stateless — GitHub can be the only thing hitting it, and the
agent still fires exactly when events occur.

## About Zo Computer

[Zo](https://etok.zo.space/affiliate) is a personal AI server that lives in the
cloud. It runs your files, your automations, and your agents — with full access
to your calendar, email, browser, GitHub, and more. This project is one example
of hooking Zo's agentic workflow into the outside world via webhooks, enabling
event-driven automation without any scheduled polling.

> Want your own Zo? Use [my affiliate link](https://zo-computer.cello.so/fFG5xDTfXhY) to
> get started.
