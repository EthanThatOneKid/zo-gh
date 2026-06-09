import type { Context } from "hono";
import { createHmac } from "crypto";

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";

function verifySignature(body: string, sig: string): boolean {
  if (!WEBHOOK_SECRET) return true; // skip verify if no secret set
  const expected = "sha256=" + createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

type EventMap = {
  push: { repository: string; ref: string; commits: Array<{ message: string; author: { name: string } }> };
  pull_request: { action: string; number: number; pull_request: { title: string; body: string; user: { login: string } } };
  issues: { action: string; issue: { title: string; body: string; user: { login: string } } };
  workflow_run: { action: string; workflow_run: { name: string; conclusion: string; head_branch: string } };
};

async function triggerAgent(input: string, metadata: Record<string, unknown> = {}) {
  const zoKey = process.env.ZO_API_KEY;
  if (!zoKey) return { ok: false, error: "ZO_API_KEY not set" };

  const response = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: {
      "Authorization": zoKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      input,
      model_name: "vercel:minimax/minimax-m3",
      output_format: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
    }),
  });

  const data = await response.json();
  return { ok: true, agentOutput: data.output };
}

const HANDLE = "etok";

function buildSyncPrompt(payload: {
  repository: { full_name: string };
  ref?: string;
  head_branch?: string;
  sender?: { login: string };
  workflow?: string;
  zopackPaths: string[];
  trigger: "push" | "workflow_dispatch";
}): string {
  const repo = payload.repository.full_name;
  const branch = payload.ref?.replace("refs/heads/", "") ?? payload.head_branch ?? "main";
  const trigger = payload.trigger;
  const files = payload.zopackPaths.length
    ? `Affected pack files:\n${payload.zopackPaths.map((p) => `  - ${p}`).join("\n")}`
    : "(no .zopack.md files in this push — but a workflow_dispatch was sent, so sync everything)";
  return [
    `A Zo Space auto-sync was triggered for \`${repo}\` (branch: \`${branch}\`) by ${payload.sender?.login ?? "unknown"} via ${trigger}.`,
    "",
    files,
    "",
    `Your job: pull the latest pack file(s) and deploy them to \`https://${HANDLE}.zo.space\`. Do this end-to-end, then verify.`,
    "",
    `Steps:`,
    `1. cd /home/workspace/code/github.com/${repo}`,
    `2. git pull --ff-only (idempotent — fine if already up to date)`,
    `3. For each .zopack.md file in the list above:`,
    `   a. Read the file and extract the route code from the \`### \\\`/<path>\\\` (page|api, public)\` block.`,
    `   b. Strip the leading/trailing \\\`\\\`\\\`tsx / \\\`\\\`\\\` fence markers.`,
    `   c. Replace \`{{HANDLE}}\` with \`${HANDLE}\` in the extracted code.`,
    `   d. Call the write_space_route tool with the extracted code (preserving public/private visibility from the pack header).`,
    `4. Verify the live deployment with: curl -sI https://${HANDLE}.zo.space/<path> (expect HTTP 200).`,
    `5. If verify fails, report the failure and stop. Do NOT roll back without asking.`,
    "",
    `If a sync-space script exists at \`scripts/sync-space.sh\` in the repo, prefer running it (it handles steps 1-3 automatically). You can \`bash\` it and pipe its output into the write_space_route call.`,
    "",
    `When done, return a one-line summary in the required \`summary\` field describing what was deployed. If nothing changed, return \`summary: "no-op"\`.`,
  ].join("\n");
}

function extractZopackPaths(payload: any): string[] {
  // push event: payload.commits[].added/modified
  const fromCommits = (payload.commits ?? []).flatMap((c: any) => [
    ...(c.added ?? []),
    ...(c.modified ?? []),
  ]);
  return Array.from(new Set(fromCommits.filter((p: string) => p.endsWith(".zopack.md"))));
}

