---
name: local-preview
description: Start or stop the Tavern Master local app for human smoke tests in a visible testing terminal inside the current Orca workspace. Use for local dev previews, consent testing, and requests to run the app.
---

# Tavern Master local preview (Windows Orca)

Read `AGENTS.md` first. Never use production credentials, reset Neon, or run notification/cron scripts on cloned data.

## Establish the Orca control surface

Load the installed orchestration discovery skill to resolve the exact executable: use `ORCA_CLI_COMMAND` when set, otherwise `orca-dev` for `ORCA_DEV_REPO_ROOT`, otherwise `orca` on this Windows host. Keep using that executable; never fall through to another build on failure. Load its version-matched guide with `orca skills get orca-cli --json` (substitute the resolved executable when different), then check `status --json`, `worktree current --json`, and `terminal create --help`. This is ordinary terminal work: no orchestration Run/Task/Dispatch or extra worktree is needed.

## Start automatically in a visible workspace terminal

1. A human request or approval to run the project authorizes `op` access and the verified local migration/start **for that preview session**. Do not ask for a second chat confirmation or typed **yes**. Do not launch unsolicited sessions or treat old approval as permanent permission. 1Password still handles its separate approval prompt; never bypass it or assume it must prompt on every invocation. Inspect new `drizzle/*.sql` and `drizzle/meta` changes. Confirm the desired worktree is clean/understood, port 3000 is free, and no preview is already running. Keep the app on 3000 for local Discord OAuth.
2. After the human requests/approves running the project, run:
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-preview-orca.ps1`
   The helper passes `-Approved` to the app launcher automatically; no typed confirmation is required. If the human declines or leaves 1Password approval pending, do not bypass it.
3. The helper validates a reachable **local** Orca runtime and that the current workspace matches this checkout. It creates a PowerShell terminal in that exact workspace, verifies its surface is **visible**, then reads and submits the preview command. It does not switch UI focus, invoke Emdash/Pane controls, create a new worktree, or start a detached process. The terminal runs `scripts/local-preview.ps1 -Approved` based on the human's run request. No `.env.local` copy is needed.
4. Record the helper's returned **terminal handle** and resolved **cli**. `commandAccepted` proves only submission, not readiness. Read the exact handle using `orca terminal read --terminal <handle> --screen --limit 80 --json` with the same executable. The rendered lines are in `result.terminal.tail` (an array). Check for local-DB verification, successful migration, and Next's **Ready in** marker; do not mistake an echoed command for executed output. Also check `http://localhost:3000` returns HTTP 200. Never paste raw logs that could contain private notes/user data, connection strings, or Orca hook tokens into chat.
5. Leave the terminal running during the human smoke test. They no longer need to manually click Run or create the terminal. If create/send fails or readiness times out, inspect the returned handle/list before retrying; never spawn a duplicate just because a receipt is uncertain. If the runtime reports a stale handle, list the workspace terminals and use only the replacement handle. On runtime-access failure, report the exact failure rather than silently using another host or a background fallback.

The equivalent verified CLI sequence is `terminal create --worktree current --shell powershell.exe --title "Local preview" --json`, verify the returned workspace and visible surface, then `terminal read` and `terminal send --terminal <handle> --text "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-preview.ps1 -Approved" --enter --json`. A fresh human run request counts as permission for this session; no additional typed confirmation is needed. Prefer the helper so the scope/surface checks are not skipped.

## Stop and clean up

From the agent terminal run:
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-preview.ps1 -Stop`

No 1Password access is needed. Confirm port 3000 is no longer listening and `.local-preview.json` is removed. If the known `taskkill` child-exit race (#173) leaves stale state while the server is already gone, rerun `-Stop` to clean it. Do not rely on Ctrl-C (Windows batch-job prompts) or closing a tab to stop the process tree.

After a confirmed stop, read the recorded testing terminal. If it is still your own unused shell, close **only that handle** with `orca terminal close --terminal <handle> --json`; never use `--all` or close the agent/user's other terminals. Retain it and report uncertainty if ownership/process state cannot be confirmed. Never remove the base repository's ignored `.env.local` or `.neon`.

## Safety and testing

The app launcher still reuses the base repository's ignored `.env.local` and `.neon`, resolves secrets once, verifies `DATABASE_URL` against the non-default/non-protected Neon **local** child branch's **neondb**, rejects target-changing query options, and only then migrates and starts dev with pinned Volta versions. Consent and SITE_URL are overridden locally only. No auto-run hooks or checked-in credentials are used.

Run script regression checks without secrets:
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-preview.tests.ps1`

Test just Orca terminal creation/submission without `op`, DB access or app startup:
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-preview-orca.ps1 -CheckOnly`
Read its returned handle for `ORCA_LOCAL_PREVIEW_TERMINAL_OK`, then close that known idle check terminal. The helper explicitly reports `ready: false`; a marker is not an app smoke test.
