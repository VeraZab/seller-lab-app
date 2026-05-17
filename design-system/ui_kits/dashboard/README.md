# Dashboard UI kit — Spoonflower Seller Lab Pro

The paid app surface — where sellers research keywords, organize them into buckets, and rewrite tag strings for a Spoonflower listing.

## Files

- `index.html` — wires everything together; opens on the empty state and lets you click through Research → Buckets → Listing editor.
- `components.jsx` — all React components (Sidebar, Topbar, ResearchPanel, KeywordTable, BucketsRail, ListingEditor, Empty). Small, mainly-cosmetic implementations. State is fake — typing into the URL field and hitting "Research" loads a hardcoded keyword set.
- The HTML pulls `colors_and_type.css` and `components.css` from the project root.

## Screens included

1. **Empty state** — what a new user sees: a parchment workspace with a URL paste prompt and the brand mark as watermark.
2. **Research** — left rail of listings, main keyword table with character counts, right rail of buckets to drop keywords into.
3. **Listing editor** — composing the final 40-char tag string, with live character counter and inline warnings.

## What's intentionally fake

- No real Spoonflower API. The "Research" button loads a fixed keyword set with hardcoded volume/competition numbers.
- The bucket drag-drop is click-to-add; full DnD is left for production.
- The auth/billing/settings surfaces are not rendered — out of scope for a visual UI kit.
