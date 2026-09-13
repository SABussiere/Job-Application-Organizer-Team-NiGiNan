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

## Verified locations

A location is either a place that was matched against a real gazetteer, or
explicitly **Unknown**. There is no third option: what you type is a search
query, not a value, and the case only takes a location when you pick a match
or choose Unknown. Abandoning a half-typed query restores whatever was set
before.

That rule is the reason the Map tab can be trusted. Every location on the
board is either a real point or an admitted blank, never a plausible-looking
string nobody checked. Picking a match stores the canonical string
("Toronto, ON, Canada") plus a `geo` object with city, region, country and
coordinates; Unknown stores no coordinates and so never appears on the map.

The provider is [Open-Meteo's geocoding API][om]: no API key, no billing
account, nothing for a teammate to configure, and it sends
`access-control-allow-origin: *` so the browser calls it directly. That keeps
the app free of a server layer, the same way Firestore does. Province and
state names are abbreviated for Canada and the US so the stored string reads
the way postings write it; elsewhere the full region name is kept.

Everything goes through `searchPlaces()` in `lib/geocode.js`, so moving to a
keyed provider later means rewriting one function.

Two conveniences: verified locations already on your board are offered
before any network call, so a repeat is one tap and keeps its coordinates;
and whether a job is remote is a separate field (see below), so "Remote"
never has to be typed into the location.

**Legacy values.** Cases saved before checking was required can still hold
specific-looking text with no coordinates. Those are badged `needs checking`,
counted separately on the map, and cannot be re-saved: the case modal refuses
to save until the location is either matched or set to Unknown. Normalising
them automatically would have meant either inventing coordinates or throwing
away what someone wrote.

Coverage is a genuine limit. The dataset matches on place name, so a city
commonly known by another name will not be found under the one you type
(searching Bangalore finds a town in Pakistan; Bengaluru finds the Indian
city). Unknown is the escape hatch, and a keyed provider would handle
aliases properly.

## Employment and location type

Two short fixed vocabularies, separate from the free-text `jobType` that
describes the kind of work:

| Field | Values |
|-------|--------|
| `employmentType` | Unknown, Full-time, Part-time, Contract, Internship |
| `locationType` | Unknown, On-site, Hybrid, Remote |

Both default to Unknown, because a posting does not always say, and both are
multi-select filters on the board. Values are stored as the label you see
rather than as codes, so filters, chips and cards need no lookup table; the
tradeoff is that renaming a label would orphan existing data, which is the
right trade at this size. Neither shows as a tag on a card while it is
Unknown, since that would put a meaningless label on most of them.

Splitting `locationType` out is what lets the location field stay strict.
A remote job can still be anchored to a city and appear on the map, and a
job whose city you do not know yet is Unknown regardless of whether it is
remote.

[om]: https://open-meteo.com/en/docs/geocoding-api

## Map tab

A world map of everywhere you have applied. Two independent switches, so any
combination works:

| Switch | Options |
|--------|---------|
| Projection | Flat map, Globe (drag to rotate) |
| Encoding | Pins, Heat |

Both are plain SVG over the same data.

- **Pins** takes the colour of its **furthest-along** case, so a city where
  you have an offer and three rejections reads as an offer, and carries a
  count when it holds more than one case
- **Heat** shades each country by how many applications it holds, on a
  single-hue teal ramp. Pins stay visible but smaller, so selecting a city
  still works, and hovering a shaded country gives its count
- Selecting a pin opens a scrolling read-only panel beside the map with the
  full detail of every case there: stage, job type, employment, on-site or
  remote, requisition ID, follow-up status, contact-log count, notes and a
  link to the posting. Editing stays behind an explicit **Open case** button
- The stage chips filter which cases are plotted at all
- Drag to rotate the globe or pan the flat map, and zoom with + and −

### Why teal, and why point-in-polygon

The heat ramp is one hue light to dark, because it encodes magnitude. Teal
rather than the more usual blue: the board already uses blue to mean the
Applied stage, and one colour meaning two things on one screen is worse than
an unconventional hue. Steps are anchored on the app's own accent tokens and
checked for monotonically falling OKLab lightness across a 6 degree hue
spread, which is the check that matters for a sequential ramp. Counts are
small integers, so the scale uses explicit bins (1, 2–3, 4–6, 7–10, 11+)
rather than a continuous gradient: a reader can map a shade back to a number.
Countries with nothing keep the basemap grey, so zero never reads as low.

Counting per country is point-in-polygon (`geoContains`), not a name match,
because the gazetteer and the basemap disagree on names. The gazetteer says
"United States" and the basemap says "United States of America", so matching
on names would have silently dropped every US application from the heat map.

### State and province detail

`world-atlas` has no data below the country level, for anywhere. Getting a
finer grain than "the whole country" means a second dataset per country —
there is no small, reliably-projected file covering every country's states
and provinces at once; a global one is many megabytes, an order of magnitude
past everything else this map bundles — so detail is added one country at a
time.

**United States** — `us-atlas` (114KB), an official Census Bureau dataset
from the same maintainers as `world-atlas`, already in plain lon/lat.

**Canada** — no equally official npm package exists, so this one is a
hand-built asset at `lib/geo-data/canada-provinces-10m.json` (60KB): the 10
provinces and 3 territories from Statistics Canada's cartographic boundary
files, republished under the MIT license by
[sachijay/canada_maps](https://github.com/sachijay/canada_maps), reprojected
from Statistics Canada's Lambert projection to WGS84 lon/lat with `proj4`
(the source ships in a projected coordinate system that looks like
plausible-but-wrong lon/lat if used as-is — its eastings and northings are
large enough to pass a casual glance), then simplified with `mapshaper`.
`lib/geo-data/README.md` has the exact reprojection parameters and rebuild
command, and the license text, so this can be regenerated or extended
without redoing that research.

A pin inside a covered country resolves to its state or province — a click,
a heat colour, and the "cases here" panel all follow, and its border draws
thinner than a country's so the map doesn't read the same at both scales.
Every uncovered country still resolves at the whole-country level, and
cities everywhere are already exact points regardless — they were never
rounded to a country to begin with. Adding another country means finding (or
building, as with Canada) an equally small, unprojected TopoJSON source for
it and appending it to the `REGIONS` array in `components/WorldMap.js` the
same way.

Verified for both countries by checking that real cities resolve to the
right subdivision rather than assuming a simplified boundary still holds:
seven for the US, fourteen for Canada (one per province and territory),
plus a same-named-city check (Toronto, Ontario against Toronto, Ohio) to
confirm the country-vs-state split doesn't blur at a name that exists on
both sides of the border.

Three `world-atlas` features — Northern Cyprus, Somaliland and Kosovo — ship
with no id in the 110m file, which collided all three onto the same map key.
They're given a name-based id as a fallback so each stays distinct.

**Topographic relief is not here, and is not cheap.** Terrain shading needs an
elevation raster or hillshade tiles, which means a tile provider and a key, or
bundling a dataset orders of magnitude larger than the 108KB of outlines.
Everything else on this map works offline with no account, and that seemed
worth more than relief the data does not need.

Country outlines come from a bundled 108KB TopoJSON file (`world-atlas` at
110m resolution) projected with `d3-geo`, not from map tiles. No tile server,
no API key, and the map works offline. The globe uses an orthographic
projection, with pins on the far side hidden by comparing each point's
`geoDistance` to the centre of the visible hemisphere.

A panel under the case list accounts for every case that is **not** drawn,
split into locations that are Unknown and legacy text that was never checked.
A map that silently omits cases would be worse than no map, so the count is
always visible.

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
| Employment | multi-select | full-time versus internship versus contract |
| On-site / remote | multi-select | how the work happens |
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
- Location lookup matches on place name, so a city commonly known by another
  name will not be found under the one you typed, and Unknown is the only way
  past it. A keyed provider (Google Places, Mapbox) handles aliases and
  partial input far better; the swap is one function in `lib/geocode.js`
- The map plots cities, not employers. Pinning an actual office address would
  need a provider that geocodes street addresses, which the current keyless
  one does not do
