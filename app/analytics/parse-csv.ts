import type { ParsedSaleRow } from "./actions";

// Parse a Spoonflower earnings CSV/TSV export. The site's own export
// appears to be tab-separated (multiple spaces on visual inspection), but
// we also accept comma-separated with quoting for defensive user input.
//
// Canonical columns (order-insensitive; matched by header name, lowercased):
//   Date, Type, Qty, Size, Design, Design id, Substrate, Customer,
//   Amount, Balance, Description

const COLUMN_ALIASES: Record<string, keyof HeaderMap> = {
  date: "date",
  type: "type",
  qty: "qty",
  quantity: "qty",
  size: "size",
  design: "design_title",
  "design title": "design_title",
  "design id": "design_id",
  substrate: "substrate",
  customer: "customer",
  amount: "amount",
  balance: "balance",
  description: "description",
};

type HeaderMap = {
  date: number;
  type: number;
  qty: number;
  size: number;
  design_title: number;
  design_id: number;
  substrate: number;
  customer: number;
  amount: number;
  balance: number;
  description: number;
};

export type CsvParseResult = {
  rows: ParsedSaleRow[];
  skipped: number;
  errors: string[];
  // First few rows we couldn't parse, with a reason each. Shown in the
  // upload toast so the user knows what to fix instead of guessing why
  // sales look low. Capped at 5 to keep the toast readable.
  skipSamples: { line: number; reason: string; preview: string }[];
};

export function parseSalesCsv(text: string): CsvParseResult {
  const errors: string[] = [];
  const skipSamples: { line: number; reason: string; preview: string }[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return {
      rows: [],
      skipped: 0,
      errors: ["Empty file"],
      skipSamples: [],
    };
  }

  // Detect delimiter from the header row. Tab wins if present at all;
  // otherwise fall back to comma (with quoted-string tolerance).
  const headerLine = lines[0];
  const delimiter = headerLine.includes("\t") ? "\t" : ",";

  const headers = splitLine(headerLine, delimiter).map((h) =>
    h.trim().toLowerCase(),
  );
  const map: Partial<HeaderMap> = {};
  headers.forEach((h, idx) => {
    const key = COLUMN_ALIASES[h];
    if (key) map[key] = idx;
  });

  const required = [
    "date",
    "type",
    "amount",
    "design_id",
  ] as const;
  const missing = required.filter((k) => map[k] === undefined);
  if (missing.length) {
    return {
      rows: [],
      skipped: 0,
      errors: [
        `Missing required columns: ${missing.join(", ")}. Found: ${headers.join(", ")}`,
      ],
      skipSamples: [],
    };
  }

  const rows: ParsedSaleRow[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    const cell = (key: keyof HeaderMap): string =>
      cells[map[key] as number]?.trim() ?? "";

    const rawDate = cell("date");
    const rawAmount = cell("amount");
    const rawDesignId = cell("design_id");

    const soldAt = parseDate(rawDate);
    const amount = parseMoney(rawAmount);
    const designId = parseDesignId(rawDesignId);

    if (!soldAt || amount === null) {
      skipped++;
      if (skipSamples.length < 5) {
        const reason = !soldAt
          ? `unparseable date: "${rawDate}"`
          : `unparseable amount: "${rawAmount}"`;
        skipSamples.push({
          line: i + 1,
          reason,
          preview: lines[i].slice(0, 160),
        });
      }
      continue;
    }

    rows.push({
      sold_at: soldAt,
      type: normalizeType(cell("type")),
      qty: parseInt(cell("qty"), 10) || 1,
      size: cell("size") || null,
      design_title: cell("design_title") || null,
      design_id: designId,
      substrate: cell("substrate") || null,
      customer: cell("customer") || null,
      amount,
      balance: parseMoney(cell("balance")),
      description: cell("description") || null,
    });
  }

  return { rows, skipped, errors, skipSamples };
}

// Split a CSV or TSV row honoring "quoted, values". Handles doubled
// quotes for literal quote characters ("").
function splitLine(line: string, delimiter: string): string[] {
  if (delimiter === "\t") return line.split("\t");
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\s*UTC\s*$/i, "")
    .replace(/\s*Z\s*$/i, "")
    .trim();
  if (!cleaned) return null;

  // Format 1: "2026-07-03 16:32:02" → ISO with Z suffix
  // Format 2: "2026-07-03T16:32:02" → already ISO
  // Format 3: "2026-07-03" → treat as midnight UTC
  if (/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(cleaned)) {
    const iso = cleaned.includes("T")
      ? cleaned + "Z"
      : cleaned.length === 10
        ? cleaned + "T00:00:00Z"
        : cleaned.replace(" ", "T") + "Z";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // Format 4: "MM-DD-YY" or "MM/DD/YY" or "MM-DD-YYYY" — Spoonflower's
  // short earnings summary format. Assume US-style month-first.
  const m = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000; // "26" → 2026
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // Last-ditch: hand it to JS's parser. It handles a wide range of common
  // formats; returns Invalid Date for gibberish, which we filter.
  const d = new Date(cleaned);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseMoney(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,\s]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDesignId(raw: string): number | null {
  const parsed = parseInt(raw.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Normalize the free-text Type column into a small canonical vocabulary.
// Spoonflower uses these types in earnings exports:
//   sale                 → customer bought something → counts in stats
//   cancel/refund/return → customer got their money back → counts in stats as a refund
//   payout               → Spoonflower paid the seller → not a customer transaction
//   debit                → seller spent Spoondollars on their own order → not a customer transaction
//   credit               → promotional/support credit → not a customer transaction
//   adjustment           → manual balance adjustment → not a customer transaction
//
// Only "sale" and "refund" show up in the analytics aggregations; the
// rest are stored (they affect the running balance in the CSV) but
// silently excluded from headline/chart/design stats via
// `isAnalyticsEvent()` in stats.ts.
function normalizeType(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (
    lower.includes("refund") ||
    lower.includes("return") ||
    lower.includes("cancel")
  )
    return "refund";
  if (lower.includes("payout")) return "payout";
  if (lower.includes("debit")) return "debit";
  if (lower.includes("credit")) return "credit";
  if (lower.includes("adjust")) return "adjustment";
  if (lower.includes("sale")) return "sale";
  return lower || "other";
}
