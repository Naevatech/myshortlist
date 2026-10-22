# BUILD PROMPT: Shortlist, a UK job application assistant

Paste this whole file into your AI coding assistant (Claude Code, Copilot Chat, Cursor) at the root of an empty folder that already contains `server/.env`, `server/.env.example`, `client/.env`, `client/.env.example` and `.gitignore`. Do not overwrite those files. Only add variables to them if you introduce a new one.

---

## 0. Your role and ground rules

You are a senior full-stack engineer and product designer. Build the complete application described below, end to end, with working code. Do not stop to ask questions: where something is not specified, choose the simplest sensible option and list it under "Assumptions" in the README.

Rules that override everything else:

1. **The app never sends or submits anything without the user's explicit approval.** The user taps "Approve and apply". After that there is a short undo window (default 10 seconds, `UNDO_WINDOW_SECONDS`). Only when the window ends is the application sent. This is enforced on the server, not only in the UI.
2. **Do not add features that are not listed.** If a screen feels busy, remove elements until it is quiet.
3. **Never display a match score without a reason** on the same screen.
4. **Never invent facts about the user.** Generated CVs and cover letters may only use information found in the user's own CV and profile. Anything missing is flagged for the user to fill in.
5. **All job listings are placeholders for now** (section 9). The real job API will be plugged in later through one adapter, without changing any other code.
6. Plain, respectful, short copy. British English. No exclamation marks, no emojis, no hype, no jargon. Speak to the user as "you".

---

## 1. Product in one sentence

The app finds UK jobs that match a person's CV, writes a tailored CV and cover letter for each one, and lets the person approve each application with one tap before it is sent. The user always stays in control.

---

## 2. Tech stack

Monorepo with two folders: `client/` and `server/`.

**Client**
- React 18 + TypeScript + Vite
- React Router v6
- TanStack Query for server state
- Tailwind CSS, with the design tokens in section 4 mapped into `tailwind.config` and a small `index.css` of component classes
- `vite-plugin-pwa` (installable PWA: manifest, icons, offline app shell, no offline writes)
- Fonts: Inter, weights 400 and 500 only, loaded with `<link>` from Google Fonts (self-hosting is fine)
- No UI kit. Build the components in section 5 by hand.

**Server**
- Node 20+, Express, TypeScript
- MySQL 8 with Prisma ORM (`provider = "mysql"`), migrations committed
- `zod` for request validation, `helmet`, `cors` (credentials on, origin = `CORS_ORIGIN`), `cookie-parser`, `express-rate-limit`, `pino` logging
- Auth: own implementation (section 8). No Clerk, no Firebase.
- `multer` for CV upload, `pdf-parse` and `mammoth` for text extraction, `pdfkit` (or `puppeteer` if you prefer) for generating PDFs
- `resend` SDK for email, `groq-sdk` and `openai` for AI (behind one interface), `google-auth-library` for Google sign-in
- `node-cron` in development to run scheduled jobs; in production the same jobs are triggered by `POST /api/cron/*` with the `CRON_SECRET` header
- Vitest + Supertest for server tests, Vitest + Testing Library for key client tests

**Scripts (root `package.json`, use npm workspaces)**
`dev` (runs both), `build`, `db:migrate`, `db:seed`, `test`, `lint`.

---

## 3. Repository layout

```
shortlist/
  BUILD_PROMPT.md
  README.md                  (setup, env guide, assumptions, how to plug in the job API)
  .gitignore
  client/
    .env  .env.example
    index.html
    vite.config.ts  tailwind.config.ts  postcss.config.js
    public/ (icons, manifest assets)
    src/
      main.tsx  App.tsx  routes.tsx
      styles/index.css
      lib/ (api.ts, auth.tsx, format.ts)
      components/ (Button, Input, Select, OptionToggle, Switch, Tag, Tabs, JobCard, StatusDot,
                   Skeleton, DocumentPreview, ActionBar, AppShell, Sidebar, TabBar, MobileHeader,
                   EmptyState, ErrorState)
      pages/
        Welcome.tsx  VerifyCode.tsx
        onboarding/ (Onboarding.tsx with steps: UploadCv, Roles, WhereHow, WorkAuth, Ready)
        Today.tsx  JobReview.tsx  CheckAnswers.tsx  FinishOnSite.tsx
        Applications.tsx  ApplicationDetail.tsx  Profile.tsx  Settings.tsx
  server/
    .env  .env.example
    prisma/schema.prisma  prisma/seed.ts
    src/
      index.ts  app.ts  config/env.ts
      middleware/ (auth, error, rateLimit, validate)
      modules/
        auth/  users/  cv/  profile/  preferences/  jobs/  matches/
        documents/  answers/  applications/  settings/  cron/
      services/
        ai/ (provider interface, groq.ts, openai.ts, prompts.ts)
        email/ (provider interface, resend.ts, templates.ts)
        storage/ (local.ts, s3.ts)
        jobs/ (JobProvider interface, placeholder.ts, adzuna.ts stub, reed.ts stub, index.ts)
        send/ (Sender interface: emailSender.ts, formSender.ts stub, siteSender.ts)
        matching.ts  tailoring.ts  pdf.ts
      jobs/ (dailyMatches.ts, processScheduledSends.ts)
      utils/
```

