#!/usr/bin/env bash
#
# register-webhook.sh — Registers a GitHub webhook on a repository.
# Fires the core event set so any future events are covered without re-registering.
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
EVENTS=(push pull_request issues issue_comment release workflow_run)

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

if ! gh auth status &>/dev/null; then
  echo "ERROR: gh CLI is not authenticated. Run: gh auth login"
  exit 1
fi

register_or_update() {
  local hook_id="$1"
  if [[ -n "$hook_id" ]]; then
    gh api "repos/$OWNER/$REPO/hooks/$hook_id" -X PATCH \
      -F config_url="$ENDPOINT" \
      -F config_content_type="json" \
      -F config_secret="$SECRET" \
      $(for event in "${EVENTS[@]}"; do printf -- '-F events[]=%q ' "$event"; done) \
      -F active=true &>/dev/null
  else
    gh api "repos/$OWNER/$REPO/hooks" -X POST \
      -F config_url="$ENDPOINT" \
      -F config_content_type="json" \
      -F config_secret="$SECRET" \
      $(for event in "${EVENTS[@]}"; do printf -- '-F events[]=%q ' "$event"; done) \
      -F active=true >/dev/null
  fi
}

EXISTING=$(gh api "repos/$OWNER/$REPO/hooks" \
  --jq '.[] | select(.config.url == "'"$ENDPOINT"'") | .id' 2>/dev/null || echo "")

if [[ -n "$EXISTING" ]]; then
  echo "Webhook already registered (id=$EXISTING). Updating..."
  register_or_update "$EXISTING"
  echo "Done. Updated existing webhook $EXISTING."
else
  echo "Registering new webhook on $OWNER/$REPO..."
  register_or_update ""
  echo "Webhook registered."
fi

echo ""
echo "✅ Webhook registered at: https://github.com/$OWNER/$REPO/settings/hooks"
echo "   Endpoint: $ENDPOINT"
echo "   Events: ${EVENTS[*]}"
echo ""
echo "Next:"
echo "  1. Save GITHUB_WEBHOOK_SECRET in Zo Settings → Advanced → Secrets"
echo "  2. Save ZO_API_KEY in the same place"
echo "  3. Ping: bun send-test-webhook.ts ping"
