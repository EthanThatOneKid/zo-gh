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
  workflow_dispatch: {
    inputs: { branch: "main", packs: "" },
    repository: { full_name: "EthanThatOneKid/zo-future-of-collaboration" },
    sender: { login: "etok" },
  },
  "push-with-pack": {
    ref: "refs/heads/main",
    repository: { full_name: "EthanThatOneKid/zo-future-of-collaboration" },
    sender: { login: "etok" },
    commits: [
      {
        id: "testpack123",
        message: "feat: update future-of-collaboration pack",
        author: { name: "etok" },
        added: [],
        modified: ["future-of-collaboration.zopack.md"],
      },
    ],
  },
};

async function sendWebhook(eventType: string) {
  const payload = payloads[eventType];
  if (!payload) {
    console.error(`Unknown event: ${eventType}. Available: ${Object.keys(payloads).join(", ")}`);
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