`server/src/config/env.ts` must validate every variable in `server/.env.example` with zod and fail fast with a readable message. Empty optional keys (Google, Resend, Groq, S3, Stripe, etc.) must not crash the app. Features that need a missing key degrade gracefully (see section 12).

---

## 4. Design system (follow exactly)

Mood: calm, trustworthy, like modern banking or legal-tech. Quiet hierarchy: size, weight and spacing create hierarchy, not colour, borders or shadows. No illustrations, gradients, emojis or stock photos. Generous white space: when in doubt, add space rather than content.

### 4.1 Tokens

```css
:root{
  --ink:#111111;      /* headings and body */
  --mut:#6B6B6B;      /* secondary text, 5.3:1 on white */
  --line:#E6E6E6;     /* dividers, card borders */
  --sur:#FAFAFA;      /* subtle surfaces, hover */
  --acc:#1F3A5F;      /* the only accent: primary buttons, links, active nav */
  --ctl:#949494;      /* borders of controls (inputs, outline buttons), 3:1 */
  --ok:#1E6B3A;  --warn:#8A5A00;  --err:#B3261E;   /* status text */
  --dot-ok:#2E7D4F; --dot-warn:#B7791F;            /* status dots */
}
```
- Background pure white `#FFFFFF`. Green only for applied/success, amber only for needs attention, red only for errors.
- Font: Inter. Weights 400 and 500 only. Body 16px, line-height 1.6. Scale: 32 / 24 / 18 / 16 / 14 / 12.
  - Page title: 32px desktop, 24px mobile, weight 500, letter-spacing -0.01em
  - Section heading 18px/500, body 16, small 14, caption 12 (never below 12)
- Spacing: 8px base grid. Page padding 24px mobile, 64px desktop. Content width capped at 720px (reading screens: onboarding, application detail, profile, settings, check answers) and 1040px (lists and job review).
- Radius 8px. Borders 1px `--line`. No shadows except a very soft one on dialogs.
- Motion: fades 150 to 200ms only. Respect `prefers-reduced-motion`.
- Focus: `:focus-visible { outline: 2px solid var(--acc); outline-offset: 2px }` on every interactive element.
- Tap targets at least 44px. Contrast WCAG AA. Readable at 200% zoom. Full keyboard navigation.

### 4.2 Responsive rule
One breakpoint at **760px**. Prefer container-width logic in the app shell; a media query on viewport width 760px is acceptable.

### 4.3 App shell
- **Desktop (>= 760px):** slim left sidebar 216px wide, right border `--line`, padding 48px 32px. Wordmark "Shortlist" at the top (18px/500), then text links Today, Applications, Profile, Settings with 16px gaps (min-height 44px). Active link: accent colour, weight 500. Content area padding 64px.
- **Mobile (< 760px):** slim header (56px, bottom border) with the wordmark linking to Today, and a sticky **bottom tab bar** with 4 items, each a thin outline icon (20px, 1.5px stroke) above a 12px label: Today, Applications, Profile, Settings. Active item: accent colour, weight 500. Page padding 24px.
- No hamburger menu, no tooltips needed for the main flow.
- **Exception:** Job Review and Check answers hide the bottom tab bar on mobile and show the sticky action bar instead (one task per screen).
- Onboarding and Welcome use no app shell.

Icons (inline SVG, viewBox 24, stroke currentColor, stroke-width 1.5, round caps and joins):
- Today: `<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>`
- Applications: `<rect x="3.5" y="7" width="17" height="12" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>`
- Profile: `<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>`
- Settings: `<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>`
- Back chevron: `<path d="M15 6l-6 6 6 6"/>`, close: `<path d="M7 7l10 10M17 7L7 17"/>`

---

## 5. Components

- **Button** (min-height 48px, padding 0 24px, radius 8, 16px/500). Variants: `primary` (accent fill, white text, hover `#17304F`), `outline` (white, 1px `--ctl` border, ink text), `text` (no border, accent text, padding 0 12px, hover `--sur`). **One filled primary button per screen.** Disabled: 40% opacity. Links styled as buttons must be real `<a>` elements.
- **Input / Select / Textarea** (min-height 48px, 1px `--ctl` border, radius 8, padding 0 16px). Always a visible `<label>` (14px/500) above. Warning state: 1px amber border `#B7791F` with an amber helper line that says what is needed.
- **OptionToggle** (button with `aria-pressed`): used for remote/hybrid/on-site, Yes/No, and matches per day. Selected: accent border, accent text, weight 500 (not colour alone).
- **Switch** (`role="switch"`, `aria-checked`): 44x24 track, knob moves 20px. Hit area 44x44.
- **Tag** (44px high, `--sur` background, 1px `--line` border, radius 8). Editable tags have a 44x44 remove button with an accessible label "Remove {name}".
- **Tabs** (`role="tablist"`): text tabs, 32px gap, bottom hairline; active tab ink colour, weight 500, 2px ink underline.
- **JobCard** (whole card is one link): padding 24, 1px `--line` border, hover `--sur`. Contents: title (18/500) with score on the right as small grey text "94 / 100" (not a badge), then "Company · Location" (14 grey), then "Salary · Route label" (14, route label grey), then the one-line reason (14 grey, margin-top 8).
- **StatusDot**: 8px dot + word, 14px. Applied: green dot. Viewed: grey dot. Interview: accent dot. Offer: green dot. Rejected: hollow grey dot. Red is never used for status. The word is always shown.
- **Skeleton**: soft grey `#EFEFEF` bars with a slow opacity pulse (1.6s).
- **DocumentPreview**: white sheet, 1px `--line` border, padding 24, 14px text, line-height 1.75. Changed phrases are marked with a subtle 1px underline (`rgba(31,58,95,.55)`, offset 3px) and the caption "Underlined text was adjusted for this role." In edit mode the sheet becomes `contentEditable`, background `--sur`, 2px accent outline.
- **ActionBar** (sticky bottom of the content column, white, top border). Mobile: primary button full width, then a centred row of text buttons, then a 12px grey note. Desktop: one row, right-aligned: note on the left, text buttons, primary button on the right. DOM order: primary first, then secondary, then note (keyboard users meet the primary action first).
- **Dialog** (only if needed): radius 16, a very soft shadow, focus trap, Esc to close.
- **EmptyState / ErrorState**: one short sentence, optionally one grey helper line, one action. No illustration.

