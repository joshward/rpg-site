# Project Guidelines

## Project Overview
rpg-site is a Next.js (App Router) web application built with:
- Next.js 15 and React 19
- Tailwind CSS v4 for styling
- Drizzle ORM with a Neon (serverless) PostgreSQL database
- Authentication via better-auth using Discord OAuth

Key API route:
- Auth handler: `/api/auth/[...all]` (src/app/api/auth/[...all]/route.ts)

Primary goals for automation: keep changes minimal, safe, and aligned with the project’s conventions.

## Project Structure (key paths)
- App routes and pages: `src/app`
- Auth server config: `src/lib/auth.ts`
- Auth client: `src/lib/authClient.ts`
- Auth API route: `src/app/api/auth/[...all]/route.ts`
- Database client: `src/db/db.ts`
- Drizzle schema directory: `src/db/schema`
- Drizzle config: `drizzle.config.ts`
- Generated SQL migrations: `drizzle/`
- Next config: `next.config.ts`
- ESLint/Prettier config: `eslint.config.mjs`, Prettier is implicit via devDependency
- TypeScript config: `tsconfig.json`
- Junie files: `.junie/context.yml`, `.junie/guidelines.md`
- Dependabot: `.github/dependabot.yml`

## Environment and Secrets
Required environment variables:
- `DATABASE_URL` — Postgres connection string (Neon serverless)
- `DISCORD_CLIENT_ID` — Discord OAuth client ID
- `DISCORD_CLIENT_SECRET` — Discord OAuth client secret

Env files:
- Local: `.env.local`
- Production: `.env.production`

Secrets management:
- Some scripts are designed to run under 1Password CLI: `op run --env-file=.env.local -- <command>`
- Use the scripts with a `!` suffix when available to automatically wrap commands in `op`.

## Common Scripts
- Development: `npm run dev` (or `npm run dev!` to use 1Password `op`)
- Build: `npm run build`
- Start (production): `npm run start`
- Lint: `npm run lint`
- Format (write): `npm run format`
- Format (check): `npm run format:check`
- Drizzle migrate: `npm run db:migrate` (or `npm run db:migrate!` with `op`)
- Drizzle generate migration: `npm run db:gen! <name>`

## Migrations
- Tool: drizzle-kit
- Config: `drizzle.config.ts`
- Output directory: `drizzle/`

## Testing and Build Guidance for Junie
- Test runner: Vitest with React Testing Library and jsdom.
- Test location: tests live next to the module under a nested `_tests_` directory. Filename should be `<module-name>.tests.ts` or `<module-name>.tests.tsx`.
  - Example: `src/components/SignInButton.tsx` → `src/components/_tests_/SignInButton.tests.tsx`.
- Scripts:
  - Run all tests: `npm run test`
  - Watch mode: `npm run test:watch`
  - Coverage: `npm run test:coverage`
- Configuration files:
  - `vitest.config.ts` (jsdom env, tsconfig path aliases enabled via `vite-tsconfig-paths`, setup file: `vitest.setup.ts`).
  - `vitest.setup.ts` extends `expect` with `@testing-library/jest-dom`.
- Mocks: Prefer `vi.mock()` to stub external modules (e.g., auth client) in component tests.
- Build: If your change could affect runtime (server/client code, config), run `npm run build` locally to validate. For docs-only or metadata-only changes (e.g., files in `.junie/`, `.github/`), a build is not required.

## Code Style and Conventions
- Use Prettier (v3) and ESLint (v9) with Next.js config.
- Database naming convention: `snake_case` (configured in Drizzle).
- Import aliases:
  - `@/db` -> `src/db`
  - `@/lib` -> `src/lib`
- Prefer minimal, focused pull requests with clear descriptions.
- Don't add comments that just say what the code does. Use comments when they add clarity to why an approach was taken.
- Add doc comments to functions and classes when they are meant to be reused.

## CI and Maintenance
- Dependabot is configured for npm and GitHub Actions weekly updates in `.github/dependabot.yml`.

## Notes for Automation (Junie)
- Favor the least invasive change that satisfies the issue.
- When working with environment-dependent commands, prefer the `!` suffixed scripts to ensure variables are injected via 1Password where applicable.
- Update `.junie/guidelines.md` if you introduce new conventions or key paths that automation should know.
