# Shortlist

Shortlist finds UK jobs that match a person's CV, writes a tailored CV and cover letter for each one, and lets the person approve each application with one tap before it is sent. Nothing is sent without approval, and there is a 10-second undo window that the server enforces.

- `client/`: React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind, installable PWA
- `server/`: Node 20+, Express 5, TypeScript, Prisma with MySQL 8 (MariaDB 10.4+ also works)

The UI follows the reference design (the "Shortlist, UK job application assistant" canvas). Its `shared.css` is ported almost verbatim into `client/src/styles/index.css`, so class names such as `.btn`, `.job`, `.doc` and `.bar` match the design markup. The one breakpoint is at 760px.

## Quick start

```bash
npm install
npm run db:migrate      # local database: creates it and applies prisma/migrations
                        # online database: use `npm run db:deploy` instead
npm run db:seed         # demo user, today's six matches, six tracked applications
npm run dev             # API on :4000, app on :5173
```

Open http://localhost:5173 and sign in as **sam.carter@example.com** with the password **Shortlist-demo-2026** (demo data only).

## Signing in

- **Accounts:** email and password, or Google. A new account gets a 6-digit code by email to verify the address, then goes to onboarding.
- **Wrong details:** one message for a wrong email or a wrong password. After 5 failures in 15 minutes the account is locked for 15 minutes.
- **Forgot password:** always shows the same "Check your email" message. The link works once and expires after `PASSWORD_RESET_TTL_MINUTES` (30). Resetting signs the account out on every device, straight away.
- **Older accounts** made with the email code only have no password yet: use "Forgot password?" to choose one.
- **Where emails go:** without `RESEND_API_KEY`, codes and reset links are printed in the server console. Test addresses (`example.com`, `.example`, `.test`) are always printed there, never sent.

Other scripts: `npm run build`, `npm test` (server and client), `npm run lint`.

### Requirements

- Node 20 or later
- MySQL 8 (or MariaDB 10.4+) running locally, with the user in `DATABASE_URL` able to create databases. `prisma migrate dev` also needs a temporary "shadow" database.
- Server tests use a separate database, `shortlist_test` (or `TEST_DATABASE_URL`). It is reset before every run.

## Environment variables

`server/.env` is validated on start-up (`server/src/config/env.ts`). A missing required value stops the server with a readable message. Empty optional keys never crash the app: the feature that needs them degrades instead (see "Running without keys").

