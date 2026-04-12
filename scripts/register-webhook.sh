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
echo "✅ Webhook registered at: https://github.com/$OWNER/$REPO/settings/hooks"
echo "   Endpoint: $ENDPOINT"
echo "   Events: all (push, pull_request, issues, workflow_run, etc.)"
echo ""
echo "Next:"
echo "  1. Save GITHUB_WEBHOOK_SECRET in Zo Settings → Advanced → Secrets"
echo "  2. Save ZO_API_KEY in the same place"
echo "  3. Ping: bun send-test-webhook.ts ping"
