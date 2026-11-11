# xgold.tech

Static site for xGold Tech. Plain HTML and CSS, no build step for the pages themselves. Served by GitHub Pages at the domain in `CNAME`.

- `index.html` and the section pages: problems, solutions, how-we-work, about, research, book
- `BRAND.md` is the brand standard. `tokens.css` holds every design token; components in `styles/` (inner pages), `css/` (home page and the shared nav) and `js/` reference tokens only
- `CLAUDE.md` is the design system; `DESIGN-NOTES.md` records the decisions behind the current layout
- `book.html` posts each request to the home assessment API (`ai-api.xgold.tech`). The private lead-sync service turns it into a Company, Person, Opportunity (stage NEW) and Note in Twenty, and adds the person's website activity. See `crm/HOMELAB.md` and `crm/VISITOR-TRACKING.md`. No CRM credential is in the browser or this repo.

## Internal CRM

`crm/` holds the self-hosting kit for [Twenty](https://github.com/twentyhq/twenty) at `crm.xgold.tech`, behind its own login. Public pages only link to it from the footer. `crm/lead-sync.mjs` pushes each assessment request into Twenty as a lead; the older `supabase/` function is legacy reference. See `crm/README.md`.

## Publishing research and solutions

`research.html` and `solutions.html` show a feed read from the `ai` Directus in the browser (`js/feed.js`). Upload a zip or folder from the dashboard (Directus → Publish to website) and it appears immediately; each item opens on `item.html`. Format guide: `content/README.md`. The items that were on these pages before the feed are in `content/feed/`. The numbered Sources list stays on `research.html`, because every page links to it.

The previous site, including its newsletter build, Axios feed workflow and slot-booking server, is in git history before the "Replace site" commit.
