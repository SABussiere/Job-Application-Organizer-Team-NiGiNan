# Casefile — Job Application Tracker

A job application organizer for the Fall 2026 hackathon brief: track
applications through stages, tailor resumes per role, log employer
communications, and get follow-up visibility — as **one responsive web app**
that works in a desktop browser and a mobile browser from a single codebase.

Built with Next.js (App Router). There's no server API layer — the browser
talks to Firestore directly, and each signed-in user only ever sees their
own applications and master resume.

## Quick start

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
   (or reuse one you already have).
2. In that project: **Build > Authentication > Get started**, enable the
   **Email/Password** sign-in method.
3. **Build > Firestore Database > Create database** (any region; start in
   production mode — the rules below lock it down anyway).
4. **Project settings > General > Your apps**, add a Web app if you don't
   have one, and copy the config it shows you.
5. Copy `.env.local.example` to `.env.local` and paste those values in.
6. Deploy the security rules in `firestore.rules` — easiest way is the
   Firebase CLI:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init firestore   # point it at the existing firestore.rules file
   firebase deploy --only firestore:rules
   ```
   (or paste the contents of `firestore.rules` into the Firestore console's
   **Rules** tab and publish it there — same effect, no CLI needed)
7. Install and run:
   ```bash
   npm install
   npm run dev
   ```

Open http://localhost:3000, create an account (email + password), and
you're in. Every user who signs up gets their own empty board and master
resume — nothing is shared between accounts.

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

## Accounts and data model

Sign-in is Firebase Authentication (email/password). Everything a user owns
lives under two Firestore subcollections keyed by their uid:

```
users/{uid}/applications/{applicationId}
users/{uid}/masterModules/{moduleId}
```

`firestore.rules` only allows a request through when `request.auth.uid`
matches the `{uid}` segment being read or written, so this is what actually
keeps accounts separate — not anything in the app code. `lib/api.js` is the
one file that knows about Firestore; every component just calls
`api.listApplications()`, `api.createResumeModule(...)`, etc., same as
before.

## Modular resume + automatic tailoring

The master resume is no longer one text blob — it's a list of modules (a
summary, each job, each project, a skills block), each with a few tags you
choose (e.g. `react`, `leadership`, `data analysis`).

When you paste a job description into an application's **Tailored Resume**
tab and hit **Generate tailored resume**, `lib/matching.js` runs a
dependency-free keyword match: it tokenizes the job description, scores
every module (tag matches count for more than incidental body-text overlap,
plus a small synonym table so "engineer"/"engineering" etc. still match),
and assembles a resume from modules marked "always include" plus the
highest-scoring matches. The UI shows exactly which modules were picked and
why (or why a module was left out), so it's not a black box.

This is pure keyword matching — no external API, no cost, no network call,
runs instantly. An LLM-backed version (semantic matching, light rephrasing
to mirror the posting's language) is a natural upgrade path later without
changing the API shape, since everything already funnels through
`selectModules()` in `lib/matching.js`.

## Trying it from your phone during local dev

Your phone can't reach `localhost` on your laptop. Find your computer's LAN
IP (`ipconfig getifaddr en0` on Mac, `ipconfig` on Windows) and visit
`http://<that-ip>:3000` from your phone's browser, on the same Wi-Fi
network. For an actual hackathon demo, deploying to Vercel (or similar) is
easier than relying on local network access.

## Known gaps / next steps

- Only email/password sign-in is wired up. Adding Google (or another OAuth
  provider) is mostly enabling it in the Firebase console and adding one
  more button in `LoginScreen.js` that calls `signInWithPopup`.
- No password-reset flow yet (`sendPasswordResetEmail` from `firebase/auth`
  is the one-function way to add it).
- No push notifications for follow-ups yet. Options: a Progressive Web App
  (installable, can use the Notifications/Push API) or simply an email
  reminder sent from a scheduled server job
- Consider turning this into a PWA (manifest.json + service worker) for an
  "install to home screen" feel without needing a native app
