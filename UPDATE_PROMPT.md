# Shortlist: update prompt (design changes only)

You are working on the existing Shortlist codebase (React 18 + TypeScript + Vite + Tailwind client, Node 20 + Express + Prisma + MySQL server, own auth with JWT in httpOnly cookies). Apply **only** the changes below. Do not change anything else, do not add features that are not listed, keep the existing design rules: white background, one accent `#1F3A5F`, Inter, 8px grid, 8px radius, one filled primary button per screen, red only for errors.

---

## 1. Sidebar icons (desktop)

In `Sidebar`, every link gets a 20px outline icon before the label, the same icons the mobile tab bar uses. Move the icons into one shared file (`components/icons.tsx`) and use it in both `Sidebar` and `TabBar`.

- Link: `display:flex; align-items:center; gap:12px; min-height:44px`. Links are 16px apart.
- Icon: inline SVG, `viewBox="0 0 24 24"`, `width/height 20`, `fill="none"`, `stroke="currentColor"`, `stroke-width 1.5`, round caps and joins, `aria-hidden="true"`. It takes the link colour: grey `#6B6B6B` by default, ink on hover, accent and weight 500 when `aria-current="page"`.

```tsx
export const TodayIcon = () => (<svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>);
export const ApplicationsIcon = () => (<svg {...p}><rect x="3.5" y="7" width="17" height="12" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/></svg>);
export const ProfileIcon = () => (<svg {...p}><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>);
export const SettingsIcon = () => (<svg {...p}><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>);
// const p = { viewBox:'0 0 24 24', width:20, height:20, fill:'none', stroke:'currentColor', strokeWidth:1.5, strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':true } as const;
```

---

## 2. Match score pill

Replace the grey "94 / 100" text everywhere with a light pill.

- New component `ScorePill`: text `{score}%`, then a visually hidden `<span class="sr-only"> match score</span>`.
- Style: `inline-flex; align-items:center; padding:2px 10px; border-radius:8px; background:#E9EEF5; color:#1F3A5F; font-size:14px; font-weight:500; line-height:1.5; white-space:nowrap; font-variant-numeric:tabular-nums`.
- **JobCard:** the title row is `flex; justify-content:space-between; align-items:center; gap:16px`, with the title on the left and `ScorePill` on the right.
- **Job review**, under "Why this matches": `Match score <ScorePill score={94} />` (the label in 14px grey), followed by the three reasons as before.
- The rule stays: never show a score without its reason on the same screen.

---

## 3. Posted age on job cards and Job review

Show how long ago each job was posted.

- Shared helper `client/src/lib/postedAge.ts`:

```ts
export function formatPostedAge(postedAt: string | Date, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(postedAt).getTime()) / 86_400_000);
  if (days < 1) return 'Posted today';
  if (days === 1) return 'Posted 1 day ago';
  if (days < 7) return `Posted ${days} days ago`;
  if (days < 14) return 'Posted 1 week ago';
  return 'Posted 2 weeks ago';
}
```

- **JobCard:** add a last line under the reason, 12px grey, `margin-top:4px`: `Posted 2 days ago`.
- **Job review:** add the same 12px grey line directly under the "Company · Location" line at the top.
- Never show a raw date or time. Add unit tests for 0, 1, 2, 6, 7, 13 and 14 days.
- The API must return `postedAt` (ISO string) on every match and job response.

---

## 4. Only fetch jobs from the last 2 weeks

- New env: `JOBS_MAX_AGE_DAYS=14` and `JOBS_MIN_AGE_DAYS=0`. Set the minimum to 1 to hide jobs posted today. Validate both in `config/env.ts`, with max between 1 and 30 and min between 0 and max.
- Extend the provider query in `services/jobs/types.ts`:

```ts
search(q: { roles: string[]; location: string; radiusMiles: number; workModes: string[];
            minSalary?: number; limit: number; postedAfter: Date; postedBefore: Date }): Promise<RawJob[]>;
```

- In `services/jobs/index.ts`, compute `postedAfter = now - JOBS_MAX_AGE_DAYS` and `postedBefore = now - JOBS_MIN_AGE_DAYS`. Pass both to the provider; real providers map them to their own parameter (Adzuna `max_days_old`, Reed `postedWithin`).
- Filter again on `postedAt` after the provider returns, because not every provider supports the filter.
- Drop jobs with a missing or unparseable `postedAt`; never guess a date.
- Sort the remaining jobs newest first before scoring.
- **daily-matches cron:** skip any job outside the window, and mark matches whose job has aged out so they no longer appear on Today.
- **Placeholder provider:** give each job a `postedAt` relative to now so the samples always fall inside the window. Job 1 is 2 days old, job 2 is 1 day, job 3 is 5 days, job 4 is 7 days, job 5 is 3 days and job 6 is 14 days.

---

## 5. Matches per day up to 30

