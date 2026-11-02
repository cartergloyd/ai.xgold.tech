# xGold Tech/AI: Brand Standards

Governs websites, video, images, social, decks, and print. Tokens live in `tokens.css`. Layout rhythm follows apple.com. Values are ours.

If a request conflicts with this document, ask before deviating.

## 1. Principles

1. **Few ingredients.** One accent (gold). One typeface. A small set of radii and sizes. Add nothing without a reason.
2. **Whitespace is the design.** One idea per section. Do not fill space because it exists.
3. **The product is the color.** The interface is neutral. Gold marks identity and interaction. Saturation comes from the product.
4. **Fewest words.** Every word serves a purpose or goes.
5. **Separate with color and space.** Not lines.
6. **Craft is precision.** Alignment, edges, spacing, and render quality are visible at 100%.

## 2. Identity

### Name

| Use | Form |
|-----|------|
| Brand | **xGold** (lowercase x, capital G, one word) |
| Formal first reference | xGold Tech/AI |
| Descriptor | Tech/AI, set in `--text-secondary`, never alone |
| Never | XGold, X-Gold, Xgold, x Gold |

Domains and handles may be lowercase.

### Monogram

White X, gold G. The X is the only element that changes with the background.

| Background | X | G |
|------------|---|---|
| `--bg`, `--bg-alt` (light) | `--ink` | `--gold` |
| `--bg-dark`, `--charcoal` | `#ffffff` | `--gold` |
| Photography or render | Use only over flat black or a flat area. Never over detail. | `--gold` |

In inline SVG, fill with `var(--logo-x)` and `var(--logo-g)`. The tokens switch with the surface.

- **Clear space:** 25% of monogram width on all sides (`--logo-clearspace`).
- **Minimum size:** 24 px high on screen. 8 mm in print.
- **Lockup:** monogram, then wordmark "xGold" in SF Pro Semibold, tracking -0.02em. Gap equals clear space. Wordmark height equals the X height.
- **Do not:** recolor, outline, rotate, stretch, add shadow, add gradient, place on busy imagery, or set the G in text gold (`--gold-deep`).

The supplied PNG has a white X on transparency. Use it on dark only. Light-background and vector files are listed in Open items.

## 3. Color

### Palette

| Token | Value | Role |
|-------|-------|------|
| `--bg` | `#ffffff` | Page |
| `--bg-alt` | `#f5f4f1` | Alternating section, card tint |
| `--bg-dark` | `#000000` | Product-on-black tiles |
| `--charcoal` | `#1c1b19` | Elevated dark surface |
| `--text` | `#1d1d1b` | Body and headlines. Never pure black on light. |
| `--text-secondary` | `#6b6862` | Captions, metadata, second half of a headline |
| `--accent` | `#d0a048` | Fills: primary button, marks, logo |
| `--on-accent` | `#1d1d1b` | Text on gold fills. Never white. |
| `--accent-text` | `#8a6414` | Links, outline buttons, status labels (light) |
| `--accent-text-hover` | `#6f500f` | Hover for `--accent-text` |
| `--accent-wash` | gold at 16% | Selection, highlighted row |

On dark surfaces, `--accent-text` becomes `#d0a048` and hover becomes `#e0b865`.

### Gold has three jobs

1. **Fill.** `--accent` with `--on-accent` text.
2. **Text.** `--accent-text`. Gold on white is 2.4:1 and fails as text.
3. **Wash.** `--accent-wash` for selection only.

Gold is the only interactive color. No secondary brand colors.

### Contrast (WCAG)

| Pair | Ratio |
|------|-------|
| `--text` on `--bg` / `--bg-alt` | 16.9 / 15.4 |
| `--text-secondary` on `--bg` / `--bg-alt` | 5.6 / 5.1 |
| `--accent-text` on `--bg` / `--bg-alt` | 5.4 / 4.9 |
| `--on-accent` on `--accent` / hover | 7.1 / 6.0 |
| Gold on black (dark `--accent-text`) | 8.8 |
| Gold on `--charcoal` | 7.2 |
| `--text-secondary` on black (dark) | 8.5 |

