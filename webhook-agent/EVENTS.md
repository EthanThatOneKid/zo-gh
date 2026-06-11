# GitHub Webhook Events Log

Append-only log of push (and other) events handled by `api-github-webhook.ts`.

## 2026-06-11 02:55 UTC — push to `feat/policy-driven-events`

- **Repo:** `EthanThatOneKid/zo-gh`
- **Ref:** `refs/heads/feat/policy-driven-events`
- **Commit:** [`8253ada`](https://github.com/EthanThatOneKid/zo-gh/commit/8253adab9c1980f401c3c9479984c4836b0926e1) — _test: workflow file push with PAT_ (EthanThatOneKid)
- **Branch state:** 1 commit ahead of `master`, 2 behind
- **Default branch:** `master` (not `main`)

### Files changed
| File | Status | +/− |
| --- | --- | --- |
| `webhook-agent/api-github-webhook.ts` | modified | +229 / −63 |

### Summary
The webhook handler is now policy-driven. A new `RepoPolicy` type and a 5-minute in-memory cache load `.zo-gh.yml` from the target repo (trying `ref`, then `main`, `master`, `trunk`) and fall back to a built-in default policy covering `push`, `workflow_dispatch`, `pull_request`, `issues`, and `workflow_run`. The handler now:

- Parses payloads defensively and returns 400 on bad JSON.
- Resolves the policy for every event and reads prior agent state from `https://api.zo.computer/zo/state/<key>`.
- Routes `push` events on `main` with `.zopack.md` changes into a **sync** action that asks the agent to read updated packs and refresh the Zo Space routes; other pushes stay on the **summarize** path. The event message includes the resolved policy and prior state.
- Adds a dedicated `workflow_dispatch` branch that asks the agent to fetch configured packs and update routes (manual sync trigger).
- Threads policy into `triggerAgent` so the `model_name` and `persona_id` come from `policy.agent` (with existing `vercel:minimax/minimax-m2.7` as the fallback).
- Returns the resolved `policy`, `priorStateKey`, and `changedPackFiles` in the response JSON for observability.

### Action taken
No `.zopack.md` files were touched on `main` (and this push is to `feat/policy-driven-events`, not `main`), so no auto-sync was triggered.
