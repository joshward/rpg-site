<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project guide

## What this is

Tavern Master is a guild-scoped RPG web app using Next.js App Router, React, TypeScript, Tailwind CSS, Drizzle ORM with Neon PostgreSQL, better-auth with Discord OAuth, and Discord API/bot integration. Use the installed versions and `package.json` as the source of truth; the root `README.md` is still the create-next-app template. Do not rely on old Next.js examples or the formerly stale `.junie/guidelines.md`.

## Local setup and running

- Use the Volta-pinned Node 24 and npm from `package.json` (currently Node 24.21.0, npm 10.9.7). Vercel is set to Node `24.x`. Check `node --version` if a shell bypasses Volta shims. Run `npm ci` after switching branches or updating the lockfile.
- The human supplies an ignored `.env.local` containing 1Password references and access to a **separate, resettable local database**. Never print secrets or use the production database for local work. Server configuration (`src/lib/config.ts`) requires `DATABASE_URL`, `SITE_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, and `CRON_SECRET`; authentication also needs `BETTER_AUTH_SECRET`. Local Discord OAuth must be configured for the local URL.
- **Coordinate with the human before invoking `op` commands.** 1Password requires their approval to load local secrets. Do not bypass approval or substitute production credentials. Once approved, run `npm run db:migrate!` against the **local** database, then `npm run dev!` and open `http://localhost:3000`. Keep the dev server available for human-led smoke tests and stop it when no longer needed. `npm run dev` only works if its environment is already populated.
- `drizzle.config.ts` reads `DATABASE_URL` from the process environment; unlike Next.js, Drizzle does not load `.env.local` by itself. Use the `!` scripts for local DB commands (`npm run db:gen! -- <name>` to generate, `npm run db:migrate!` to apply), and inspect generated SQL and `drizzle/meta` before applying. `npm run db:migrate` without `!` is for an already-populated environment such as Vercel, **not** an implicit local-secrets loader. Never run a migration against production from a dev machine.
- `.env.local`, `node_modules`, `.next`, and `/docs` are ignored by Git; `.env.production` is tracked and must never contain secrets. `/docs` contains local-only requirements/rollout notes, not PR artifacts; do not commit secrets or copied production data. Keep project instructions in this tracked file. Preserve the managed Next.js block above: `next dev` may update it; changes outside the markers survive.

## Neon development branch

- Neon CLI authentication is separate from Postgres credentials. Discover the organization and project with `neonctl orgs list` and `neonctl projects list`; verify the intended development branch and its parent with `neonctl branches list/get --project-id <project-id>`. A local `neonctl set-context --org-id <org-id> --project-id <project-id>` writes `.neon`, which is gitignored. Context alone does not pin a branch in every CLI version: pass both the development **branch ID** and project ID explicitly for destructive commands. Never target the default/production branch.
- `neonctl branches reset <dev-branch-id> --parent --project-id <project-id>` replaces the **entire development branch** with its parent's current data; it does not produce an empty database. Only do this with the human's approval, after checking the branch and parent and verifying that the resolved local `DATABASE_URL` points to the development branch. Do not print connection strings. If the parent is production, the local clone contains sensitive data (potentially auth tokens and private notes): do not export it, include it in logs, or run notification/cron test scripts against it. Connect and migrate **only the clone**, never production. The human's local-only runbook can record the actual IDs and reset steps without committing them.

## Layout and conventions

- `src/app/`: routes and layouts; `_components/` contains route-local UI. `src/components/`: reusable UI and Storybook stories. `src/actions/`: server actions. `src/lib/`: auth, Discord integration, feature gates and other domain logic. `src/db/schema/`: Drizzle tables; `drizzle/`: ordered SQL migrations and metadata. Drizzle is configured for `snake_case` DB names. The `@/` alias maps to `src/`.
- Discord access is guild-scoped. Use `src/actions/auth-helpers.ts` (`ensureAccess`/`ensureAdmin`) and `src/lib/authn.ts` for role decisions. Validate authorization **inside each server action, route handler and data read**; hiding buttons is not a security boundary. Follow nearby `asResult`/`ActionError` patterns in `src/actions/action-helpers.ts`.
- Consent/checklist functionality is still rolling out. `src/lib/consent/feature-gate.ts` defines the default-Off, server-only `CONSENT_FEATURE_ENABLED` flag. Consent access must also respect guild settings and, for game-specific views, the game's mode. Do not use `NEXT_PUBLIC_` for the gate or expose private answers/notes through a hidden UI. Only turn the flag on locally when testing consent, and keep production Off until the user deliberately plans activation. The existing rename **Clear answers** choice deletes that topic's responses, heads-up choices and private notes in the same transaction as the rename; preserve this behavior as the consent schema evolves.
- Keep changes small and testable; reuse existing components and adjacent conventions. Tests use Vitest, jsdom and React Testing Library (`vitest.config.ts`); put them near relevant code (often `_tests_/*.tests.ts(x)`, sometimes colocated `.tests.tsx`). Mock network/DB in unit tests, and cover authorization and privacy at server boundaries.

## Checks and deploy safety

- Before handing off a PR: `npm test`, `npm run lint` (Oxlint), `npm run format:check` (Prettier), `npx tsc --noEmit`, and `npm run build` for app/runtime changes. `npm run test:watch`, `npm run test:coverage`, `npm run format:write`, and `npm run storybook` are available when useful. Run a local manual smoke test when changing a user flow. CI runs tests, lint, formatting and build (`.github/workflows/ci.yml`), but **does not run migrations**. A build may need configured environment variables even when no live DB is used.
- Merging `main` deploys to the single production environment. Vercel's build command is `npm run db:migrate && next build`: migrations apply **before** the newly built app replaces the previous version. Make every migration additive and compatible with the **previously deployed app** (new tables or nullable/defaulted columns first; no destructive drop/rename in the same deploy). Prefer rollback of code without needing a DB rollback. Verify migrations on the separate local DB with the human's approval before merging; never reset production data.
- Production consent functionality stays behind the default-Off server gate, guild toggle, and game mode until privacy-tested, complete and intentionally activated. Do not assume a merged migration or hidden UI makes an unfinished feature safe to expose.
