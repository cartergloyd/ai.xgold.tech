# xgold.tech

Static site for xGold Tech. Plain HTML and CSS, no build step for the pages themselves. Served by GitHub Pages at the domain in `CNAME`.

- `index.html` and six section pages: problems, solutions, how-we-work, about, research, book
- `tokens.css` holds every design token; components in `styles/` reference tokens only
- `CLAUDE.md` is the design system; `DESIGN-NOTES.md` records the decisions behind the current layout
- `book.html` posts each request to the home assessment API (`ai-api.xgold.tech`). The private lead-sync service turns it into a Company, Person, Opportunity (stage NEW) and Note in Twenty, and adds the person's website activity. See `crm/HOMELAB.md` and `crm/VISITOR-TRACKING.md`. No CRM credential is in the browser or this repo.

## Internal CRM

`crm/` holds the self-hosting kit for [Twenty](https://github.com/twentyhq/twenty) at `crm.xgold.tech`, behind its own login. Public pages only link to it from the footer. `crm/lead-sync.mjs` pushes each assessment request into Twenty as a lead; the older `supabase/` function is legacy reference. See `crm/README.md`.

## Publishing work

Add a JSON file to `content/work/` and push to `main`. A GitHub Action generates `work/<slug>.html` and updates the "Our work" block on `solutions.html`. Field reference: `content/work/README.md`. Local preview:

    npm run preview:work
    python3 -m http.server 8765

Run `npm run build:work` before committing if you previewed drafts.

The previous site, including its newsletter build, Axios feed workflow and slot-booking server, is in git history before the "Replace site" commit.