---

## 6. Screens

Provide every screen for mobile (390px) and desktop (1440px). Routes in brackets.

### 6.1 Welcome and sign-in `[/]`
Wordmark top-left. Centred block, max width 440px, vertically centred.
- Headline (H1): "Apply to the right jobs. Approve every one."
- Sentence: "Shortlist finds UK jobs that match your CV and writes each application for you. Nothing is sent until you approve it."
- Email field (label "Email address") and a primary button "Continue".
- Hairline divider with "or", then outline button "Continue with Google".
- Nothing else on the page.
- "Continue" sends a one-time code by email and goes to `VerifyCode` `[/verify]`: H1 "Check your email", sentence "We sent a 6-digit code to {email}. It expires in {OTP_TTL_MINUTES} minutes.", a single 6-digit code input (`inputmode="numeric"`, `autocomplete="one-time-code"`, large type), primary "Continue", text buttons "Send a new code" (disabled for 30s after sending) and "Use a different email". Errors: "That code is not right. Try again." / "That code has expired. We sent you a new one."
- After sign-in: if onboarding is incomplete go to `/onboarding`, else `/today`.

### 6.2 Onboarding `[/onboarding]` (4 steps, one question per screen)
Layout: a 2px progress line fixed at the very top (accent on `--line`, `role="progressbar"`, 25/50/75/100%). Below it a header row with the wordmark on the left and "Step X of 4" (14 grey) on the right. Under the header a 44px row holding a text "Back" button (with chevron) on steps 2 to 4. Content column max 520px, vertically centred. Primary buttons are full width on mobile and 200px+ wide, left-aligned on desktop.

**a. Upload your CV**
- H1 "Upload your CV". Text "We read it to find roles that suit you. PDF or Word, up to 5 MB."
- Drop zone (1px dashed `--ctl`, radius 8): desktop shows "Drag your CV here" and "or"; both show outline button "Browse files" and caption "PDF or DOCX". Validate type and size client and server side.
- Reading state: H1 "Reading your CV", text "This takes a few seconds.", a box with the file name and size and four soft skeleton lines. Poll or await the parse endpoint.
- Confirmation: H1 "Here is what we found", text "Check this looks right. You can change any of it later in Profile." Rows (label grey 14 / value): Name, Latest role, Experience, Skills (first 4 and "and N more"), Education. Primary "Looks right", text button "Replace CV".
- Failure: "We could not read this file. Try a PDF or Word document." with an outline "Try again".

**b. What roles are you looking for?** Text "Add job titles. We will also look at close matches." Field "Job title" with an outline "Add" button (Enter also adds), tags below with remove buttons. Pre-fill suggestions from the parsed CV's latest roles. Primary "Continue" disabled until at least one role.

**c. Where and how?** Text "We only show roles that fit these." Location (text), Distance (select: 5, 10, 15, 25, 50 miles), Work style (OptionToggles: Remote, Hybrid, On-site, multi-select), Minimum salary per year (text, GBP). Primary "Continue".

**d. Work authorisation** Text "We use this only to filter roles. You can change it later." Two questions, each with Yes/No OptionToggles: "Do you have the right to work in the UK?" and "Will you need visa sponsorship?". Primary "Continue".

**e. You are ready** H1 "You are ready". Text "Each morning we will bring you the best new matches. You review every one, and nothing is sent until you approve it." Primary "Go to Today". On entering this step call `POST /api/onboarding/complete`, which also generates the first matches.

### 6.3 Today (home) `[/today]`
- H1 "Good morning, {firstName}." (use "Good afternoon" / "Good evening" by local time). Under it (18px grey) "{n} new matches are ready for your review." (singular for 1). Under that (14 grey) "Nothing is sent until you approve it."
- Vertical list of JobCards, 16px gap. Show up to 4 by default. A text button "See all {n} matches" expands the list in place; it becomes "Show fewer". The whole card links to `/jobs/:matchId`.
- Card route label comes from the job's apply route: "Sent by email", "Form filled for you", "You finish on their site".
- States:
  - Empty: "There are no new matches today." / "We will look again tomorrow morning. If you want to see more roles, you can widen your search." / primary "Review your preferences".
  - Loading: skeleton header lines and four skeleton cards.
  - Error: "We could not load your matches." / "Check your connection and try again. Your applications are safe." / primary "Try again".
  - All reviewed (success): green dot + "All matches reviewed", H1 "You are all caught up.", text "We will bring you new matches tomorrow morning.", outline "View your applications".

