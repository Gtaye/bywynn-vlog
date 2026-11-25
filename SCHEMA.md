# Event file format

One file per event in `events/`, named `<slug>.json`. The build refuses to publish anything that breaks these rules, so a bad edit never reaches the public page.

## Fields

| Field | What it is |
|---|---|
| `slug` | File name without `.json`. Format `YYYY-MM-DD-short-name`, lowercase letters, digits and hyphens only. Example: `2026-11-19-launch-evening`. |
| `title` | The event name as it appears on the page. |
| `date` | `YYYY-MM-DD`. Newest events show first. |
| `venue` | Where it happened, in plain words. |
| `eventType` | `"public"` or `"private"`. Shown as a small label. |
| `hero` | The main media at the top of the recap. Either `{ "type": "video", "youtubeId": "<id>" }`, `{ "type": "video", "vimeoId": "<id>" }`, or `{ "type": "image", "src": "media/<slug>/01.jpg" }`. |
| `summary` | One paragraph written for someone who wasn't there. |
| `highlights` | 1 to 6 short lines. The moments worth remembering. |
| `attendees` | People to feature. Each: `{ "name", "title", "org", "consent": true }`. |
| `sponsors` | Each: `{ "name", "blurb" }`. |
| `gallery` | Photo paths, in the order they should appear. |

## The rules the build enforces

- **Consent.** An attendee is published only if `consent` is exactly `true`. Anyone else fails the build by name. Get a yes before you add someone.
- **Video.** Only a bare YouTube or Vimeo video ID — never a URL. Upload to YouTube as *unlisted* and copy the ID from the end of the link (`youtube.com/watch?v=` **`dQw4w9WgXcQ`**).
- **Photos.** Up to 30 per event, each under 400 KB, and every path must be inside `media/<slug>/`. Accepted: `.jpg`, `.jpeg`, `.png`, `.webp`.
- Nothing in these files is ever treated as HTML. Write plain text.

## Complete example

```json
{
  "slug": "2026-11-19-launch-evening",
  "title": "Launch Evening — The Obsidian Room",
  "date": "2026-11-19",
  "venue": "The Obsidian Room, Downtown",
  "eventType": "private",
  "hero": { "type": "video", "youtubeId": "dQw4w9WgXcQ" },
  "summary": "Forty founders, three investors and one very good chef. The first evening set the tone: unhurried conversation, no name badges, and a room that already knew why it was there.",
  "highlights": [
    "Opening toast from the host",
    "Terrace mingling under the heaters",
    "A late-night conversation that became a partnership"
  ],
  "attendees": [
    { "name": "Amara Okafor", "title": "Founder", "org": "Okafor Capital", "consent": true }
  ],
  "sponsors": [
    { "name": "Lumen Wealth", "blurb": "Private banking for people who build things." }
  ],
  "gallery": [
    "media/2026-11-19-launch-evening/01.jpg",
    "media/2026-11-19-launch-evening/02.jpg"
  ]
}
```
