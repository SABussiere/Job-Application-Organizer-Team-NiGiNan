# Casefile — Mobile (Expo / React Native)

Talks to the Next.js backend in `../server` — that server must be running
for this app to show any data.

## Setup

```bash
npm install
```

Edit `src/config.js` and set `API_BASE_URL` to your computer's LAN IP while
the server is running (see comments in that file — `localhost` will not
work from a physical device or most simulators).

```bash
npx expo start
```

- Scan the QR code with the **Expo Go** app on your phone (same Wi-Fi
  network as your computer), or
- press `i` for the iOS Simulator, `a` for the Android Emulator

## Structure

- `App.js` — root component; hand-rolled tab navigation (no React Navigation
  dependency) between Board / Add / Resume / Follow-ups, plus a Detail
  screen reached by tapping any card
- `src/api.js` — fetch wrapper against the shared backend
- `src/config.js` — API base URL — **edit this first**
- `src/constants.js` — stage labels/colors, date helpers shared across screens
- `src/screens/` — one file per screen
- `src/components/` — `ApplicationCard`, `TabBar`

## Design notes

The Board screen uses stage filter chips + a single scrolling list rather
than side-by-side kanban columns (which don't fit a phone width well). Tap a
stage chip to filter; tap a card to open its Detail screen, which mirrors
the web app's three tabs (Details / Resume / Communications).
