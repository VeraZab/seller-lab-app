// "Kind" — what the word is about (semantic taxonomy of the keyword
// itself). Lives alongside `category` (provenance: Spoonflower / Trend /
// Sold / Liked / etc.).

export const KINDS = [
  "Style",
  "Subject",
  "Color",
  "Technique",
  "Layout",
  "Mood",
  "Use",
] as const;

export type Kind = (typeof KINDS)[number];

export const UNCATEGORIZED_KIND = "Uncategorized";

// Display order in the workspace bucket grid.
export const KIND_DISPLAY_ORDER: readonly string[] = [
  ...KINDS,
  UNCATEGORIZED_KIND,
];

// Short hints shown in the kind bucket header. Kept terse so the card
// header doesn't dominate the pill grid below.
export const KIND_HINTS: Record<string, string> = {
  Style: "genre / era / movement",
  Subject: "what's drawn",
  Color: "palette / tonal feel",
  Technique: "how it was made + surface quality (watercolor, woven, embossed)",
  Layout: "composition / scale / orientation",
  Mood: "emotional read",
  Use: "product / room / audience / occasion",
  Uncategorized: "not yet classified",
};

export function kindRank(kind: string | null | undefined): number {
  if (!kind) return KIND_DISPLAY_ORDER.indexOf(UNCATEGORIZED_KIND);
  const idx = KIND_DISPLAY_ORDER.findIndex(
    (k) => k.toLowerCase() === kind.toLowerCase(),
  );
  return idx === -1 ? KIND_DISPLAY_ORDER.length : idx;
}

// Prompt that classifies a list of keywords into one of the canonical
// kinds. Shared between addKeywords (insert-time auto-categorize) and the
// one-time backfill for pre-existing rows.
export function buildClassifyPrompt(words: string[]): string {
  return `You are classifying Spoonflower fabric/wallpaper keywords into one of these 7 kinds:

- Style — genre, period, design movement (cottagecore, art nouveau, victorian, mid-century)
- Subject — what's drawn (peony, fern, paisley, geometric, floral)
- Color — palette or tonal feel (off-white, neutral, earth tone, monochromatic)
- Technique — how it was made + surface quality / tactile feel (watercolor, ink, block-print, embroidery, gouache, screen-print, woven, embossed, smooth, rough, ribbed, velvety, linen-weave, knit, felted)
- Layout — composition, scale, orientation (vertical stripe, climbing, small scale, ditzy)
- Mood — emotional read (moody, romantic, calm, dramatic)
- Use — product, room, audience, occasion (upholstery, wallpaper, nursery, baby blanket, wedding)

For each word in the input list, pick the single best-fit kind. Force a best-effort guess for every word — never return "Uncategorized" or "Other". For ambiguous words (e.g. "cottagecore floral" straddles Style + Subject), pick the most defining one.

Input: ${JSON.stringify(words)}

Respond with this JSON shape — one entry per input word, keys verbatim:
{
  "<word1>": "<Kind>",
  "<word2>": "<Kind>",
  ...
}`;
}

export function isValidKind(s: unknown): s is Kind {
  return (
    typeof s === "string" &&
    (KINDS as readonly string[]).some((k) => k.toLowerCase() === s.toLowerCase())
  );
}

// Normalize whatever case Gemini returns to the canonical title-case form.
export function normalizeKind(s: string): Kind | null {
  const lower = s.toLowerCase();
  const match = KINDS.find((k) => k.toLowerCase() === lower);
  return match ?? null;
}
