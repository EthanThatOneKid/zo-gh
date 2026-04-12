# Regenerate SKILL.md with Appendix and doc updates. UTF-8.
# Run from repo root: python scripts/build_skill_md.py
# Run after changing webhook-agent/api-github-webhook.ts or scripts/* helpers.
from __future__ import annotations

import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
skill_path = root / "SKILL.md"
api = (root / "webhook-agent" / "api-github-webhook.ts").read_text(encoding="utf-8")
reg = (root / "scripts" / "register-webhook.sh").read_text(encoding="utf-8")
send = (root / "scripts" / "send-test-webhook.ts").read_text(encoding="utf-8")
text = skill_path.read_text(encoding="utf-8").replace("\r\n", "\n")

new_description = """description: >
  Zo GitHub Webhook Agent \u2014 event-driven autonomous agents triggered by GitHub
  repository activity. Fires Zo agents via /zo/ask on push, PR, issues, workflow
  runs, and more. No polling, no timers. Self-contained: SKILL.md ends with an
  Appendix of verbatim sources (api-github-webhook.ts, register-webhook.sh,
  send-test-webhook.ts) so users need not clone the repo. Copy the route into the
  user\u2019s Zo Space as POST /api/github-webhook. Use for one repo, many repos, or
  org-wide webhooks. Created for Zo Computer."""

text = re.sub(
    r"description: >\n.*?(?=\nmetadata:)",
    new_description,
    text,
    count=1,
    flags=re.DOTALL,
)

text = text.replace(
    "| Agents \u2014 copy `webhook-agent/` into a Space, org/multi-repo patterns, checklists | **This file (SKILL.md)** |\n\n---",
    "| Agents \u2014 copy route into a Space, org/multi-repo patterns, checklists | **This file (SKILL.md)** |\n"
    "| No git clone \u2014 full route + CLI sources | **Appendix** at the end of **SKILL.md** |\n\n"
    "**Maintainers:** after editing `webhook-agent/api-github-webhook.ts` or the\n"
    "`scripts/` helpers, run `python scripts/build_skill_md.py` to refresh the\n"
    "Appendix from those files.\n\n---",
)

text = text.replace(
    "| Webhook route | `webhook-agent/api-github-webhook.ts`                         | Hono `Context` handler: `X-Hub-Signature-256`, `X-GitHub-Event`, JSON body, dispatches to `/zo/ask` for supported events. |\n"
    "| CLI helpers   | `scripts/register-webhook.sh`, `scripts/send-test-webhook.ts` | Register GitHub webhooks and send synthetic payloads **to** your endpoint; they do not implement the route.               |",
    "| Webhook route | `webhook-agent/api-github-webhook.ts`                         | Hono `Context` handler: `X-Hub-Signature-256`, `X-GitHub-Event`, JSON body, dispatches to `/zo/ask` for supported events. Same text in **Appendix**. |\n"
    "| CLI helpers   | `scripts/register-webhook.sh`, `scripts/send-test-webhook.ts` | Register GitHub webhooks and send synthetic payloads **to** your endpoint; they do not implement the route. Verbatim copies in **Appendix**.               |",
)

text = text.replace(
    "1. **Copy or sync** `webhook-agent/api-github-webhook.ts` from\n"
    "   `https://github.com/EthanThatOneKid/zo-gh` (or the user\u2019s fork) into their\n"
    "   Space so it is exposed as **`POST /api/github-webhook`**. Keep the **same\n"
    "   filename** as the reference unless Zo\u2019s docs for their Space explicitly\n"
    "   require a different convention.",
    "1. **Copy or sync** the route into their Space as **`POST /api/github-webhook`**.\n"
    "   Source options: the **Appendix** in this SKILL (no clone), or\n"
    "   `webhook-agent/api-github-webhook.ts` from\n"
    "   `https://github.com/EthanThatOneKid/zo-gh` (or the user\u2019s fork). Keep the **same\n"
    "   filename** as the reference unless Zo\u2019s docs for their Space explicitly\n"
    "   require a different convention.",
)

text = text.replace(
    "4. After the route is live, continue with secrets, webhook registration, and\n"
    "   `bun scripts/send-test-webhook.ts ping` as in the scenarios below.",
    "4. After the route is live, continue with secrets, webhook registration, and\n"
    "   `bun send-test-webhook.ts ping` (or `bun scripts/send-test-webhook.ts ping` from\n"
    "   a clone) as in the scenarios below.",
)

