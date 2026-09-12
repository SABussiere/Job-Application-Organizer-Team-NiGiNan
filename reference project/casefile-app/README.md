# Casefile — Job Application Tracker (Minimal design variant)

This is the sleek/minimal card-based visual variant of Casefile — same data
model, same API, same features as the manila "case file" version. Only the
design system changed: flat white cards, one deep-teal accent, Inter
typeface, varied corner radius by hierarchy instead of one radius on
everything.

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
- **Mobile** (≤640px wide): fixed bottom tab bar (Board / Master Resume) for
  thumb reach, board stacks into a single scrollable column,
  and every card gets a "Move to..." dropdown — drag-and-drop doesn't work
  reliably on touchscreens, so tapping is the primary way to change stage
  on mobile (works on desktop too)
- The detail modal becomes a full-screen sheet on mobile instead of a
  cramped popup, and its form fields stack into a single column
- A proper mobile viewport meta tag is set so text isn't tiny and pinch-zoom
  isn't fighting you
- Every control a thumb has to hit is at least 40px tall below 900px wide:
  form fields, buttons, the stage dropdown, and the reorder arrows in the
  tailored-resume module list
- The follow-up chips stay visible while the date-applied range collapses
  behind a disclosure; the chip row scrolls horizontally rather than wrapping
  into three rows
- The LaTeX preview scrolls inside its own box, so a long line never makes
  the page scroll sideways

## API

| Method | Path                                       | Purpose                              |
|--------|---------------------------------------------|----------------------------------------|
| GET    | `/api/applications`                         | list all applications                  |
| POST   | `/api/applications`                         | create an application                  |
| GET    | `/api/applications/:id`                     | get one application                    |
| PATCH  | `/api/applications/:id`                     | update fields on it                    |
| DELETE | `/api/applications/:id`                     | delete it                              |
| POST   | `/api/applications/:id/communications`      | log a communication entry              |
| POST   | `/api/applications/:id/tailor`              | generate a tailored resume from a job description |
| GET    | `/api/resume-modules`                       | list master resume modules             |
| POST   | `/api/resume-modules`                       | create a module                        |
| PATCH  | `/api/resume-modules/:id`                   | update a module                        |
| DELETE | `/api/resume-modules/:id`                   | delete a module                        |
| POST   | `/api/resume-modules/:id/reorder`           | move a module up/down                  |
| GET    | `/api/resume-modules/full`                  | full assembled text of every module    |
| GET    | `/api/resume-modules/latex`                 | whole master resume as LaTeX           |
| POST   | `/api/resume-modules/latex`                 | LaTeX for an explicit, ordered subset of modules |
| GET    | `/api/applications/:id/latex`               | that application's tailored resume as LaTeX |
| GET    | `/api/resume-profile`                       | resume heading (name, contact, links)  |
| PATCH  | `/api/resume-profile`                       | update the heading                     |
| GET    | `/api/stats`                                | totals + counts per stage              |

Plus one non-API page, `/print`, which renders nothing but the resume sheet
and opens the print dialog. It takes `?ids=` (ordered module ids) and an
optional `?label=`.

## Structured modules + LaTeX output

A module is no longer a blob of text. Each one carries the fields a resume
line actually needs: a title (role, degree or project name), an organisation
(company, institution, or the tech stack for a project), a location, start
and end dates, an optional lead-in paragraph, and its bullet points. The
Master Resume page also holds the heading — name, phone, email, location and
however many links you want.

