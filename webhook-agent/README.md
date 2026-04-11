# Webhook Agent — Zo Space

The Zo Space containing the webhook API route and documentation.

**Live at:** https://etok.zo.space/

**Key routes:**
- `/api/github-webhook` — receives GitHub webhook events, triggers autonomous agent
- `/docs` — documentation page explaining the full setup

## Deploying

Routes are synced automatically when updated via the Zo API. No manual deploy step needed.

## Testing

Send a test payload:

```bash
bun scripts/send-test-webhook.ts push
bun scripts/send-test-webhook.ts pull_request
bun scripts/send-test-webhook.ts issues
```

## Registering the webhook on GitHub

```bash
GITHUB_WEBHOOK_SECRET=your_secret ./scripts/register-webhook.sh your-username your-repo
```