### 6.4 Job review `[/jobs/:matchId]` (the most important screen)
Layout: single column on mobile; on desktop a two-column grid inside a 1040px container, columns 5fr / 6fr, 64px gap (job on the left, documents on the right). A text "Today" back button with chevron sits above.

Left column:
1. Header: H1 job title, then company (18), location and work mode (grey), salary (`£48,000 to £58,000`), then a small block: bold 14 route label (e.g. "Applies through a form on their site") and a grey 14 explanation.
2. "Why this matches" (section heading), "Match score 94 / 100" (14 grey), then exactly **three** brief points.
3. Text button "Read full description" / "Hide full description" (`aria-expanded`). Expanded text is 14px.

Right column ("Your documents"):
- Tabs "CV" and "Cover letter" with a text button "Edit" / "Done" on the right of the tab row.
- DocumentPreview of the active tab. Underline changed phrases. Saving edits (on "Done") stores the edited document (`editedByUser = true`).
- Caption (12 grey): "Written from your CV. Please check before sending. Underlined text was adjusted for this role."

ActionBar (see section 5): primary label depends on the route, text buttons "Skip" and "Save for later", note "Nothing is sent until you approve it."
- Route `email`: primary "Approve and apply".
- Route `form`: primary "Review answers" which opens `CheckAnswers`.
- Route `site`: primary "Open application page" which opens `FinishOnSite`.
- "Skip" and "Save for later" update the match status and return to Today.

**Approval confirmation** (replaces the page content, no bar, vertically centred, max 520px): green dot "Approved", H1 "Your application is on its way.", text "We will {send your CV and cover letter to {company} | submit your application form, CV and cover letter to {company}} in {n} seconds. You can still undo this." (live countdown, `aria-hidden`; plus a visually hidden `role="status"` line "Approved. You can undo for 10 seconds."), outline button "Undo". When the countdown ends it shows the **sent** state: green dot "Sent", H1 "Application sent." (form route: "Application submitted."), text "Your CV and cover letter went to {company}. You can follow its progress in Applications.", primary "Back to Today", text "View applications". Undo returns to the review page (form route: back to Check answers).

States: loading (skeleton for both columns, disabled action bar), error ("We could not load this job." / "Check your connection and try again. Nothing has been sent." / primary "Try again" / text "Back to Today").

### 6.5 Check your answers `[/jobs/:matchId/answers]` (route `form` only)
Back button "Back to job". H1 "Check your answers". Text "The {company} application form asks these questions. We filled them in from your CV. Check each one before you approve." A column of labelled fields (max 720px): full name, email, phone, right to work in the UK, notice period, "Why do you want to work at {company}?" (textarea), salary expectation. Each field has a grey 12px helper: "From your CV.", "From your profile.", or "Drafted from the job description and your CV. Please check." A field the system could not fill (e.g. notice period) gets an amber border and the helper "Needs your answer. We could not find this in your CV." The primary "Approve and apply" stays **disabled** until every field marked `needsAttention` has a value; the bar note then reads "Add your {field} to continue." Approving starts the same undo flow as 6.4.

### 6.6 Finish on their site `[/jobs/:matchId/finish]` (route `site` only)
Centred, max 520px. H1 "Finish on the {company} site." Text "We opened their application page in a new tab. Your CV and cover letter are ready to upload. Come back and tell us when you have applied, so we can track it." Primary "I have applied" (creates an application with status Applied and route `site`, event "You applied on the employer's site"), outline "Download CV and cover letter" (two PDFs in a zip or one at a time), text link "Open the page again" (`target="_blank" rel="noopener noreferrer"`). The success screen uses the "Added to Applications." wording: "We will track it from here. We did not send anything for this job."

### 6.7 Applications (tracker) `[/applications]`
- H1 "Applications". Tabs All, Active, Closed. Active = Applied, Viewed, Interview, Offer. Closed = Rejected (and withdrawn).
- Desktop: a simple table (Role, Company, Date, Status). The role is a link; the whole row is clickable (pseudo-element stretch). Column headers 12 grey. Row padding 20px 16px 20px 0, bottom hairline.
- Mobile: a list. Each row is a link: role (500), "Company · date" (14 grey), then status dot and word.
- Dates formatted `12 Oct 2026`, tabular numerals.
- States: empty ("You have not applied to anything yet." / "When you approve an application, you can follow it here." / primary "Review today's matches"), loading (skeleton rows), error ("We could not load your applications." / "Check your connection and try again." / primary "Try again").

### 6.8 Application detail `[/applications/:id]`
Max 720px. Back button "Applications". H1 role, company (18), "Place · Applied {date}", status dot + word. Sections spaced 64px apart:
- **Timeline** (ordered list, hairline between items, date in a 96px column then event text; newest first; the latest event in weight 500 with an optional grey detail line).
- **Documents sent** (rows with name, grey "PDF · Sent {date}", and a text button "View" that opens the stored PDF).
- **Notes** (textarea labelled "Only you can see your notes", outline "Save note").
Status values and events are updated by: the send job (Applied), the user (site route), and manual status updates in a later version. For now the user can change a status from the detail page only if you add a minimal select under the header, otherwise leave statuses read-only. Prefer read-only.

