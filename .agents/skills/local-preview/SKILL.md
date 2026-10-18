---
name: local-preview
description: Start or stop the Tavern Master local app for human smoke tests in the current Emdash task's Run terminal. Use for local dev previews, consent testing, and requests to run the app.
---

# Tavern Master local preview (Windows Emdash)

Read `AGENTS.md` first. This workflow never uses production credentials or resets a Neon branch.

## Start in the current Emdash task

1. **Coordinate with the human before any `op` command**, for each preview session. Never infer approval from an earlier run. Confirm the current worktree contains the desired code, inspect new `drizzle/*.sql` and `drizzle/meta` changes, and check port 3000 is free. Do not stop another task's server or pick another port silently.
2. Use the project's checked-in `.emdash.json` **Run** script in this task. Ask the human to start **Run** and open its terminal drawer with **Ctrl+J**. If a personal Run override is set in Emdash Project Settings, clear it to inherit the shared command. The Run script invokes:
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-preview.ps1 -ConfirmApproval`
3. Ask the human to type **yes** at the confirmation prompt in the Run terminal, then approve 1Password if prompted. Any other response cancels before loading secrets or migrating. Even if Emdash auto-runs the script, it must wait for this explicit confirmation. No `.env.local` copy is needed.
4. Wait for the launcher to report **Verified: Neon local child branch**, successful migrations, and Next **Ready in**. Ask the human to check the Run output; do not claim to have read the terminal when no terminal-reading tool is available. Independently check `http://localhost:3000` returns HTTP 200 before reporting success. Emdash can open the URL using its dev-server pill → **Open in Emdash Browser**, or **Ctrl+Shift+B**; the system browser also works.
5. Leave the Run terminal available for the smoke test. Do not invoke `runpane`, create another task/worktree, use undocumented Emdash hooks/internal APIs, or launch a hidden background process. Emdash's `EMDASH_PORT` is a suggested app port range, **not a control API**; keep this app on 3000 for its configured local Discord OAuth URL. Never print Emdash hook tokens, secrets, connection strings or sensitive app logs.

**Supported fallback:** If Run is not configured in the currently open task, ask the human to create an Emdash terminal with **Ctrl+Shift+T** and run the same command there. If tooling cannot open a terminal tab programmatically, say so rather than inventing an Emdash CLI. Do not send OS-wide keystrokes to automate UI focus. After explicit approval in chat, the agent may run `-Approved` **in an already available visible Emdash testing terminal**, but not in the agent's own occupied terminal or a detached process.

## Stop

From the agent tab or another terminal in this worktree, run:
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-preview.ps1 -Stop`

No 1Password access is required for stopping. Do not use Ctrl-C: Windows `op`/npm wrappers can leave `Terminate batch job (Y/N)?`. The ignored per-worktree PID/start-time record targets only this preview tree. Confirm port 3000 is no longer listening. Emdash's teardown script runs the same stop command when tearing down the task; don't rely on closing a tab as cleanup. A known `taskkill` child-exit race is tracked in #173: if the server is already gone but a stale state file remains, rerun `-Stop` to clean the stale record. Never delete the base repository's ignored `.env.local` or `.neon`.

## Safety and verification

The launcher locates the base Git repository, uses its ignored `.env.local` and `.neon`, validates the resolved `DATABASE_URL` against the non-default, non-protected Neon **local** child branch's **neondb** database, and rejects query options except the expected Neon TLS options. It sets `SITE_URL=http://localhost:3000` and `CONSENT_FEATURE_ENABLED=true` locally only. Only then does it run `npm run db:migrate` and `npm run dev` in the same approved, 1Password-populated child process using package.json's pinned Volta versions. Outside that populated process, use the project's `!` scripts.

The `.emdash.json` Run command intentionally does not pass `-Approved` or embed credentials. Its empty `preservePatterns` avoids requesting copies of local env/config files. Personal Emdash overrides may take precedence; inspect Project Settings if behavior differs. No setup script automatically installs dependencies or accesses secrets.

Run approval/config regression checks without secrets:
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-preview.tests.ps1`

Emdash references: [Project Settings](https://emdash.com/docs/project-config), [Keyboard Shortcuts](https://emdash.com/docs/keyboard-shortcuts), [In-App Browser](https://emdash.com/docs/in-app-browser).
