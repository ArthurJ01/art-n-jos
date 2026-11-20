# CLAUDE.md

Context for AI assistants (and humans) working on this repo. Read this first, then `README.md` and `docs/SETUP.md` if you need more.

## What this is

**art-n-jos**: a recipe collection web app for Arthur and his girlfriend. It's also a learning project (Arthur is a junior software engineer), so prefer industry-standard patterns and explain non-obvious choices. Keep running costs at or near $0.

- Prod: https://art-n-jos.vercel.app (public)
- Dev: https://art-n-jos-dev.vercel.app (behind Vercel login)
- Repo: https://github.com/ArthurJ01/art-n-jos (public; keep it public, see "Decisions")

## Stack

npm-workspaces monorepo, TypeScript everywhere, Node 22.

| Path              | What                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| `apps/web`        | React 19 + Vite, React Router, TanStack Query, plain CSS (dark theme)     |
| `apps/api`        | Express 5, Zod validation, Pino logs, Drizzle ORM + Postgres              |
| `packages/shared` | Zod schemas and types used by both (`recipeInputSchema`, `Recipe`, …)     |
| `api/index.js`    | Vercel serverless entry; re-exports the bundled `apps/api/dist/vercel.js` |
| `vercel.json`     | Build command, `/api/*` rewrite, SPA fallback, region `fra1`              |

The API has three entry points, all bundled by `apps/api/build.mjs` (esbuild; `@art-web/*` is bundled in, npm deps stay external):

- `src/index.ts` is a long-running server for local dev and Docker.
- `src/vercel.ts` exports the Express app for Vercel functions.
- `src/db/migrate.ts` runs the Drizzle migrations.

`src/app.ts` builds the Express app (no `listen`), so tests can use it directly.

## Commands (run from the repo root)

```bash
npm install
cp .env.example .env           # local config
npm run db:up                  # Postgres 16 in Docker (also creates artweb_test)
npm run db:migrate             # apply migrations
npm run db:seed                # optional sample data
npm run dev                    # API :3000 + web :5173 (Vite proxies /api)

npm test                       # all tests (API tests need db:up)
npm run lint && npm run format:check && npm run typecheck
npm run build
npm run db:generate            # after editing apps/api/src/db/schema.ts
```

CI runs exactly these checks, so run them before saying something works.

## Conventions

- Validate all input with the Zod schemas in `packages/shared`. Add new shapes there first, and both sides get the types.
- **DB changes:** edit `apps/api/src/db/schema.ts`, run `npm run db:generate`, read the generated SQL, then commit the schema and the `apps/api/drizzle/*` files together. Migrations run _before_ new code goes live, so keep them backwards-compatible: add first, and rename or drop in a later deploy.
- Express 5: async route errors reach `middleware/errors.ts` automatically. Throw `HttpError(status, msg)` for expected errors.
- Auth is a shared password (`APP_PASSWORD`) that sets a signed httpOnly cookie. GET routes are public; writes use `requireAuth`.
- Tests: Vitest. API tests hit a real Postgres (`TEST_DATABASE_URL`, default `localhost:5432/artweb_test`).
- Prettier (single quotes, width 100) and ESLint flat config. Don't hand-format; run `npm run format`.
- Git identity for this repo is Arthur's GitHub noreply email. Never commit his real email or any secrets.

## Deploy pipeline

`main` is protected by process: work on a branch, open a PR (CI runs), and merge. Merging runs `.github/workflows/deploy.yml`:

1. CI (`ci.yml`): format, lint, typecheck, tests with a Postgres service, build, Docker build check.
2. **Deploy to dev** (`deploy-env.yml`): migrate the Neon `dev` branch, run `vercel build` and `vercel deploy --prebuilt`, then point `art-n-jos-dev.vercel.app` at the new deployment via the Vercel REST API.
3. **Deploy to prod**: waits for Arthur's approval in GitHub Environments. Then migrate the Neon `production` branch, run `vercel deploy --prebuilt --prod`, and smoke-test `/api/health`.

Vercel's own git auto-deploy is **off** (`git.deploymentEnabled: false`). Only GitHub Actions deploys.

`/api/health` returns `{status, env, version, db}`. `version` is the deployed commit SHA, which is useful to confirm a deploy.

## Where config and secrets live (names only, never values)

- **GitHub repo:** secret `VERCEL_TOKEN` (team-scoped); variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DEPLOY_ENABLED=true`.
- **GitHub environments `dev` / `production`:** secret `DATABASE_URL` (Neon **direct** string, used for migrations); variable `APP_URL`.
- **Vercel project env** (Production and Preview): `DATABASE_URL` (Neon **pooled** string), `APP_PASSWORD`, `SESSION_SECRET`, `APP_ENV` (`prod`/`dev`).
- **Neon:** project `art-n-jos`, AWS Frankfurt, branches `production` (default) and `dev` (never auto-deletes). Postgres 18 (local/CI use 16).

## Decisions and gotchas

- **Hosting:** Vercel Hobby + Neon free, so the cost is $0. Render's free tier was rejected because of its ~1 min cold start. The Dockerfile is kept so the API can move to Cloud Run if Vercel's free CPU limit is ever hit.
- **Region:** Vercel functions run in `fra1` (Frankfurt), next to Neon. Neon has no Stockholm region.
- **Public repo:** on GitHub Free, private repos lose environments, environment secrets and required reviewers.
- **`vercel alias set` fails with team-scoped tokens** ("User not found"), even with `--scope`. That's why the dev alias step uses the REST API.
- **Vercel import:** the monorepo auto-detect suggests "Services". The project uses the **Other** preset, and `vercel.json` drives the build.
- **Pooled vs direct DB URL:** the runtime on Vercel uses the pooled URL; migrations in CI use the direct one.
- **Dependabot:** don't merge TypeScript or @types/node major bumps without checking the tooling. Keep @types/node on 22.x.
- **Planned domain:** jos-n-art.com, not bought yet. See `docs/SETUP.md` step 6.
