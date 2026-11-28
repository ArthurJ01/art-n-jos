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

- `src/index.ts` is a long-running server for local dev.
- `src/vercel.ts` exports the Express app for Vercel functions.
- `src/db/migrate.ts` runs the Drizzle migrations.

`src/app.ts` builds the Express app (no `listen`), so tests can use it directly.

## Commands (run from the repo root)

```bash
npm install
cp .env.example .env           # local config
psql -U postgres -f scripts/setup-local-db.sql   # once: artweb login + artweb/artweb_test DBs
npm run db:migrate             # apply migrations
npm run db:seed                # optional sample data
npm run dev                    # API :3000 + web :5173 (Vite proxies /api)

npm test                       # all tests (API tests need the local DB)
npm run lint && npm run format:check && npm run typecheck
npm run build
npm run db:generate            # after editing apps/api/src/db/schema.ts
```

CI runs exactly these checks, so run them before saying something works.

## Conventions

- Validate all input with the Zod schemas in `packages/shared`. Add new shapes there first, and both sides get the types.
- **Recipes are stored as plain lines.** `ingredients` and `steps` are `text[]`. A line ending with a colon (`Sås:`) is a group heading; the helpers for that rule (`isHeadingLine`, `groupLines`, …) are in `packages/shared`. Amounts are _not_ stored separately: `apps/web/src/lib/ingredients.ts` reads "ca 500 g" out of the line when the recipe is shown, and recalculates it for the portion buttons. The builder (`RowListEditor`, `lib/rows.ts`) turns lines into rows and back, and strips a trailing colon from ordinary rows so they don't become headings.
- **Import from a link:** `POST /api/recipes/import` returns a draft and saves nothing. `apps/api/src/import/fetch-page.ts` downloads the page and is the guard against SSRF (public addresses only, checked inside the connection; read its header comment before changing it). `extract.ts` reads the page's schema.org JSON-LD. That data has the ingredients as one flat list, so `groups.ts` adds the group headings ("Sås:") by finding the ingredients in the visible page and taking the `<h1>`–`<h6>` headings that stand between them. It goes by position, not by any site's class names. `createApp` takes `fetchPage` as a dependency, and tests always pass a fake, so no test touches the internet.
- **DB changes:** edit `apps/api/src/db/schema.ts`, run `npm run db:generate`, read the generated SQL, then commit the schema and the `apps/api/drizzle/*` files together. Migrations run _before_ new code goes live, so keep them backwards-compatible: add first, and rename or drop in a later deploy.
- Express 5: async route errors reach `middleware/errors.ts` automatically. Throw `HttpError(status, msg)` for expected errors.
- **The whole site is behind a login.** You log in with an email address from `ALLOWED_EMAILS` and a six-digit code that is emailed to it (`POST /api/auth/request-code`, then `/verify-code`), which sets a signed httpOnly cookie holding the address. In `app.ts`, everything after `api.use(requireAuth(...))` needs that cookie; only `/api/health` and `/api/auth/*` are open. New routes go below that line. `apps/api/src/auth/login-codes.ts` has the rules (10 minutes, 5 guesses per code, 5 codes per address per hour) and keeps them in the `login_codes` table, because in-memory limits don't hold on Vercel. `createApp` takes `sendLoginCode` as a dependency, and tests pass a fake, so no test sends email. In the web app, `RequireAuth` wraps every route except the login page.
- Tests: Vitest. API tests hit a real Postgres (`TEST_DATABASE_URL`, default `localhost:5432/artweb_test`).
- Prettier (single quotes, width 100) and ESLint flat config. Don't hand-format; run `npm run format`.
- Git identity for this repo is Arthur's GitHub noreply email. Never commit his real email or any secrets. That includes the addresses in `ALLOWED_EMAILS`: tests and examples use `@example.com`.

## Deploy pipeline

Two long-lived branches, each deploying its own environment. `dev` is the default branch.

- Feature branches → PR into **`dev`** (CI runs) → merge. A push to `dev` runs `.github/workflows/deploy.yml`: CI, then **Deploy to dev**.
- Release: PR from **`dev` into `main`**, merged with a **merge commit** (never squash, or the branches drift apart). A push to `main` runs CI, then **Deploy to prod**.
- The first job in `ci.yml` ("PRs to main come from dev", a required check) fails any PR into `main` whose head isn't this repo's `dev` branch. The test job waits for it, so a wrong-source PR fails in seconds without running the tests. It passes on PRs into `dev`, because a skipped required check counts as passed.

