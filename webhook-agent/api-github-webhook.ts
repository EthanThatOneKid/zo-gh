import type { Context } from "hono";
import { createHmac } from "crypto";

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";
const POLICY_CACHE_TTL_MS = 5 * 60 * 1000;
const POLICY_CACHE = new Map<string, { value: RepoPolicy; cachedAt: number }>();

type RepoPolicy = {
  version: string;
  branch?: string;
  fallbackBranches?: string[];
  events?: Record<string, { action: string; enabled?: boolean; target?: string }>;
  sync?: {
    enabled?: boolean;
    packPaths?: string[];
    onEvents?: string[];
  };
  agent?: {
    model?: string;
    persona_id?: string;
    priorStateKey?: string;
  };
};

function defaultPolicy(repoFullName: string): RepoPolicy {
  return {
    version: "1",
    branch: "main",
    fallbackBranches: ["master"],
    events: {
      push: { action: "summarize" },
      workflow_dispatch: { action: "sync" },
      pull_request: { action: "review" },
      issues: { action: "triage" },
      workflow_run: { action: "summarize" },
    },
    sync: {
      enabled: true,
      packPaths: ["**/*.zopack.md"],
      onEvents: ["push", "workflow_dispatch"],
    },
    agent: {
      model: "vercel:minimax/minimax-m2.7",
      priorStateKey: `zo-gh:${repoFullName}`,
    },
  };
}

function normalizeRepoFullName(payload: any): string {
  return payload?.repository?.full_name || payload?.repository?.fullName || "unknown/unknown";
}

function getRepoOwnerAndName(repoFullName: string): [string, string] {
  const [owner, repo] = repoFullName.split("/");
  return [owner || "", repo || ""];
}

function cacheKey(repoFullName: string, ref: string) {
  return `${repoFullName}@${ref || "default"}`;
}

function isCacheFresh(entry?: { cachedAt: number }) {
  return !!entry && Date.now() - entry.cachedAt < POLICY_CACHE_TTL_MS;
}

