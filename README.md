# art-n-jos

A small full-stack web app for collecting recipes. It also works as a practice project for professional software engineering setups: a monorepo, a typed API, a real database, tests, CI/CD, and separate dev and prod environments.

```
             ┌──────────────────── Vercel ────────────────────┐
 Browser ───▶│ /*      React app (global CDN)                 │
             │ /api/*  Express API, serverless (Frankfurt)    │───▶ Postgres (Neon, Frankfurt)
             └────────────────────────────────────────────────┘
```

| Layer       | Tech                                                            |
| ----------- | --------------------------------------------------------------- |
| Frontend    | React 19, TypeScript, Vite, React Router, TanStack Query        |
| API         | Node 22, Express 5, Zod validation, Pino logging                |
| Database    | PostgreSQL 16 through Drizzle ORM, with SQL migrations          |
| Shared code | `packages/shared`: Zod schemas and types used by both sides     |
| Tests       | Vitest, Supertest (API against a real DB), Testing Library      |
| Quality     | ESLint, Prettier, TypeScript strict mode                        |
| CI/CD       | GitHub Actions → Vercel CLI (`dev` branch → dev, `main` → prod) |
| Hosting     | Vercel (site + API), Neon (Postgres). Free tiers, so $0/month   |

## Project structure

```
.
├── apps/
│   ├── api/                 Express API
│   │   ├── src/
│   │   │   ├── app.ts       builds the Express app (routes, middleware)
│   │   │   ├── index.ts     starts the server (local)
│   │   │   ├── vercel.ts    entry used on Vercel
│   │   │   ├── env.ts       validated environment variables
│   │   │   ├── db/          schema, client, migrate & seed scripts
│   │   │   ├── routes/      /api/recipes, /api/meal-plan, /api/auth
│   │   │   ├── auth/        login codes: making, checking and emailing them
│   │   │   ├── import/      reads a recipe from a link to another site
│   │   │   └── middleware/  auth + error handling
│   │   ├── drizzle/         generated SQL migrations (commit these!)
│   │   └── test/            API integration tests
│   └── web/                 React app
│       └── src/
│           ├── pages/       one component per route
│           ├── components/
│           └── lib/         API client + hooks, helpers
├── packages/shared/         types & validation shared by api and web
├── .github/workflows/       CI and deploy pipelines
├── api/index.js           Vercel serverless entry (wraps the Express app)
├── vercel.json            Vercel build, rewrites and region
├── scripts/setup-local-db.sql  one-time local database setup
└── docs/SETUP.md            step-by-step hosting setup
```

## Running it locally

You need **Node 22+** and **PostgreSQL 16+** installed locally (the installer from https://www.postgresql.org/download/ works on Windows and macOS).

```bash
npm install                 # install everything (all workspaces)
cp .env.example .env        # local config. Put your email in ALLOWED_EMAILS
psql -U postgres -f scripts/setup-local-db.sql   # once: creates the artweb login and databases
npm run db:migrate          # create the tables
npm run db:seed             # (optional) add a few example recipes
npm run dev                 # API on :3000 + web on :5173
```

On Windows the PostgreSQL installer doesn't add `psql` to your PATH. Use the full path instead, e.g. `& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -f scripts/setup-local-db.sql` in PowerShell.

Open http://localhost:5173 and log in with an address from `ALLOWED_EMAILS` in your `.env`. The whole site is behind the login. Locally no email is sent: the six-digit code is printed in the terminal running `npm run dev` (look for `SMTP_HOST is not set`).

### Useful scripts (run from the repo root)

| Command               | What it does                                                     |
| --------------------- | ---------------------------------------------------------------- |
| `npm run dev`         | Run API and web in watch mode                                    |
| `npm test`            | Run all tests (the API tests need the local database)            |
| `npm run lint`        | ESLint                                                           |
| `npm run format`      | Auto-format with Prettier                                        |
| `npm run typecheck`   | TypeScript in all workspaces                                     |
| `npm run build`       | Production build of web and API                                  |
| `npm run db:generate` | Create a new migration after editing `apps/api/src/db/schema.ts` |
| `npm run db:migrate`  | Apply migrations to the database in `DATABASE_URL`               |

## Day-to-day workflow

There are two long-lived branches. Each one deploys its own environment:

```
feature branch ──PR──▶ dev  ──merge──▶ deploys the dev site
dev            ──PR──▶ main ──merge──▶ deploys prod
```

1. Start from the latest `dev`: `git switch dev && git pull`, then `git switch -c feature/favourite-recipes`.
2. Make your change, and add or adjust tests.
3. Push and open a pull request **into `dev`** (the default branch). **CI** runs a format check, lint, typecheck, tests and build.
4. Merge it. The **Deploy** pipeline runs CI again, migrates the **dev** database and deploys the dev site (it shows a `DEV` badge). Merge as many pull requests into `dev` as you like.
5. When the dev site looks right, release: open a pull request from **`dev` into `main`** and merge it with **"Create a merge commit"**. The pipeline migrates the **prod** database and deploys **prod**.

Pull requests into `main` from any branch other than `dev` fail the "PRs to main come from dev" check.

**Why a merge commit for releases?** "Squash and merge" writes dev's changes into `main` as one brand-new commit that `dev` doesn't have. Git then sees the branches as different, so every later release pull request shows old changes again and can conflict. Squashing feature pull requests into `dev` is fine.

### Changing the database

1. Edit `apps/api/src/db/schema.ts`.
2. Run `npm run db:generate`. This writes a new SQL file in `apps/api/drizzle/`. Read it!
3. Run `npm run db:migrate` to apply it locally.
4. Commit the schema change and the migration together.

Migrations run **before** the new code goes live, so for a short time the old code runs against the new schema. Prefer additive changes (add a nullable column, then use it). Rename or drop things in a later, separate deploy.

## Deploying

See **[docs/SETUP.md](docs/SETUP.md)** for a one-time setup of Neon, Vercel, GitHub and the domain.

## Ideas for what to build next

- Image uploads for recipes (e.g. Cloudflare R2 or Supabase Storage)
- Pagination on the recipe list
- "Import from URL" that reads a recipe website's JSON-LD
- End-to-end tests with Playwright in CI
- Error tracking (Sentry free tier) and uptime monitoring
- A shopping list that combines ingredients from several recipes