- **Settings:** OptionToggles `3, 5, 10, 15, 20, 25, 30` (they wrap on mobile), default 5. Helper text: "How many new matches we show you each day. Fewer is calmer."
- **Prisma:** `matchesPerDay Int @default(5)`. Validate with zod as `z.union([3,5,10,15,20,25,30].map(z.literal))`.
- **New env:** `MAX_MATCHES_PER_DAY=30`, used as the upper bound.
- **Today:** the copy reads "{n} new matches are ready for your review." Show 4 cards, then a text button "See all {n} matches" or "Show fewer".

---

## 6. Sign in, sign up, forgot password, reset, sign out

Auth changes from email code only to **email and password, Google, and an email verification code at sign up**. Every screen below is centred, max width 440px, with no app shell, the wordmark top-left and one primary button.

### 6.1 Client routes

| Route | Screen |
|---|---|
| `/` | Welcome |
| `/signin` | Sign in, including the error state |
| `/signup` | Create account |
| `/verify` | Verify email |
| `/forgot` | Forgot password, then the "Check your email" state |
| `/reset?token=` | Choose new password, then the Done or Expired state |
| `/signed-out` | Signed out |

- Everything else sits behind an auth guard that redirects to `/signin?next=…` and returns the user to `next` after sign-in.
- A signed-in user who opens a public auth route goes to `/today`.

### 6.2 Screens and copy

- **Welcome (`/`)**
  - H1 "Apply to the right jobs. Approve every one."
  - Text "Shortlist finds UK jobs that match your CV and writes each application for you. Nothing is sent until you approve it."
  - Primary "Get started", which goes to `/signup`.
  - Below it: "Already have an account? Sign in", which goes to `/signin`.
- **Sign in (`/signin`)**
  - H1 "Sign in".
  - Fields: "Email address" and "Password". The password field has a Show/Hide text button inside it (44px hit area).
  - A text button "Forgot password?" sits on the same row as the Password label, on the right.
  - Primary "Sign in", then a hairline divider with "or", then outline "Continue with Google".
  - Footer: "New to Shortlist? Create an account".
  - Error state: both fields get a red border, with `role="alert"` text above them: "That email or password is not right. Try again." Never say which field was wrong.
  - After 5 failed attempts: "Too many attempts. Try again in 15 minutes."
  - After a successful sign-in: an unverified user goes to `/verify`, a user who hasn't finished onboarding goes to `/onboarding`, everyone else goes to `next` or `/today`.
- **Create account (`/signup`)**
  - H1 "Create your account", text "Use your email or Google. Next, you will upload your CV."
  - Fields: "Email address" and "Password" (helper "At least 8 characters.").
  - Primary "Create account", divider "or", outline "Continue with Google".
  - Footer: "Already have an account? Sign in".
  - Errors: "Enter a valid email address." and "Use at least 8 characters."
  - On success, go to `/verify`.
- **Verify email (`/verify`)**
  - H1 "Check your email", text "We sent a 6-digit code to {email}. It expires in 10 minutes."
  - One code input (`inputmode="numeric"`, `autocomplete="one-time-code"`).
  - Primary "Continue". Text buttons "Send a new code" (disabled for 30 seconds) and "Use a different email".
  - Errors: "That code is not right. Try again." and "That code has expired. We sent you a new one."
  - On success, go to `/onboarding`.
- **Forgot password (`/forgot`)**
  - H1 "Reset your password", text "Enter your email and we will send you a link to choose a new one."
  - Field "Email address", primary "Send reset link", text "Back to sign in".
  - Sent state, which replaces the form:
    - H1 "Check your email".
    - Text "If there is an account for {email}, we have sent a link to reset your password. The link expires in 30 minutes."
    - Outline "Send the link again" (disabled for 30 seconds) and text "Back to sign in".
    - Always show this state, whether or not the account exists.
- **Choose new password (`/reset?token=`)**
  - On load, call `GET /api/auth/reset/validate`. If the token is not valid, show the Expired state straight away.
  - Form: H1 "Choose a new password", text "Use at least 8 characters."
  - Fields "New password" and "Confirm new password" (error "The passwords do not match."), primary "Update password".
  - **Done** state:
    - Green dot with "Password updated".
    - H1 "You can sign in now."
    - Text "Your password has been changed. For your security, you have been signed out on your other devices."
    - Primary "Sign in".
  - **Expired** state:
    - H1 "This link has expired."
    - Text "Reset links work once and expire after 30 minutes. Request a new one."
    - Primary "Send a new link", which goes to `/forgot`.
- **Signed out (`/signed-out`)**
  - H1 "You have signed out."
  - Text "Your matches, documents and applications are saved. Sign in again whenever you are ready."
  - Primary "Sign in".

Reuse the existing `Input`, `Button`, `Divider` and `StatusDot` components. Add a `PasswordInput` component with the Show/Hide toggle (`aria-pressed`, label "Show password" / "Hide password").

### 6.3 Settings changes (Account section)

- **Email** row: unchanged.
- **Password** row:
  - Shows "Last changed {date}" from `passwordChangedAt`, with a text button "Change".
  - "Change" calls `POST /api/me/password/reset-link` and shows the inline message "We have sent a link to {email}. It expires in 30 minutes."
  - Hide this row for Google-only accounts.
