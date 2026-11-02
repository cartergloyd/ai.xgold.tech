# CLAUDE.md — Apple-Style Design System

This project follows the visual language of apple.com: restrained, spacious, product-first. When building or editing any UI here, follow these rules. If a request conflicts with them, ask before deviating.

`BRAND.md` is the xGold brand standard (color, logo, type, voice) and applies to every page. Where this file and `BRAND.md` differ, `BRAND.md` wins.

> Values below are close approximations of Apple's published CSS, not an official spec. Treat them as design tokens we own, and keep them in one place (`tokens.css`).

## Core principles

1. **Few ingredients, used consistently.** One accent color, one typeface family, a small set of radii and type sizes. Do not introduce new ones without a reason.
2. **Whitespace is the design.** One idea per section. Generous vertical padding. Never fill space just because it exists.
3. **Content is the only color.** The UI is neutral (white, gray, black). Saturation comes from imagery.
4. **Short copy.** Headlines are a single sentence. Supporting text is one line. Details go in footnotes.
5. **Separate with color and space, not lines.**

## Design tokens

```css
:root {
  /* Color */
  --bg: #ffffff;
  --bg-alt: #f5f4f1;          /* alternating section background */
  --bg-dark: #000000;
  --text: #1d1d1b;            /* near-black, never pure #000 for body text */
  --text-secondary: #6b6862;
  --text-on-dark: #f5f4f1;
  --accent: #d0a048;          /* gold fills: primary buttons, marks, logo */
  --on-accent: #1d1d1b;       /* text on gold fills, never white */
  --accent-text: #8a6414;     /* gold text: links, outline buttons, status labels, headline keyword */
  --accent-on-dark: #d0a048;  /* gold text on dark surfaces */
  --hairline: rgba(29, 29, 27, 0.12);

  /* Typography */
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
          "Helvetica Neue", Helvetica, Arial, sans-serif;

  /* Radii */
  --radius-card: 24px;        /* range 18–28px */
  --radius-pill: 980px;

  /* Layout */
  --content-max: 980px;       /* standard column (--container-max) */
  --content-wide: 1260px;     /* wide rows, nav and footer (--container-wide) */
  --gutter: 22px;             /* mobile; scale to ~40px+ on desktop */
  --section-pad-y: clamp(64px, 10vw, 120px);

  /* Motion */
  --ease: cubic-bezier(0.28, 0.11, 0.32, 1);
  --duration: 0.5s;
}
```

The site is light only. There is no dark mode: pages stay white when the device is in dark mode (`color-scheme: only light` in `tokens.css` and `<meta name="color-scheme" content="only light">` in every page head). Do not add `prefers-color-scheme` rules. Dark sections and cards (`--bg-dark`) are part of the design and stay.

## Color rules

- Page backgrounds alternate between `--bg` and `--bg-alt`, or use `--bg-dark` for product-on-black moments.
- Exactly one accent: gold. Do not add secondary brand colors. Gold has three jobs: fill (`--accent` with `--on-accent` text), text (`--accent-text`; gold `--accent` on white fails as text), and wash (`--accent-wash`, selection only).
- Status labels ("New", "Beta") are sentence case, small, in `--accent-text`. Never all caps.
- Muted gray is used for the second half of a headline ("The latest. <span class="muted">Take a look at what's new.</span>") and for captions and metadata.

## Typography

- Font: system San Francisco stack (see `--font`). No decorative or secondary typefaces.
- Page title: very large (clamp ~48–96px), semibold (600), tight line-height (~1.05), slightly negative letter-spacing (about -0.02em).
- Section headline: 40–56px, semibold, same tight treatment.
- Card headline: 28–40px, semibold.
- Body and links: 17px, regular, line-height ~1.4.
- Fine print / footnotes: 12px, `--text-secondary`.
- Footnote markers are superscripts attached to the claim (e.g. `Try it free¹`).
- Limit to roughly four type sizes per page. Do not create in-between sizes.

## Layout and spacing

- Content lives in a centered container (`--container-max` 980px, or `--container-wide` 1260px for wide rows, the nav and the footer) with consistent gutters. Page titles, shelves, and card rows share the same left edge.
- Backgrounds go full-bleed. Content stays in the container.
- Vertical rhythm between sections: `--section-pad-y` (64–120px). Between a title and its content: 48–80px.
- Prefer CSS grid/flexbox. No fixed pixel widths for layout. Use `max-width` and fluid units.
- Horizontal shelves and carousels bleed off the right edge of the viewport to signal scrolling. Do not show a scrollbar. Provide a round chevron button.
- Declare `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` and respect safe-area insets.

