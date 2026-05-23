import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Extension-callable endpoint: takes a design image (base64), asks Gemini
// which of the caller's saved keywords apply, fills the rest of the quota
// with AI suggestions, and returns the result in the same char-bucket
// shape the workspace page uses so the extension renders identically.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const TOTAL_CAP = 150;

// Priority for ordering returned words: Sold → Liked → Trend → Spoonflower
// → AI → Uncategorized.
const CATEGORY_PRIORITY = [
  "Sold",
  "Liked",
  "Trend",
  "Spoonflower",
  "AI",
] as const;

type Row = {
  word: string;
  category: string | null;
  frequency: number | null;
};

type GeminiOutput = {
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
    .select("word, category, frequency")
    .eq("user_id", user.id);
  if (rowsErr) return json({ error: rowsErr.message }, 500);

  const allRows = (rows ?? []) as Row[];
  const libraryByNorm = new Map<string, Row>();
  for (const r of allRows) libraryByNorm.set(normalize(r.word), r);

  const gemini = await callGemini({
    apiKey: geminiKey,
    imageBase64: image,
    mime,
    libraryWords: allRows.map((r) => r.word),
    totalCap: TOTAL_CAP,
  });
  if (gemini === null) return json({ error: "Gemini call failed" }, 502);

  // 1. Collect verbatim library hits from BOTH matched and generated. Gemini
  //    sometimes mis-classifies a library word as "generated" — if the user
  //    has it saved we still want to return it (with its stored category),
  //    and the low-value filter never applies to library hits.
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
  collectLibraryHits(toStringArray(gemini.matched));
  collectLibraryHits(toStringArray(gemini.generated));

  // 2. Sort library hits by category priority, then frequency desc, then
  //    alphabetically.
  libraryHits.sort(compareByPriorityThenFreq);

  // 3. Fill the rest of the 150-quota with AI-tagged generated suggestions
  //    (Gemini-produced, NOT in library). Reject generic / stopword tags
  //    here — library hits already bypassed this filter above.
  const out: Row[] = libraryHits.slice(0, TOTAL_CAP);
  if (out.length < TOTAL_CAP) {
    for (const w of toStringArray(gemini.generated)) {
      const trimmed = String(w).trim();
      const key = normalize(trimmed);
      if (!key || seen.has(key)) continue;
      if (libraryByNorm.has(key)) continue;
      if (isLowValueTag(trimmed)) continue;
      out.push({ word: trimmed, category: "AI", frequency: 1 });
      seen.add(key);
      if (out.length >= TOTAL_CAP) break;
    }
  }

  return json({
    buckets: groupByCharCount(out),
    heatMaxByCategory: computeHeatMaxByCategory(out),
    counts: {
      library: libraryHits.length,
      ai: out.length - libraryHits.length,
      total: out.length,
      cap: TOTAL_CAP,
    },
  });
}

async function callGemini(args: {
  apiKey: string;
  imageBase64: string;
  mime: string;
  libraryWords: string[];
  totalCap: number;
}): Promise<GeminiOutput | null> {
  const prompt = `You are tagging a design for a Spoonflower listing — a marketplace for fabric, wallpaper, and home goods (curtains, bedding, kitchen textiles, baby blankets, gift wrap, peel-and-stick wallpaper). Tags must drive search traffic from buyers shopping for HOME and TEXTILE products.

Look at the attached design and produce keyword tags that apply.

Step 1 — From the library below, pick the keywords that visually or thematically apply. Use them VERBATIM (no rephrasing, splitting, or combining).
Step 2 — Then suggest NEW keywords (not in the library) that would also apply, prioritizing high-search-volume Spoonflower terms. These fill the remaining quota.

STRICT RULES — keywords that violate these must be EXCLUDED from both lists:
- No generic single words. NEVER include: "and", "or", "the", "for", "with", "art", "design", "pattern", "fabric", "wallpaper", "print", "color", "decor", "style", "home" — these are too broad to rank in search.
- No off-domain keywords. Skip anything that doesn't apply to fabric / wallpaper / surface design / home goods (no automotive, electronics, sports, finance, medical, etc.).
- Each tag must be at least 3 characters and at least 2 words OR a specific compound descriptor (e.g. "cottagecore", "art nouveau", "muted earth tones", "kitchen towel", "baby blanket", "vintage botanical", "dark academia").
- Tags should be a style, motif, aesthetic, use case, color story, or specific product category — not a single common noun.

Goal: up to ${args.totalCap} total tags. Library matches are preferred over generated ones. If you have fewer good options than the cap, return fewer — quality over quantity.

Library: ${JSON.stringify(args.libraryWords)}

Respond with this JSON shape:
{
  "matched": [verbatim library words that apply, best-fit first],
  "generated": [new keywords not in library, best-fit first]
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
    console.error("[match] Gemini fetch failed", e);
    return null;
  }

  if (!res.ok) {
    console.error("[match] Gemini non-2xx", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error("[match] Gemini empty text", data);
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed as GeminiOutput;
    return null;
  } catch {
    console.error("[match] Gemini non-JSON text", text);
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

// Low-value tag blocklist — generic single-noun / stopword tags that would
// dilute search rank if returned as AI fillers. Library hits bypass this
// filter (if the user explicitly saved one of these, they keep it).
// Edit this list directly in code; deploys are the source of truth.
const LOW_VALUE_TAGS = new Set<string>([
  "a", "an", "and", "or", "the", "for", "with", "of", "to", "in", "on",
  "at", "by", "is", "it",
  "art", "design", "pattern", "patterns", "fabric", "fabrics",
  "wallpaper", "print", "prints", "color", "colors", "colour", "colours",
  "decor", "decoration", "style", "styled", "home", "house", "nice",
  "pretty", "beautiful", "peel-and-stick", "room", "project", "gift",
]);

function isLowValueTag(word: string): boolean {
  const n = word.trim();
  if (n.length < 3) return true;
  return LOW_VALUE_TAGS.has(n.toLowerCase());
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
