# Claude Style Guide — Apple-Inspired Web Design

A reference for building web pages and components in the calm, disciplined, Apple-style aesthetic discussed in this conversation. Use this as a baseline when prompting Claude Code or when reviewing layout and motion decisions.

## Core Philosophy

The look comes from restraint, not decoration. Every choice serves readability and focus: controlled line lengths, generous negative space, a consistent centered grid, full-bleed imagery for impact, and motion that feels deliberate rather than flashy. When in doubt, remove rather than add.

## Layout: The Fixed Content Grid

All text and interactive content lives inside a centered, width-capped container. The whitespace on either side is intentional negative space, not wasted room — it keeps line lengths readable and gives the page a premium, uncluttered feel.

Key rules:

- Wrap main content in a centered container with a maximum width. Use the historical Apple value of `980px` as a starting point, exposed as a CSS variable (`--content-width`) so it's easy to change. Newer templates run wider (1024–1200px+).
- Center the container horizontally with `margin-inline: auto`.
- Add horizontal gutter padding (~22px each side) so text never touches the edge on narrow screens.
- Build internal layout on a 12-column CSS Grid with a ~24px gap. Align headlines, body, and UI to column fractions (full, 1/2, 2/3) rather than arbitrary pixels.
- Constrain body text to roughly 50–75 characters per line for comfortable reading; achieve this by limiting text blocks to a subset of columns on wide screens.

Note: these specific values (980px, the breakpoints below) are well-known historical Apple conventions, not an official published spec. The authoritative current values are whatever the live CSS uses — inspect the page in dev tools to confirm.

## Responsive Breakpoints

Reflow the layout at these widths (historical Apple breakpoints):

- 1068px
- 980px
- 734px
- 320px

Below 734px, stack columns into a single column and reduce font sizes proportionally. On mobile, let content fill the screen with small gutters (~16px). Use `clamp()` for fluid typography so type scales smoothly between breakpoints.

## Full-Bleed Media

Hero and background images may break out of the content container and span the full viewport width for visual impact, while all text and buttons stay inside the grid. This pairs immersive imagery with disciplined typography.

Escape the container with a utility class:

```css
.full-bleed {
  width: 100vw;
  margin-inline: calc(50% - 50vw);
}
```

## Buttons and Corners

Apple buttons are typically fully rounded pills (`border-radius: 980px` forces a pill shape regardless of height) or a softer ~12px radius on rectangular elements like cards.

The important rule: **match what's already on the page.** When adding new inputs or buttons, read the existing CSS, find the radius used on current buttons, and reuse that exact value so new elements look native rather than bolted on. Don't guess — pull the value from the existing styles.

## Motion and Animation

Motion should feel calm and deliberate — never bouncy or fast.

- Use ease-out timing, around `cubic-bezier(0.25, 0.1, 0.25, 1)`.
- Transitions for state changes (form swaps, content reveals): ~400–600ms.
- Hover/focus micro-interactions (border shifts, subtle scale ~1.03): ~200ms.
- Combine a gentle fade with a slight translate (e.g. fade + small upward slide) for entrances and exits rather than abrupt swaps.

### Accessibility: prefers-reduced-motion

Always honor `prefers-reduced-motion`. Continuous or large motion can cause problems for people with vestibular sensitivities. When the setting is enabled, replace animations with instant swaps and stop any auto-playing motion.

```css
@media (prefers-reduced-motion: reduce) {
  /* disable transitions/animations, provide instant fallback */
}
```

## Pattern: Infinite Auto-Scrolling Carousel

A row of cards that floats continuously and loops seamlessly with no visible jump.

The mechanic:

- Render the full card set twice, back-to-back, inside one track.
- Animate the track with `transform: translateX()` from `0%` to `-50%` (the width of exactly one set), looping with `animation: scroll Ns linear infinite`.
- Because the second copy is identical to the first, the reset at the loop point is invisible.
- Duration slow enough to feel like gentle floating — start around 40–60s.

Polish:

- Pause on hover (`animation-play-state: paused`) so users can study a card.
- Fade the left/right edges with a mask: `mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent)`.
- Hide the scrollbar; overflow horizontally.
- Stop auto-scroll under `prefers-reduced-motion` and allow manual scrolling instead.

Card anatomy: ~16:9 landscape image, ~12px rounded corners, ~24px gap between cards, left-aligned title (medium weight) with a lighter gray label beneath.

## Pattern: Minimalist Careers / Signup Section

Sparse, centered, almost nothing on screen.

Content order:

1. Large headline (e.g. "Join us") — big, tightly tracked, medium/semibold.
2. Email input field.
3. Upload button (file input styled as a button; accept .pdf, .doc, .docx).
4. Submit button.
5. Nothing else — no subheadings, paragraphs, or extra links.

Behavior:

- Inputs and the upload button reuse the existing page button radius so they match.
- On submit: validate the email, prevent default, then smoothly transition the form out and a confirmation message ("We will be in touch.") in — fade plus slight translate, ease-out, ~400–600ms.
- Stub the backend with a `// TODO: wire up to backend` comment; file uploads require server-side handling and can't be purely front-end.
- Respect `prefers-reduced-motion` with an instant swap fallback.

## General Build Constraints

- Prefer vanilla HTML and CSS; add JavaScript only where genuinely needed (loop duplication, submit transitions, validation). No CSS frameworks unless asked.
- Use semantic HTML and modern CSS: Grid, custom properties, `clamp()`.
- Preserve existing colors, copy, and images when redesigning — change layout and structure, not content.
- Comment clearly around the parts that carry the design logic: the grid system, breakpoints, full-bleed escape, loop mechanic, matched border-radius, and any motion transition.
- When working from an existing page, read the current HTML/CSS first so new work inherits real values (radius, container width, type) rather than guessed ones.

## Quick Prompting Checklist

When asking Claude Code to build something in this style, specify:

- Read the existing file first (if one exists) and pull real values.
- Centered container, max-width via `--content-width`, 12-column grid.
- Which corner treatment: pill vs. ~12px, matched to existing buttons.
- Motion timing and easing; combine fade + translate.
- `prefers-reduced-motion` fallback every time.
- Where the backend stub / TODO goes for anything that submits data.
- Ask it to explain any deviations and report values it pulled from existing styles.