## Lines and dividers

- Avoid horizontal rules. Use background-color changes and whitespace to separate sections.
- Only exception: the global nav gets a 1px hairline (`--hairline`) and a translucent, blurred backdrop (`backdrop-filter: saturate(180%) blur(20px)`).

## Global nav

- Slim bar (~44–48px tall), centered, translucent background with blur.
- xGold monogram at the left, then a flat list of short text items in small (12–14px) gray text that darkens on hover, then one gold pill ("Start an assessment"). One nav for every page: `css/nav.css` + `js/nav.js`.
- Optional promo strip directly beneath: one sentence, small text, inline `--accent-text` link with a `›` chevron, light gray or white background.
- On mobile, collapse to a menu icon with a full-screen menu.

## Hero

- One product, one message. Structure: product name (h1/h2), one-line tagline, two actions.
- Actions: a filled pill ("Buy" / "Try it free") plus a secondary outline pill or text link ("Learn more ›").
- Media is full-bleed. Text anchors to a corner (commonly bottom-left) or centers above the product. Ensure text contrast against the image.
- Any autoplay or auto-advancing media must include a visible pause control and respect `prefers-reduced-motion`.

## Cards

- Radius `--radius-card`. No borders, no heavy shadows. A card is defined by its background (black, white, or a soft tint).
- Consistent internal order:
  1. Status label (small, `--accent-text`, sentence case), e.g. New
  2. Product name (large, semibold)
  3. One-line tagline
  4. Price or offer in smaller, lighter text
  5. Product image, often cropped by the bottom edge of the card
- Alternate dark and light cards in a row for rhythm.
- Media cards (entertainment, content): image tile with the title and metadata (genre, type) underneath in gray, not overlaid on the image.
- Entire card is clickable. Hover: very subtle scale (≤1.02) or none. Never bounce.

## Buttons and links

| Type | Style |
|------|-------|
| Primary | Filled `--accent` (gold), `--on-accent` (ink) text, never white, pill radius, 8–12px × 16–22px padding, 17px text |
| Secondary | Transparent, 1px `--accent-text` border, `--accent-text` text, pill radius |
| On dark media | The same gold filled pill; outline and text links use `--accent-on-dark` |
| Tertiary | Plain text link in `--accent-text` with a trailing `›` ("Learn more ›") |
| External | Trailing `↗` ("Find a store ↗") |
| Carousel control | Round, translucent gray, chevron icon, overlaid on edge of the shelf |

- Buttons are small and quiet. Do not make them oversized or add shadows.
- Hover: slightly darker/lighter fill. Focus: visible 2px focus ring in `--focus-ring` (`--accent-text`) with offset.
- Never use more than two buttons side by side in one component.

## Icon shelves

- Row of transparent-background product cutouts with a short label beneath (e.g. "Apple Watch Ultra 4").
- Optional tiny `--accent-text` status label under the label ("New"), sentence case.
- Overflows horizontally with a chevron to scroll. Equal spacing between items.

## Imagery

- Studio-lit product photography or renders on solid, soft-gradient, or black backgrounds. No stock photos of people, no clip-art icons, no decorative illustrations.
- Provide descriptive `alt` text (product, color, orientation, what is shown).
- Serve responsive image sizes. Large hero images should not block first paint.
- If a placeholder is needed, use a flat `--bg-alt` block, not a gray "image" icon.

## Motion

