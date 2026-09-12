# Casefile — Job Application Tracker

A job application organizer for the Fall 2026 hackathon brief: track
applications through stages, tailor resumes per role, log employer
communications, and get follow-up visibility — as **one responsive web app**
that works in a desktop browser and a mobile browser from a single codebase.

Built with Next.js (App Router) — API routes and the frontend live together.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 on your laptop, or visit the same URL from your
phone's browser once the app is deployed (or on the same Wi-Fi network,
using your computer's LAN IP — see note below).

## What's responsive about it

- **Desktop** (>640px wide): top nav bar, four-column kanban board, drag
  cards between stages
- **Mobile** (≤640px wide): fixed bottom tab bar (Board / Master Resume /
  Follow-ups) for thumb reach, board stacks into a single scrollable column,
  and every card gets a "Move to..." dropdown — drag-and-drop doesn't work
  reliably on touchscreens, so tapping is the primary way to change stage
  on mobile (works on desktop too)
- The detail modal becomes a full-screen sheet on mobile instead of a
  cramped popup, and its form fields stack into a single column
- A proper mobile viewport meta tag is set so text isn't tiny and pinch-zoom
  isn't fighting you

## API

Same REST API as before, still used by the frontend:

| Method | Path                                   | Purpose                     |
|--------|------------------------------------------|-------------------------------|
| GET    | `/api/applications`                     | list all applications        |
| POST   | `/api/applications`                     | create an application        |
| GET    | `/api/applications/:id`                 | get one application          |
| PATCH  | `/api/applications/:id`                 | update fields on it          |
| DELETE | `/api/applications/:id`                 | delete it                    |
| POST   | `/api/applications/:id/communications`  | log a communication entry    |
| GET    | `/api/resume`                           | get the master resume text   |
| PUT    | `/api/resume`                           | set the master resume text   |
| GET    | `/api/stats`                            | totals + counts per stage    |

## Data

Stored in `data/db.json`, created automatically on first write. Delete it to
reset. Everything reads/writes exclusively through `lib/db.js` — swap that
module for Prisma + Postgres later without touching any route or page.

## Trying it from your phone during local dev

Your phone can't reach `localhost` on your laptop. Find your computer's LAN
IP (`ipconfig getifaddr en0` on Mac, `ipconfig` on Windows) and visit
`http://<that-ip>:3000` from your phone's browser, on the same Wi-Fi
network. For an actual hackathon demo, deploying to Vercel (or similar) is
easier than relying on local network access.

## Known gaps / next steps

- No authentication — matches the brief ("manually create jobs as an
  administrator")
- JSON-file storage is fine for a demo but not for concurrent writers — move
  to a real database before more than one person uses it at once
- No push notifications for follow-ups yet. Options: a Progressive Web App
  (installable, can use the Notifications/Push API) or simply an email
  reminder sent from a scheduled server job
- Consider turning this into a PWA (manifest.json + service worker) for an
  "install to home screen" feel without needing a native app
