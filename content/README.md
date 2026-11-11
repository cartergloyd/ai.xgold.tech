# Publishing to the Research and Solutions feeds

Upload from the dashboard: **xGold AI → Storage → Directus (ai) → Publish to website**. Choose a zip or a folder.
New items appear on `research.html` or `solutions.html` straight away. No rebuild, no git.

## What to upload

One folder per item. Each folder holds an `article.json` and the files it uses.

    my-upload.zip
    ├── klarna-customer-service/
    │   └── article.json
    └── server-management-demo/
        ├── article.json
        ├── server-management.mp4
        └── server-management.jpg

- A zip can hold one item or many. A single wrapping folder is fine.
- Pick a folder instead of a zip if you prefer; the same rules apply.
- Real examples are in `content/feed/`. `klarna-customer-service` is a five-field case. `server-management-demo` has a video.
- Publishing the same `slug` again updates that item. Nothing else is touched.
- To take an item down, use Remove in the same drawer.

## article.json

| Field | Required | Notes |
|---|---|---|
| `section` | yes | `research` or `solutions` |
| `slug` | yes | lowercase letters, digits, hyphens. The item's address and its identity |
| `title` | yes | one sentence, ends with a period |
| `summary` | yes | one line on the card and under the title |
| `date` | yes | `YYYY-MM-DD`. Newest first |
| `type` | no | free text, e.g. `Findings`, `Documented case`, `Demo`. Shown on the card |
| `area` | no | free text, e.g. `Customer service` |
| `status` | no | e.g. `Live`, `Pilot`. Only when true |
| `client`, `duration` | no | shown in the "At a glance" card |
| `cover` | no | image path. Shown on the card. Default: the first image in `body` |
| `hero_stat` | no | `{ "figure": "9.8 → 2.6 days", "label": "Days to post", "note": "…" }` |
| `spec` | no | the five fields `problem`, `changed`, `systems`, `measured`, `result`. All five if present |
| `body` | no | array of blocks, below |
| `scorecard` | no | rows of `{ "measure", "baseline", "after", "target", "status" }` |
| `scorecard_note`, `decision` | no | `decision` is `{ "title", "body", "signed" }` |
| `sources` | no | `[{ "label", "url", "note" }]` |
| `evidence` | no | one sentence on how the figures were obtained |
| `draft` | no | `true` skips the item. Drafts are not stored |

## Body blocks

Plain strings become paragraphs. Objects:

| Block | Example |
|---|---|
| heading | `{"h2": "…"}` or `{"h3": "…"}` |
| paragraph | `{"p": "…"}` or `"…"`. `{"lead": "…"}` is the larger intro line |
| lists | `{"ul": ["…","…"]}` or `{"ol": ["…","…"]}` |
| quote | `{"quote": "…", "cite": "…"}` |
| image | `{"image": "img/chart.png", "alt": "…", "caption": "…"}` |
| video | `{"video": "clip.mp4", "poster": "clip.jpg", "caption": "…"}` |
| callout | `{"callout": "…"}` |
| stats | `{"stats": [{"figure": "$4.10", "label": "Cost per invoice"}]}` |

Inside any text: `**bold**`, `*italic*`, `` `code` ``, `[link](https://…)` and `[^12]`, which becomes a footnote linking to source 12 on the Research page.

## Files

- Reference a file by its path inside the item's folder: `cover`, `image`, `video`, `poster` and `file` fields only. Other text is never treated as a file.
- Supported: png, jpg, gif, webp, avif, svg, mp4, webm, mov, pdf. No size limit.
- A full web address (`https://…`) is used as is, so an image or video can also live elsewhere.
- Every referenced file must be in the upload. A missing one fails that item and says which.

## Where things live

`feed_items` table in the `ai` Directus (`deploy/ai-feed.sql` in homelab-dashboard). Media sits in Directus's "Published feed media" folder and is served by `directus-extension-feed-media` at `https://ai-api.xgold.tech/feed-media/<id>`. Only that folder is public; the rest of the file library stays private. The pages read the feed in the browser with `js/feed.js`.
