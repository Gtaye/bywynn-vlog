# Bywynn Vlog

Recaps and highlights from every Bywynn event. Static site: no server, no logins, no secret keys. Every change is a commit here.

**Start here: `EDITING.md`.** It covers what to change and where, and how to add an event.

## Add an event
- One JSON file per event in `events/`. The format is in `SCHEMA.md`.
- Photos go in `media/<event-slug>/`. Step by step: `HOW-TO-ADD-PICTURES.md`.
- Start one fast: `npm run new-event`, or copy an old one with `npm run copy-event -- <old-slug> <new-slug> "<title>" <YYYY-MM-DD>`.
- Site name, tagline and colours: `site.json`.

## Safety built in
- Every push runs a secret scan (gitleaks) and the full test suite before deploying.
- Strict Content-Security-Policy: no outside scripts, no trackers. Video loads only when someone presses play.
- People only appear in a recap with `"consent": true`. Photos with location data (EXIF) are refused.

## Run locally
```bash
npm test
npm run build
npm run preview   # http://127.0.0.1:4173
```

v2, started Nov 25, 2026. Engine and tests carried over from the first vlog in Gtaye/event-platform, new design.