### 6.9 Profile and CV `[/profile]`
Max 720px. H1 "Profile" with outline "Replace CV" on the right (wraps below on mobile).
- **Your CV** (section heading, grey 14 "Read from {fileName}. Edit anything that looks wrong."). Rows separated by hairlines, each: label (14/500), content, text button "Edit": Contact, Summary, Experience (several entries), Education, Skills (read-only tags).
- **Preferences** ("We use these to choose which roles to show you."): Roles (tags), Location (e.g. "Belfast, within 15 miles" and work style), Minimum salary. Each with "Edit".
- Edit opens the row inline as form fields with outline "Save" and text "Cancel". Replace CV runs the upload and parse again and asks the user to confirm the new details (same "Here is what we found" screen).

### 6.10 Settings `[/settings]`
Max 720px. H1 "Settings". Sections:
- **Account:** Email (with "Change"), Sign in with (Google or Email code), text button "Sign out".
- **Email notifications:** switches "New matches" ("One short email each morning when new matches are ready.") and "Application updates" ("When an employer views or replies to an application.").
- **Matches per day:** OptionToggles 3, 5, 10. Helper "How many new matches we show you each day. Fewer is calmer."
- **Data and privacy:** outline "Download my data" ("A copy of your CV, documents and application history."), text "Delete my account" ("This removes your CV, documents and application history. It cannot be undone.") which opens a confirmation dialog.
- **How Shortlist uses your data:** a `--sur` box with three short paragraphs: "We use your CV, preferences and work authorisation to find jobs and to write your CV and cover letter for each one." / "We never send an application without your approval. We do not sell your data, and employers only receive what you approve." / "You can download or delete everything at any time."

---

## 7. Application routes (how a job is applied to)

Each job has an `applyRoute`:
- `email`: the listing provides an application email address. After the undo window the server emails the user's CV and cover letter (PDF attachments) to that address using the email service, with the user's name and a short plain message, `Reply-To` set to the user's email.
- `form`: the employer's site has a form. The app drafts answers (section 10.4) and the user checks them on Check answers. Submission uses a `FormSender`. **In version 1, `FormSender` is a stub** that returns `{ ok:false, reason:"not_supported" }`. When that happens, the application is created with status "Approved" and the user is shown the Finish on their site flow for that job (so nothing silently fails). The interface must make it possible to add browser automation later (Browserbase keys are already in `.env.example`).
- `site`: the user finishes on the employer's site (section 6.6). Nothing is sent by the app.

---

## 8. Authentication (own implementation)

- **Email one-time code:** `POST /api/auth/request-code { email }` creates or finds the user, stores a hashed 6-digit code (SHA-256 with a server secret, or bcrypt) with `expiresAt = now + OTP_TTL_MINUTES`, sends it by email. `POST /api/auth/verify-code { email, code }` checks the hash, expiry, attempts (`OTP_MAX_ATTEMPTS`), marks it consumed, sets `emailVerifiedAt`, issues session cookies. Always return the same response for unknown and known emails (no user enumeration). In development, if `RESEND_API_KEY` is empty, log the code to the server console instead of sending.
- **Google:** `GET /api/auth/google` redirects to Google consent (scopes `openid email profile`), `GET /api/auth/google/callback` verifies the ID token, creates or links the user by verified email, issues session cookies, redirects to `APP_URL`. Use `state` and PKCE or a signed state cookie. If `GOOGLE_CLIENT_ID` is empty, hide the Google button (`GET /api/config` returns `{ googleEnabled }`).
- **Sessions:** short-lived JWT access token (`ACCESS_TOKEN_TTL`) and a rotating refresh token (`REFRESH_TOKEN_TTL`), both in `httpOnly`, `secure` (in production), `sameSite=lax` cookies. Store only a hash of each refresh token in the database, rotate on use, revoke on sign-out. `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/me`.
- **CSRF:** because cookies are used, require a custom header (`X-Requested-With: shortlist`) on all state-changing requests and check `Origin` against `CORS_ORIGIN`.
- **Rate limits:** 5 code requests per email per hour and 20 per IP per hour; 10 verify attempts per IP per 15 minutes; general API limit 300 per 15 minutes.
- Account deletion and data export are in section 11.

---

## 9. Job listings: placeholders now, real API later

Create `server/src/services/jobs/` with:

```ts
export interface RawJob {
  externalId: string;
  title: string; company: string; location: string;
  workMode: 'remote' | 'hybrid' | 'onsite';
  salaryMin?: number; salaryMax?: number;
  description: string; requirements: string[];
  postedAt: string;
  applyRoute: 'email' | 'form' | 'site';
  applyUrl?: string; applyEmail?: string;
  raw?: unknown;
}
export interface JobProvider {
  name: string;
  search(q: { roles: string[]; location: string; radiusMiles: number;
              workModes: string[]; minSalary?: number; limit: number }): Promise<RawJob[]>;
}
```

- `placeholder.ts` returns the fixed list below (filter loosely by roles/location, but always return at least 6 so the UI is never empty in development).
- `adzuna.ts` and `reed.ts` are stubs that read `ADZUNA_APP_ID/KEY` and `REED_API_KEY` and throw `NotConfiguredError` with a clear message and a comment showing where to map the API response to `RawJob`. A generic `custom.ts` reads `JOBS_API_BASE_URL` and `JOBS_API_KEY`.
- `index.ts` picks the provider from `JOB_PROVIDER` (`placeholder` by default). **Switching provider is the only change needed to go live.**
- Persist everything fetched into the `jobs` table (unique on `provider + externalId`) so matches always reference stored rows.
- Use `.example` email domains and `#` or `https://example.com/...` URLs for placeholders. Do not use real company names.

