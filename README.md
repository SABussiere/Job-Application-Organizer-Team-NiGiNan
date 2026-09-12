# Job-Application-Organizer-Team-NiGiNan

| Name                | CCID     |
| ------------------- | -------- |
| Spencer Bussiere    | sabussie |
| Abbinash Ranjitkar  | ranjitka |
| Joshua Terry        | jrterry  |
| Harshit Kumar Saini | hsaini3  |
| Jerry Chen          | hchen16  |
| Dev Tiwari          | devkumar |

A job application organizer built for the Fall 2026 hackathon brief: track
applications through stages, tailor resumes per role, log employer
communications, and get follow-up reminders — accessible on both web and
mobile from one shared backend.

## Architecture

```
casefile-app/
  server/   Next.js app — API routes + the web frontend, in one codebase
  mobile/   Expo (React Native) app — talks to the same API for iOS/Android
```

Both clients call the exact same REST API, so data created on one shows up
on the other immediately (no separate accounts, no sync step — it's the same
backend). Details on each in their own README.

## Quick start

**1. Backend + web app**
```bash
cd server
npm install
npm run dev
```
Opens at http://localhost:3000 — Case Board, Master Resume, and Follow-ups
views all live here, backed by the API.

**2. Mobile app**
```bash
cd mobile
npm install
```
Before running, open `mobile/src/config.js` and set `API_BASE_URL` to your
computer's LAN IP (not `localhost` — see the comment in that file for why).
Then:
```bash
npx expo start
```
Scan the QR code with Expo Go (iOS/Android), or press `i`/`a` for a simulator.

## Data model

One `application` record: company, position, date applied, stage (applied /
interview / offer / rejected), job URL, location, notes, follow-up date, a
tailored resume snapshot, and a list of logged communications. Full shape is
documented in `server/lib/db.js`.

## Where things live

- `server/lib/db.js` — the only place that reads/writes application data.
  It's currently a JSON file on disk for zero-setup local dev; swap it for
  Prisma + Postgres later without touching any API route.
- `server/app/api/*` — REST endpoints, shared by both the web app and mobile
- `server/app/*` (excluding `api/`) — the web frontend pages
- `mobile/src/screens/*` — the four mobile screens (Board, Add, Resume,
  Follow-ups) plus a Detail screen reached by tapping a card
- `mobile/src/api.js` — mirrors `server/lib/api.js` but points at a
  configurable base URL instead of a same-origin path

## Known gaps / next steps

- No authentication — matches the brief ("manually create jobs as an
  administrator"), but would need adding for a real multi-user product
- Mobile dates are plain text inputs (`YYYY-MM-DD`) rather than a native date
  picker, to avoid an extra native dependency for the demo
- No push notifications on mobile yet for follow-up reminders (the web app
  has none either in this version — the Chrome-extension prototype had local
  notifications; porting that to "due date reached while app is closed" on
  mobile needs either a push service or a scheduled server job)
- JSON-file storage is fine for a demo but not for concurrent writers —
  move to a real database before more than one person uses it at once
