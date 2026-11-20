# Hosting setup (one time, about 30–45 minutes)

When you're done you'll have:

- **GitHub**: your code, CI, the deploy pipeline and the Docker image registry
- **Neon**: managed Postgres with a `production` branch and a `dev` branch
- **Render**: two web services, `art-n-jos-dev` and `art-n-jos-prod`, each running your Docker image

Everything below uses free tiers, so the total is **$0/month**. See [Costs](#costs) at the bottom.

> Do the steps in order. A few of them depend on something created earlier (for example, Render needs the Docker image to exist first).

---

## 1. Put the code on GitHub

1. Create a **new, empty, public** repository on GitHub named `art-n-jos`. Don't add a README, .gitignore or license, because the project already has them.
   _Why public?_ On GitHub's free plan, public repos get unlimited Actions minutes and the "approve before prod" gate. Your secrets are never in the code. They're stored in GitHub, Neon and Render.
2. Make the first commit and push. The folder is already a git repo with every file staged:

   ```bash
   cd ~/Projects/art-web
   npm install                          # creates node_modules (git-ignored)
   git commit -m "Initial commit: recipes app with CI/CD"
   git remote add origin git@github.com:<your-username>/art-n-jos.git
   git push -u origin main
   ```

   (No SSH key set up with GitHub? Use `https://github.com/<your-username>/art-n-jos.git` instead.)

3. Open the **Actions** tab. The **Deploy** workflow runs. It will:
   - ✅ run CI
   - ✅ build the Docker image and push it to `ghcr.io/<your-username>/art-n-jos`
   - ⏭️ skip the deploy jobs (we turn those on in step 5)

4. Make the image public, so Render can pull it without credentials. On your GitHub profile, go to **Packages → art-n-jos → Package settings → Change visibility → Public**.

## 2. Create the databases (Neon)

1. Sign up at https://neon.com (you can log in with GitHub).
2. **Create project**:
   - Name: `art-n-jos`
   - Postgres version: 16 or newer
   - Region: **AWS Europe Central (Frankfurt)**, close to Sweden and to Render's Frankfurt region
3. The project starts with a branch called `production` (or `main`). That's your **prod database**.
4. Go to **Branches → Create branch**, name it `dev`, parent `production`. That's your **dev database**.
5. For each branch, click **Connect** and copy the connection string. It looks like
   `postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`.
   Turn the **"Connection pooling"** toggle **off** so you get the direct connection string.
   Keep both strings somewhere safe for now. You'll paste them into Render and GitHub.

## 3. Create the web services (Render)

Do this twice: once for **dev**, once for **prod**.

1. Sign up at https://render.com (GitHub login works).
2. **New → Web Service → Existing Image**
   - Image URL: `ghcr.io/<your-username>/art-n-jos:latest`
   - Name: `art-n-jos-dev` (and later `art-n-jos-prod`)
   - Region: **Frankfurt**
   - Instance type: **Free**
3. **Environment variables**:

   | Key              | dev value                             | prod value                            |
   | ---------------- | ------------------------------------- | ------------------------------------- |
   | `APP_ENV`        | `dev`                                 | `prod`                                |
   | `DATABASE_URL`   | Neon **dev** branch connection string | Neon **production** connection string |
   | `APP_PASSWORD`   | a password for the dev site           | the password you'll actually use      |
   | `SESSION_SECRET` | a random string (see below)           | a _different_ random string           |

   Generate a secret with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. Under **Advanced → Health Check Path**, enter `/api/health`.
5. Click **Deploy**. The first deploy will start, but the site will show errors until the database has tables, which the pipeline takes care of in step 5.
6. Open the service's **Settings → Deploy Hook** and copy the URL. Treat it like a password.
7. Note the service URL, e.g. `https://art-n-jos-dev.onrender.com`.

## 4. Configure GitHub environments

In your repo: **Settings → Environments**.

### `dev`

- **New environment** → name: `dev`
- **Environment secrets**:
  - `DATABASE_URL`: Neon dev connection string
  - `RENDER_DEPLOY_HOOK_URL`: deploy hook from `art-n-jos-dev`
- **Environment variables**:
  - `APP_URL`: `https://art-n-jos-dev.onrender.com` (no trailing slash)

### `production`

- **New environment** → name: `production`
- ✅ **Required reviewers**: add yourself. This is the "approve before prod" button.
- **Deployment branches**: _Selected branches_ → `main`
- Secrets and variables are the same as for dev, but use the **prod** values (Neon production string, `art-n-jos-prod` deploy hook, prod URL).

## 5. Turn on deployments

1. **Settings → Secrets and variables → Actions → Variables → New repository variable**
   - Name: `DEPLOY_ENABLED`, value: `true`
2. **Actions → Deploy → Run workflow** (or push any commit to `main`).
3. Watch it run: CI → build → deploy to dev. When it pauses at **Deploy to prod**, open the dev URL and check that it works, then click **Review deployments → Approve**.

🎉 You're live.

## 6. Protect `main` (recommended)

**Settings → Rules → Rulesets → New branch ruleset**

- Target: default branch
- ✅ Require a pull request before merging
- ✅ Require status checks to pass: add `Lint, typecheck, test, build` and `Docker image builds`
- ✅ Block force pushes

From now on all changes go through a PR, which is how most teams work.

---

## Troubleshooting

| Symptom                                        | Likely cause / fix                                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| First page load takes ~1 minute                | Normal on Render's free tier. The service sleeps after 15 min of no traffic.                                                 |
| "Run database migrations" fails                | Wrong `DATABASE_URL` secret in that GitHub environment, or the image is private (step 1.4).                                  |
| "Trigger Render deploy" fails with 400         | The Render service's image URL must be `ghcr.io/<you>/art-n-jos:...` in lowercase, same as the pipeline.                     |
| "Wait until the new version is live" times out | Look at the service's **Logs** in Render. Often a missing or invalid environment variable; the app prints exactly which one. |
| Can't log in on the deployed site              | Check `APP_PASSWORD` on that Render service. Cookies need HTTPS, and Render provides it automatically.                       |

**Rolling back:** in Render, open the service → **Events** → pick an earlier deploy → **Rollback**. Or re-run an older successful **Deploy** workflow run in GitHub Actions.

---

## Costs

| Service                  | Plan | Cost              | Limits that matter                                                                                         |
| ------------------------ | ---- | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| GitHub (public repo)     | Free | $0                | Unlimited Actions minutes on public repos. Free container registry for public images.                      |
| Neon                     | Free | $0                | ~1 GB storage and 100 compute-hours per month per project. A recipe site uses a tiny fraction.             |
| Render (2 web services)  | Free | $0                | 750 instance-hours/month shared across services. Services sleep after 15 min idle and take ~1 min to wake. |
| Custom domain (optional) | —    | ~100–150 SEK/year | e.g. via Cloudflare Registrar, Porkbun or Loopia                                                           |

**When you might want to pay:** if the cold start on prod annoys you, upgrade only `art-n-jos-prod` to Render's _Starter_ instance (about $7/month). Dev can keep sleeping.

Free-tier limits change over time, so check the pricing pages for Neon (https://neon.com/pricing) and Render (https://render.com/pricing).
