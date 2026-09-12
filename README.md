# Job-Application-Organizer-Team-NiGiNan

| Name                | CCID     |
| ------------------- | -------- |
| Spencer Bussiere    | sabussie |
| Abbinash Ranjitkar  | ranjitka |
| Joshua Terry        | jrterry  |
| Harshit Kumar Saini | hsaini3  |
| Jerry Chen          | hchen16  |
| Dev Tiwari          | devkumar |

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
- Every control a thumb has to hit is at least 40px tall below 900px wide:
  form fields, buttons, the stage picker, and the reorder arrows in the
  tailored-resume module list
- The follow-up chips stay visible while company, position, job type,
  location and date filters sit in their own dropdowns; the chip row scrolls
  sideways rather than wrapping into three rows
- The LaTeX and resume previews scroll inside their own boxes, so a long line
  never makes the page scroll sideways

## Accounts and data model

Sign-in is Firebase Authentication (email/password). Everything a user owns
lives under two Firestore subcollections keyed by their uid:

```
users/{uid}/applications/{applicationId}
users/{uid}/masterModules/{moduleId}
users/{uid}/meta/resumeProfile        <- one doc: name, contact, links
```

There is no migration step in Firestore, so `lib/api.js` normalises every
document on read: a module saved before the structured fields existed gets
empty strings and an empty bullet list, and a case saved before job type and
requisition ID gets empty values for those. Nothing needs backfilling.

`firestore.rules` only allows a request through when `request.auth.uid`
matches the `{uid}` segment being read or written, so this is what actually
keeps accounts separate — not anything in the app code. `lib/api.js` is the
one file that knows about Firestore; every component just calls
`api.listApplications()`, `api.createResumeModule(...)`, etc., same as
before.

## Structured modules and LaTeX output

A module is not a blob of text. Each carries the fields a resume line needs:
a title (role, degree or project name), an organisation (company,
institution, or the tech stack for a project), a location, start and end
dates, an optional lead-in, and its bullet points. The Master Resume page
also holds the heading, which is name, phone, email, location and links.