Gold as a graphic against white is 2.4:1. Use it for fills and marks only, never for text or the sole indicator of state.

### Surfaces

- Alternate `--bg`, `--bg-alt`, and `--bg-dark` between sections.
- Use `.surface-dark` or `.section--dark` for a dark tile on a light page. Tokens re-scope automatically.
- Full-bleed tiles stack with an 8 px gap (`--tile-gap`).

### Gold gradient

`--gradient-gold` via `.t-gold`. One headline line per page. Dark surfaces only. 32 px or larger. Nowhere else: not on buttons, cards, or UI chrome.

## 4. Typography

One typeface: the system San Francisco stack (`--font`). No second family.

| Role | Class | Size | Weight | Line height | Tracking |
|------|-------|------|--------|-------------|----------|
| Page title | `.t-page-title` | 40 to 96 px | 600 | 1.05 | -0.02em |
| Section headline | `.t-section` | 32 to 56 px | 600 | 1.05 | -0.02em |
| Card headline | `.t-card` | 24 to 40 px | 600 | 1.15 | -0.02em |
| Lead, tagline | `.t-lead` | 20 to 28 px | 400 | 1.15 | -0.01em |
| Body, links | none | 17 px | 400 | 1.4 | -0.01em |
| Small | none | 14 px | 400 | 1.4 | -0.01em |
| Fine print | `.t-fine` | 12 px | 400 | 1.4 | -0.01em |

- Use at most four sizes per page. Do not add in-between sizes.
- Headlines: sentence case, single sentence or fragment. Wrap with `text-wrap: balance`.
- Second half of a headline may use `--text-secondary` (`.t-muted`).
- Footnote markers are superscripts attached to the claim.
- Line length under 75 characters.
- Status labels ("New", "Pre-order", "Beta") are sentence case, 12 to 14 px, `--accent-text`. Use only when the status is true. Never all caps.

## 5. Layout and margins

Mobile first. Backgrounds go full bleed. Content sits in the container.

| Viewport | Gutter | Content width |
|----------|--------|---------------|
| Under 734 px | 22 px | Viewport minus 44 px |
| 734 to 1067 px | 40 px | Viewport minus 80 px |
| 1068 px and up | 40 px | 980 px, centered |

- **Standard:** `.container`, 980 px content.
- **Wide:** `.container--wide`, 1260 px content, for shelves and product grids.
- **Cap:** 1440 px (`--page-max`) for media content inside full-bleed tiles.
- Page titles, shelves, and card rows share one left edge.
- Centered text is allowed in heroes only. Body copy is left-aligned.
- Gutters respect `env(safe-area-inset-*)`. Declare `viewport-fit=cover`.
- No fixed pixel widths for layout. Use `max-width`, grid, and flexbox.
- Tap targets are 44 by 44 px minimum.

### Vertical rhythm

| Space | Value |
|-------|-------|
| Between sections | `--section-pad-y`, 64 to 120 px |
| Title to content | `--title-gap`, 40 to 80 px |
| Hero top padding | `--hero-pad-top`, 32 to 56 px |
| Hero title to tagline | 12 px |
| Hero tagline to actions | 24 px |
| Hero actions to media | `--hero-gap-media`, 40 to 64 px |

Hero top padding is smaller than section padding. The product should appear in the first viewport.

### Lines

None, except the 1 px nav hairline and footer dividers. Separate with background change and space.

## 6. Components

One file each: `nav`, `hero`, `card`, `button`, `shelf`, `footer`. Components read tokens. No hex values, no raw px radii.

### Nav

- 44 px bar. Translucent `--nav-bg` with `backdrop-filter: saturate(180%) blur(20px)`. 1 px `--hairline`.
- Monogram at left. Short text items, 12 to 14 px, `--text-secondary`, darken on hover.
- Mobile: menu icon and full-screen menu.
- Optional promo strip below: one sentence, small, one inline link with `›`.

### Hero

