import type { Context } from "hono";
import { createHmac } from "crypto";

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";

function verifySignature(body: string, sig: string): boolean {
  if (!WEBHOOK_SECRET) return true; // skip verify if no secret set
  const expected = "sha256=" +
    createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
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
  push: {
    repository: string;
    ref: string;
    commits: Array<{ message: string; author: { name: string } }>;
  };
  pull_request: {
    action: string;
    number: number;
    pull_request: { title: string; body: string; user: { login: string } };
  };
  issues: {
    action: string;
    issue: { title: string; body: string; user: { login: string } };
  };
  workflow_run: {
    action: string;
    workflow_run: { name: string; conclusion: string; head_branch: string };
  };
};

async function triggerAgent(
  input: string,
  metadata: Record<string, unknown> = {},
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
      model_name: "vercel:minimax/minimax-m2.7",
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

  const payload = JSON.parse(body);

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
      const p = payload as EventMap["push"];
      const commitCount = p.commits?.length || 0;
      const lastCommit = p.commits?.[commitCount - 1];
      agentInput =
        `A push event occurred on repository \`${p.repository?.full_name}\` to ref \`${p.ref}\`. ${commitCount} commit(s) were pushed. Last commit message: "${lastCommit?.message}". Author: ${lastCommit?.author?.name}. Log this event and summarize what changed.`;
      summary = `push to ${p.ref} in ${p.repository?.full_name}`;
      break;
    }
    case "pull_request": {
      const p = payload as EventMap["pull_request"];
      agentInput =
        `A pull_request event (action: ${p.action}) occurred on repository \`${payload.repository?.full_name}\`. PR #${p.number}: "${p.pull_request?.title}". Opened by ${p.pull_request?.user?.login}. Body: ${
          p.pull_request?.body || "(no description)"
        }. Review this PR description and summarize the changes, flag any missing information, and identify potential reviewers.`;
      summary = `PR #${p.number} ${p.action}: ${p.pull_request?.title}`;
      break;
    }
    case "issues": {
      const p = payload as EventMap["issues"];
      agentInput =
        `An issue event (action: ${p.action}) occurred on repository \`${payload.repository?.full_name}\`. Title: "${p.issue?.title}". Opened by ${p.issue?.user?.login}. Body: ${
          p.issue?.body || "(no description)"
        }. Triage this issue: is it a bug, feature, or question? Suggest labels, priority, and an initial response.`;
      summary = `issue "${p.issue?.title}" (${p.action})`;
      break;
    }
    case "workflow_run": {
      const p = payload as EventMap["workflow_run"];
      agentInput =
        `A workflow_run event (action: ${p.action}) occurred on repository \`${payload.repository?.full_name}\`. Workflow: "${p.workflow_run?.name}". Conclusion: ${
          p.workflow_run?.conclusion || "null"
        }. Branch: ${p.workflow_run?.head_branch}. Summarize the run status and note any failures.`;
      summary =
        `workflow ${p.workflow_run?.name} (${p.action}, conclusion: ${p.workflow_run?.conclusion})`;
      break;
    }
    default: {
      return c.json({ received: true, skipped: `event ${event} not handled` });
    }
  }

  const result = await triggerAgent(agentInput);
  console.log(
    `[github-webhook] agent triggered for ${summary}:`,
    JSON.stringify(result),
  );

  return c.json({ received: true, event, summary, agentTriggered: result.ok });
};
