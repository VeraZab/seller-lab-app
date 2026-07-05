import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Extension-callable endpoint: takes a design image (base64), asks our
// AI assistant which of the caller's saved keywords apply, and returns
// the result in the same char-bucket shape the workspace page uses so
// the extension renders identically.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const TOTAL_CAP = 150;

// Priority for ordering returned words: sold → liked → trend → user →
// spoonflower. Lowercase slugs match the canonical DB convention; lookup
// is case-insensitive defensively.
const CATEGORY_PRIORITY = [
  "sold",
  "liked",
  "trend",
  "user",
  "spoonflower",
] as const;

type Row = {
  word: string;
  category: string | null;
  frequency: number | null;
  kind: string | null;
};

type AiMatchOutput = {
  matched?: unknown;
  generated?: unknown;
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return json({ error: "Missing Bearer token" }, 401);
  }
  const accessToken = auth.slice(7).trim();
  if (!accessToken) return json({ error: "Empty Bearer token" }, 401);

  // Read as text first then JSON.parse so we can log the raw payload on
  // failure — Next.js's `req.json()` swallows the body when it throws.
  let rawText: string;
  try {
    rawText = await req.text();
  } catch (e) {
    console.error("[match] req.text() failed", e);
    return json({ error: "Couldn't read request body" }, 400);
  }
  let body: { image?: unknown; mime?: unknown } | null = null;
  try {
    body = JSON.parse(rawText);
  } catch (e) {
    console.error(
      "[match] JSON.parse failed",
      e instanceof Error ? e.message : e,
      "content-type:",
      req.headers.get("content-type"),
      "content-length:",
      req.headers.get("content-length"),
      "actual length:",
      rawText.length,
      "first 200 chars:",
      rawText.slice(0, 200),
    );
    return json({ error: "Body must be JSON" }, 400);
  }
  if (!body || typeof body.image !== "string" || !body.image) {
    return json({ error: "Missing 'image' (base64 string)" }, 400);
  }
  const image = body.image.replace(/^data:[^;]+;base64,/, "");
  const mime = typeof body.mime === "string" ? body.mime : "image/jpeg";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!supabaseUrl || !anonKey) {
    return json({ error: "Server missing Supabase env" }, 500);
  }
  if (!geminiKey) return json({ error: "Server missing GEMINI_API_KEY" }, 500);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  const { data: rows, error: rowsErr } = await supabase
    .from("user_keywords")
    .select("word, category, frequency, kind")
    .eq("user_id", user.id)
    .eq("hidden", false);
  if (rowsErr) return json({ error: rowsErr.message }, 500);

  const allRows = (rows ?? []) as Row[];
  const libraryByNorm = new Map<string, Row>();
  for (const r of allRows) libraryByNorm.set(normalize(r.word), r);

  // Group by kind so the AI can reason about each semantic bucket
  // separately — critical for solid-color designs where "return every
  // Color-kind library word that fits" only makes sense with the kinds
  // presented explicitly.
  const libraryByKind: Record<string, string[]> = {};
  for (const r of allRows) {
    const k = r.kind ?? "Uncategorized";
    (libraryByKind[k] ??= []).push(r.word);
  }

  const aiResult = await callAiAssistant({
    apiKey: geminiKey,
    imageBase64: image,
    mime,
    libraryByKind,
    totalCap: TOTAL_CAP,
  });
  if (aiResult === null)
    return json({ error: "AI assistant call failed" }, 502);

  // Collect verbatim library hits from BOTH matched and generated. The AI
  // assistant sometimes mis-classifies a library word as "generated" — if
  // the user has it saved we still want to return it.
  const seen = new Set<string>();
  const libraryHits: Row[] = [];
  const collectLibraryHits = (words: string[]) => {
    for (const w of words) {
      const key = normalize(w);
      if (!key || seen.has(key)) continue;
      const row = libraryByNorm.get(key);
      if (!row) continue;
      libraryHits.push(row);
      seen.add(key);
    }
  };
  collectLibraryHits(toStringArray(aiResult.matched));
  collectLibraryHits(toStringArray(aiResult.generated));

  // Log what the AI returned vs what actually landed in the library-hits
  // set. If a color/word the user expected doesn't show up, this is the
  // fastest way to see whether the AI didn't pick it OR the AI picked it
  // but our lookup missed (typo, hyphen mismatch, etc.).
  const aiMatched = toStringArray(aiResult.matched);
  const aiGenerated = toStringArray(aiResult.generated);
  const missedFromMatched = aiMatched.filter(
    (w) => !libraryByNorm.has(normalize(w)),
  );
  console.log(
    `[match] user=${user.id.slice(0, 8)} library=${allRows.length} ` +
      `ai_matched=${aiMatched.length} ai_generated=${aiGenerated.length} ` +
      `library_hits=${libraryHits.length} ` +
      `dropped_no_library_row=${missedFromMatched.length}`,
    { aiMatched, missedFromMatched },
  );

  libraryHits.sort(compareByPriorityThenFreq);
  const out = libraryHits.slice(0, TOTAL_CAP);

  return json({
    buckets: groupByCharCount(out),
    heatMaxByCategory: computeHeatMaxByCategory(out),
    counts: {
      library: out.length,
      total: out.length,
      cap: TOTAL_CAP,
    },
  });
}

