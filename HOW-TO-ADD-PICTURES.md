# How to add pictures (and a new event)

No code knowledge needed. Five steps.

## 1. Start the event

Either ask an agent ("create an event for Friday's dinner"), or run:

```bash
npm run new-event -- 2026-12-05-winter-dinner "Winter Dinner — The Glasshouse" 2026-12-05
```

That creates `events/2026-12-05-winter-dinner.json` (fill in venue, summary, highlights, people, sponsors) and an empty folder `media/2026-12-05-winter-dinner/`.

## 2. Drop the photos in

Put the photos in `media/<event-slug>/`, named in the order you want them shown: `01.jpg`, `02.jpg`, `03.jpg` …

Keep each one **under 400 KB** and **no wider than 1600 px**. Easiest way: export at **1600 px wide, quality 80, with metadata/location stripped** (most export dialogs have a "remove location info" or "strip metadata" box — tick it). Raw camera files and phone originals are too big and carry GPS data — export them first. The build refuses anything over the limits or with metadata still inside, and tells you which file.

## 3. Point the event at the photos

```bash
npm run new-event -- --sync 2026-12-05-winter-dinner
```

Or ask an agent to "sync the gallery for winter dinner". The first photo becomes the cover unless the event has a video.

## 4. Video (optional)

Upload to YouTube as **Unlisted**. Copy the ID from the end of the link — in `youtube.com/watch?v=dQw4w9WgXcQ` the ID is `dQw4w9WgXcQ`. In the event file set:

```json
"hero": { "type": "video", "youtubeId": "dQw4w9WgXcQ" }
```

Vimeo works the same way with `"vimeoId"`.

## 5. The one rule

A person is only shown if their entry has `"consent": true`. Ask them first. The build refuses to publish anyone without it — on purpose.

Also on purpose: only photos listed in the event's `gallery` (or its `hero`) are published. Anything else sitting in the folder stays private, and removing a photo from the list takes it off the site.

---

Check it before it goes live:

```bash
npm run build && npm run preview
```

Then open http://127.0.0.1:4173