One product. One message. Structure: name, tagline, up to two actions, media.

```html
<section class="section section--alt section--hero">
  <div class="container">
    <h1 class="t-page-title">xGold Core</h1>
    <p class="t-lead">Runs where your data lives.</p>
    <div class="actions">
      <a class="btn" href="/core">Learn more</a>
      <a class="btn btn--secondary" href="/buy">Buy</a>
    </div>
  </div>
  <img src="core-hero.avif" alt="xGold Core, front three-quarter view, gold edge light on black.">
</section>
```

- Light hero: centered text above the product. Product is cropped by the section's bottom edge.
- Dark hero: full-bleed black tile, product whole, text anchored bottom-left or centered above it.
- Text over imagery needs 4.5:1 contrast. Never overlay long text on detail.
- Autoplay media needs a visible pause control.

### Buttons

| Type | Style |
|------|-------|
| Primary | Fill `--accent`, text `--on-accent`, pill, 8 by 18 px padding, 17 px |
| Secondary | Transparent, 1 px `--accent-text` border, `--accent-text` text, pill |
| Tertiary | Text link, `--accent-text`, trailing `›` ("Learn more ›") |
| External | Trailing `↗` |
| Carousel control | Round, translucent gray, chevron, on the shelf edge |

- Small and quiet. No shadows. No oversized buttons.
- Hover: fill moves to `--accent-hover`. Focus: 2 px `--focus-ring`, 2 px offset.
- Never more than two buttons side by side. Gap 12 px (`--btn-gap`).
- Pointer-coarse devices: minimum height `--tap-target`.

### Cards

- Radius `--radius-card`. No border. No shadow. Defined by background alone.
- Order: status label (if true), name, tagline, price, product image cropped by the bottom edge.
- Alternate dark and light cards in a row.
- Media cards: image tile, title and metadata below in `--text-secondary`. Never overlaid.
- Whole card is the link. Hover scale 1.02 maximum, or none.

### Shelves

Product cutouts on transparent backgrounds, label beneath. Equal spacing. Overflow bleeds off the right edge. No scrollbar. Round chevron control.

### Footer

`--bg-alt`. 12 px `--text-secondary`. Order: numbered footnotes, link columns under small bold headings, region selector, one copyright line with legal links. Hairline dividers allowed here.

## 7. Imagery

Studio renders and studio photography. Product only.

### Look

| Element | Standard |
|---------|----------|
| Backdrop | Flat `--bg`, `--bg-alt`, or `--bg-dark`. No textured or gradient backdrops. |
| Key light | One soft source, upper left, about 45 degrees. |
| Rim light | One gold edge light, matched to `--gold`. Defines silhouette. |
| Emitted light | Optional soft gold glow from the product onto black. Under 30% of frame. |
| Shadow | Soft contact shadow only. No drop shadow on cutouts. |
| Material | Brushed, not mirrored. Edge chamfers, grain, and seams stay visible. |
| Lens | 85 mm equivalent or longer, or orthographic. No wide-angle distortion. |
| Angle | Straight profile or three-quarter. One angle per product family. |
| Frame | Product fills 55 to 70% of frame width. 8% minimum margin on uncropped sides. |
| Crop | Light tiles: crop at the bottom edge. Dark tiles: show the whole product. |
| Color | Neutral scene. Gold only as rim, emitted light, and the monogram. |

### Content

- On-screen UI shows real, plausible content. No lorem ipsum.
- No stock photography. No clip art. No decorative illustration.
- People: none, except hands in commissioned shots that establish scale.
- Placeholder: a flat `--bg-alt` block.

### Delivery

| Asset | Size | Format |
|-------|------|--------|
| Hero | 2880 by 1620 | AVIF or WebP, JPEG fallback, under 300 KB |
| Card tile | 1600 by 2000 | AVIF or WebP |
| Cutout | 1600 px long edge | Transparent AVIF or PNG |
| Link preview | 1200 by 630 | JPEG |

Master in Display P3. Export sRGB unless the format carries P3. Serve responsive sizes with `srcset`. Hero images must not block first paint.

