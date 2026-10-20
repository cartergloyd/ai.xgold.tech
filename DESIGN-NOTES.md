# Design notes — AI consulting site in the Apple Business idiom

`CLAUDE.md` and `tokens.css` are the law. This file records what the Apple Business
reference pages add on top of them, and where the two differ. Read all three before
building any component.

## What Apple Business does that the generic apple.com rules don't spell out

### Nav
- Wordmark on the left ("Apple Business" → our firm name), small 12–14px gray links on the
  right, and **one filled blue pill "Sign In"** at the far right. That pill is the only
  color in the bar. Page hero sits directly under a 1px hairline.
- Link set is short and verb/noun based: Run · Grow · Partners · Success Stories · Support.
  Ours should be five items or fewer, same register.

### Hero (centered variant, not corner-anchored)
- Pale radial tint behind the content: a very large, soft circle in a near-white tint
  (Apple used a mint `#f2fbf9`-ish wash on white). Reads as atmosphere, not a shape.
- Stack, all centered: small brand lockup (glyph + wordmark) → one-sentence page title
  ("Better business ahead.") → **icon shelf** of 7 app tiles → two-tone paragraph →
  one filled pill CTA ("Get started"). Exactly one button in the hero.
- Two-tone paragraph pattern: the first clause and the last clause are `--text`,
  the middle is `--text-secondary`. "**Everything your business needs** to effortlessly
  manage… **All in one place.**" Use this for our hero body.
- Icon shelf tiles: squircle, ~90px, soft drop shadow allowed **because they are product
  imagery**, not UI chrome. Equal gaps, no labels.

### Section headers with a color-keyed verb
- "**Run** teams and devices with ease." — the pillar word is colored (green), the rest
  is `--text`. Headline left, a single "Learn more" pill right-aligned on the same row.
- This is a controlled exception to "exactly one accent": each top-level pillar
  (Run / Grow …) owns one word-color and one tinted card color. Everything interactive
  stays `--accent` blue.
- Section bg: `--bg-alt` with the headline block, then cards.

### Bento card grid
- Two-column asymmetric row: wide white card (~2/3) + narrow tinted card (~1/3).
  Then a full-width dark/photo card beneath. Cards use `--radius-card`, no borders.
- Card internal order matches CLAUDE.md: eyebrow ("Built-in Device Management", 17px
  semibold, `--text`) → headline (card size, semibold) → image filling the lower area,
  **cropped by the card edge**. Narrow tinted card: eyebrow + headline in white, then an
  icon grid that bleeds off the left edge.
- Round black "+" button bottom-right of the wide card = expand/detail affordance.
- Tinted card color is a mid-saturation flat fill (Apple used `#4a90d9`-ish blue), white
  text. One tinted card per row max.

## Mapping Apple Business → AI consulting firm

| Apple Business | Ours |
|---|---|
| "Run" pillar (devices, apps, security) | Deliver / Deploy — implementation, integration, governance |
| "Grow" pillar (reach customers) | Grow / Advise — strategy, roadmaps, enablement |
| App icon shelf | Shelf of platform/model logos or service glyphs we work with |
| Device render in wide card | Product UI render: dashboards, agent consoles, architecture diagrams |
| Success Stories | Case studies |
| Sign In | Contact / Book a call (single blue pill) |

## Palette (locked after review 2026-10-13)
Neutrals plus exactly two colors. **Blue** `--accent` for every interactive element and the
single tinted card. **Gold** `--brand-gold` for the wordmark "Gold" and the one keyword in
each section headline (Solve / Deliver / Prove). No other color anywhere.

## Width (locked after review)
`--container-wide: 1120px`, centered, 40px gutters on desktop. At 1440 that leaves 120px
margins each side. Nav wordmark and all section headlines share the same left edge.
Only the Deliver shelf bleeds past the right edge.

## Copy rules (locked after review)
- Solutions first. Card headline is what we do ("Finish the workflow, not the demo."),
  body is the expanded "what has to change," the statistic is a supporting line at the bottom.
- Every pillar headline carries a right-aligned action that leads to #start.
- Footnote superscripts only on statistics. Caveats, methodology notes and the brief date
  live in the footer. No fine print the customer does not need inside the page body.
- Page ends with a direct hire: "Hire xGold Tech for one workflow." + two pills.

## Project tokens (end of `tokens.css`)
`--brand-gold` · `--tint-hero` · `--card-tint` · `--card-dark-bg` · `--surface-on-dark` ·
`--control-bg` · `--fs-lede`.

## Site map (progressive disclosure, 2026-10-13)
Homepage states value, establishes relevance and offers one next step. Every section on it has a
"learn more" action into the page that holds the detail. Shared nav on every page:
Problems · Solutions · How we work · About · Research · [Start an assessment → book.html].
Shared footer: link directory + evidence note; the numbered source list lives only on research.html,
and every footnote marker on other pages links to `research.html#src-NN`.