- Use motion to reveal and clarify, not to decorate. Long, smooth easing (`--ease`, 0.4–0.8s).
- Preferred effects: fade + slight upward translate on scroll-in, scale on pinned hero elements, parallax at low intensity, scroll-linked playback for product media.
- No bounce, elastic, or spring overshoot. No spinning or looping decorative animation.
- Always honor reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
```

## Copywriting

- Headlines: a short sentence or fragment ("Pro further.", "Hello, hello.").
- One supporting line max under a headline.
- Prices and offers: "From $399 or $33.25/mo. for 12 mo.¹" — concise, with footnote markers.
- Link text: "Learn more", "Buy", "View pricing", "Apply now". No marketing-speak or exclamation marks.
- Legal and eligibility details live in numbered footnotes at the page bottom.

## Promotional banners and ad creatives

Used for campaigns, offers, and partner-facing ads (e.g. Apple Ads "Drive business on Apple Maps."). These follow the same restraint as the site, with a few controlled exceptions.

**Structure**
- Container: `--bg-alt` panel, `--radius-promo` (~28px), often displayed on a dark surround. Fixed aspect ratio (about 16:9 to 2:1) with responsive scaling.
- Two zones: a text column on the left (about 45–55% width) and illustration on the right. On mobile, stack text above art.
- Brand lockup (logo + product wordmark, e.g. " Ads") top-left, small, in `--text`.
- No button required. The whole banner is the click target (wrap it in a single `<a>`). If a CTA is needed, use one text link with `›`.

**Headline**
- One sentence split into two lines: a hook line and a subject line.
- Hook line may use the gold gradient (`--gradient-gold`, `.t-gold`) via `background-clip: text`, on dark surfaces only. Subject line is solid `--text`.
- Use the gradient on one headline line per banner, never on body text or buttons.
- Keep the gradient text at a size ≥ 32px and verify contrast against `--bg-alt`.

**Body and fine print**
- Offer copy: one plain sentence, 3 lines max, medium weight, with an asterisk when terms apply.
- Fine print: 12px, `--text`, bottom-left, two short lines max (limits first, "terms apply" second).

**Illustration**
- Background art is product UI (maps, screens, interfaces) at low contrast: desaturated, faded, and partly cropped by the container edges.
- Exactly one saturated focal object (e.g. a large glossy pin with a pale blue halo ring) positioned on the right, off-center.
- Supporting elements are small circular badges orbiting the focal object: gradient fill, 2–3px white rim, white glyph, soft drop shadow. Use 4–6 of them, each a different hue from the same product palette, with varied sizes.
- This is the one place gradients and soft shadows are allowed. They belong to the product illustration, never to buttons, cards, or UI chrome.
- Background art must never reduce legibility of the text column. Fade it or mask it behind the text.

**Accessibility**
- Banner `<a>` needs an accessible name that includes the full offer. Decorative illustration gets `alt=""` or `aria-hidden="true"`.
- The fine print must remain real, selectable text, not baked into an image.

## Footer

- Light gray (`--bg-alt`) background, 12px text in `--text-secondary`.
- Numbered footnotes first, then multi-column link directory under small bold column headings, then a region selector and a single copyright line with legal links.
- Hairline dividers are acceptable here only.

## Responsive behavior

- Mobile-first. Multi-column grids stack to one column. Cards stack with full width.
- Nav collapses to a menu icon. Carousels become touch-swipe lists with partially visible next item.
- Typography scales with `clamp()`. Spacing and proportions stay consistent across breakpoints.
- Minimum tap target 44×44px.

## Accessibility

- Body text contrast ≥ 4.5:1. Verify text over imagery.
- All interactive elements keyboard-reachable with visible focus states.
- Semantic HTML: one `h1` per page, logical heading order, `nav`, `main`, `footer` landmarks.
- Autoplay media has a pause control. Respect `prefers-reduced-motion`. The site is light only, so `prefers-color-scheme` is not followed.

## Implementation notes

- Prefer plain HTML + CSS with custom properties. Use utility frameworks only if the project already uses one, and map classes to the tokens above.
- Keep tokens in a single `tokens.css`. Components must reference tokens, never hard-coded hex values or px radii.
- Component file naming: `hero`, `card`, `button`, `nav`, `shelf`, `footer`. One responsibility each.
- Do not add dependencies for animation unless native CSS/IntersectionObserver cannot do the job.

## Do / Don't

**Do**
- Use whitespace generously and let one message own each section.
- Alternate white, light gray, and black sections.
- Crop product images off card edges for depth.
- Keep every interactive element in the one accent color (gold).

**Don't**
- Add borders, drop shadows, gradients on UI chrome, or multiple accent colors. (Gradients and soft shadows are allowed only in promotional-banner illustration and the single gradient headline line. See "Promotional banners".)
- Use pure `#000` for body text or pure gray backgrounds darker than `--bg-alt` in light mode.
- Overlay long text on busy imagery.
- Add decorative icons, emoji, or stock photography. (Product-UI icons inside promo illustrations, like Maps category badges, are fine.)
- Use bouncy or attention-grabbing animation.

## Review checklist before finishing any UI task

- [ ] Only tokens from `tokens.css` used (no stray colors, radii, or font sizes)
- [ ] One accent color, one typeface
- [ ] Sections separated by background and spacing, not lines
- [ ] Hero has one message and at most two actions
- [ ] Cards follow the label → name → tagline → price → image order
- [ ] Works at 375px, 768px, and 1440px widths
- [ ] Reduced motion verified, and the page stays white with the device in dark mode
- [ ] Alt text and focus states present