async function callAiAssistant(args: {
  apiKey: string;
  imageBase64: string;
  mime: string;
  libraryByKind: Record<string, string[]>;
  totalCap: number;
}): Promise<AiMatchOutput | null> {
  const prompt = `You are tagging a design for a Spoonflower listing — a marketplace for fabric, wallpaper, and home goods. Your job: pick keywords from the user's library that apply to the attached design.

RULES:
- Return words VERBATIM from the library. No rephrasing, splitting, or combining.
- Be inclusive. Visual, thematic, stylistic, palette, mood, and use-case matches are all valid. Tangential / adjacent matches are fine.
- MULTI-TAG PLAUSIBLE READS. Stylized motifs can be read several ways at once. If a cluster bloom could be interpreted as peony, rose, dahlia, chrysanthemum, or camellia, and ANY of those are in the library, include ALL of the ones that are. Do not pick a single "best" identification and drop the others — every plausible read is a valid tag.
- This multi-read rule applies broadly: stylized animals (could be cat/leopard/lion), abstract foliage (could be fern/palm/leaves), repeat layouts (could be stripe/trellis/climbing), color stories (could be neutral/earth tone/warm), etc. Include each plausible read present in the library.
- For style / aesthetic tags (cottagecore, art nouveau, chinoiserie, mid-century, etc.): include if the design evokes the style, even loosely. Multiple style tags can coexist.
- Only skip a library word if it's clearly wrong for this design — e.g. an automotive term on a floral, or a generic stopword like "and" / "the".
- Aim for breadth. Return everything that reasonably fits.

The library below is grouped by KIND — a semantic taxonomy each word
belongs to. The kinds are Color, Subject, Style, Mood, Use, Technique,
Layout (and Uncategorized for unclassified words). Use the kinds to
guide your evaluation — for example on a solid color design you'll walk
the Color list exhaustively and then treat other kinds selectively.

SOLID COLORS: if the design is a solid or near-solid color (no motif,
no pattern, just a flat fill or a very subtle gradient/texture), use
this kind-driven procedure:

  1. **Color kind is the anchor.** Walk through EVERY word in the
     Color list AND every word in the Uncategorized list (because
     the auto-classifier may not have tagged every color word yet)
     and evaluate each: does it name or describe this specific
     color? Return every one that fits. Colors adjacent on the
     color wheel count — a solid teal is legitimately tagged teal
     AND blue AND green, plus every jewel-tone / tonal / brand-
     color name nearby (emerald, jade, peacock, malachite, forest,
     ocean, sea, dark, deep, muted, jewel-tone, etc.) if present
     anywhere in the library. Do NOT skip the plain single-word
     color name in favor of a specific one — return both "teal"
     AND "dark-teal" for a teal solid.

  2. **Other kinds only if applicable to the color.** After the
     Color list, walk through Use, Style, Mood, Subject, AND
     Uncategorized — for each word ask "does this apply BECAUSE
     of this specific color?" Include only if yes.
       - Use: rooms/purposes where this solid would be used
         (nursery, upholstery, curtains, accent, coordinate,
         background, wallpaper). Solids are especially useful as
         coordinate and blender fabrics — include those liberally.
       - Style: aesthetic movements the color evokes (minimalist,
         modern, scandi, boho, cottagecore, coastal).
       - Mood: emotional register (calming, serene, moody, dramatic,
         cozy, warm, cool, playful, elegant).
       - Subject: object names that evocatively describe the color
         even though the design doesn't depict the object (lavender
         for pale purple, ocean/sea for teal, honey/sunset for warm
         gold, grass/sage/moss for green). ONE exception to the
         no-motif rule — only when the object name reads as a color
         descriptor.

  3. **Skip Technique and Layout kinds entirely** for solids —
     there's no visible technique or layout on a flat color.

**Breadth rule for solids:** be aggressive. Solid colors carry almost
no signal beyond the color itself, so err strongly toward inclusion.
If the Color list has 15+ words that plausibly describe this color,
return all of them. Being conservative on solids is worse than being
generous — a shopper searching "jade" for a teal-green solid deserves
to find it.

Library (grouped by kind):
${JSON.stringify(args.libraryByKind, null, 2)}

Respond with this JSON shape (the "generated" array must be empty):
{
  "matched": [verbatim library words that apply, best-fit first],
  "generated": []
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(args.apiKey)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: args.mime, data: args.imageBase64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });
  } catch (e) {
    console.error("[match] AI assistant fetch failed", e);
    return null;
  }

  if (!res.ok) {
    console.error("[match] AI assistant non-2xx", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error("[match] AI assistant empty text", data);
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed as AiMatchOutput;
    return null;
  } catch {
    console.error("[match] AI assistant non-JSON text", text);
    return null;
  }
}

function compareByPriorityThenFreq(a: Row, b: Row): number {
  const ra = priorityRank(a.category);
  const rb = priorityRank(b.category);
  if (ra !== rb) return ra - rb;
  const fa = a.frequency ?? 1;
  const fb = b.frequency ?? 1;
  if (fa !== fb) return fb - fa;
  return a.word.localeCompare(b.word);
}

function priorityRank(category: string | null): number {
  if (!category) return CATEGORY_PRIORITY.length; // Uncategorized last
  const lower = category.toLowerCase();
  const idx = CATEGORY_PRIORITY.findIndex((c) => c.toLowerCase() === lower);
  return idx === -1 ? CATEGORY_PRIORITY.length : idx;
}

function toStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.filter((s): s is string => typeof s === "string" && s.length > 0);
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function groupByCharCount(rows: Row[]) {
  const map = new Map<number, Row[]>();
  for (const r of rows) {
    const n = r.word.length;
    const list = map.get(n) ?? [];
    list.push(r);
    map.set(n, list);
  }
  return Array.from(map, ([charCount, words]) => ({
    charCount,
    words: words.map((w) => ({
      word: w.word,
      category: w.category,
      frequency: w.frequency ?? 1,
    })),
  })).sort((a, b) => a.charCount - b.charCount);
}

function computeHeatMaxByCategory(rows: Row[]): Record<string, number> {
  const max: Record<string, number> = {};
  for (const r of rows) {
    if (!r.category) continue;
    const freq = r.frequency ?? 1;
    if (freq > (max[r.category] ?? 0)) max[r.category] = freq;
  }
  return max;
}

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: CORS_HEADERS });
}
