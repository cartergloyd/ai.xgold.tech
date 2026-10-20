# xgold.tech

Static site for xGold Tech. Plain HTML and CSS, no build step for the pages themselves. Served by GitHub Pages at the domain in `CNAME`.

- `index.html` and six section pages: problems, solutions, how-we-work, about, research, book
- `tokens.css` holds every design token; components in `styles/` reference tokens only
- `CLAUDE.md` is the design system; `DESIGN-NOTES.md` records the decisions behind the current layout
- `book.html` writes submissions to the Supabase table `assessment_requests` using the publishable key (insert-only; schema in `supabase/schema.sql`). Read them in the Supabase Table Editor. Never put the secret key in this repo.

## Internal CRM

`crm/` holds the self-hosting kit for [Twenty](https://github.com/twentyhq/twenty) at `crm.xgold.tech`, behind its own login. Public pages only link to it from the footer. `supabase/functions/sync-to-twenty/` pushes each assessment request into Twenty as a lead. See `crm/README.md`.

## Publishing work

Add a JSON file to `content/work/` and push to `main`. A GitHub Action generates `work/<slug>.html` and updates the "Our work" block on `solutions.html`. Field reference: `content/work/README.md`. Local preview:

    npm run preview:work
    python3 -m http.server 8765

Run `npm run build:work` before committing if you previewed drafts.

The previous site, including its newsletter build, Axios feed workflow and slot-booking server, is in git history before the "Replace site" commit.
