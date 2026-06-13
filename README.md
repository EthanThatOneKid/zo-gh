# Zo GitHub Webhook Agent

Event-driven autonomous agents triggered by GitHub repository activity, with Zo continuously reconciling toward GitHub state so Zo stays eventually consistent even when webhooks are missed. Built on
[Zo Computer](https://etok.zo.space/affiliate).

[**Zo Computer**](https://etok.zo.space/affiliate) is a personal AI server that
runs in the cloud with full tool access — files, calendar, email, browser,
GitHub, and more. It ships with an agentic workflow engine that can be triggered
on a schedule (RRULE/cron) or, as this project demonstrates, via GitHub
webhooks plus a periodic reconciliation pass when needed.

**Primary sync model**

- **GitHub is the upstream event log / source of truth.**
- **Zo is the executor and reconciler.**
- **Webhooks are the fast path.**
- **Scheduled automation is the backfill path** for missed events while Zo is asleep or a webhook delivery is lost.
- **Goal:** keep Zo state eventually consistent with GitHub state.

**Main use cases**

- Deploy Zo Spaces directly from GitHub source.
- Keep skills and other Zo-owned artifacts in sync automatically.
- React to GitHub activity with autonomous review, triage, and deployment actions.

**Tweet:** https://x.com/etok_me/status/2043233125262929941?s=46

**Key routes on that space:**

| Path                  | Purpose                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `/api/github-webhook` | Receives GitHub webhook events and triggers the autonomous agent |
| `/docs`               | In-space documentation for the full setup                        |

**Repo:** https://github.com/EthanThatOneKid/zo-gh

## Documentation

**Setup (quick start, route install, secrets, ping), supported events, security,
multi-repo and org-wide scenarios, troubleshooting, and a self-contained source
appendix** live in **[SKILL.md](./SKILL.md)**. Start there for anything beyond
this overview. For any Space other than the reference deployment, set
**`ZO_WEBHOOK_ENDPOINT`** to your full webhook URL before running the register
or test scripts (see SKILL.md).

### Shared webhook secret

Use one `GITHUB_WEBHOOK_SECRET` value across every repo that points at the same
Zo webhook endpoint. That keeps GitHub signature verification consistent when
registering multiple repos or an org-wide webhook fanout.

## Repository layout

```
zo-gh/
├── scripts/
│   ├── register-webhook.sh  # Registers GitHub webhook (core event set)
│   └── send-test-webhook.ts # Synthetic payloads (ping, push, …) to hit the route locally
├── webhook-agent/           # Zo Space bundle: api-github-webhook.ts → POST /api/github-webhook
├── SKILL.md                 # Agent skill + Appendix (verbatim sources; no clone required)
├── DISPLAY.json             # Zo / registry UI metadata (icon, tags, integrations)
└── README.md                 # This file — short intro and links
```

## About Zo Computer

[Zo](https://etok.zo.space/affiliate) is a personal AI server that lives in the
cloud. It runs your files, your automations, and your agents — with full access
to your calendar, email, browser, GitHub, and more. This project is one example
of hooking Zo's agentic workflow into the outside world via webhooks and
reconciliation, enabling event-driven automation without losing track of GitHub
state when Zo sleeps.

> Want your own Zo? Use
> [my affiliate link](https://zo-computer.cello.so/fFG5xDTfXhY) to get started.