| Page | Job | What it holds |
|---|---|---|
| `index.html` | Value, relevance, one next step | Hero · four cost benchmarks · six Build cards (each links to its Problems tab) · statement · two documented implementations (Providence, Hiscox) · three-phase plan · start block |
| `problems.html` | Pick a challenge, understand the fix | Six hash-linked tabs (documents, reporting, integration, support, agents, governance). Each: benchmark card, tinted "what has to change", "what we build" with Measured by, "seen in practice" case |
| `solutions.html` | Evidence you can evaluate | Ten documented implementations in the five-field spec (Problem / Changed / Systems / Measured / Result) + an illustrative pilot acceptance scorecard and the expand/improve/stop decision |
| `how-we-work.html` | Scope, process, responsibilities, costs, controls, deliverables | In/out of scope · three phases · who does what · costs (fixed fee, scoped build, monthly operate) · fit · safeguards · scorecard |
| `about.html` | Credibility | Six principles · people (PLACEHOLDERS) · qualifications stated plainly, incl. what we cannot show yet (PLACEHOLDERS) |
| `research.html` | Source-supported findings | Six findings with evidence · cost of manual work · nine stats with filter · measurement definitions with Deloitte/Gartner/GDS anchors · sources 1–31 · evidence notes |
| `book.html` | Interest → scoped conversation | Single-card intake form, "Start an assessment" |

Pages were generated once by a throwaway script; they are plain static HTML now. Nav and footer are
duplicated per page by design. Edit them in all seven files together.

Research inputs (2026-10-13): competitor phrasing survey of 18 firms (Brainforge, Main & Machine,
insidea, Tribe, Fractional, Credal, Glean, Thoughtworks, Palantir, UiPath, Workato, Zapier, Claude,
Accenture, Deloitte, Distyl, GeekyAnts, Writer) and a documented-implementation survey (Hiscox, Dow,
Klarna, Octopus, DBS, UK GDS, Morgan Stanley, Aviva, Amazon, Pennsylvania). Only cases with all five
fields filled were used.

## Publishing work (added 2026-10-19)
`content/work/<slug>.json` → `node scripts/build-work.mjs` → `work/<slug>.html` + the block between
`<!-- WORK:START -->` and `<!-- WORK:END -->` on `solutions.html`. No dependencies. The GitHub Action
`.github/workflows/build-work.yml` runs it on every push to main that touches `content/work/`, and
commits the generated files, so adding a JSON file is the whole publishing step. Entries with
`"draft": true` are skipped; `--include-drafts` previews them locally. The script only deletes pages
that carry its own "generated by" marker. Schema and body-block reference: `content/work/README.md`.
Article pages use the same five-field spec card, a tinted hero-stat card, a prose body, an optional
scorecard with the expand/improve/stop decision, and a sources list. Styles in `styles/work.css`.

## Internal CRM (added 2026-10-20)
Twenty (open-source CRM) is the internal system of record for leads. It runs as its own app at
`crm.xgold.tech` (kit in `crm/`: compose + Caddy TLS + runbook), with Twenty's own login and
invite-only sign-up. The public site exposes a single footer link, "Team sign in". The bridge from
the form is a Supabase Edge Function (`supabase/functions/sync-to-twenty`) fired by a Database
Webhook (`supabase/twenty-sync.sql`); it creates Company → Person → Opportunity(NEW) → Note and
marks the Supabase row synced. No Twenty credential ever reaches the browser.

## Booking page (`book.html`, `styles/form.css`, `book.js`)
Modeled on Apple Business's "Add your organization details" screen. No nav, no scrolling
destinations: gray page, centered wordmark, a "Cancel" link back to the site, one 516px
white card. Fields use Apple-style 1px outlined inputs with floating labels; optional
checkboxes sit in gray boxes; the single full-width primary button is dimmed until the
five required fields validate. Required: name, work email, company, immediate constraint,
workflow. Optional: role, what it costs today, named-owner checkbox, send-questions checkbox.
On submit the card swaps to a confirmation panel. `data-endpoint` on the form is empty:
set it to a form handler URL to actually deliver submissions (JSON POST).

Form backend (2026-10-20): Supabase project ekmukamjcmlizopalhmq, table `assessment_requests`, RLS insert-only for anon, publishable key embedded in book.html, honeypot field `website`. Schema in `supabase/schema.sql`. Open items: `#contact` placeholders (footer + home closing block), About page placeholders, named platforms in Fit, phase durations and pricing approach in Plan/Costs, optional Database Webhook for notifications.

## Reconciliations with CLAUDE.md
1. **Single accent** — kept for all interactive elements. Pillar keyword colors and tinted
   cards are "content color", allowed under "content is the only color".
2. **No shadows** — kept for UI chrome. App-tile shelf and device renders may carry a
   soft shadow because they are imagery.
3. **No stock photos of people** — Apple Business *does* use a photo of people in the
   Security card. Our default: avoid, use product UI renders. Revisit only if the client
   supplies real team photography.
4. **Hero: two actions** — Apple Business hero uses one. One is fine; never more than two.

## Build plan when content arrives
- `index.html` + `tokens.css` + `styles/` (`nav.css`, `hero.css`, `shelf.css`, `card.css`,
  `button.css`, `footer.css`). Plain HTML/CSS, IntersectionObserver for fade-up reveals.
- Breakpoints to verify: 375 / 768 / 1440. Dark mode and reduced motion verified.
