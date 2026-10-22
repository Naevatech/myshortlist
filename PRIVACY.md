# Privacy note (draft)

This is a short description of what Shortlist stores and why. It is a starting point, not legal advice.

## What we store

- **Account:** your email address, your name, how you sign in (email code or Google), and your notification and matches-per-day settings.
- **Your CV:** the file you upload, the text we extract from it, and the details we read from it (contact details, summary, experience, education, skills).
- **Preferences:** the roles you want, location and distance, work style, minimum salary, right to work in the UK and whether you need sponsorship.
- **Matches and documents:** jobs we matched to you, the score and reasons, and the CV and cover letter we wrote for each one (including your edits) as PDFs.
- **Form answers:** the answers we drafted and the ones you typed.
- **Applications:** what you approved, when, what was sent and to which address, status updates and your private notes.
- **Security records:** hashed sign-in codes and hashed session tokens, and an audit log of actions such as sign-in, approval, export and deletion (no CV text).

## How we use it

We use your CV, preferences and work authorisation to find jobs and to write your CV and cover letter for each one. We never send an application without your approval, and you can undo for a short time afterwards. Employers only receive what you approve. We do not sell your data.

## Where it is kept

Files are kept in private storage (a local folder outside the web root, or a private S3-compatible bucket). They are only served to you, through signed-in requests. Logs do not contain your CV text, sign-in codes or tokens.

## Your choices

- **Download:** Settings › Download my data gives you a JSON copy of everything above.
- **Delete:** Settings › Delete my account blocks sign-in straight away. Your rows and files are permanently removed within 30 days (currently after seven days).

## Third parties

When they are configured: Resend (sending email), Groq or OpenAI (reading your CV and writing documents), Google (if you sign in with Google), and your storage provider. Each only receives what it needs for that task.
