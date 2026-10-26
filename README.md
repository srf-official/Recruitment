# TurnB Recruitment Platform

Python production implementation of the approved recruitment dashboard. The two administrator pages are **Session scheduler** and **Question overview**. `main` is the production source and deployment branch; after a verified release, `develop` retains a backup of the completed version. Git commit history records every change on both branches.

## Implemented behavior

- App-specific email/password administrator login; default email `turnbrecruitment@gmail.com`. No Microsoft login is required.
- Named drives containing Aptitude, Language & Reasoning, and Prompt Engineering links.
- Inline question editing and confirmed deletion in a scrollable window. Default sets and drive-specific sets are independent. Question snapshots lock when the first candidate starts.
- Single choice, multiple select, true/false, ranking, matching, and long-form text questions. Reference keys stay in authenticated administrator endpoints.
- Individual **15 / 20 / 30 minute** candidate deadlines, enforced on the server, with name/student-ID entry and browser-based attempt resumption.
- Response saving with ordered requests, manual submission, expiry, admin stop, and permanent submission locks. Blank and partial attempts are retained.
- Submission confirmation lists answered/unanswered questions and a live remaining-time counter.
- Results tables, minimum marks/time filters, per-candidate and bulk shortlisting, manual scoring, filtered XLSX export.
- Prompt Engineering closes after all **registered** candidates submit, or the admin stops it. The administrator downloads a ZIP containing one `studentname_studentid.docx` per registered candidate. Separate evaluation, no automatic marks.

## Data and authentication

The public repository and container image contain **no recruitment question set, answer key, example candidate data, or credentials**. The private question-import JSON delivered separately is uploaded through **Import question sets** after admin sign-in. Do not add that file to GitHub or the container image.

Azure SQL is mandatory in production. SQLite is permitted only when `APP_ENV=development` or in tests. There is no silent local-file database fallback. Candidate cookies are HttpOnly and scoped to one test endpoint. Every mutating API requires a CSRF token. Administrator configuration updates use a version check; starts, stops and submissions use a short SQL row lock. Candidate answers, scoring, shortlist and exports are server-authoritative.

Candidates should keep the same browser open. There is no identity verification beyond name and student ID, and no proctoring. Duplicate IDs are blocked per test. Losing the attempt cookie requires administrator assistance; knowing a student ID never grants access to an existing answer. Autosave minimizes loss on interruptions, but the server can only submit content it has received. Late edits are not accepted after the deadline.

## Run and test

Use Python 3.12. Install `requirements.txt`; then run:

```text
python -m unittest discover -s tests -v
```

The tests cover authentication/CSRF, answer-key isolation, timing, duplicate IDs, ordered and idempotent saves, restart persistence, admin stop, locked question snapshots, manual scoring, shortlisting, real XLSX/DOCX exports, and 50 concurrent synthetic candidates. The SQLite concurrency test is not a substitute for measuring the selected Azure SQL tier and Container App together.

For local development, set `APP_ENV=development`, `DATABASE_URL=sqlite:///local.db`, `ADMIN_PASSWORD_HASH` and a strong `SESSION_SECRET`, then run Flask on port 8000. Production uses Gunicorn and HTTPS, with Secure cookies. Never use the development server for a recruitment drive.

## Production release

See [DEPLOYMENT.md](DEPLOYMENT.md) for the existing Container App, Azure SQL setup, secrets, initialization, question import, deployment checks and backup process. No new Azure resources are required by this release.
