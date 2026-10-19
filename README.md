# xgold.tech

Static site for xGold Tech. Plain HTML and CSS, no build step for the pages themselves. Served by GitHub Pages at the domain in `CNAME`.

- `index.html` and six section pages: problems, solutions, how-we-work, about, research, book
- `tokens.css` holds every design token; components in `styles/` reference tokens only
- `CLAUDE.md` is the design system; `DESIGN-NOTES.md` records the decisions behind the current layout
- `book.html` posts to the URL in its form's `data-endpoint` attribute; empty until a handler is configured

## Publishing work

Add a JSON file to `content/work/` and push to `main`. A GitHub Action generates `work/<slug>.html` and updates the "Our work" block on `solutions.html`. Field reference: `content/work/README.md`. Local preview:

    npm run preview:work
    python3 -m http.server 8765

Run `npm run build:work` before committing if you previewed drafts.

The previous site, including its newsletter build, Axios feed workflow and slot-booking server, is in git history before the "Replace site" commit.