Placeholder jobs (use exactly these; write 2 to 3 sentence descriptions and 4 requirements for each in the same style as the example in 6.4):

| # | Title | Company | Place / mode | Salary | Route |
|---|---|---|---|---|---|
| 1 | Frontend Engineer | Halden & Moore | Belfast, hybrid (three days in the office) | £48,000 to £58,000 | form |
| 2 | Full-Stack Developer | Northfield Labs | Remote, UK | £50,000 to £60,000 | email |
| 3 | Software Engineer, Payments | Kestrel Payments | Belfast, on-site | £52,000 to £62,000 | site |
| 4 | React Developer | Ashgrove Digital | Lisburn, hybrid | £42,000 to £50,000 | email |
| 5 | Web Developer | Lumen Transport | Remote, UK | £44,000 to £52,000 | form |
| 6 | Frontend Developer | Carrick Data | Belfast, hybrid | £46,000 to £54,000 | site |

Job 1 description for reference: "Halden & Moore builds scheduling software for care providers across the UK and Ireland. You will join a team of six engineers working on the customer web app. You will build and maintain features in React and TypeScript, work with designers on new screens, and help improve performance and accessibility." Requirements: two or more years of professional React experience; confident with TypeScript; experience working with REST APIs; comfortable in a hybrid team, three days a week in Belfast. Form questions for job 1: full name, email, phone, right to work in the UK, notice period, "Why do you want to work at Halden & Moore?", salary expectation.

Add `form_schema` (JSON array of questions) to jobs of route `form`. The placeholder provides it; real providers can leave it empty and the server will fall back to a default set (name, email, phone, right to work, notice period, a motivation question, salary expectation).

---

## 10. Backend behaviour

### 10.1 Data model (Prisma, MySQL)
Use `cuid()` or UUID string ids, `createdAt`/`updatedAt` on everything, `@@index` on foreign keys and on the lookups below.

- `User`: id, email (unique), name, googleId?, emailVerifiedAt, onboardingCompletedAt?, matchesPerDay (3|5|10, default `DEFAULT_MATCHES_PER_DAY`), notifyNewMatches (bool, default true), notifyAppUpdates (bool, default true), deletedAt?
- `OtpCode`: id, email, codeHash, expiresAt, attempts, consumedAt?
- `RefreshToken`: id, userId, tokenHash, expiresAt, revokedAt?, userAgent?, ip?
- `Cv`: id, userId, fileKey, fileName, mime, size, rawText (LONGTEXT), parsedJson, isActive
- `Profile`: userId (pk), fullName, email, phone?, location, summary, experienceJson, educationJson, skillsJson
- `Preferences`: userId (pk), rolesJson, location, radiusMiles, workStylesJson, minSalary?, rightToWorkUk (bool), needsSponsorship (bool)
- `Job`: id, provider, externalId, title, company, location, workMode, salaryMin?, salaryMax?, description (TEXT), requirementsJson, applyRoute (enum), applyUrl?, applyEmail?, formSchemaJson?, postedAt, rawJson?; unique (provider, externalId)
- `Match`: id, userId, jobId, score (0 to 100), reasonsJson (exactly 3 strings), reasonLine (one line), status (`new`, `viewed`, `skipped`, `saved`, `applied`), matchedOn (date); unique (userId, jobId)
- `Document`: id, matchId, type (`cv`, `cover_letter`), blocksJson, editedByUser, version, pdfKey?
- `FormAnswer`: id, matchId, key, label, value, source (`cv`, `profile`, `ai`, `user`), needsAttention (bool)
- `Application`: id, userId, matchId, jobId, route, status (`approved`, `applied`, `viewed`, `interview`, `offer`, `rejected`, `withdrawn`), approvedAt, scheduledSendAt?, sentAt?, undoneAt?, sendError?, notes (TEXT), idempotencyKey (unique)
- `ApplicationEvent`: id, applicationId, type, label, detail?, occurredAt
- `AuditLog`: id, userId, action, metaJson, createdAt

Document `blocksJson` format (so the UI can underline changes):
```json
[{ "type":"heading","segments":[{"text":"Sam Carter","changed":false}] },
 { "type":"paragraph","segments":[{"text":"Full-stack developer with three years of experience building ","changed":false},{"text":"customer-facing React and TypeScript applications","changed":true},{"text":".","changed":false}] },
 { "type":"bullets","items":[[{"text":"Built a component library","changed":true}]] }]
```
When the user edits, store the new blocks with every segment `changed:false` that the user typed over left unmarked is acceptable; keep it simple.

