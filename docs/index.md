# GitHub Webhook Agent — Setup Guide

A step-by-step walkthrough for connecting GitHub webhook events to autonomous Zo agents.

**Goal:** When a GitHub event fires (push, PR, issue, workflow run), an autonomous agent is triggered to analyze, log, and respond — without any scheduled polling.

---

## Architecture

```
GitHub → Webhook POST → https://etok.zo.space/api/github-webhook
                                   ↓
                           verify HMAC signature
                           parse event type + payload
                                   ↓
                       POST /zo/ask with event context
                                   ↓
                         Autonomous agent fires
                                   ↓
                     result → console log / GitHub response
```

The webhook route handles **all event types** — push, pull_request, issues, workflow_run, issue_comment, release, and any others. Each event type triggers a tailored agent prompt.

---

## Prerequisites

- [x] A GitHub repository to register the webhook on
- [x] `gh` CLI authenticated (`gh auth status`)
- [x] `GITHUB_WEBHOOK_SECRET` saved in [Zo Settings → Advanced → Secrets](/?t=settings&s=advanced)
- [x] `ZO_API_KEY` saved in the same place

---

## Step 1 — Register the webhook on GitHub

Run the registration script from this repository:

```bash
export GITHUB_WEBHOOK_SECRET="your-secret-value"
export GITHUB_TOKEN="your-gh-token"

./scripts/register-webhook.sh <owner> <repo>
```

This configures a webhook on the target repo that fires **all event types**. You can also register manually via the GitHub Web UI:

1. Go to **Settings → Webhooks → Add webhook**
2. Payload URL: `https://etok.zo.space/api/github-webhook`
3. Content type: `application/json`
4. Secret: `your-secret-value`
5. Select **Let me select individual events → All events**
6. Enable the webhook

> **Important:** GitHub requires your endpoint to be publicly accessible (not localhost). The `etok.zo.space` URL satisfies this out of the box.

---

## Step 2 — Save your secrets

Go to [Settings → Advanced → Secrets](/?t=settings&s=advanced) and add:

| Secret | Value |
|--------|-------|
| `GITHUB_WEBHOOK_SECRET` | The same secret you entered in GitHub |
| `ZO_API_KEY` | Your Zo API key (from [Settings → Advanced → Access Tokens](/?t=settings&s=advanced)) |

The webhook route reads `GITHUB_WEBHOOK_SECRET` to verify incoming payloads. The `ZO_API_KEY` is used to dispatch agent work.

---

## Step 3 — Test with a fake payload

Send a realistic payload to the live endpoint without touching GitHub:

```bash
bun scripts/send-test-webhook.ts push
bun scripts/send-test-webhook.ts pull_request
bun scripts/send-test-webhook.ts issues
```

Each run POSTs a fully-formed payload to `https://etok.zo.space/api/github-webhook`. Check your Zo Computer conversation or service logs to see the agent fire.

---

## Step 4 — Trigger a real GitHub event

Push a commit from any branch:

```bash
git commit -m "test webhook trigger" --allow-empty
git push
```

Watch the agent fire in Zo Computer. All event types — push, PR, issue, workflow, comment, release — are handled by the same endpoint.

---

## Supported events

| Event | Trigger |
|-------|---------|
| `push` | Code pushed to any branch |
| `pull_request` | PR opened, closed, merged, review requested |
| `issues` | Issue opened, closed, labeled, commented |
| `workflow_run` | CI/CD workflow status change |
| `issue_comment` | Comment on issue or PR |
| `release` | Release published or edited |
| `*` (any event) | Catch-all for future event types |

---

## Customizing behavior

Edit the `/api/github-webhook` route in your Zo Space to customize what the agent does for each event type. The route dispatches a tailored `input` prompt to `/zo/ask` per event:

- **push** → summarize commits, flag who authored what
- **pull_request** → review PR description, flag missing info, suggest reviewers
- **issues** → triage: bug vs feature vs question, suggest labels + priority
- **workflow_run** → summarize CI/CD status, note failures
- **\*** → log the raw event and summarize what occurred

The sky is the limit: you can write results to files, post GitHub comments, create Linear issues, send Slack messages, and more — all triggered purely by GitHub activity with no polling.
