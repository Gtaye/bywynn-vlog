# Editing and copying the vlog — cheat sheet

Every change below is one file. Make the change on GitHub (open the file, click the pencil, "Commit changes" to a new branch, open a pull request), or tell any of the agents: *"change the tagline to …"*. The checks run, and once you merge, the site updates on its own.

## What to change, and where

| I want to change… | Edit this | Example |
|---|---|---|
| Site name, tagline, footer, Google description | `site.json` | `"name": "Founders Table"` |
| Colours | `site.json` → `colors` | `"primary": "#D4AF37"` |
| An event's words, people, sponsors | `events/<slug>.json` | see `SCHEMA.md` |
| An event's photos | `media/<slug>/`, then sync | see `HOW-TO-ADD-PICTURES.md` |
| Fonts, spacing, corner roundness | `site/styles.css`, top `:root` block | `--radius: 14px;` |

### The five colours in `site.json`

| Key | What it paints |
|---|---|
| `background` | Page background, and text on gold buttons |
| `card` | Event cards and panels |
| `accent` | Green badges and quiet highlights |
| `primary` | The gold: buttons, dates, links, focus rings |
| `foreground` | Main text (lighter shades for secondary text are made from it automatically) |

Colours must be written as `#` plus 6 characters, like `#1B3B2B`. If something is wrong in `site.json`, the build stops and tells you which line, so a typo can never reach the live page.

## Add an event

```bash
npm run new-event -- 2026-12-05-winter-dinner "Winter Dinner — The Glasshouse" 2026-12-05
```

## Copy an event (fastest for a series)

Starts a new event from an old one: venue, type, summary, highlights and sponsors are copied so you only edit what changed.

```bash
npm run copy-event -- 2026-11-19-launch-evening 2026-12-17-winter-evening "Winter Evening — The Obsidian Room" 2026-12-17
```

On purpose, **people and photos are never copied**. Consent is given per event, and each event has its own photo folder.

## Copy the whole site (a new series, a new sector)

1. On GitHub, open this repo and click **Use this template → Create a new repository**. Name it, e.g. `founders-table-vlog`.
2. In the new repo, edit `site.json`: name, tagline, footer, colours.
3. Delete the sample event: `events/2026-11-19-launch-evening.json` and the folder `media/2026-11-19-launch-evening/`.
4. **Settings → Pages → Source: GitHub Actions.**
5. **Settings → Branches → protect `main`**: require a pull request and the `check` status.
6. Add the first event with `npm run new-event` (or ask an agent). The site goes live on the first merge.

Everything else (the security rules, consent check, photo checks, secret scan, tests) comes with the copy automatically.

## Check before it goes live

```bash
npm test
npm run build
npm run preview
```

Then open http://127.0.0.1:4173.