`lib/latex.js` typesets all of that into [Jake's Resume][jake], the LaTeX
template most people use, and the Master Resume page and each application's
**Tailored Resume** tab both offer **Copy LaTeX** and **Download .tex**.
Paste the result into Overleaf and compile with pdfLaTeX. User text is
escaped (`&`, `%`, `$`, `_`, curly quotes) so a pasted job title can't break
the document.

Jake's template feeds its four subheading slots in a different order per
section, which the renderer handles per module type:

| Module type | Renders as                                                 |
|-------------|------------------------------------------------------------|
| Summary     | a plain paragraph under `\section{Summary}`                    |
| Education   | `\resumeSubheading{institution}{location}{degree}{dates}` |
| Experience  | `\resumeSubheading{role}{dates}{company}{location}`       |
| Project     | `\resumeProjectHeading{name $\|$ tech stack}{dates}`      |
| Skills      | `\textbf{Label}{: items}` rows, one per `Label: items` line |

[jake]: https://github.com/jakegut/resume

### Getting an actual PDF

Two routes, both in the **Tailored Resume** tab and on the Master Resume
page:

**Preview + Save as PDF** renders the resume as HTML laid out to match the
template and hands it to the browser's own print engine. It's instant,
offline and dependency-free. `components/ResumePreview.js` shares
`groupByType()` and `dateRange()` with the LaTeX renderer, so section order
and dates can't drift between the two — only the typesetting differs, and
this view is an approximation rather than a reproduction of pdfLaTeX output.

Printing happens on a bare `/print` route rather than in place. Printing the
preview where it sits doesn't work: inside the case modal, the overlay's
fixed positioning and scroll container break pagination, and on the Master
Resume page the hidden-but-still-present module cards push the sheet several
pages down. `/print?ids=a,b,c` carries the exact module order being viewed,
so an unsaved tailored selection prints correctly.

**Compile PDF in Overleaf** posts the generated source to Overleaf's
`/docs` endpoint as `encoded_snip` with `engine=pdflatex`, which opens a new
Overleaf project already compiling. That's true pdfLaTeX output, in one
click, with no TeX distribution to install.

Compiling locally instead would mean one of:

| Approach | Cost |
|----------|------|
| Server-side pdfLaTeX | needs TeX Live (~2GB) on the host; rules out serverless deploys like Vercel |
| Browser WASM engine (SwiftLaTeX, texlive.js) | no server needed, but a ~20MB engine and font payload to ship |
| A second non-LaTeX renderer (HTML print styles, jsPDF) | instant PDF, but a second layout to maintain that won't match the template |

Note that SwiftLaTeX runs the engine locally but fetches the packages a
preamble needs (`titlesec`, `fancyhdr`, `marvosym`, fonts) from its own
texlive server on first compile, so it isn't offline either unless you host
that mirror yourself.

The current pairing covers both needs: the HTML preview for seeing and
saving a PDF without leaving the app, and Overleaf for a genuine pdfLaTeX
render. Swapping in a WASM engine later only changes where
`renderLatexResume()` output gets sent.

## Swapping sections in a tailored resume

The Tailored Resume tab lists **every** master module, checked or unchecked,
with up/down arrows. Checking one swaps that section in, unchecking swaps it
out, and the arrows set the order. Sections land wherever their first module
sits, so moving a module far enough up moves its whole section — that's how
you put Projects above Experience for one posting without touching your
master resume.

The order and selection are persisted per application in `resumeModuleIds`,
so reopening a case brings back the resume you built for it. The plain-text
and LaTeX views both rebuild from the current selection.

## Filtering the case board

Follow-ups are bucketed in one place, `lib/followups.js`, so nothing can
disagree about what's urgent:

| Bucket        | Meaning                                        |
|---------------|------------------------------------------------|
| Past due      | follow-up date is before today                 |
| Due soon      | today through the next 7 days                  |
| Scheduled     | more than 7 days out                           |
| No follow-up  | no date set, or the case is rejected           |

The board shows these as chips with live counts, and every card carries a
badge for where it stands (`3 days overdue`, `Due tomorrow`, `No follow-up
set`).

There is deliberately no separate Follow-ups page. An earlier version had
one, grouping open cases into these same buckets, but it amounted to a
second board with a different sort order — every action it offered was
already one chip away here. Filtering the board in place is the same feature
without the duplicate view to keep in sync.

Alongside the chips the board filters on:

| Filter | Kind | Why |
|--------|------|-----|
| Company | multi-select | you routinely want several at once |
| Position | multi-select | the exact title, when you know it |
| Job type | multi-select | the *kind* of role, regardless of wording |
| Location | multi-select | "Toronto or remote" is one question |
| Requisition ID | single text, substring match | an ID names exactly one posting |
| Date applied | from/to range, with 7/30/90-day presets | |

Selecting several values in one dropdown widens it (Acme **or** Globex);
filling in two different dropdowns narrows (Acme **and** Backend Engineer).
Options are built from the data itself and carry a count, so you never pick
a value that matches nothing.

Every active filter shows as a removable chip with a running "4 of 19 cases"
count and a Clear all. `lib/filters.js` holds the whole predicate and the
chip list, so the board component does no filtering logic of its own.

The dropdowns are hand-built rather than `<select multiple>`, which is close
to unusable on a touchscreen and leaves no room for per-option counts. Each
one gains a type-ahead box past six options. On a phone the row becomes a
two-column grid of full-width controls.

### Job type, and why position isn't enough

The same work gets posted as "SWE Intern", "Software Developer Co-op" and
"Backend Engineer I". Filtering by position title alone means three separate
options for one thing you care about, so each case also carries a **job
type** — the kind of role, normalised by you. Filter by `Backend` and all
three turn up. It shows on the card as a small accent-coloured tag.

`JOB_TYPE_SUGGESTIONS` in `lib/constants.js` seeds the suggestions with role
families (Backend, Data / Analytics, DevOps / SRE, and so on). It is a
free-text field, not a fixed enum, so anything you type is accepted and
becomes a suggestion afterwards. If your team would rather think in
employment types (Internship / Co-op / New Grad), replace that one array —
nothing else depends on its contents.

### Typing a company you've used before

Company, position, job type and location are type-ahead fields in both the
create form and the case modal, suggesting values already on the board with
the most-used first. This is about data quality as much as convenience: the
board's filter options are built from these exact strings, so an employer
saved once as `Acme` and once as `Acme Robotics` would split into two
options that each match half your cases.

`components/SuggestInput.js` is hand-rolled rather than a `<datalist>` so the
dropdown looks identical across browsers and stays tappable on a phone. It
supports arrow keys and Enter, and picks on `mousedown` so the choice lands
before the input blurs.

## Creating a case

Pressing **New application** opens a form; nothing is written until you
press **Create case**. Company and position are required, and requisition
ID, location, stage, dates, posting link and notes are all optional and
editable later. Earlier versions created a placeholder card the moment the
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

## Data

Stored in `data/db.json`, created automatically on first write. Delete it to
reset. Everything reads/writes exclusively through `lib/db.js` — swap that
module for Prisma + Postgres later without touching any route or page.

If you have an old `data/db.json` from before the modular resume update, it
migrates automatically on first read: your old single-string master resume
becomes one module tagged to always-include, so nothing is lost.

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
- No push notifications for follow-ups yet — the board filter and card
  badges only tell you once you open the app. Options: a Progressive Web App
  (installable, can use the Notifications/Push API) or an email reminder sent
  from a scheduled server job
- Communications are logged by hand. Reading them from an email API and
  classifying each message (rejection, interview invite, recruiter outreach)
  with an LLM is the planned next step
- The in-app PDF comes from the browser's print engine over an HTML
  approximation of the template, not from pdfLaTeX. Exact typesetting still
  means Overleaf (network, and an account for more than an anonymous
  project). A browser WASM engine would close that gap
- Consider turning this into a PWA (manifest.json + service worker) for an
  "install to home screen" feel without needing a native app