text = text.replace(
    "2. **Finish setup** \u2014 Follow\n"
    "   **[README \u2014 Quick start](https://github.com/EthanThatOneKid/zo-gh/blob/master/README.md#quick-start)**:\n"
    "   register the GitHub webhook (`./scripts/register-webhook.sh` or the web UI),\n"
    "   save `GITHUB_WEBHOOK_SECRET` and `ZO_API_KEY` in Zo Secrets, run\n"
    "   `bun scripts/send-test-webhook.ts ping`, then trigger a real event with\n"
    "   `git push`.",
    "2. **Finish setup** \u2014 Follow\n"
    "   **[README \u2014 Quick start](https://github.com/EthanThatOneKid/zo-gh/blob/master/README.md#quick-start)**:\n"
    "   register the GitHub webhook (save **Appendix** `register-webhook.sh` and run\n"
    "   it, use `./scripts/register-webhook.sh` from a clone, or use the GitHub web UI),\n"
    "   save `GITHUB_WEBHOOK_SECRET` and `ZO_API_KEY` in Zo Secrets, run\n"
    "   `bun send-test-webhook.ts ping` (or `bun scripts/send-test-webhook.ts ping` from\n"
    "   a clone), then trigger a real event with `git push`.",
)

text = text.replace(
    "- [ ] `webhook-agent/api-github-webhook.ts` installed on the Zo Space as\n"
    "      `POST /api/github-webhook` (see **Space route implementation**)",
    "- [ ] `api-github-webhook.ts` installed on the Zo Space as `POST /api/github-webhook`\n"
    "      (see **Space route implementation** or **Appendix**)",
)

text = text.replace(
    "- [ ] Pinged with `bun scripts/send-test-webhook.ts ping` (or another synthetic\n"
    "      event)",
    "- [ ] Pinged with `bun send-test-webhook.ts ping` or\n"
    "      `bun scripts/send-test-webhook.ts ping` (or another synthetic event)",
)

text = text.replace(
    "2. Run `bun scripts/send-test-webhook.ts ping` to confirm the endpoint receives\n"
    "   requests",
    "2. Run `bun send-test-webhook.ts ping` (or `bun scripts/send-test-webhook.ts ping`\n"
    "   from a clone) to confirm the endpoint receives requests",
)

text = text.replace(
    "| `webhook-agent/api-github-webhook.ts` | **Space route:** webhook HTTP handler (HMAC, event switch, `/zo/ask`). Copy into Zo; not run from the shell.                 |\n"
    "| `scripts/register-webhook.sh`         | Registers (or updates) a webhook on a repo. Fires all events.                                                                |\n"
    "| `scripts/send-test-webhook.ts`        | Sends synthetic payloads (`ping`, push, PR, issues, workflow_run) to hit the endpoint without triggering real GitHub events. |",
    "| `webhook-agent/api-github-webhook.ts` | **Space route:** webhook HTTP handler (HMAC, event switch, `/zo/ask`). Copy into Zo; not run from the shell. **Appendix** has the same file verbatim.                 |\n"
    "| `scripts/register-webhook.sh`         | Registers (or updates) a webhook on a repo. Fires all events. **Appendix** has the same script verbatim.                                                                |\n"
    "| `scripts/send-test-webhook.ts`        | Sends synthetic payloads (`ping`, push, PR, issues, workflow_run) to hit the endpoint without triggering real GitHub events. **Appendix** has the same script verbatim. |",
)

header = """---

## Appendix \u2014 full sources (no clone required)

The blocks below are **verbatim** copies of the files in this repository at
`https://github.com/EthanThatOneKid/zo-gh`. Anyone with **only this SKILL.md**
can recreate the integration: save each block to a file using the **heading
filename**, install `api-github-webhook.ts` into the Zo Space as
`POST /api/github-webhook`, then run the shell script and Bun script from the
same directory. If both scripts live in **one folder** (not under `scripts/`),
run `./register-webhook.sh` and `bun send-test-webhook.ts ping` (drop the
`scripts/` path shown in some usage comments).

If your Space base URL is not `https://etok.zo.space`, edit `ENDPOINT` in
`register-webhook.sh` and `send-test-webhook.ts` before running.

### `api-github-webhook.ts` (Zo Space route)

```typescript
"""
footer_api = """
```

### `register-webhook.sh`

```bash
"""
footer_reg = """
```

### `send-test-webhook.ts`

```typescript
"""
footer_send = """
```
"""

appendix = header + api + footer_api + reg + footer_reg + send + footer_send

marker = "## Quick reference\n"
idx = text.index(marker)
new_tail = """## Quick reference

- **Commands (register, ping, push):**
  [README \u2014 Quick start](https://github.com/EthanThatOneKid/zo-gh/blob/master/README.md#quick-start)
- **Endpoint:** `https://etok.zo.space/api/github-webhook`
- **Repo:** `https://github.com/EthanThatOneKid/zo-gh`
- **No clone:** copy-paste sources are in **Appendix** below

""" + appendix

new_text = text[:idx] + new_tail
skill_path.write_text(new_text, encoding="utf-8", newline="\n")
print("Wrote", skill_path, "lines", new_text.count("\n") + 1)
