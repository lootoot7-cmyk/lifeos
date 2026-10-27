# LifeOS

An AI-powered, privacy-first personal life manager: documents, receipts, warranties, expiry dates and reminders in one place. English and Urdu, mobile-first, installable as a PWA, dark/light theme.

This build covers **Foundation + Phases 1–3** of the product spec:

- Email/password, Google and phone sign-in, password reset, onboarding
- Dashboard, universal search, alerts, settings
- **LifeVault** — documents with expiry, renewal and reminder offsets
- **ReceiptBrain** — receipt upload, server-side Gemini extraction, review, spending summaries, purchases and linked warranty records
- **Universal Capture** — photo/PDF or dictated text classified as receipt, document or note, with manual fallback
- **Privacy Center** — data export, delete-my-data, delete account, AI opt-out, audit log
- Reminder engine with push, in-app and optional email delivery

Later-phase modules (Where Did I Put It?, QueueLess, Price History AI, Lost & Found Network, Home Inventory AI, WaitTime AI, Daily Decision AI, Emergency Info Card) are not implemented yet.

## Architecture

```
Browser (static Next.js export, Firebase Hosting)
  ├── Firebase Auth / Firestore / Storage  ← owner-only security rules
  ├── App Check (reCAPTCHA Enterprise)
  └── Callable Cloud Functions ── Gemini API (API key in Secret Manager)
        ├── extractReceipt / analyzeCapture
        ├── dispatchReminders (every 15 min)
        └── exportMyData / deleteMyData / deleteMyAccount
```

- The frontend is a **static export** (`output: "export"`), so there are no Next.js server routes. Everything sensitive runs in Cloud Functions.
- **No API keys ship to the browser.** `NEXT_PUBLIC_*` values are Firebase public identifiers; the Gemini key lives only in Google Secret Manager.
- Every record carries `ownerId == request.auth.uid`. Firestore and Storage rules reject reads/writes by anyone else. Admins get no special client access; server tasks use the Admin SDK.
- AI never invents values. Low-confidence fields are flagged for confirmation, invalid dates are dropped with a warning, and every AI flow falls back to manual entry.

## Prerequisites

- Node.js 22+
- Firebase CLI (`npm i -g firebase-tools`)
- A Firebase project on the **Blaze** plan (Cloud Functions, Storage)
- Java 21+ only if you want the emulator suite and rules tests (this machine has Java 1.8, so those steps were not run here)

## 1. Install

```bash
npm install
npm --prefix functions install
```

## 2. Configure the web app

```bash
cp .env.example .env.local
cp .firebaserc.example .firebaserc   # set your Firebase project id
```

Fill `.env.local` from **Firebase Console → Project settings → Your apps → Web app config**. Also set:

| Variable | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_FCM_VAPID_KEY` | Console → Cloud Messaging → Web configuration → Web Push certificate |
| `NEXT_PUBLIC_APPCHECK_RECAPTCHA_ENTERPRISE_KEY` | Console → App Check → Apps → reCAPTCHA Enterprise |
| `NEXT_PUBLIC_FUNCTIONS_REGION` | Must match `REGION` in `functions/src/config.ts` (`us-central1`) |

In the console, enable **Authentication → Sign-in method**: Email/Password, Google, Phone.

## 3. Server secrets and parameters

The Gemini key is never placed in `.env.local`:

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

Function parameters (set in `functions/.env.<project-id>` or the Google Cloud console):

| Parameter | Default | Purpose |
| --- | --- | --- |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Model used for extraction |
| `ENFORCE_APP_CHECK` | `true` | Reject callables without a valid App Check token |
| `EMAIL_NOTIFICATIONS_ENABLED` | `false` | Write reminder emails to the `mail` collection for the Trigger Email extension |

For local development you can disable App Check enforcement with `ENFORCE_APP_CHECK=false` and leave `NEXT_PUBLIC_APPCHECK_RECAPTCHA_ENTERPRISE_KEY` empty.

## 4. Run locally

```bash
npm run dev
```

Without Firebase credentials the app shows a "Connect LifeOS to Firebase" setup screen instead of a fake login.

### Emulator suite (needs Java 21+)

```bash
set NEXT_PUBLIC_USE_EMULATORS=true   # .env.local
firebase emulators:start
npm run dev
```

## 5. Deploy

```bash
npm run build          # static export into out/
npm run functions:build
firebase deploy --only hosting,firestore,storage,functions
```

`firebase.json` deploys Firestore/Storage rules, indexes, Hosting headers, and the functions predeploy build. The scheduler function `dispatchReminders` is created automatically.

Web Push additionally needs the Cloud Messaging setup above and, for iOS, the app installed to the home screen.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Type-check and static export to `out/` |
| `npm run start` | Serve the built export locally with `serve` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (dates, reminders, receipts, functions) |
| `npm run test:rules` | Firestore/Storage rules tests via emulators (Java 21+) |
| `npm run functions:build` | Compile Cloud Functions |
| `npm run deploy` | Build web app and `firebase deploy` |

## Security and privacy notes

- **Rules are the boundary.** `firestore.rules` validates full record shape on every write (`onlyKeys`, timestamps, enum values) and enforces `ownerId`; `storage.rules` limits uploads to images/PDFs under 15 MB in `users/{uid}/{vault,receipts,captures,avatar}`.
- **Exports are server-written.** `users/{uid}/exports/` is readable/deletable by the owner only; "Delete my data" removes exports along with documents, receipts, captures and avatar files.
- **Notifications and audit logs are server-only** collections; clients can read their own and mark notifications read.
- **AI quota** is enforced per user per day (30 free / 300 pro / 1000 business).
- **Receipt privacy:** long digit runs (such as card numbers) are masked to the last four digits before storage; uploaded files are deletable by their owner and cleaned up on record deletion.

## Verification status

- `npx tsc --noEmit` passes for the app and `functions/`
- `npm test`: 32 unit tests pass
- `npm run build`: all 21 routes prerender
- Browser smoke test: setup screen and all PWA assets (manifest, service worker, icons) load with no console errors
- Firebase credentials and rules-emulator tests are pending user-supplied credentials and a Java 21 runtime