- **Sign in with**: "Google" or "Email and password".
- **Sign out**: a text button that opens a confirm dialog.
  - Dialog: title "Sign out of Shortlist?", text "You can sign back in at any time.", primary "Sign out", text "Cancel".
  - Radius 16, focus trap, Esc closes it.
  - Confirming calls `POST /api/auth/logout`, clears the TanStack Query cache, then goes to `/signed-out`.

### 6.4 Server

**Prisma changes**

```prisma
model User {
  // add:
  passwordHash      String?    // null for Google-only accounts
  passwordChangedAt DateTime?
  failedSignins     Int        @default(0)
  lockedUntil       DateTime?
  resetTokens       PasswordResetToken[]
}

model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  ip        String?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

Keep `OtpCode`, but use it only for email verification at sign up. Create a migration named `auth_password_reset`.

**Endpoints** (all under `/api`, validated with zod)

- `POST /auth/signup { email, password }`
  - Password must be at least `MIN_PASSWORD_LENGTH` and not on the common-passwords list.
  - Hash it with argon2id (or bcrypt cost 12).
  - Send the verification code. The response is the same whether or not the email already exists.
- `POST /auth/signin { email, password }`
  - Return one generic 401 for both a wrong email and a wrong password.
  - When the user doesn't exist, hash a dummy password so the timing matches.
  - After 5 failures in 15 minutes, set `lockedUntil` for 15 minutes.
  - On success: reset the failure counter, issue the session cookies, and return `{ user, needsVerify, needsOnboarding }`.
- `POST /auth/verify-code { email, code }` and `POST /auth/resend-code { email }`: keep the existing code logic.
- `POST /auth/forgot { email }`
  - Always returns 202 with the same body.
  - If the user exists: create 32 random bytes, store only the SHA-256 hash, set `expiresAt = now + PASSWORD_RESET_TTL_MINUTES`, and email `${APP_URL}/reset?token=…`.
  - In development without `RESEND_API_KEY`, log the link to the console instead.
- `GET /auth/reset/validate?token=` returns 200 or 410.
- `POST /auth/reset { token, password }`
  - Checks the hash, the expiry and that the token hasn't been used.
  - Sets `passwordHash` and `passwordChangedAt`, then marks the token used.
  - **Revokes every refresh token for the user.**
  - Returns 200. It does not sign the user in. A bad, used or expired token returns 410.
- `POST /me/password/reset-link` (signed in): sends the same reset email to the user's own address.
- `POST /auth/logout`: revokes the current refresh token and clears both cookies.
- `POST /auth/logout-all`: revokes every refresh token for the user.

**Rate limits**

- 5 reset or verification emails per address per hour, and 20 per IP per hour.
- 10 sign-in attempts per IP per 15 minutes.

**Logging:** never log passwords, password hashes, reset tokens or codes. The one exception is the development console fallback above.

---

## 7. Env changes

Add these to `server/.env` and `server/.env.example`, and validate them in `config/env.ts`:

```env
# Password reset link lifetime and password rules
PASSWORD_RESET_TTL_MINUTES=30
MIN_PASSWORD_LENGTH=8

# Only fetch and show jobs posted within this window (days). 14 = 2 weeks.
# Set MIN to 1 to skip jobs posted today.
JOBS_MAX_AGE_DAYS=14
JOBS_MIN_AGE_DAYS=0

# Options in Settings: 3, 5, 10, 15, 20, 25, 30
MAX_MATCHES_PER_DAY=30
```

Keep `OTP_TTL_MINUTES` and `OTP_MAX_ATTEMPTS`; they are now used only for email verification.

---

## 8. Tests to add

- `formatPostedAge` boundaries: 0, 1, 2, 6, 7, 13 and 14 days.
- Job window: jobs older than `JOBS_MAX_AGE_DAYS`, newer than `JOBS_MIN_AGE_DAYS`, or without `postedAt` are excluded, and the result is sorted newest first.
- `matchesPerDay` accepts only 3, 5, 10, 15, 20, 25 and 30.
- Sign in: the same error for an unknown email and a wrong password, and the lockout after 5 failures.
- Forgot: the same 202 for unknown and known emails.
- Reset: the token works once, expires after 30 minutes, and revokes all sessions.
- Logout clears the cookies and revokes the refresh token.
- Route guards: protected routes redirect to `/signin?next=`, and a signed-in user is redirected away from the auth routes.
- Accessibility: the sidebar icons are `aria-hidden`, the score pill has the hidden "match score" text, and the error messages use `role="alert"`.

## 9. Order of work

1. Env and Prisma migration.
2. Auth endpoints and their tests.
3. Auth screens and route guards.
4. Settings changes (password row, sign-out dialog, matches per day).
5. Job window in the provider and the cron.
6. `formatPostedAge`, `ScorePill` and the sidebar icons in the UI.
7. Run the full test suite and check every screen at 390px and 1440px.
