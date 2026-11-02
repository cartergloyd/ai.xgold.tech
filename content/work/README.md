# Publishing work

Add one JSON file per item to this folder and push to `main`. The GitHub Action
runs `scripts/build-work.mjs`, which writes `work/<slug>.html` and rebuilds the
"Our work" block on `solutions.html`. Deleting the JSON removes the page.

To preview locally, including drafts:

    node scripts/build-work.mjs --include-drafts
    python3 -m http.server 8765

Then run `node scripts/build-work.mjs` (without the flag) before committing, so
draft pages are not published. Or just commit the JSON and let the Action build.

## Fields

| Field | Required | Notes |
|---|---|---|
| `slug` | yes | lowercase letters, digits, hyphens. Becomes `work/<slug>.html` |
| `title` | yes | one sentence, ends with a period |
| `summary` | yes | one line, shown on the card and under the title |
| `type` | yes | `Implementation`, `Proof of concept`, `Article` or `Note` |
| `area` | yes | `documents`, `reporting`, `integration`, `support`, `agents` or `governance` |
| `date` | yes | `YYYY-MM-DD`; newest first on the solutions page |
| `status` | no | `Live`, `Pilot`, `Concept`, `Published` or `Retired` |
| `client` | no | name, or "Regional distributor (name withheld)" |
| `duration` | no | e.g. "8 weeks" |
| `draft` | no | `true` keeps it out of the build |
| `hero_stat` | no | `{ "figure": "9.8 → 2.6 days", "label": "Days to post", "note": "…" }` |
| `spec` | no | the five fields: `problem`, `changed`, `systems`, `measured`, `result`. All five required if present |
| `spec_title` | no | headline on the five-field card. Default "In five fields." |
| `body` | no | array of blocks, see below |
| `scorecard` | no | rows of `{ "measure", "baseline", "after", "target", "status" }` |
| `scorecard_note` | no | one line under "The scorecard." |
| `decision` | no | `{ "title", "body", "signed" }` shown beside the scorecard |
| `sources` | no | `[{ "label", "url", "note" }]` |
| `evidence` | no | one sentence on how the figures were obtained |

## Body blocks

Plain strings become paragraphs. Objects: `{"h2": ""}`, `{"h3": ""}`, `{"p": ""}`,
`{"lead": ""}`, `{"ul": ["", ""]}`, `{"ol": ["", ""]}`, `{"quote": "", "cite": ""}`,
`{"image": "assets/work/file.png", "alt": "", "caption": ""}`, `{"callout": ""}`,
`{"stats": [{"figure": "", "label": ""}]}`.

Inside any text: `**bold**`, `*italic*`, `` `code` `` and `[link text](https://…)`.
Everything else is escaped. Put images in `assets/work/`.

## Rules we hold ourselves to

Report before and after in units with the denominator. Name the systems. Say who
measured it. Include the measures that did not move. If a figure is projected,
say "projected".