| Variable | Required | What it is / where to get it |
|---|---|---|
| `NODE_ENV` | yes | `development`, `test` or `production` |
| `PORT` | yes | API port, default 4000 |
| `APP_URL` | yes | Public URL of the React app (links in emails, redirect after Google sign-in) |
| `API_URL` | yes | Public URL of this API |
| `CORS_ORIGIN` | yes | Allowed browser origin(s), comma-separated. Also used for the CSRF origin check |
| `DATABASE_URL` | yes | `mysql://USER:PASSWORD@HOST:3306/shortlist` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | yes | `openssl rand -hex 32` each. In production they must be at least 32 characters |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL` | yes | For example `15m` and `30d` |
| `COOKIE_DOMAIN` | no | Leave empty locally; for example `.shortlist.app` in production |
| `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS` | yes | Email verification code lifetime, and wrong attempts allowed per code |
| `PASSWORD_RESET_TTL_MINUTES` | yes | Reset link lifetime, default 30 |
| `MIN_PASSWORD_LENGTH` | yes | Default 8. Very common passwords are refused too |
| `ENCRYPTION_KEY` | yes | `openssl rand -hex 32`. AES-256-GCM key for any stored third-party tokens |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | Google Cloud Console › Credentials › OAuth client (web). Empty hides the Google button |
| `GOOGLE_REDIRECT_URI` | no | `{API_URL}/api/auth/google/callback`. Add the same URI in Google Cloud |
| `EMAIL_PROVIDER` | yes | `resend` |
| `RESEND_API_KEY` | no | https://resend.com. Empty prints emails to the console |
| `EMAIL_FROM` | yes | Sender, for example `Shortlist <hello@your-domain.com>`. The domain must be verified in Resend |
| `AI_PROVIDER` | yes | `groq` or `openai` (the other key is used as a fallback if only that one is set) |
| `GROQ_API_KEY`, `GROQ_MODEL` | no | https://console.groq.com |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | no | https://platform.openai.com |
| `JOB_PROVIDER` | yes | `placeholder` (default), `adzuna`, `reed` or `custom`, or several joined by commas (`adzuna,reed`) |
| `JOBS_API_BASE_URL`, `JOBS_API_KEY` | no | For `custom` |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | no | https://developer.adzuna.com |
| `REED_API_KEY` | no | https://www.reed.co.uk/developers |
| `STORAGE_DRIVER` | yes | `local` or `s3` |
| `UPLOAD_DIR` | yes | Local storage folder, outside any web root. Never served statically |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | for `s3` | Any S3-compatible store (AWS S3, Cloudflare R2). Objects are private |
| `MAX_CV_SIZE_MB` | yes | Upload limit, default 5 |
| `CRON_SECRET` | yes | Sent as `x-cron-secret` to `POST /api/cron/*` |
| `DAILY_MATCH_HOUR` | yes | Hour (UK time) for the morning run |
| `DEFAULT_MATCHES_PER_DAY` | yes | 3, 5, 10, 15, 20, 25 or 30 |
| `MAX_MATCHES_PER_DAY` | yes | Highest option offered in Settings, default 30 |
| `JOBS_MAX_AGE_DAYS`, `JOBS_MIN_AGE_DAYS` | yes | Only jobs posted within this window are fetched and shown, newest first. Defaults 14 and 0; set the minimum to 1 to hide jobs posted today |
| `UNDO_WINDOW_SECONDS` | yes | Seconds between approval and sending, default 10 |
| `BROWSERBASE_*`, `STRIPE_*`, `SENTRY_DSN` | no | Reserved for later; unused in version 1 |

`client/.env`: `VITE_API_URL` (the API's URL) and `VITE_APP_NAME`. Never put secrets there.

## Running without keys

The app runs with only MySQL and the `.env` as provided:

- **No `RESEND_API_KEY`:** sign-in codes and all emails are printed in the server console. Email-route applications are recorded as sent, with "dryRun" in the event detail. Application detail shows this as "Development mode: … no email left Shortlist."
- **No `GOOGLE_CLIENT_ID`:** the Google button is hidden (`GET /api/config` returns `googleEnabled: false`).
- **No AI key:** a rule-based CV parser, deterministic scoring with template reasons, and template tailoring (CV bullets reused verbatim and reordered; a template cover letter built from the job title, company and two facts from the CV). **Writing quality is much better with an AI key.**
- **`JOB_PROVIDER=placeholder`:** the six placeholder jobs (`server/src/services/jobs/placeholder.ts`).
- **`STORAGE_DRIVER=local`:** files are stored in `UPLOAD_DIR`.

## How sending works

1. **Approve and apply** calls `POST /api/matches/:id/approve` with an idempotency key. The server checks ownership, that both documents exist, and (form route) that no answer still needs attention. It then creates the application with `scheduledSendAt = now + UNDO_WINDOW_SECONDS`.
2. **Undo** (`POST /api/applications/:id/undo`) only succeeds before `scheduledSendAt` and before sending starts.
3. `processScheduledSends` claims each due row with a conditional update (`WHERE sentAt IS NULL AND undoneAt IS NULL`), so nothing is sent twice and nothing undone is ever sent. In development it runs every 5 seconds, plus a one-off timer just after each window. In production, call `POST /api/cron/process-sends` (for example every 10 seconds) or keep the server process running.
4. Routes: **email** sends both PDFs to the listing's address with `Reply-To` set to the applicant. **form** uses `FormSender`, which is a stub in version 1: it returns `not_supported`, and the user is taken to "Finish on their site". **site**: the user applies on the employer's site and taps "I have applied".

Daily matches: `POST /api/cron/daily-matches` (development: `node-cron` at `DAILY_MATCH_HOUR`, Europe/London).

## Real job listings (Adzuna or Reed)

Both UK adapters are implemented. To switch from the placeholder jobs:

1. Get a free developer key: Adzuna (https://developer.adzuna.com, gives an app ID and an app key) or Reed (https://www.reed.co.uk/developers, gives one API key).
2. In `server/.env`, set `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` with `JOB_PROVIDER=adzuna`, or `REED_API_KEY` with `JOB_PROVIDER=reed`.
3. Restart the server. New matches come from the real API. Existing matches stay as they are.

How the adapters behave:
- Up to three of the user's roles are searched separately, near their location and within their distance (a remote-only search is not limited to a town). Results are merged and duplicates removed.
- The work mode is read from the listing text (hybrid, remote, otherwise on-site).
- Only real annual salaries are kept. Adzuna's estimated salaries and Reed's day or hour rates are dropped, so salary reasons stay honest.
- Listings use the "site" route: the user downloads the tailored CV and cover letter, applies through the listing's link, then taps "I have applied".
- Descriptions are the snippets the APIs return (about 500 characters), so matching and tailoring work from shorter text than the placeholders have.
- If the job API fails during onboarding, onboarding still completes and the morning run tries again.

To add another source, implement `JobProvider` (`server/src/services/jobs/types.ts`) in a new file and add it to `createJobProvider` in `server/src/services/jobs/index.ts`. `custom.ts` is a generic adapter for your own API (`JOBS_API_BASE_URL`, `JOBS_API_KEY`).

## Assumptions

- After "Approve and apply", a short "Sending it now." line can show for a moment while the client confirms the send with the server, before "Application sent.".
- A form application that falls back (`not_supported`) is listed in Applications as "Finish on their site" with an amber dot. A failed email send is listed as "Not sent", with **Try again** on its detail page (`POST /api/applications/:id/retry`).
- "Save for later" keeps a match on Today (on later days too) until it is skipped or applied to.
- Uploading a CV (onboarding or Profile › Replace CV) replaces the profile details straight away. The "Here is what we found" screen then confirms them.
- The deterministic score is shown on a 30–96 scale, so a rule-based score never claims a perfect match.
- Location fit uses a text match on the town (no geocoding), so a nearby town gets an honest "check the commute" reason.
- Right-to-work and sponsorship answers are stored and used in form answers. The placeholder jobs have no sponsorship data, so they are not filtered on it.
- Profile › Experience and Education allow adding and removing entries, so a bad parse can be fixed.
- Change of email sends a code to the new address (`POST /api/me/email/request` and `/verify`).
- Deleted accounts are blocked at once and hard-deleted (rows and files) by the daily run once seven days have passed.
- Application statuses are read-only. Updates from employers are not tracked in version 1.
- Generated PDFs use Helvetica (no font files bundled).

## Known limits

- AI quality needs a Groq or OpenAI key. Without one, tailoring only reorders your own content and adds one templated sentence.
- Form submission is stubbed (`server/src/services/send/formSender.ts`). Browser automation (for example Browserbase) can be added there without other changes.
- Adzuna and Reed give description snippets and apply links only, so real listings are finished on the employer's site.

## Tests

```bash
npm test               # server (Vitest + Supertest, needs MySQL) then client (Vitest + Testing Library)
```

Server tests cover the OTP flow (expiry, attempts, no enumeration), refresh rotation, CSRF, approve/undo/send timing and idempotency, route rules, auth guards on every route, provider switching, data export and deletion, and the CV parser. Client tests cover Welcome → Verify, onboarding validation, Today states, Job review approve then undo, Check answers' disabled state, and the Applications filter tabs.
