# Hosting setup (one time, about 30 minutes)

When you're done you'll have:

- **GitHub**: your code, CI, and the deploy pipeline: the `dev` branch deploys the dev site and `main` deploys prod
- **Neon**: managed Postgres with a `production` branch and a `dev` branch
- **Vercel**: hosts the React site on its global network and runs the API as serverless functions in Frankfurt
- **jos-n-art.com** (optional): your own domain

Everything except the domain is on free tiers. See [Costs](#costs) at the bottom.

> Do the steps in order. Wherever you need to paste a secret, keep it out of the code, chat messages and screenshots.

---

## 1. GitHub ✅

Already done: the code is at https://github.com/ArthurJ01/art-n-jos and CI runs on every push.

## 2. Create the databases (Neon)

1. Sign up at https://neon.com (logging in with GitHub works).
2. **Create project**:
   - Name: `art-n-jos`
   - Postgres version: 16 or newer
   - Region: **AWS Europe Central (Frankfurt)**, the same city where the API will run
3. The project starts with a branch called `production` (or `main`). That's your **prod database**.
4. **Branches → Create branch**, name `dev`, parent `production`. That's your **dev database**.
5. For **each** branch, open **Connect** and copy **two** connection strings:
   - **Pooled** (toggle "Connection pooling" **on**; the host contains `-pooler`). The live app uses this one, on Vercel.
   - **Direct** (toggle **off**). The deploy pipeline uses this one to run migrations, on GitHub.

   So you end up with four strings: dev-pooled, dev-direct, prod-pooled, prod-direct.

## 3. Create the Vercel project

1. Sign up at https://vercel.com with **Continue with GitHub** and pick the free **Hobby** plan.
2. **Add New… → Project → Import** `ArthurJ01/art-n-jos`.
   - Framework preset: **Other**
   - Root directory: `./`
   - Leave the build settings alone. They come from `vercel.json`.
3. Click **Deploy**. The first deploy builds the site, but the API will fail until the env vars below are set. That's expected.
   (Vercel's automatic deploy-on-push is switched off in `vercel.json`. From now on, GitHub Actions does the deploys.)
4. **Settings → Environment Variables**. Add each variable below, choosing the environment it applies to:

   | Key              | Production                       | Preview (= dev)             |
   | ---------------- | -------------------------------- | --------------------------- |
   | `DATABASE_URL`   | prod-**pooled** string           | dev-**pooled** string       |
   | `ALLOWED_EMAILS` | who can log in, comma-separated  | the same                    |
   | `SESSION_SECRET` | a random string (see below)      | a _different_ random string |
   | `APP_ENV`        | `prod`                           | `dev`                       |
   | `SMTP_HOST`      | `smtp.gmail.com`                 | the same                    |
   | `SMTP_USER`      | the Gmail address that sends     | the same                    |
   | `SMTP_PASS`      | a Gmail app password (see below) | the same                    |

   Generate random strings with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   **Login emails.** You log in with your email address and a six-digit code that is sent to it. Only the addresses in `ALLOWED_EMAILS` get a code. The codes are sent through a Gmail account, which is free and needs no domain:
   1. On that Google account, turn on **2-Step Verification** (https://myaccount.google.com/security). App passwords don't exist without it.
   2. Create an app password at https://myaccount.google.com/apppasswords (name it `art-n-jos`). Google shows 16 letters once. That is `SMTP_PASS`; paste it without the spaces.
   3. `SMTP_USER` is the account's address. The codes arrive from that address.

   An app password can only send and read mail. It can't change the account, and you can delete it on the same page at any time. The API refuses to start on Vercel if `SMTP_HOST`, `SMTP_USER` or `SMTP_PASS` is missing, since nobody could log in.

   Any other mail provider works too: set `SMTP_HOST`, `SMTP_PORT` (default 465), `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM` if the sender address is not the same as `SMTP_USER`. Once the domain is bought, a provider like Resend can send from it.

5. **Settings → Functions → Function Region**: choose **Frankfurt, Germany (fra1)**, next to the database. `vercel.json` asks for it too, but setting it here makes sure.
6. **Settings → General**: note the **Project ID**. Your **Team ID** (it starts with `team_`) is in your account/team **Settings → General**.
7. Create a token for GitHub Actions: https://vercel.com/account/tokens → **Create**, name `github-actions`, scope your Hobby team, no expiry (or 1 year). Copy it.

## 4. Configure GitHub

In the repo: **Settings → Secrets and variables → Actions**.

**Repository secret**

- `VERCEL_TOKEN`: the token from step 3.7

**Repository variables**

- `VERCEL_ORG_ID`: your Team ID (`team_…`)
- `VERCEL_PROJECT_ID`: the Project ID (`prj_…`)

Then **Settings → Environments**:

### `dev`

- **Deployment branches**: _Selected branches_ → `dev`
- Secret `DATABASE_URL`: dev-**direct** string
- Variable `APP_URL`: `https://art-n-jos-dev.vercel.app` (or `https://dev.jos-n-art.com` once the domain is set up)

### `production`

- _Optional_ **Required reviewers**: add yourself to get an extra "approve before prod" button. Merging the `dev` → `main` release pull request is already the decision to ship, so you can leave this off.
- **Deployment branches**: _Selected branches_ → `main`
- Secret `DATABASE_URL`: prod-**direct** string
- Variable `APP_URL`: the prod address Vercel shows on the project page, e.g. `https://art-n-jos.vercel.app` (or `https://jos-n-art.com` later)

## 5. Turn on deployments

1. **Settings → Secrets and variables → Actions → Variables → New repository variable**
   - Name: `DEPLOY_ENABLED`, value: `true`
2. **Actions → Deploy → Run workflow**, pick the `dev` branch, and run it. Watch CI → **Deploy to dev**, then open the dev URL and check that it works. Dev sits behind Vercel login, so you'll be asked to log in.
3. Run the workflow again on the `main` branch to deploy prod. (If you turned on required reviewers, click **Review deployments → Approve** when it pauses.)

🎉 You're live.

## 6. Custom domain: jos-n-art.com (optional)

1. Buy `jos-n-art.com`, for example at Cloudflare Registrar (about $10.50/year, and renewals cost the same).
2. In Vercel: **Project → Settings → Domains → Add**:
   - `jos-n-art.com`: Production
   - `www.jos-n-art.com`: redirect to `jos-n-art.com`
   - `dev.jos-n-art.com`: don't assign it to a branch. The pipeline points it at each new dev deploy.
3. Vercel shows the DNS records to create (an `A` record for the root and `CNAME` records for `www` and `dev`). Add them in Cloudflare's DNS tab and set them to **DNS only** (grey cloud). Vercel issues the HTTPS certificates automatically.
4. Update the GitHub environment variables: `APP_URL` = `https://dev.jos-n-art.com` (dev) and `https://jos-n-art.com` (production).

## 7. Branches: `dev` and `main`

Every change goes into `dev` first (deploys the dev site), and `main` only takes pull requests from `dev` (deploys prod).

1. Create `dev` from `main`, either on GitHub (the branch dropdown → type `dev` → **Create branch**) or locally: `git switch main && git pull && git switch -c dev && git push -u origin dev`.
2. **Settings → General → Default branch** → `dev`, so new pull requests and clones start from it.
3. **Settings → General → Pull Requests**: keep **Allow merge commits** on (releases use it). Squash merging can stay on for feature pull requests.
4. **Settings → Rules → Rulesets → New branch ruleset**, named `dev`:
   - Target: include by name → `dev`
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass: add `Lint, typecheck, test, build`
   - ✅ Block force pushes
   - ✅ Restrict deletions
5. A second ruleset named `main`, the same as above but targeting `main`, and with both `Lint, typecheck, test, build` and `PRs to main come from dev` as required status checks (source: GitHub Actions). Without the second one, a pull request from another branch only shows a red check and can still be merged. GitHub only offers a check in that list after it has run once; both run on every pull request, so open any pull request first if one is missing.

---

## Troubleshooting

| Symptom                                | Likely cause / fix                                                                                                                                                                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Run database migrations" fails        | Wrong `DATABASE_URL` secret in that GitHub environment (use the **direct** string).                                                                                                                                                                                                                           |
| "Pull Vercel project settings" fails   | `VERCEL_TOKEN`, `VERCEL_ORG_ID` or `VERCEL_PROJECT_ID` is wrong or missing.                                                                                                                                                                                                                                   |
| Site loads but recipes don't (API 500) | **Vercel → Project → Logs**. Usually a missing env var; the app prints exactly which one. Env vars only apply to _new_ deploys, so re-run the workflow after changing them.                                                                                                                                   |
| "Point the dev address…" fails         | The `APP_URL` name is taken by someone else on `vercel.app`. Pick another name, e.g. `art-n-jos-dev-arthur.vercel.app`.                                                                                                                                                                                       |
| No login code arrives                  | Check spam first. Then: is the address in `ALLOWED_EMAILS` for that environment? (The site answers the same either way, on purpose.) After five codes in an hour an address gets no more for a while. If sending failed, **Vercel → Logs** has `Login: could not send the code`, usually a wrong `SMTP_PASS`. |

**Rolling back:** Vercel → Project → **Deployments** → pick an earlier production deploy → **⋯ → Instant Rollback**.

---

## Costs

| Service                | Plan       | Cost         | Limits that matter                                                                                                                                                                                      |
| ---------------------- | ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub (public repo)   | Free       | $0           | Unlimited Actions minutes on public repos.                                                                                                                                                              |
| Neon                   | Free       | $0           | About 1 GB storage and 100 compute-hours per month per project. Sleeps after ~5 min idle, and waking takes well under a second.                                                                         |
| Vercel                 | Hobby      | $0           | Personal, non-commercial use only. About 4 h of _active_ CPU per month, which is hundreds of thousands of API requests. If you hit a limit the API pauses until the month resets; you're never charged. |
| Domain `jos-n-art.com` | Cloudflare | ~$10.50/year | Same price every year.                                                                                                                                                                                  |

**If you outgrow Vercel's free tier:** upgrade to Vercel Pro ($20/month), or move the API to a host with a free tier such as Google Cloud Run while the site stays on Vercel.

Free-tier limits change over time, so check https://neon.com/pricing and https://vercel.com/pricing.