`lib/latex.js` typesets all of that into [Jake's Resume][jake], the LaTeX
template most people use. Jake's template feeds its four subheading slots in
a different order per section, which the renderer handles per module type:

| Module type | Renders as |
|-------------|------------|
| Summary | a plain paragraph under `\section{Summary}` |
| Education | `\resumeSubheading{institution}{location}{degree}{dates}` |
| Experience | `\resumeSubheading{role}{dates}{company}{location}` |
| Project | `\resumeProjectHeading{name $\|$ tech stack}{dates}` |
| Skills | `\textbf{Label}{: items}` rows, one per `Label: items` line |

User text is escaped (`&`, `%`, `$`, `_`, curly quotes) so a pasted job title
cannot break the document. Rendering is a pure function, so it runs in the
browser: no server, and nothing extra to deploy for it.

[jake]: https://github.com/jakegut/resume

### Getting an actual PDF

Two routes, both in the **Tailored Resume** tab and on the Master Resume
page:

**Preview + Save as PDF** renders the resume as HTML laid out to match the
template and hands it to the browser's own print engine. Instant, offline, no
dependencies. `components/ResumePreview.js` shares `groupByType()` and
`dateRange()` with the LaTeX renderer, so section order and dates cannot
drift between the two; only the typesetting differs, and this view is an
approximation rather than a reproduction of pdfLaTeX output.

Printing happens on a bare `/print` route rather than in place. Printing the
preview where it sits does not work: inside the case modal the overlay's
fixed positioning and scroll container break pagination, and on the Master
Resume page the hidden-but-still-present module cards push the sheet several
pages down. `/print?ids=a,b,c` carries the exact module order being viewed,
so an unsaved tailored selection prints correctly.

**Compile PDF in Overleaf** posts the source to Overleaf's `/docs` endpoint
as `encoded_snip` with `engine=pdflatex`, opening a project that is already
compiling. True pdfLaTeX output in one click, with no TeX distribution to
install. Compiling locally instead would mean server-side TeX Live (~2GB,
which rules out serverless hosting), a browser WASM engine (~20MB, and
SwiftLaTeX still fetches packages from its own server), or a second
non-LaTeX renderer to keep in sync. Nobody needs TeX installed for either
route that ships today.

## Swapping sections in a tailored resume

The Tailored Resume tab lists every master module, checked or unchecked, with
up/down arrows. Checking one swaps that section in, unchecking swaps it out,
and the arrows set the order. Sections land wherever their first module sits,
so moving a module far enough up moves its whole section. That is how you put
Projects above Experience for one posting without touching your master.

The order and selection persist per application in `resumeModuleIds`, so
reopening a case brings back the resume you built for it. Deleting a master
module also removes it from every case that referenced it, in one batched
write.

## Filtering the case board

Follow-ups are bucketed in one place, `lib/followups.js`, so nothing can
disagree about what is urgent:

| Bucket | Meaning |
|--------|---------|
| Past due | follow-up date is before today |
| Due soon | today through the next 7 days |
| Scheduled | more than 7 days out |
| No follow-up | no date set, or the case is rejected |

The board shows these as chips with live counts, and every card carries a
badge for where it stands (`3 days overdue`, `Due tomorrow`, `No follow-up
set`).

There is deliberately no separate Follow-ups page. An earlier version had
one, grouping open cases into these same buckets, but it amounted to a second
board with a different sort order, and every action it offered was already
one chip away here.

Alongside the chips the board filters on:

| Filter | Kind | Why |
|--------|------|-----|
| Company | multi-select | you routinely want several at once |
| Position | multi-select | the exact title, when you know it |
| Job type | multi-select | the kind of role, regardless of wording |
| Location | multi-select | "Toronto or remote" is one question |
| Requisition ID | single text, substring match | an ID names exactly one posting |
| Date applied | from/to range, with 7/30/90-day presets | |

Selecting several values in one dropdown widens the result (Acme **or**
Globex); filling two different dropdowns narrows it (Acme **and** Backend).
Options are built from the data itself and carry a count, so you never pick a
value that matches nothing. Every active filter shows as a removable chip
with a running "4 of 19 cases" count and a Clear all. `lib/filters.js` holds
the whole predicate and the chip list, so the board component does no
filtering logic of its own.

The dropdowns are hand-built rather than `<select multiple>`, which is close
to unusable on a touchscreen and leaves no room for per-option counts. Each
gains a type-ahead box past six options.

### Job type, and why position is not enough

The same work gets posted as "SWE Intern", "Software Developer Co-op" and
"Backend Engineer I". Filtering by position title alone means three separate
options for one thing you care about, so each case also carries a **job
type**: the kind of role, normalised by you. Filter by `Backend` and all
three turn up. It shows on the card as a small accent-coloured tag.

`JOB_TYPE_SUGGESTIONS` in `lib/constants.js` seeds the suggestions with role
families. It is a free-text field, not a fixed enum, so anything you type is
accepted and becomes a suggestion afterwards. If your team would rather think
in employment types (Internship / Co-op / New Grad), replace that one array.

### Typing a company you have used before

Company, position, job type and location are type-ahead fields in both the
create form and the case modal, suggesting values already on the board with
the most-used first. This is about data quality as much as convenience: the
board's filter options are built from these exact strings, so an employer
saved once as `Acme` and once as `Acme Robotics` would split into two options
that each match half your cases.

## Creating a case

Pressing **New application** opens a form, and nothing is written until you
press **Create case**. Company and position are required; requisition ID,
job type, location, stage, dates, posting link and notes are all optional and
editable later. An earlier version created a placeholder card the moment the
button was pressed, which left junk rows behind whenever someone changed
their mind.

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
