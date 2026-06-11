#!/usr/bin/env bash
set -euo pipefail

OWNER="${1:-}"
TOKEN="${GITHUB_TOKEN:-}"
SECRET="${GITHUB_WEBHOOK_SECRET:-}"
ENDPOINT="${ZO_WEBHOOK_ENDPOINT:-https://etok.zo.space/api/github-webhook}"

usage() {
  echo "Usage: GITHUB_WEBHOOK_SECRET=<secret> GITHUB_TOKEN=<token> $0 <owner>"
  echo "Registers the webhook on every repo GitHub lists for that owner."
  exit 1
}

if [[ -z "${OWNER}" ]]; then
  usage
fi

if [[ -z "${TOKEN}" ]]; then
  echo "ERROR: GITHUB_TOKEN not set"
  usage
fi

if [[ -z "${SECRET}" ]]; then
  echo "ERROR: GITHUB_WEBHOOK_SECRET not set"
  usage
fi

if ! gh auth status &>/dev/null; then
  echo "ERROR: gh CLI is not authenticated. Run: gh auth login"
  exit 1
fi

repos=$(gh repo list "$OWNER" --limit 1000 --json name,isArchived --jq '.[] | select(.isArchived == false) | .name')

if [[ -z "$repos" ]]; then
  echo "No repos found for $OWNER"
  exit 0
fi

count=0
while IFS= read -r repo; do
  [[ -z "$repo" ]] && continue
  echo "Registering webhook on $OWNER/$repo"
  GITHUB_TOKEN="$TOKEN" GITHUB_WEBHOOK_SECRET="$SECRET" ZO_WEBHOOK_ENDPOINT="$ENDPOINT" \
    "$(dirname "$0")/register-webhook.sh" "$OWNER" "$repo"
  count=$((count + 1))
done <<< "$repos"

echo "Registered or updated webhooks for $count repo(s) under $OWNER."
