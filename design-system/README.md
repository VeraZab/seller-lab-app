# Spoonflower Seller Lab Pro — Design System

> A design system for the paid web companion of the **Spoonflower Seller Lab** Chrome extension — an SEO keyword & tag helper for independent fabric and surface-pattern designers selling on Spoonflower.

---

## 1. Product context

**Spoonflower Seller Lab** is a Chrome extension by **zabzablab** that helps independent designers find better SEO keywords for their Spoonflower listings, faster. It runs inline on Spoonflower.com.

Headline feature set (from the public listing):

- 🔍 Find relevant SEO keywords for a listing
- 🪣 Organize raw keyword ideas into word buckets by character count
- ✏️ Rework existing listings with clearer, more searchable tags
- 📏 Manage per-tag and total character limits
- ⚡ Quickly copy optimized tags back into the workflow

> *"Not affiliated with Spoonflower Inc."* — the extension is an independent productivity tool for sellers.

### The paid version (this design system)

The free Chrome extension lives **inside** Spoonflower. The **paid version (Pro)** has its own website and dashboard, so it must establish a distinct brand identity that:

1. Feels like a **craft studio tool**, not a generic SaaS dashboard — the audience is fabric and surface-pattern designers who care about craft.
2. Stays trustworthy with **data and metrics** — keyword research is technical work.
3. Reads as **premium without being sterile** — paid users should feel they got a beautiful product, not just a paywalled feature flag.
4. **Keeps the existing logo** (a soft, block-printed quatrefoil in dusty slate-blue) and builds everything else around its DNA.

### Audience

Independent textile, surface, and pattern designers who sell on Spoonflower. Many are solo makers; some run shops as a side income; a small slice are full-time pros with hundreds of listings. They're visually literate, value craft, and are not full-time spreadsheet jockeys — but they will tolerate dense data when it earns its keep.

---

## 2. Sources used

This system was assembled from limited public input:

- **GitHub:** [`VeraZab/spoonflower-seller-workspace`](https://github.com/VeraZab/spoonflower-seller-workspace) — referenced as the codebase home. *Not imported in this pass — GitHub access wasn't connected and the user clarified only the logo needed to be preserved.* If you (or a future agent) want pixel-accurate parity with the extension's existing UI, connect GitHub and pull this repo first.
- **Chrome Web Store listing:** [Spoonflower Seller Lab: SEO Keyword Helper](https://chromewebstore.google.com/detail/spoonflower-seller-lab-se/bdphillbkbnikcjmjonkmodmlddbhegb) — feature list, tone, developer info, and the source logo (`assets/logo-original.png`).
- **Privacy policy:** [zabzablab.com/designer-tools/spoonflower-seller-lab/privacy-policy](https://www.zabzablab.com/designer-tools/spoonflower-seller-lab/privacy-policy) — referenced for site structure context only.

The **rest of this system** (palette beyond the logo color, typography, components, marketing site, dashboard) is a fresh design built to fit the brand DNA the logo establishes. The user has explicitly approved everything-but-the-logo as redesignable.

---

## 3. CONTENT FUNDAMENTALS — voice, tone & copy

The product is made by one person (zabzablab) for a community of independent makers. Copy should feel like that person — knowledgeable, plainspoken, a little bit warm — not like marketing-org committee writing.

### Voice properties

| Quality | What it means here |
|---|---|
| **Plainspoken** | Say what something is. No "unlock", "elevate", "synergize". |
| **Specific** | Numbers and concrete nouns over vague claims. *"Find 40 ranked keyword ideas in under 30 seconds"* > *"Powerful keyword research."* |
| **Crafty** | Acknowledge that listings are creative work. *"Your shop, sharper"* > *"Conversion optimization platform."* |
| **Quietly confident** | The tool works. Don't oversell. No exclamation points unless the user actually accomplished something. |
| **A little dry-funny** | Occasional wink in microcopy. *"No keywords yet. Paste a listing URL above, or just stare at this for a bit."* |

### Tone shifts by surface

- **Marketing site:** Warm, opinionated, lightly editorial. Headlines can be a sentence, not a slogan.
- **In-app product UI:** Direct and short. Labels, not commentary.
- **Empty states & onboarding:** Friendliest tier. Speak to the user as a peer.
- **Errors:** Apologetic and concrete. Say what happened and what to do.
- **Billing & legal:** Sober. No jokes here.

### Person, casing, punctuation

- **"You"**, not "we". The product is talking to the seller, not narrating its own greatness.
- **"We"** is allowed sparingly, as the team voice, mostly in changelog, support, and policy pages.
- **Sentence case** for headings, buttons, labels, menu items. Title Case only for proper nouns and the product name (*Spoonflower Seller Lab Pro*).
- **Oxford commas** yes. **Em dashes** with no spaces — like this. **Curly quotes** in marketing copy.
- **Numbers as numerals** (5 listings, 142 keywords, 14/40 chars), except at the start of a sentence.
- **No exclamation points** in product UI. One per page on marketing if it earns it.

### Emoji

**Used very sparingly.** The Chrome listing uses 🔍 🪣 ✏️ 📏 ⚡ as bullet glyphs in product copy — we'll keep that pattern *only* in dense feature lists or changelog entries. **Never inside the app UI**, never on buttons, never decoratively in marketing hero copy. Default to no emoji.

### Examples

| ✅ Good | ❌ Avoid |
|---|---|
| Find sharper keywords for your Spoonflower listings. | Unlock the power of AI-driven keyword optimization. |
| 14 / 40 characters used | Character utilization: 35% |
| No keywords yet. Paste a listing URL to start. | 🎉 Welcome! Let's get started on your keyword journey! |
| Couldn't reach Spoonflower. Try again in a moment. | Oops! Something went wrong! 😢 |
| Saved to *Floral / cottagecore* bucket. | Successfully added to bucket. |
| Your shop, sharper. | Supercharge your sales! |

### Product naming

- **Spoonflower Seller Lab** — the free Chrome extension (existing name, do not change).
- **Spoonflower Seller Lab Pro** — the paid web product. Always written in full on first mention; can be shortened to **Seller Lab Pro** in body copy and **Pro** in in-app UI.
- The studio behind it is **zabzablab**. Don't bury this on the marketing site; makers buy from people, not logos.

---

## 4. VISUAL FOUNDATIONS

### The big idea

**"Craft studio meets analytics."** A workshop where the data is laid out on a warm paper desk, not a cold dashboard. The logo is a block-printed quatrefoil — soft, hand-stamped, a little uneven. The whole system rhymes with that: warm parchment surfaces, dusty slate-blue ink, generous quiet, and one bright marigold accent for action.

### Color

- **Slate** (`#798BA6` = `--slate-500`) — primary brand, pulled directly from the logo. Used for filled buttons, key UI elements, headings on dark surfaces.
- **Parchment** (`#FBF8F2` = `--parchment-50`) — page background everywhere. Slightly warm cream, **not** white. This is the most identity-defining color choice.
- **Ink** (`#14182A` = `--ink-900`) — primary text. A deep blue-black, never pure black.
- **Saffron** (`#E0A458` = `--saffron-500`) — accent for primary CTAs, highlights, important counters.
- **Sage** (`#8AAE92` = `--sage-500`) — success, "saved" states.
- **Brick** (`#C25450` = `--brick-500`) — errors and destructive actions.

Each has a 50–900-ish scale; see `colors_and_type.css`. Total brand surface should be **70% parchment + slate, 20% ink, 10% saffron/sage/brick combined**. If a screen is more than 10% saffron, you're using it wrong.

### Typography

- **Display: Newsreader** (Google Fonts) — a contemporary editorial serif with optical sizing. Used for h1/h2, hero numerals, and the occasional italic pull-quote. The italic has personality — lean into it.
- **Body: Plus Jakarta Sans** — warm geometric sans for UI. Friendlier than Inter, more modern than DM Sans. Used for h3 and below, body text, buttons, labels.
- **Mono: JetBrains Mono** — for keyword chips, character counters, tag previews, code samples.

> ⚠ All three fonts are loaded from Google Fonts via CDN in `colors_and_type.css`. **If you need offline/production-grade font files, the user should provide them or we should swap to self-hosted webfonts.** No font files are bundled here.

### Spacing

A 4px base scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96. Marketing layouts use generous space (96px+ between sections); product UI is tighter (16–24px). Density tier should be consistent within a surface.

### Backgrounds & motifs

- **Parchment-50** is the default page background — never pure white.
- **Pure white (`#FFFFFF`)** is reserved for *card surfaces* that need to feel like clean paper laid on the desk. Don't use it as a page bg.
- The **quatrefoil shape from the logo** can be used as a *bullet glyph*, a *section divider mark*, or a *low-opacity repeating watermark* on hero sections and empty states. Use at low opacity (5–10%) so it reads as texture, not decoration.
- **No** gradient backgrounds, no glassmorphism, no mesh blurs. The brand is flat, warm, paper-like.

### Borders & dividers

- **Hairlines** (1px, `--hairline` or `--border`) do most of the structural work. Cards are typically *border + soft shadow*, not just shadow.
- Dividers between list rows: `1px solid var(--border)` (parchment-200). Never a dashed line.
- **Border radii:** 6–10px is the common range (`--radius-sm`/`--radius-md`). Tag chips and capsule pills use `--radius-pill`. Don't go bigger than `--radius-xl` (20px) — feels too soft for a productivity tool.

### Shadows

Paper-like, never blue, always close to the surface:

- `--shadow-xs`: 1px ledge, used for inputs and tag chips on hover.
- `--shadow-sm`: standard card.
- `--shadow-md`: hover-lifted card, dropdowns.
- `--shadow-lg`: dialogs, focused modals.

No glow. No spread. The light is coming from above-and-slightly-front, like a desk lamp.

### Hover & press

- **Hover (filled button):** background goes one step darker on the brand scale (e.g. `--slate-500` → `--slate-600`).
- **Hover (ghost / tertiary):** background fills with `--parchment-100` (faint warm tint), no color shift.
- **Hover (link):** underline appears (offset 2–3px), color unchanged.
- **Press:** scale (0.98) and shadow drops one tier. ~80ms.
- **Focus:** 2px outline of `--slate-300` with 2px offset. Visible on keyboard nav, not on mouse click.
- **Disabled:** 40% opacity, no pointer events. Never use a gray *color* — use opacity.

### Animation

- **Easing:** `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart). Custom-feeling without being theatrical.
- **Durations:** 120ms (micro), 200ms (default), 360ms (sequenced or larger).
- **No bounces, no springs, no flips.** Fades, slides (4–8px), and gentle scale (0.96–1.0) only.
- Page transitions are a fade + tiny upward slide. Tag-chip insertion has a 200ms fade + slide-in from the keyboard.

### Transparency & blur

Used **almost never** on chrome. Acceptable cases:

- A 4–8px backdrop blur on a sticky header **only if** content is scrolling beneath it.
- 20–40% opacity overlays for modal scrims (`rgba(20, 24, 42, 0.4)`).
- The quatrefoil watermark on hero sections (5–8% opacity).

Avoid frosted-glass cards, blurred buttons, anything that reads "iOS 7 visionary year."

### Imagery vibe

When real product imagery is needed: **warm, neutral, slightly desaturated**. Spoonflower fabrics, designer workspaces, hands-on-fabric photography. Avoid synthetic gradients, AI-generated stock, or anything cool/blue/tech. Black-and-white photography is *also* fine — but never cold blue.

### Cards

The canonical card:

```
background: var(--surface);            /* white */
border: 1px solid var(--border);       /* parchment-200 */
border-radius: var(--radius-md);       /* 10px */
box-shadow: var(--shadow-sm);
padding: var(--space-6);               /* 24px */
```

For "tinted" cards (callouts, empty states), swap `--surface` for `--parchment-100` and drop the shadow.

### Layout rules

- **Marketing:** max content width 1180px, single accent column, content reads top-to-bottom. No two-column dashboards on marketing pages.
- **Product:** 240px left sidebar (collapsible to 64px), top toolbar 56px, main work area fills the rest. Right-rail inspector at 360px when needed.
- **Sticky elements:** Header is sticky. The "save listing" footer in editor surfaces is sticky bottom. Sidebars are *not* sticky on scroll inside the main area.

---

## 5. ICONOGRAPHY

### Approach

The brand uses **outlined line icons with a 1.75px stroke, 24×24 grid, rounded caps and joins.** Solid/filled icons are reserved for *active/selected* nav states. Icons sit at the same x-height as the surrounding body text and read as quiet structural markers — never as decoration.

### Icon set

We use **[Lucide](https://lucide.dev)** from CDN. It matches the stroke style we want, has a wide catalog (1500+ icons), and is permissively licensed.

```html
<script src="https://unpkg.com/lucide@latest"></script>
<script>lucide.createIcons();</script>
```

Or per-icon SVG inline (preferred for static designs):

```html
<i data-lucide="search"></i>
```

**Stroke override:** Lucide ships at 2px stroke. We override to 1.75px to match the slightly more refined weight of the type system:

```css
[data-lucide] { stroke-width: 1.75; }
```

### Brand glyph

The **quatrefoil** from the logo is the one piece of pictogram unique to us. Use it:

- As the favicon and app icon.
- As a list bullet on marketing pages (replaces `•`) — render a small slate-500 quatrefoil ~11px.
- As a section divider mark, centered between content blocks.
- As a low-opacity, randomized-density **shimmer watermark** on hero sections and empty states (see `assets/shimmer.svg`).

**Logo assets:**

- `assets/logo.svg` — **canonical** vector trace of the original block-print PNG (1.8 KB). Crisp at any size. Slate-500 fill baked in.
- `assets/logo-current.svg` — same path, `fill="currentColor"`. Inline as `<svg>` (not `<img src>`) so CSS color cascades — use this when you want to recolor the mark via context.
- `assets/logo-original.png` — the source 128×128 block-print PNG, kept for reference.
- `assets/shimmer.svg` — tileable watermark made from the logo at randomized scales, rotations, and opacities (3.7 KB). Tiles seamlessly via wrap-around copies on each edge.

> The vector was built by tracing the original PNG: blur the alpha channel, threshold, marching-squares contour trace, Douglas-Peucker simplification, then smooth quadratic curves between simplified vertices. 4-fold rotational symmetry was averaged into the alpha to kill block-print noise asymmetry.

### Emoji

**Effectively never.** The Chrome listing copy uses 🔍 🪣 ✏️ 📏 ⚡ as marketing bullets. That's the *only* sanctioned usage and it lives only on the changelog or a "What's new" surface. **No emoji in the product UI, on buttons, or in headings.**

### Unicode glyphs

Allowed:

- **× (multiplication sign, U+00D7)** for close affordances when not using a Lucide icon.
- **→ (rightwards arrow, U+2192)** in CTAs (*"See pricing →"*) — sparingly.
- **• (bullet, U+2022)** for inline list separators in metadata strings (*"Updated today · 142 keywords"*) — actually we prefer **·** (middle dot) for that.

### Per-product custom icons

If a custom icon is ever needed (e.g. a "bucket" glyph for keyword buckets), draw it on Lucide's grid spec: 24×24 viewBox, 1.75px stroke, rounded caps and joins, monochrome. Don't mix stroke styles.

---

## 6. Index — what's in this project

```
/
├── README.md                       ← this file
├── SKILL.md                        ← agent skill manifest (Claude Code-compatible)
├── colors_and_type.css             ← all CSS vars: colors, type, spacing, radii, shadows, motion
├── components.css                  ← reusable .btn, .input, .chip, .s-card, .badge, .alert classes
├── assets/
│   ├── logo.svg                    ← canonical sharp vector logo (slate fill, 1.8 KB)
│   ├── logo-current.svg            ← same path, currentColor (inline use only)
│   ├── logo-original.png           ← source 128×128 block-print PNG (reference)
│   └── shimmer.svg                 ← tileable watermark, randomized quatrefoils, seamless tiling
├── preview/                        ← Design System tab cards (≤ ~700×400 each)
│   ├── type-display.html           Type — Display (Newsreader)
│   ├── type-body.html              Type — Body (Plus Jakarta Sans)
│   ├── type-mono.html              Type — Mono (JetBrains Mono)
│   ├── type-scale.html             Type — full size ladder
│   ├── colors-slate.html           Colors — Slate (primary)
│   ├── colors-parchment-ink.html   Colors — Parchment & Ink neutrals
│   ├── colors-accents.html         Colors — Accents & semantic (saffron, sage, brick)
│   ├── colors-tag-taxonomy.html    Colors — Tag taxonomy (liked, sales, system, trend, starred)
│   ├── radii.html                  Radii
│   ├── shadows.html                Shadows
│   ├── spacing.html                Spacing scale
│   ├── buttons.html                Buttons (primary / accent / ghost / text / danger; sizes; states)
│   ├── inputs.html                 Inputs (text, search-with-icon, select, error state)
│   ├── tag-chips.html              Tag chips (default + 5 taxonomy variants + dot variant)
│   ├── cards.html                  Cards (default / tinted / flat)
│   ├── badges-alerts.html          Badges & alerts
│   ├── logo-mark.html              Logo & lockup
│   └── motifs.html                 Brand motifs (bullet, divider, shimmer)
├── ui_kits/
│   ├── marketing/                  Full marketing site
│   │   ├── README.md
│   │   ├── index.html              ← public landing page demo
│   │   └── components.jsx          ← Nav, Hero, ProductShot, FeatureGrid, Pricing, FAQ, Footer
│   └── dashboard/                  Full Pro web app
│       ├── README.md
│       ├── index.html              ← interactive Pro workspace
│       └── components.jsx          ← Sidebar, Topbar, Empty, KeywordTable, BucketsRail, TagComposer
```

**Start here:**

1. `colors_and_type.css` and `components.css` → tokens and reusable classes.
2. `preview/*.html` → visual reference for every primitive.
3. `ui_kits/marketing/index.html` and `ui_kits/dashboard/index.html` → reference applications. Copy components out of these when building new screens.

---

## 7. Caveats & open questions

- **Codebase not imported.** No production parity check against the existing Chrome extension. If the extension already has established UI conventions, this system *replaces* them rather than reflecting them — per the user's explicit instruction ("everything else you can change").
- **Fonts are CDN-loaded.** No `.ttf`/`.woff2` files in `fonts/`. For production builds, self-host **Newsreader**, **Plus Jakarta Sans**, and **JetBrains Mono** and update `colors_and_type.css`.
- **Iconography is Lucide.** Not custom-drawn. If a bespoke icon family is desired later, the brand glyph (quatrefoil) is the seed to grow from.
- **Logo provided at 128×128 only.** Source is the Chrome Web Store listing. If you have a vector or higher-res master, drop it in `assets/` and update references — anything above ~256px will look soft otherwise.