### 10.2 API (all under `/api`, JSON, validated with zod, cookie auth unless noted)
- Auth: `POST /auth/request-code`, `POST /auth/verify-code`, `GET /auth/google`, `GET /auth/google/callback`, `POST /auth/refresh`, `POST /auth/logout`, `GET /me`, `GET /config` (public: `{ googleEnabled }`)
- CV and onboarding: `POST /cv` (multipart, field `file`; stores, extracts text, parses with AI, returns parsed profile), `GET /cv/active`, `POST /onboarding/complete`
- Profile: `GET /profile`, `PATCH /profile`
- Preferences: `GET /preferences`, `PUT /preferences`
- Matches: `GET /matches/today` (returns `{ total, items }` for today, ordered by score), `GET /matches/:id` (job + reasons + documents, marks viewed), `POST /matches/:id/skip`, `POST /matches/:id/save`
- Documents: `GET /matches/:id/documents`, `PUT /documents/:id` (user edits), `POST /matches/:id/documents/regenerate`, `GET /documents/:id/pdf`
- Answers (form route): `GET /matches/:id/answers`, `PUT /matches/:id/answers`
- Applications: `POST /matches/:id/approve` (creates the application, sets `scheduledSendAt = now + UNDO_WINDOW_SECONDS`, returns `{ applicationId, scheduledSendAt }`), `POST /applications/:id/undo` (only valid before `scheduledSendAt` and before sending), `POST /matches/:id/applied-on-site` (site route), `GET /applications?filter=all|active|closed`, `GET /applications/:id` (with events and documents), `PATCH /applications/:id/notes`
- Settings: `GET /settings`, `PATCH /settings` (notifications, matchesPerDay), `GET /me/export` (JSON download), `DELETE /me` (requires `{ confirm: true }`)
- Cron (header `x-cron-secret: $CRON_SECRET`): `POST /cron/daily-matches`, `POST /cron/process-sends`, `GET /health`

**Approval rules enforced on the server:** `approve` requires an authenticated owner of the match, an existing document pair, and, for `form` routes, no unresolved `needsAttention` answers. It is idempotent (same `idempotencyKey` returns the same application). The sender job `processScheduledSends` runs every 5 seconds in development (and via `/cron/process-sends` or a long-running worker in production), picks applications with `status = approved`, `undoneAt IS NULL`, `sentAt IS NULL` and `scheduledSendAt <= now`, locks each row (`UPDATE ... WHERE id=? AND sentAt IS NULL`), sends through the matching `Sender`, then sets `status = applied`, `sentAt`, writes the event "You approved and applied", marks the match `applied`, and emails nothing else. On failure it records `sendError`, adds a calm event, and surfaces it to the user as "We could not send this application. Nothing was sent." with a retry.

### 10.3 CV parsing and matching
- Extract text (`pdf-parse` for PDF, `mammoth` for DOCX). Reject files over `MAX_CV_SIZE_MB`, wrong MIME or magic bytes, or empty text.
- Parse with the AI service into a strict JSON schema (name, email, phone, location, headline, summary, experience[{title, company, start, end, bullets[]}], education[], skills[], yearsExperience). Validate with zod; retry once on invalid JSON. If no AI key is set, fall back to a simple rule-based parser (regex for email/phone, section headings) so development still works.
- `daily-matches`: for each user with `onboardingCompletedAt`, fetch jobs from the provider using their preferences, upsert jobs, score each against the profile, keep the top `matchesPerDay` that are not already matched, create `Match` rows for today, generate tailored documents, and email the "New matches" notification if enabled. Run at `DAILY_MATCH_HOUR` UK time (`Europe/London`).
- **Scoring:** a number 0 to 100 plus exactly three brief reasons and one single-line reason. With an AI key use the AI (temperature 0.2, JSON output). Without one, compute a deterministic score from title similarity, skills overlap, location/work-mode fit, salary vs minimum, and generate reason text from templates (for example "Your React and TypeScript experience matches the main requirements.", "The role is hybrid in Belfast, which fits your location and work style.", "The salary range is above your minimum of £45,000."). If a role falls below the user's minimum salary, say so honestly in the reason ("The salary range starts below your minimum.").

### 10.4 Tailoring (CV, cover letter, form answers)
- **CV:** start from the user's parsed CV. Reorder and lightly rephrase existing content to fit the job description. Mark phrases that were changed as `changed:true`. Never add employers, dates, qualifications, tools or numbers that are not in the CV. No invented metrics.
- **Cover letter:** 3 short paragraphs plus sign-off, plain language, first person, UK spelling, under 220 words, grounded only in the CV and the job description. Mark job-specific sentences as `changed:true`.
- **Form answers:** map each question in the job's `formSchema` to a profile/preferences value when possible (`source: cv | profile`). Open questions are drafted by the AI (`source: ai`). Anything that cannot be answered from known data (for example notice period) is left empty with `needsAttention: true`.
- All AI calls: system prompt states the no-fabrication rule; output validated with zod; store prompt version with the document. Log token usage, never log CV text.

### 10.5 Email
- Templates (plain, short, no marketing): sign-in code, "New matches" ("You have {n} new matches to review." with a button-style link to `{APP_URL}/today`), application email to employers, application update. Subject lines in sentence case.
- With no `RESEND_API_KEY`, log emails to the console in development.

---

## 11. Privacy and security (UK GDPR aware)

- Validate and sanitise every input. Parameterised queries only (Prisma). Escape any HTML in generated documents. `helmet` defaults plus a strict `Content-Security-Policy` for the API.
- Store CVs outside the web root (`UPLOAD_DIR`) or in S3-compatible storage with private ACLs and short-lived signed URLs. Never serve the uploads folder statically.
- Do not log personal data, CV text, OTP codes (except the development fallback) or tokens.
- `GET /me/export` returns a JSON file with the user's profile, preferences, CV text, matches, documents, answers, applications and events.
- `DELETE /me` soft-deletes immediately (blocks sign-in), then a purge job hard-deletes the user's rows and files within 30 days; the confirmation dialog says exactly what is removed.
- Consent line on first sign-in is not needed on the Welcome screen (kept minimal). Link a plain privacy note in Settings (section 6.10). Add a short `PRIVACY.md` stub in the repo describing what is stored.
- Encrypt any stored third-party tokens with `ENCRYPTION_KEY` (AES-256-GCM).

