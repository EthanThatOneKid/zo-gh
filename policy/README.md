# Policy

This directory holds example per-repo sync policy for `zo-gh`.

- Copy `example.zo-gh.yml` into a repo root as `.zo-gh.yml`.
- Keep the schema intentionally small so the webhook handler can parse it safely.
- Use it to define which branch is primary, which pack files matter, and which events should trigger sync.
