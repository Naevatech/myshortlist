# Deploying Shortlist

Shortlist runs as **one Node.js app**: the server answers `/api/*` and also serves the built website, so everything lives on one domain. This guide covers pushing to GitHub and deploying on Hostinger (Business Web Hosting or Cloud plans, which include Node.js web apps).

## 1. Push to GitHub

1. On github.com, create a **new private repository** (for example `shortlist`). Do not add a README, .gitignore or licence.
2. In a terminal in the project folder:

   ```bash
   git init
   git add .
   git status
   ```

   Check the list. It must **not** include `server/.env`, `client/.env`, `node_modules/` or `server/uploads/` (`.gitignore` already excludes them). This should print only the two `.env.example` files:

   ```bash
   git ls-files | grep "\.env"
   ```

3. Commit and push (replace `YOUR-NAME`):

   ```bash
   git commit -m "Shortlist: first version"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/shortlist.git
   git push -u origin main
   ```

   GitHub asks you to sign in the first time. Use the browser sign-in or a personal access token, not your password.

## 2. Before you deploy

- **New secrets.** Generate four values and keep them for step 3:

  ```bash
  node -e "for (let i = 0; i < 4; i++) console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- **The demo account.** The seeded `sam.carter@example.com` has a public password (it is in the README). If production uses the same database, delete that account first, or sign in as it and change the password in Settings. Never run `npm run db:seed` against production.
- **Email.** Make sure your sending domain is verified in Resend and `EMAIL_FROM` uses it.

## 3. Create the app in Hostinger

1. hPanel → **Websites** → **Add Website** → **Node.js web app** → **GitHub**. Connect your GitHub account and pick the `shortlist` repository and the `main` branch.
2. Deploy settings:

   | Field | Value |
   |---|---|
   | Framework preset | Express (or Other) |
   | Node.js version | 22 (20 and 24 also work) |
   | Package manager | npm |
   | Build command | `npm run build:deploy` (applies database migrations, then builds) |
   | Entry file | `server/dist/index.js` |
   | Output directory | leave empty (this is a server app) |

3. Environment variables. Add every variable from `server/.env.example`, with these production values:

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `APP_URL`, `API_URL`, `CORS_ORIGIN` | `https://your-domain.com` (all three the same) |
   | `DATABASE_URL` | Your Hostinger MySQL URL. Use the host shown in hPanel › Databases (often `localhost`). With a local host, leave off `?sslaccept=strict`. Encode `#` in the password as `%23`. |
   | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET` | the four values from step 2 (the server refuses to start with weak ones) |
   | `RUN_SCHEDULER` | `true` (sends approved applications and runs the 7am matches inside the app) |
   | `UPLOAD_DIR` | an absolute folder **outside** the app folder, for example `/home/YOUR-HOSTINGER-USER/shortlist-uploads`. Files inside the app folder are replaced on every deploy. |
   | `GOOGLE_REDIRECT_URI` | `https://your-domain.com/api/auth/google/callback` (if you use Google sign-in) |
   | `RESEND_API_KEY`, `EMAIL_FROM`, `GROQ_API_KEY`, `GROQ_MODEL`, `JOB_PROVIDER`, `ADZUNA_*`, `REED_API_KEY` | as in your local `server/.env` |
   | `VITE_LOGO_DEV_TOKEN` | optional: company logos (read at build time) |

   Do not set `PORT` (Hostinger provides it) or `VITE_API_URL` (the website calls the API on its own domain).

4. Click **Deploy**. When it finishes, open `https://your-domain.com/api/health`. It should show `{"ok":true}`. Then open `https://your-domain.com`.

## 4. After the first deploy

- **Google sign-in.** In Google Cloud Console › Credentials, add `https://your-domain.com/api/auth/google/callback` to the OAuth client's authorised redirect URIs.
- **Remote MySQL.** If `DATABASE_URL` uses the remote IP rather than `localhost`, keep the app's access allowed in hPanel › Databases › Remote MySQL.
- **Updates.** Every push to `main` builds and deploys again automatically. Database migrations run as part of the build.
- **Logs.** Build logs are under **Deployments**; runtime logs are on the app's dashboard.

## Troubleshooting

- **Build fails with "tsc", "vite" or "prisma: not found".** The build needs dev dependencies. Make sure the install step is not set to production-only.
- **Build fails at "db:deploy".** `DATABASE_URL` is wrong or the database cannot be reached during the build. Check the host, the `%23` encoding and Remote MySQL access.
- **The site loads but sign-in fails.** `APP_URL`, `API_URL` and `CORS_ORIGIN` must all be exactly `https://your-domain.com`, with no trailing slash.
- **The server stops at start-up.** Read the runtime log. It names the variable in `server/.env` that is missing or invalid.
