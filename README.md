# GitHub Webhook Agent

A proof-of-concept for event-driven agent triggering via GitHub webhooks to Zo Space API routes.

## What this does

GitHub webhooks fire on repository events (push, pull_request, issues, etc.) → POST to a Zo Space API route → dispatch autonomous agent work.

## Repository structure

```
.
├── webhook-agent/        # Zo Space routes
│   ├── api/
│   │   └── github-webhook.ts
│   └── docs/
│       └── index.tsx
├── docs/                 # User-facing documentation (scaffolded as separate Zo space)
│   └── index.md
└── README.md
```

## Components

### 1. `webhook-agent/` — Zo Space

- `api/github-webhook.ts` — Receives GitHub webhook payloads and dispatches agent tasks
- `docs/index.tsx` — Documentation page explaining the methodology

### 2. `docs/` — Documentation workspace

Walkthrough guide for reproducing the setup.

---

## Quick start

1. Deploy the `webhook-agent` space to zo.space
2. Add webhook to your GitHub repo pointing to `https://etok.zo.space/api/github-webhook`
3. Select events (push, pull_request, etc.)
4. Watch the agent fire on each event

See the docs route for full step-by-step reproduction instructions.