### Alt text

Product, finish, angle, and what the screen shows. "xGold Core, brushed aluminum, front three-quarter view, dashboard on screen."

## 8. Motion

Reveal and clarify. Never decorate.

- Easing `--ease`. Duration 0.4 to 0.8 s.
- Entrances: fade and 16 px upward translate (`--reveal-distance`). Apply to the headline and product only, not every section.
- Allowed: scale on pinned hero elements, low-intensity parallax, scroll-linked product playback.
- Not allowed: bounce, elastic, spring overshoot, spin, looping decoration.
- Hover: scale 1.02 maximum.
- Honor `prefers-reduced-motion`. `tokens.css` zeroes durations and disables animation.

## 9. Video

Same look as section 7. Same easing as section 8.

### Technical

| Item | Standard |
|------|----------|
| Master | 3840 by 2160, ProRes 422 HQ |
| Frame rate | 24 fps film. 60 fps screen capture. |
| Delivery | 16:9, 9:16, 1:1, 4:5. H.264 or H.265. |
| Color | Rec.709 SDR. HDR master optional. |
| Audio loudness | -16 LUFS integrated, -1 dBTP peak |
| File name | `xgold_[campaign]_[ratio]_[seconds]s_v[nn].mp4` |

### Structure

- Product on screen within 2 seconds.
- One message per shot. Shots run 3 to 6 seconds.
- Hard cuts, or dissolves of 12 frames or fewer.
- Camera: slow push or orbit on the `--ease` curve. No handheld, whip pan, glitch, or zoom punch.
- Backgrounds: black or `--bg-alt`.

### Safe zones

Keep text inside 90% of the frame (`--video-safe-title`) and action inside 93% (`--video-safe-action`). In 9:16, keep text out of the top 14% and bottom 20%.

### On-screen type

SF Pro Semibold, tracking -0.02em. Sizes as a percentage of frame height:

| Element | Size |
|---------|------|
| Headline | 6% |
| Supporting line | 3.2% |
| Caption | 2.8% |
| Lower third: name | 3%, descriptor 2.2% in `--text-on-dark-secondary` |

Lower thirds sit left-aligned on the title-safe margin.

### Captions

Required on every video. Ship a separate track (VTT or SRT). Burn in for social only. White, semibold, two lines maximum, 42 characters per line, no box. Use a 60% black box only over photographic backgrounds.

### Logo sting

3 seconds (`--video-sting`) on black. Monogram fades in over 0.8 s, holds 1.5 s, fades out over 0.7 s. White X, gold G, centered. End card: monogram, one line, URL.

### Audio

No stock music loops. Silence is allowed. Voiceover is calm and measured, about 140 words per minute, and follows section 11.

## 10. Social, decks, print

| Asset | Size | Notes |
|-------|------|-------|
| Link preview | 1200 by 630 | Product on flat ground. Monogram bottom-left. |
| Feed post | 1080 by 1350 (4:5) | One product, one line |
| Story, Reels | 1080 by 1920 | Section 9 safe zones |
| Video thumbnail | 1280 by 720 | Product and four words maximum |
| Avatar | 1080 by 1080 | Monogram on black, 60% of width |
| Slide | 1920 by 1080 | See below |

**Decks.** Title and divider slides on black. Content slides on `--bg` or `--bg-alt`. One idea per slide. Body 28 px minimum. Footnotes 18 px minimum. 8% side margins. No bullets longer than one line.

**Print.** Margins 15 mm minimum. Never set gold text under 14 pt. Gold fills need an approved physical proof. Record the matched spot or CMYK values under Open items once approved.

## 11. Voice and copy

Precise. Calm. Brief. Every sentence earns its place.

### Rules

1. Cut, then cut again. If a word can go, it goes.
2. One claim per sentence. Prefer numbers, units, and named things.
3. Headline: 6 words or fewer. Support: one line, 12 words or fewer. Body: 3 sentences or fewer per paragraph.
4. Say what it does. Use verbs, not adjectives.
5. Name features by function. Do not write "AI-powered" or "intelligent".
6. Sentence case everywhere. Capitalize product names only.
7. Numerals always. Space before units: 50 ms, 4 GB. Thousands with commas.
8. Caveats go in numbered footnotes.
9. Active voice. Present tense. No promises about the future.