---

## 12. Graceful degradation (no keys yet)

The app must run locally with only MySQL and the `.env` as provided:
- No `RESEND_API_KEY`: codes and emails are printed to the server console.
- No `GOOGLE_CLIENT_ID`: Google button hidden.
- No `GROQ_API_KEY`/`OPENAI_API_KEY`: rule-based CV parser, deterministic scoring with template reasons, and template-based tailoring (reuse CV bullets verbatim, template cover letter using the job title, company and two CV facts). Clearly mark in the README that AI quality needs a key.
- `JOB_PROVIDER=placeholder`: the six placeholder jobs.
- `STORAGE_DRIVER=local`: files in `UPLOAD_DIR`.
- Email-route sends in development with no email key: log "would send" and still record the application as sent in the UI, flagged `dryRun` in the event detail.

---

## 13. Accessibility, PWA and performance

- Semantic HTML: `<header>`, `<nav aria-label="Main">`, `<main>`, headings in order, one H1 per page. Real `<button>`, `<a href>`, `<label for>`. Icon-only buttons have `aria-label`. Decorative SVGs `aria-hidden`.
- Tabs follow the ARIA tabs pattern with arrow-key support. Live regions for the undo countdown (announce once) and form errors. Move focus to the page heading on route change. Skip link at the top of every page.
- Visible focus on everything. Colour is never the only signal (status words, selected-state weight, amber helper text).
- Works at 200% zoom without horizontal scroll. Respect `prefers-reduced-motion`.
- PWA: `manifest.webmanifest` (name "Shortlist", theme and background `#FFFFFF`, accent `#1F3A5F` for theme colour), 192/512/maskable icons (a simple wordmark-free square with the letter S in Inter 500 on white with a thin accent border; generate as SVG then PNG), service worker caching the app shell and static assets only. API responses are not cached for writes.
- Code-split routes; images none; keep the client bundle lean.

---

## 14. Seed data and tests

- `prisma/seed.ts`: one demo user "Sam Carter" (sam.carter@example.com, onboarding complete), a parsed profile, preferences (Belfast, 15 miles, hybrid, £45,000, right to work yes, sponsorship no), the six placeholder jobs, matches for today, generated documents, and six sample applications for the tracker: Full-Stack Developer, Ferngate Systems, 12 Oct 2026, Applied; Software Engineer, Oakridge Software, 9 Oct 2026, Viewed; React Developer, Quay Street Digital, 6 Oct 2026, Interview; Web Developer, Marlow & Reed, 2 Oct 2026, Offer; Frontend Developer, Brightwater Health, 28 Sep 2026, Rejected; Platform Engineer, Tern Analytics, 24 Sep 2026, Rejected. The Interview application has the timeline: 11 Oct "Interview invitation received", 8 Oct "Application viewed", 6 Oct "You approved and applied".
- Server tests: OTP flow (expiry, attempts, enumeration), approve/undo/send timing and idempotency (an application cannot be sent before `scheduledSendAt`, cannot be sent after undo, cannot be sent twice), route rules (form answers with `needsAttention` block approval), job provider switching, auth guards on every route, data export and deletion.
- Client tests: Welcome to verify flow, onboarding step validation, Today states, Job review approve then undo, Check answers disabled state, Applications filter tabs.
- `npm test` must pass before you declare the work finished.

---

## 15. Build order (commit after each milestone)

1. Monorepo scaffold, env validation, Prisma schema, first migration, health route, lint and format.
2. Design tokens, Tailwind config, base components, AppShell (sidebar, tab bar, mobile header), router skeleton, PWA setup.
3. Auth (OTP, Google, sessions, `/me`), Welcome and Verify screens.
4. CV upload, parsing, storage; onboarding steps a to e; profile and preferences endpoints.
5. Job provider interface + placeholders; matching; daily matches job; Today screen with all four states.
6. Tailoring and documents; Job review screen (both layouts, tabs, edit, underline of changed text, description toggle).
7. Approval, undo, scheduled sending, confirmation screens; email route end to end (dry run without a key).
8. Form route: answers drafting, Check answers screen, `FormSender` stub with fallback to Finish on their site; site route screen.
9. Applications tracker, detail page, notes, timeline; Profile and Settings; export and delete.
10. Accessibility pass, empty/loading/error states on every main screen, tests, README, PRIVACY.md.

---

## 16. Definition of done

- `npm install && npm run db:migrate && npm run db:seed && npm run dev` brings up the app with the demo data; a new user can sign in with an emailed code (console in dev), upload a CV, complete onboarding, see placeholder matches, review a tailored CV and cover letter, approve with a 10-second undo, and see the application in the tracker.
- Nothing is ever sent without approval; the undo window works; this is covered by tests.
- Every screen exists for 390px and 1440px and matches section 4 to 6 (spacing, type, one primary button per screen, one accent colour).
- Empty, loading, error and success states exist for Today, Job review and Applications.
- Switching `JOB_PROVIDER` is the only change needed to use a real job API, and the README explains exactly how to map an API response to `RawJob`.
- README documents setup, every environment variable (where to get it, whether it is required), assumptions, and known limits (AI quality without a key, form automation stubbed).