function parseZoGhPolicy(text: string): RepoPolicy {
  const lines = text.split(/\r?\n/);
  const result: RepoPolicy = { version: "1" };
  let section: string | null = null;
  let subSection: string | null = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line || line.startsWith("#")) continue;
    if (/^[A-Za-z0-9_-]+:\s*$/.test(line)) {
      section = line.slice(0, -1);
      subSection = null;
      continue;
    }
    const top = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (top && !line.startsWith(" ")) {
      const [, key, value] = top;
      if (key === "version") result.version = value.replace(/^['"]|['"]$/g, "") || "1";
      if (key === "branch") result.branch = value.replace(/^['"]|['"]$/g, "") || undefined;
      continue;
    }
    const bullet = line.match(/^\s+-\s+(.*)$/);
    if (bullet && section === "fallbackBranches") {
      result.fallbackBranches ??= [];
      result.fallbackBranches.push(bullet[1].replace(/^['"]|['"]$/g, ""));
      continue;
    }
    const kv = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv && section === "sync") {
      const [, key, value] = kv;
      result.sync ??= {};
      if (key === "enabled") result.sync.enabled = value !== "false";
      if (key === "packPaths") result.sync.packPaths = value.split(",").map((s) => s.trim()).filter(Boolean);
      if (key === "onEvents") result.sync.onEvents = value.split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }
    if (kv && section === "agent") {
      const [, key, value] = kv;
      result.agent ??= {};
      if (key === "model") result.agent.model = value.replace(/^['"]|['"]$/g, "") || undefined;
      if (key === "persona_id") result.agent.persona_id = value.replace(/^['"]|['"]$/g, "") || undefined;
      if (key === "priorStateKey") result.agent.priorStateKey = value.replace(/^['"]|['"]$/g, "") || undefined;
      continue;
    }
    if (section === "events" && kv) {
      const [, eventName, action] = kv;
      result.events ??= {};
      result.events[eventName] = { action: action.replace(/^['"]|['"]$/g, "") || "summarize" };
      continue;
    }
    if (section === "events" && line.startsWith("  ")) {
      const eventKey = line.trim().replace(/:.*$/, "");
      if (eventKey) {
        result.events ??= {};
        result.events[eventKey] = { action: "summarize" };
      }
    }
  }
  return result;
}

async function fetchPolicyFromRepo(repoFullName: string, refHint: string): Promise<RepoPolicy> {
  const key = cacheKey(repoFullName, refHint);
  const cached = POLICY_CACHE.get(key);
  if (isCacheFresh(cached)) return cached.value;

  const [owner, repo] = getRepoOwnerAndName(repoFullName);
  const branches = [refHint, "main", "master", "trunk"].filter(Boolean);
  let text = "";
  for (const branch of branches) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.zo-gh.yml`;
    const response = await fetch(url, { headers: { Accept: "text/plain,*/*" } });
    if (response.ok) {
      text = await response.text();
      break;
    }
  }
  const policy = text ? parseZoGhPolicy(text) : defaultPolicy(repoFullName);
  POLICY_CACHE.set(key, { value: policy, cachedAt: Date.now() });
  return policy;
}

function applyPolicyToEvent(policy: RepoPolicy, event: string) {
  const eventPolicy = policy.events?.[event];
  return eventPolicy?.action || policy.events?.["*"]?.action || defaultPolicy("unknown/unknown").events?.[event]?.action || "summarize";
}

function shouldSync(policy: RepoPolicy, event: string) {
  const sync = policy.sync;
  if (!sync?.enabled) return false;
  return (sync.onEvents || []).includes(event);
}

function findChangedPackFiles(payload: any) {
  const commits = payload?.commits || [];
  const paths = new Set<string>();
  for (const commit of commits) {
    for (const added of commit?.added || []) paths.add(added);
    for (const modified of commit?.modified || []) paths.add(modified);
    for (const removed of commit?.removed || []) paths.add(removed);
  }
  return [...paths].filter((path) => path.endsWith(".zopack.md"));
}

function buildPriorStateKey(policy: RepoPolicy, repoFullName: string) {
  return policy.agent?.priorStateKey || `zo-gh:${repoFullName}`;
}

async function readPriorState(priorStateKey: string) {
  const url = `https://api.zo.computer/zo/state/${encodeURIComponent(priorStateKey)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function triggerAgent(
  input: string,
  metadata: Record<string, unknown> = {},
  policy: RepoPolicy | null = null,
) {
  const zoKey = process.env.ZO_API_KEY;
  if (!zoKey) return { ok: false, error: "ZO_API_KEY not set" };

  const response = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: {
      Authorization: zoKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      input,
      model_name: policy?.agent?.model || "vercel:minimax/minimax-m2.7",
      persona_id: policy?.agent?.persona_id,
      output_format: {
        type: "object",
        properties: { summary: { type: "string" } },
        required: ["summary"],
      },
    }),
  });

  const data = await response.json();
  return { ok: true, agentOutput: data.output };
}

export default async (c: Context) => {
  const sig = c.req.header("x-hub-signature-256") || "";
  const event = c.req.header("x-github-event") || "";
  const deliveryId = c.req.header("x-github-delivery") || "";

  const body = await c.req.text();

  if (!verifySignature(body, sig)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  console.log(`[github-webhook] event=${event} delivery=${deliveryId}`);

  let payload: any = {};
  try {
    payload = JSON.parse(body || "{}");
  } catch {
    return c.json({ error: "Invalid JSON payload" }, 400);
  }

  const repoFullName = normalizeRepoFullName(payload);
  const ref = payload?.ref || payload?.workflow_run?.head_branch || payload?.workflow?.head_branch || "";
  const policy = await fetchPolicyFromRepo(repoFullName, ref);
  const action = applyPolicyToEvent(policy, event);
  const changedPackFiles = findChangedPackFiles(payload);
  const priorStateKey = buildPriorStateKey(policy, repoFullName);
  const priorState = await readPriorState(priorStateKey);

  let agentInput = "";
  let summary = "";

  switch (event) {
    case "ping": {
      return c.json({
        received: true,
        event: "ping",
        message: "Webhook connected successfully",
      });
    }
    case "push": {
      const commitCount = payload?.commits?.length || 0;
      const lastCommit = payload?.commits?.[commitCount - 1];
      const isMain = (payload?.ref || "").endsWith("/main") || (payload?.ref || "") === "refs/heads/main";
      const shouldSyncNow = isMain && changedPackFiles.length > 0 && shouldSync(policy, event);
      if (shouldSyncNow) {
        agentInput = [
          `A push event occurred on repository \`${repoFullName}\` to ref \`${payload?.ref}\`.`,
          `${commitCount} commit(s) were pushed.`,
          `Changed .zopack.md files: ${changedPackFiles.join(", ")}.`,
          `Repository policy: ${JSON.stringify(policy)}.`,
          `Prior agent state: ${JSON.stringify(priorState || {})}.`,
          `This is a sync action. Read the updated pack(s), update the Zo Space route(s), and summarize what was changed.`,
        ].join(" ");
        summary = `sync push to main (${changedPackFiles.length} pack file${changedPackFiles.length === 1 ? "" : "s"})`;
      } else {
        agentInput =
          `A push event occurred on repository \`${repoFullName}\` to ref \`${payload?.ref}\`. ${commitCount} commit(s) were pushed. Last commit message: "${lastCommit?.message}". Author: ${lastCommit?.author?.name}. Repository policy: ${JSON.stringify(policy)}. Prior agent state: ${JSON.stringify(priorState || {})}. Log this event and summarize what changed.`;
        summary = `push to ${payload?.ref} in ${repoFullName}`;
      }
      break;
    }
    case "workflow_dispatch": {
      agentInput = [
        `A workflow_dispatch event occurred on repository \`${repoFullName}\`.`,
        `Repository policy: ${JSON.stringify(policy)}.`,
        `Prior agent state: ${JSON.stringify(priorState || {})}.`,
        `This is a manual sync trigger. If the policy allows sync, fetch the configured pack(s) and update the Zo Space route(s).`,
      ].join(" ");
      summary = `manual sync via workflow_dispatch on ${repoFullName}`;
      break;
    }
    case "pull_request": {
      agentInput = `A pull_request event (action: ${payload?.action}) occurred on repository \`${repoFullName}\`. PR #${payload?.number}: "${payload?.pull_request?.title}". Opened by ${payload?.pull_request?.user?.login}. Body: ${payload?.pull_request?.body || "(no description)"}. Repository policy: ${JSON.stringify(policy)}. Prior agent state: ${JSON.stringify(priorState || {})}. Review this PR description and summarize the changes, flag any missing information, and identify potential reviewers.`;
      summary = `PR #${payload?.number} ${payload?.action}: ${payload?.pull_request?.title}`;
      break;
    }
    case "issues": {
      agentInput = `An issue event (action: ${payload?.action}) occurred on repository \`${repoFullName}\`. Title: "${payload?.issue?.title}". Opened by ${payload?.issue?.user?.login}. Body: ${payload?.issue?.body || "(no description)"}. Repository policy: ${JSON.stringify(policy)}. Prior agent state: ${JSON.stringify(priorState || {})}. Triage this issue: is it a bug, feature, or question? Suggest labels, priority, and an initial response.`;
      summary = `issue "${payload?.issue?.title}" (${payload?.action})`;
      break;
    }
    case "workflow_run": {
      agentInput = `A workflow_run event (action: ${payload?.action}) occurred on repository \`${repoFullName}\`. Workflow: "${payload?.workflow_run?.name}". Conclusion: ${payload?.workflow_run?.conclusion || "null"}. Branch: ${payload?.workflow_run?.head_branch}. Repository policy: ${JSON.stringify(policy)}. Prior agent state: ${JSON.stringify(priorState || {})}. Summarize the run status and note any failures.`;
      summary = `workflow ${payload?.workflow_run?.name} (${payload?.action}, conclusion: ${payload?.workflow_run?.conclusion})`;
      break;
    }
    default: {
      const fallbackAction = action || "summarize";
      agentInput = `Unhandled GitHub event \`${event}\` on repository \`${repoFullName}\`. Policy action: ${fallbackAction}. Repository policy: ${JSON.stringify(policy)}. Prior agent state: ${JSON.stringify(priorState || {})}. Log and summarize the raw event.`;
      return c.json({ received: true, skipped: `event ${event} not handled`, policy, priorStateKey });
    }
  }

  const result = await triggerAgent(agentInput, { deliveryId, repoFullName, event, policy, priorStateKey }, policy);
  console.log(
    `[github-webhook] agent triggered for ${summary}:`,
    JSON.stringify(result),
  );

  return c.json({ received: true, event, summary, agentTriggered: result.ok, policy, priorStateKey, changedPackFiles });
};
