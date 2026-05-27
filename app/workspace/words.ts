// Canonical word shape stored in user_keywords.word: lowercase, with
// internal whitespace collapsed to a single hyphen, no leading/trailing
// hyphens. Used by every write path (typed Add bar, inline rename, CSV
// import) so the DB stays consistent and case-collisions can't reappear.
export function normalizeWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