### Banned

**Punctuation and format:** em dashes, exclamation marks, emoji, rhetorical questions, ellipses for effect, all caps for emphasis.

**Constructions:** "not just X, but Y"; "more than a tool"; "whether you're A or B"; lists of three adjectives; "We're excited to"; "In today's"; hedging ("can help", "may", "aims to").

**Words:** delve, unlock, elevate, empower, leverage, harness, supercharge, unleash, streamline, seamless, effortless, robust, powerful, cutting-edge, state-of-the-art, next-generation, revolutionary, transformative, game-changing, world-class, best-in-class, innovative, journey, landscape, tapestry, ecosystem (unless literal), solution, synergy, magic, simply, just, easy, please.

### Patterns

| Element | Pattern | Example |
|---------|---------|---------|
| Headline | Name or fragment | "xGold Core." |
| Support | What it does, one line | "Runs where your data lives." |
| Price | "From $399 or $33.25/mo. for 12 mo.¹" | |
| Button | Verb, 1 to 3 words | "Learn more", "Buy", "View pricing", "Contact sales" |
| Error | What happened, then what to do | "File exceeds 50 MB. Upload a smaller file." |
| Empty state | Name the space, one line, one action | "No projects. Create project" |
| Link | Names the destination | "Read the docs" |

### Rewrites

| Before | After |
|--------|-------|
| Unlock the power of AI-driven insights with our seamless platform! | Answers from your data. |
| We're excited to announce our newest model. | Available now. |
| It's not just a tool. It's your partner. | Cut. |
| Our cutting-edge engine delivers lightning-fast results. | Responds in 40 ms. |
| Please click here to learn more. | Learn more |

## 12. Accessibility

- Body text 4.5:1 minimum. Verify text over imagery.
- Every interactive element is keyboard reachable with a visible focus ring.
- Semantic HTML: one `h1`, logical heading order, `nav`, `main`, `footer`.
- Decorative media: `alt=""` or `aria-hidden="true"`.
- Autoplay has a pause control.
- Respect `prefers-reduced-motion`. The site is light only: no dark mode, and pages stay white when the device is in dark mode.
- Fine print stays real, selectable text. Never bake it into an image.

## 13. Implementation

- Plain HTML and CSS with custom properties. Use a utility framework only if the project already does, and map classes to tokens.
- `tokens.css` loads first. Nothing else defines color, radius, or size.
- Dark values live in `.surface-dark` in `tokens.css`, for dark tiles on a light page. There is no dark mode.
- Do not add animation dependencies. Use CSS and `IntersectionObserver`.
- Web type renders as SF on Apple devices and Helvetica Neue, Helvetica, or Arial elsewhere. Design for the fallback.

## 14. Open items

| Item | Status |
|------|--------|
| Vector monogram with `--logo-x` and `--logo-g` fills (SVG) | To produce |
| Light-background and one-color monogram files | To produce |
| Wordmark and lockup files | To produce |
| SF Pro license for video, image, and print text. Apple limits use. Choose a licensed alternative for non-web deliverables if not cleared. | To decide |
| Print gold: spot or CMYK match | To approve with printer |

## 15. Review checklist

- [ ] Only tokens from `tokens.css`
- [ ] One accent, one typeface, at most four type sizes
- [ ] Gold text is `--accent-text`. Gold fills carry `--on-accent`.
- [ ] Sections separated by color and space, not lines
- [ ] Hero: one message, at most two actions
- [ ] Cards follow label, name, tagline, price, image
- [ ] Works at 375, 768, and 1440 px
- [ ] Reduced motion verified, and the page stays white with the device in dark mode
- [ ] Alt text and focus states present
- [ ] Copy passes the banned list
- [ ] Logo clear space and minimum size respected
