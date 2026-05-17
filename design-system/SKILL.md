---
name: spoonflower-seller-lab-pro-design
description: Use this skill to generate well-branded interfaces and assets for Spoonflower Seller Lab Pro, the paid web companion of the Spoonflower Seller Lab Chrome extension (SEO keyword & tag helper for independent Spoonflower fabric designers). Contains essential design guidelines, colors, type, fonts, brand assets, and UI kit components for prototyping marketing pages, the Pro dashboard, slides, and throwaway mocks.
user-invocable: true
---

# Spoonflower Seller Lab Pro — design skill

Read `README.md` in this skill first — it is the source of truth for product context, voice, visual foundations, and iconography. Then explore the other files as needed for your task.

## What's in here

- `README.md` — product context · CONTENT FUNDAMENTALS (voice, casing, emoji policy, sample copy) · VISUAL FOUNDATIONS (color usage, type, spacing, backgrounds, shadows, hover/press, animation, transparency, imagery, cards, layout rules) · ICONOGRAPHY (Lucide stroke icons + the quatrefoil brand glyph) · file index · caveats.
- `colors_and_type.css` — all CSS variables: 5 color scales (slate, parchment, ink, saffron, sage, brick, indigo, blossom, plum), type families (Newsreader / Plus Jakarta Sans / JetBrains Mono — all CDN-loaded from Google Fonts), spacing tokens (4px base), radii, shadows, motion, plus semantic type defaults (`.h1`, `.eyebrow`, `.body`, `.lead`, `.mono`, etc.).
- `components.css` — reusable component classes: `.btn` (+ `--accent`, `--ghost`, `--text`, `--danger`, `--sm`, `--lg`), `.input`/`.select`/`.textarea` with helper styles, `.chip` (+ taxonomy variants `--liked`/`--sales`/`--system`/`--trend`/`--starred` and `.chip--dot` dot variant), `.s-card`, `.badge`, `.alert`, `.brand-lockup`, `.eyebrow`, `.divider`.
- `assets/` — brand glyphs:
    - `logo.svg` — canonical sharp vector trace of the logo (slate-500 fill). Use this for `<img src>` placements.
    - `logo-current.svg` — same path with `currentColor`. Inline as `<svg>` to inherit CSS color.
    - `logo-original.png` — original 128 px block-print PNG (reference / fallback).
    - `shimmer.svg` — tileable watermark of logo quatrefoils at randomized scales/rotations/opacities. Use as `background-image` with `background-repeat: repeat` on hero sections and empty states.
- `preview/*.html` — atomic spec cards for every primitive (type, colors, spacing, components, brand). When a designer needs to remember "what does a tag chip look like?", this is the answer.
- `ui_kits/marketing/` — full marketing site (`index.html` + `components.jsx`) — nav, hero, product shot, feature grid, testimonial, pricing, FAQ, footer.
- `ui_kits/dashboard/` — full Pro web app (`index.html` + `components.jsx`) — sidebar, topbar, empty state, keyword research table, buckets rail, tag composer.

## How to use

If you are creating **visual artifacts** (slides, mocks, throwaway prototypes, marketing pages, dashboard mocks): copy `assets/logo.svg` and `assets/shimmer.svg` out into the new project, link `colors_and_type.css` and `components.css` (or inline the tokens), and build with the existing component classes. Lift components out of `ui_kits/` rather than redrawing from scratch.

If you are working on **production code**: copy the assets, read the rules in `README.md` to become an expert in designing with the brand, and translate the tokens in `colors_and_type.css` into whatever framework the codebase uses (Tailwind config, CSS-in-JS theme, etc).

## Quick rules of thumb

- **Page background is parchment**, not white. White (`var(--surface)`) is for card surfaces.
- **No emoji** in product UI. Marketing changelog/feature-list bullets occasionally OK.
- **One saffron CTA per screen.** Most actions are slate-filled or ghost.
- **Sentence case.** "Save listing", not "Save Listing".
- **Newsreader serif** for h1/h2 and big numerals (italic encouraged). **Plus Jakarta Sans** for everything else.
- **Tag taxonomy colors** are product-domain meaning, not decoration: pink = most liked, sage = most sales, slate = scraped from Spoonflower, plum = user's own trend research, saffron = starred (user-saved keywords / observed market intuition).
- **Quatrefoil bullet** can replace `•` on marketing copy. Shimmer pattern on hero backgrounds.
- **No gradients, no glassmorphism, no bouncy springs.** The brand is flat, warm, paper-like.

## When invoked without specific guidance

Ask the user what they want to build. Then ask clarifying questions about audience, surface (marketing / app / slide / email / icon set), variation count, and which Pro features they want represented. Once you understand the brief, act as an expert designer and output HTML (or production code) using the assets and patterns in this skill.

## Caveats

- The original logo source is a 128 px PNG; the vector here was reconstructed. If a true vector master exists, it should replace `logo.svg`.
- All fonts are CDN-loaded from Google Fonts. For production, self-host.
- This system was built without access to the existing extension's code — it replaces, rather than reflects, any prior UI conventions in the Chrome extension. See README for the source repo: [VeraZab/spoonflower-seller-workspace](https://github.com/VeraZab/spoonflower-seller-workspace).
