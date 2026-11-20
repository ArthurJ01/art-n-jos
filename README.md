# art-n-jos

A small full-stack web app for collecting recipes. It also works as a practice project for professional software engineering setups: a monorepo, a typed API, a real database, tests, Docker, CI/CD, and separate dev and prod environments.

```
             ┌──────────────────── Vercel ────────────────────┐
 Browser ───▶│ /*      React app (global CDN)                 │
             │ /api/*  Express API, serverless (Frankfurt)    │───▶ Postgres (Neon, Frankfurt)
             └────────────────────────────────────────────────┘
```

| Layer       | Tech                                                           |
| ----------- | -------------------------------------------------------------- |
| Frontend    | React 19, TypeScript, Vite, React Router, TanStack Query       |
| API         | Node 22, Express 5, Zod validation, Pino logging               |
| Database    | PostgreSQL 16 through Drizzle ORM, with SQL migrations         |
| Shared code | `packages/shared`: Zod schemas and types used by both sides    |
| Tests       | Vitest, Supertest (API against a real DB), Testing Library     |
| Quality     | ESLint, Prettier, TypeScript strict mode                       |
| Packaging   | Multi-stage Dockerfile (built in CI; ready for Cloud Run etc.) |
| CI/CD       | GitHub Actions → Vercel CLI (dev → approval → prod)            |
| Hosting     | Vercel (site + API), Neon (Postgres). Free tiers, so $0/month  |

## Project structure

```
.
├── apps/
│   ├── api/                 Express API
│   │   ├── src/
│   │   │   ├── app.ts       builds the Express app (routes, middleware)
│   │   │   ├── index.ts     starts the server (local / Docker)
│   │   │   ├── vercel.ts    entry used on Vercel
│   │   │   ├── env.ts       validated environment variables
│   │   │   ├── db/          schema, client, migrate & seed scripts
│   │   │   ├── routes/      /api/recipes, /api/auth
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
├── Dockerfile
├── docker-compose.yml       local Postgres
└── docs/SETUP.md            step-by-step hosting setup
```

## Running it locally

You need **Node 22+** and **Docker** (for the local database).

```bash
npm install                 # install everything (all workspaces)
cp .env.example .env        # local config. Edit APP_PASSWORD if you like
npm run db:up               # start Postgres in Docker
npm run db:migrate          # create the tables
npm run db:seed             # (optional) add two example recipes
npm run dev                 # API on :3000 + web on :5173
```

Open http://localhost:5173 and log in with the `APP_PASSWORD` from your `.env`.

### Useful scripts (run from the repo root)

| Command               | What it does                                                     |
| --------------------- | ---------------------------------------------------------------- |
| `npm run dev`         | Run API and web in watch mode                                    |
| `npm test`            | Run all tests (needs `npm run db:up` for the API tests)          |
| `npm run lint`        | ESLint                                                           |
| `npm run format`      | Auto-format with Prettier                                        |
| `npm run typecheck`   | TypeScript in all workspaces                                     |
| `npm run build`       | Production build of web and API                                  |
| `npm run db:generate` | Create a new migration after editing `apps/api/src/db/schema.ts` |
| `npm run db:migrate`  | Apply migrations to the database in `DATABASE_URL`               |

## Day-to-day workflow

1. Create a branch: `git switch -c feature/favourite-recipes`
2. Make your change, and add or adjust tests.
3. Push and open a pull request. **CI** runs lint, typecheck, tests, build and a Docker build.
4. Merge into `main`. The **Deploy** pipeline then:
   1. runs CI again,
   2. runs DB migrations on **dev** and deploys to dev (a Vercel preview),
   3. waits for your **approval**, then migrates the prod DB and deploys to **prod**.
5. Check the dev site (it shows a `DEV` badge). If it looks right, approve the prod deploy in the Actions tab.

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
- Real user accounts (one login per person) instead of a shared password
- Pagination on the recipe list
- "Import from URL" that reads a recipe website's JSON-LD
- End-to-end tests with Playwright in CI
- Error tracking (Sentry free tier) and uptime monitoring
- A shopping list that combines ingredients from several recipes