function extractBranch(payload: any): string {
  return (payload.ref ?? payload.workflow_run?.head_branch ?? payload.pull_request?.head?.ref ?? "")
    .replace("refs/heads/", "");
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
    payload = body ? JSON.parse(body) : {};
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  let agentInput = "";
  let summary = "";
  let skipAgent = false;

  switch (event) {
    case "ping": {
      return c.json({ received: true, event: "ping", message: "Webhook connected successfully" });
    }
    case "push": {
      const branch = extractBranch(payload);
      const zopackPaths = extractZopackPaths(payload);
      const isMain = branch === "main";
      const touchedPack = zopackPaths.length > 0;
      if (isMain && touchedPack) {
        agentInput = buildSyncPrompt({
          repository: payload.repository,
          ref: payload.ref,
          sender: payload.sender,
          zopackPaths,
          trigger: "push",
        });
        summary = `sync push to main (${zopackPaths.length} pack file${zopackPaths.length === 1 ? "" : "s"})`;
      } else {
        agentInput = `A push event occurred on repository \`${payload.repository?.full_name}\` to ref \`${payload.ref}\`. ${payload.commits?.length || 0} commit(s) were pushed. No .zopack.md changes on main — no auto-sync needed. Log this event and summarize what changed.`;
        summary = `push to ${payload.ref} in ${payload.repository?.full_name}`;
      }
      break;
    }
    case "workflow_dispatch": {
      // Manual button click in GitHub Actions UI. Always sync, regardless of diff.
      // The repo's workflow would have sent a synthetic push payload alongside; we treat workflow_dispatch as an explicit "sync now" signal.
      agentInput = buildSyncPrompt({
        repository: payload.repository,
        ref: `refs/heads/${payload.inputs?.branch ?? "main"}`,
        sender: payload.sender,
        zopackPaths: payload.inputs?.packs
          ? String(payload.inputs.packs).split(",").map((s: string) => s.trim()).filter(Boolean)
          : [],
        trigger: "workflow_dispatch",
      });
      summary = `manual sync via workflow_dispatch on ${payload.repository?.full_name}`;
      break;
    }
    case "pull_request": {
      const p = payload as EventMap["pull_request"];
      agentInput = `A pull_request event (action: ${p.action}) occurred on repository \`${payload.repository?.full_name}\`. PR #${p.number}: "${p.pull_request?.title}". Opened by ${p.pull_request?.user?.login}. Body: ${p.pull_request?.body || "(no description)"}. Review this PR description and summarize the changes, flag any missing information, and identify potential reviewers.`;
      summary = `PR #${p.number} ${p.action}: ${p.pull_request?.title}`;
      break;
    }
    case "issues": {
      const p = payload as EventMap["issues"];
      agentInput = `An issue event (action: ${p.action}) occurred on repository \`${payload.repository?.full_name}\`. Title: "${p.issue?.title}". Opened by ${p.issue?.user?.login}. Body: ${p.issue?.body || "(no description)"}. Triage this issue: is it a bug, feature, or question? Suggest labels, priority, and an initial response.`;
      summary = `issue "${p.issue?.title}" (${p.action})`;
      break;
    }
    case "workflow_run": {
      const p = payload as EventMap["workflow_run"];
      agentInput = `A workflow_run event (action: ${p.action}) occurred on repository \`${payload.repository?.full_name}\`. Workflow: "${p.workflow_run?.name}". Conclusion: ${p.workflow_run?.conclusion || "null"}. Branch: ${p.workflow_run?.head_branch}. Summarize the run status and note any failures.`;
      summary = `workflow ${p.workflow_run?.name} (${p.action}, conclusion: ${p.workflow_run?.conclusion})`;
      break;
    }
    default:
      skipAgent = true;
      return c.json({ received: true, skipped: `event ${event} not handled` });
  }

  if (skipAgent) {
    return c.json({ received: true, skipped: "no-op" });
  }

  const result = await triggerAgent(agentInput);
  console.log(`[github-webhook] agent triggered for ${summary}:`, JSON.stringify(result));

  return c.json({ received: true, event, summary, agentTriggered: result.ok });
};