Deploy jobs (`deploy-env.yml`):

1. CI (`ci.yml`): format, lint, typecheck, tests with a Postgres service, build.
2. **Deploy to dev**: migrate the Neon `dev` branch, run `vercel build` and `vercel deploy --prebuilt`, then point `art-n-jos-dev.vercel.app` at the new deployment via the Vercel REST API.
3. **Deploy to prod**: migrate the Neon `production` branch, run `vercel deploy --prebuilt --prod`, and smoke-test `/api/health`. Merging the release PR is the go-ahead; the `production` environment's required-reviewer approval is optional.

Each branch has its own deploy queue (`concurrency: deploy-<branch>`), so a prod release never blocks dev.

Vercel's own git auto-deploy is **off** (`git.deploymentEnabled: false`). Only GitHub Actions deploys.

`/api/health` returns `{status, env, version, db}`. `version` is the deployed commit SHA, which is useful to confirm a deploy.

## Where config and secrets live (names only, never values)

- **GitHub repo:** secret `VERCEL_TOKEN` (team-scoped); variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DEPLOY_ENABLED=true`.
- **GitHub environments `dev` / `production`:** secret `DATABASE_URL` (Neon **direct** string, used for migrations); variable `APP_URL`.
- **Vercel project env** (Production and Preview): `DATABASE_URL` (Neon **pooled** string), `ALLOWED_EMAILS`, `SESSION_SECRET`, `APP_ENV` (`prod`/`dev`), and `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` for the login emails (a Gmail account with an app password).
- **Neon:** project `art-n-jos`, AWS Frankfurt, branches `production` (default) and `dev` (never auto-deletes). Postgres 18 (CI uses 16; local can be any 16+).

## Decisions and gotchas

- **Hosting:** Vercel Hobby + Neon free, so the cost is $0. Render's free tier was rejected because of its ~1 min cold start. If Vercel's free CPU limit is ever hit, the options are Vercel Pro or moving the API elsewhere.
- **Region:** Vercel functions run in `fra1` (Frankfurt), next to Neon. Neon has no Stockholm region.
- **Public repo:** on GitHub Free, private repos lose environments, environment secrets and required reviewers.
- **`vercel alias set` fails with team-scoped tokens** ("User not found"), even with `--scope`. That's why the dev alias step uses the REST API.
- **Vercel import:** the monorepo auto-detect suggests "Services". The project uses the **Other** preset, and `vercel.json` drives the build.
- **Pooled vs direct DB URL:** the runtime on Vercel uses the pooled URL; migrations in CI use the direct one.
- **Dependabot:** PRs target `dev`. Don't merge TypeScript or @types/node major bumps without checking the tooling. Keep @types/node on 22.x.
- **Local database:** a natively installed Postgres (16+), set up once with `scripts/setup-local-db.sql`. CI gets its own throwaway Postgres through the `services:` block in `ci.yml`.
- **Recipe import depends on the other site:** it needs a schema.org `Recipe` in the page's HTML. Arla and ICA have one. Köket builds its page in the browser, so only the title and description come along. A site may also refuse requests from Vercel's servers that work from a home connection. When an import fails, the user sees a short message and the real reason is in the API log (`Recipe import: could not fetch the page`). The fetch gives up after 15 s, which has to stay under the function's `maxDuration` (30 s, in `vercel.json`).
- **Login emails go through Gmail's SMTP server** (`apps/api/src/auth/mailer.ts`, nodemailer). Services like Resend only send to other people from a domain you own, and the domain isn't bought yet. Without `SMTP_HOST` the code is written to the API log, which is how local dev works; in production the API refuses to start without the SMTP settings.
- **Only the data is locked, not the app's files.** The React bundle is static files on Vercel's CDN, so anyone can download the empty shell. Recipes and plans come from the API, which answers 401 without a session.
- **undici is pinned to 7.x** (`apps/api`): it is the HTTP client behind Node's `fetch`, used directly for its `lookup` hook. 8.x needs Node 22.19 or newer.
- **Planned domain:** jos-n-art.com, not bought yet. See `docs/SETUP.md` step 6.
