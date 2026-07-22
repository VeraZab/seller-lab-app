"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { Icon } from "@/components/icon";
import { ToastViewport, useToasts, type Toast } from "@/components/toast";
import {
  CATEGORIES,
  CATEGORY,
  HEAT_SHADES,
  categoryFor,
  categoryRank,
  heatLevel,
  normalizeCategory,
} from "./categories";
import { KIND_HINTS, KINDS, UNCATEGORIZED_KIND, normalizeKind } from "./kinds";
import { normalizeWord } from "./words";
import type { AddKeywordsResult, CsvImportResult } from "./actions";

type SessionUser = {
  email: string;
  displayName: string;
  initial: string;
  plan: "free" | "paid";
};

export type SavedWord = {
  word: string;
  category: string | null;
  frequency: number;
};

export type KindBucket = {
  kind: string;
  words: SavedWord[];
};

type WorkspaceClientProps = {
  user: SessionUser;
  buckets: KindBucket[];
  heatMaxByCategory: Record<string, number>;
  signOut: () => Promise<void>;
  removeKeyword: (word: string) => Promise<void>;
  updateKeyword: (oldWord: string, newWord: string) => Promise<void>;
  recategorizeKeyword: (
    word: string,
    category: string | null,
  ) => Promise<void>;
  addKeywords: (
    entries: {
      word: string;
      category: string | null;
      kind?: string | null;
    }[],
  ) => Promise<AddKeywordsResult>;
  importKeywordsFromCsv: (
    entries: { word: string; category: string; kind: string }[],
  ) => Promise<CsvImportResult>;
  setKeywordKind: (word: string, kind: string | null) => Promise<void>;
  hasUnclassified: boolean;
  classifyMissingKinds: () => Promise<{ classified: number }>;
};

// ---------------- Page ----------------

export default function WorkspaceClient({
  user,
  buckets,
  heatMaxByCategory,
  signOut,
  removeKeyword,
  updateKeyword,
  recategorizeKeyword,
  addKeywords,
  importKeywordsFromCsv,
  setKeywordKind,
  hasUnclassified,
  classifyMissingKinds,
}: WorkspaceClientProps) {
  const router = useRouter();
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

  // Background kind classification. When the server sees rows with
  // kind=null, it sets hasUnclassified so we can fire the Gemini
  // classifier after mount instead of during render. Guarded by a ref so
  // we don't re-fire if this component remounts before the refresh
  // completes.
  const classifyFired = useRef(false);
  useEffect(() => {
    if (!hasUnclassified || classifyFired.current) return;
    classifyFired.current = true;
    (async () => {
      try {
        const res = await classifyMissingKinds();
        if (res.classified > 0) router.refresh();
      } catch (e) {
        console.error("[workspace] background classify failed", e);
      }
    })();
  }, [hasUnclassified, classifyMissingKinds, router]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg)",
        fontFamily: "var(--font-body)",
        color: "var(--ink-900)",
      }}
    >
      <Sidebar user={user} signOut={signOut} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <KeywordLibrary
          buckets={buckets}
          heatMaxByCategory={heatMaxByCategory}
          removeKeyword={removeKeyword}
          updateKeyword={updateKeyword}
          recategorizeKeyword={recategorizeKeyword}
          addKeywords={addKeywords}
          importKeywordsFromCsv={importKeywordsFromCsv}
          setKeywordKind={setKeywordKind}
          pushToast={pushToast}
        />
      </div>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

type PushToast = (toast: Omit<Toast, "id">) => number;

// ---------------- Sidebar ----------------

type SidebarProps = {
  user: SessionUser;
  signOut: () => Promise<void>;
};

function Sidebar({ user, signOut }: SidebarProps) {
  const [isSigningOut, startSignOut] = useTransition();
  const items = [
    {
      id: "keyword-library",
      label: "Keyword Library",
      icon: "star" as const,
      href: "/workspace",
      active: true,
    },
    {
      id: "analytics",
      label: "Sales",
      icon: "dollar" as const,
      href: "/analytics",
      active: false,
    },
    {
      id: "customers",
      label: "Customers",
      icon: "user" as const,
      href: "/customers",
      active: false,
    },
  ];
  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: "var(--parchment-100)",
        borderRight: "1px solid var(--border)",
        padding: "18px 14px 0",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      <div style={{ padding: "4px 6px" }}>
        <BrandLockup href="/workspace" size={26} fontSize={17} />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-500)",
            padding: "0 8px 6px",
          }}
        >
          Workspace
        </div>
        {items.map((it) => (
          <Link
            key={it.id}
            href={it.href}
            prefetch
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              fontFamily: "var(--font-body)",
              fontSize: 13.5,
              fontWeight: it.active ? 600 : 500,
              color: it.active ? "var(--ink-900)" : "var(--ink-700)",
              background: it.active ? "#fff" : "transparent",
              border: it.active
                ? "1px solid var(--border)"
                : "1px solid transparent",
              borderRadius: 8,
              width: "100%",
              boxShadow: it.active ? "var(--shadow-xs)" : "none",
              textDecoration: "none",
            }}
          >
            <Icon name={it.icon} size={15} />
            <span style={{ flex: 1, textAlign: "left" }}>{it.label}</span>
          </Link>
        ))}
      </nav>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 8px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              background: "var(--slate-500)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {user.initial}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1.2,
              minWidth: 0,
              flex: 1,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ink-900)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={user.email}
            >
              {user.displayName}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--ink-500)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
              }}
            >
              {user.plan === "paid" ? "Pro" : "Free"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => startSignOut(() => signOut())}
            disabled={isSigningOut}
            title="Sign out"
            aria-label="Sign out"
            style={{
              border: "1px solid transparent",
              background: "transparent",
              padding: 6,
              borderRadius: 8,
              cursor: "pointer",
              color: "var(--ink-500)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition:
                "background 160ms ease-out, color 160ms ease-out, border-color 160ms ease-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--parchment-200)";
              e.currentTarget.style.color = "var(--ink-900)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ink-500)";
            }}
          >
            <Icon name="logout" size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ---------------- Keyword Library ----------------

type KeywordLibraryProps = {
  buckets: KindBucket[];
  heatMaxByCategory: Record<string, number>;
  removeKeyword: (word: string) => Promise<void>;
  updateKeyword: (oldWord: string, newWord: string) => Promise<void>;
  recategorizeKeyword: (
    word: string,
    category: string | null,
  ) => Promise<void>;
  addKeywords: (
    entries: {
      word: string;
      category: string | null;
      kind?: string | null;
    }[],
  ) => Promise<AddKeywordsResult>;
  importKeywordsFromCsv: (
    entries: { word: string; category: string; kind: string }[],
  ) => Promise<CsvImportResult>;
  setKeywordKind: (word: string, kind: string | null) => Promise<void>;
  pushToast: PushToast;
};

function KeywordLibrary({
  buckets,
  heatMaxByCategory,
  removeKeyword,
  updateKeyword,
  recategorizeKeyword,
  addKeywords,
  importKeywordsFromCsv,
  setKeywordKind,
  pushToast,
}: KeywordLibraryProps) {
  // Single-select source filter. null = show all sources.
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  // Free-text search. Case-insensitive substring match against the word
  // itself. Composed with the source filter (both must match).
  const [query, setQuery] = useState("");

  const totalWords = buckets.reduce((sum, b) => sum + b.words.length, 0);

  // Word count per canonical category slug — drives the legend chip counts
  // and lets us disable sources that have nothing to show.
  const countsByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of buckets) {
      for (const w of b.words) {
        const key = (w.category ?? "").toLowerCase();
        m[key] = (m[key] ?? 0) + 1;
      }
    }
    return m;
  }, [buckets]);

  const filteredBuckets = useMemo(() => {
    const target = activeCategory?.toLowerCase() ?? null;
    const q = query.trim().toLowerCase();
    if (!target && !q) return buckets;
    return buckets
      .map((b) => ({
        ...b,
        words: b.words.filter((w) => {
          if (target && (w.category ?? "").toLowerCase() !== target)
            return false;
          if (q && !w.word.toLowerCase().includes(q)) return false;
          return true;
        }),
      }))
      .filter((b) => b.words.length > 0);
  }, [buckets, activeCategory, query]);

  const shownWords = filteredBuckets.reduce(
    (sum, b) => sum + b.words.length,
    0,
  );

  return (
    <div
      style={{
        flex: 1,
        padding: "var(--space-8) var(--space-8) var(--space-10)",
        minWidth: 0,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        <Header totalWords={shownWords} />
        <AddKeywordsBar
          addKeywords={addKeywords}
          importKeywordsFromCsv={importKeywordsFromCsv}
          pushToast={pushToast}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            flexWrap: "wrap",
          }}
        >
          <Legend
            activeCategory={activeCategory}
            countsByCategory={countsByCategory}
            totalCount={totalWords}
            onSelect={setActiveCategory}
          />
          <SearchBar query={query} onChange={setQuery} />
        </div>
        {buckets.length === 0 ? (
          <EmptyLibrary />
        ) : filteredBuckets.length === 0 ? (
          <FilterEmpty
            category={activeCategory}
            query={query}
            onClear={() => {
              setActiveCategory(null);
              setQuery("");
            }}
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "var(--space-4)",
            }}
          >
            {filteredBuckets.map((b) => (
              <KindBucketCard
                key={b.kind}
                bucket={b}
                heatMaxByCategory={heatMaxByCategory}
                removeKeyword={removeKeyword}
                updateKeyword={updateKeyword}
                recategorizeKeyword={recategorizeKeyword}
                setKeywordKind={setKeywordKind}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ totalWords }: { totalWords: number }) {
  return (
    <div>
      <div className="eyebrow" style={{ color: "var(--ink-500)" }}>
        Keyword Library
      </div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 30,
          fontWeight: 500,
          color: "var(--ink-900)",
          letterSpacing: "-0.018em",
          margin: "var(--space-1) 0 0",
          lineHeight: 1.1,
        }}
      >
        {totalWords} {totalWords === 1 ? "word" : "words"}
      </h1>
    </div>
  );
}

function KindBucketCard({
  bucket,
  heatMaxByCategory,
  removeKeyword,
  updateKeyword,
  recategorizeKeyword,
  setKeywordKind,
}: {
  bucket: KindBucket;
  heatMaxByCategory: Record<string, number>;
  removeKeyword: (word: string) => Promise<void>;
  updateKeyword: (oldWord: string, newWord: string) => Promise<void>;
  recategorizeKeyword: (
    word: string,
    category: string | null,
  ) => Promise<void>;
  setKeywordKind: (word: string, kind: string | null) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [busyWord, setBusyWord] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleRemove = useCallback(
    (word: string) => {
      setBusyWord(word);
      startTransition(async () => {
        await removeKeyword(word);
        setBusyWord(null);
      });
    },
    [removeKeyword],
  );

  const handleUpdate = useCallback(
    (oldWord: string, newWord: string) => {
      setBusyWord(oldWord);
      startTransition(async () => {
        await updateKeyword(oldWord, newWord);
        setBusyWord(null);
      });
    },
    [updateKeyword],
  );

  const handleRecategorize = useCallback(
    (word: string, category: string | null) => {
      setBusyWord(word);
      startTransition(async () => {
        await recategorizeKeyword(word, category);
        setBusyWord(null);
      });
    },
    [recategorizeKeyword],
  );

  const handleSetKind = useCallback(
    (word: string, kind: string | null) => {
      setBusyWord(word);
      startTransition(async () => {
        await setKeywordKind(word, kind);
        setBusyWord(null);
      });
    },
    [setKeywordKind],
  );

  const sortedWords = useMemo(
    () => sortBucketWords(bucket.words),
    [bucket.words],
  );

  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("application/x-keyword-word")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragOver) setDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    // Only flip off when leaving the card boundary, not when crossing a
    // child element.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const word = e.dataTransfer.getData("application/x-keyword-word");
    if (!word) return;
    // Same-bucket drop is a no-op.
    const fromKind = e.dataTransfer.getData("application/x-keyword-from");
    if (fromKind === bucket.kind) return;
    setBusyWord(word);
    startTransition(async () => {
      await setKeywordKind(
        word,
        bucket.kind === UNCATEGORIZED_KIND ? null : bucket.kind,
      );
      setBusyWord(null);
    });
  };

  return (
    <section
      className="s-card"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        padding: "var(--space-4) var(--space-5) var(--space-5)",
        outline: dragOver ? "2px dashed var(--saffron-500)" : "none",
        outlineOffset: dragOver ? -2 : 0,
        transition: "outline-color 120ms ease-out",
      }}
    >
      <header
        style={{
          marginBottom: "var(--space-3)",
          paddingBottom: "var(--space-3)",
          borderBottom: "1px solid var(--parchment-200)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "var(--space-3)",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 500,
              color: "var(--ink-900)",
              letterSpacing: "-0.015em",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            {bucket.kind}
          </h2>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              color: "var(--ink-500)",
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
            }}
          >
            {bucket.words.length}{" "}
            {bucket.words.length === 1 ? "word" : "words"}
          </span>
        </div>
        {KIND_HINTS[bucket.kind] && (
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 11.5,
              fontWeight: 400,
              color: "var(--ink-500)",
              lineHeight: 1.35,
              marginTop: 2,
            }}
          >
            {KIND_HINTS[bucket.kind]}
          </div>
        )}
      </header>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-2)",
        }}
      >
        {sortedWords.map((w) => (
          <WordPill
            key={w.word}
            word={w.word}
            category={w.category}
            frequency={w.frequency}
            heatMax={
              w.category ? (heatMaxByCategory[w.category] ?? 1) : 1
            }
            sourceKind={bucket.kind}
            currentKind={bucket.kind}
            onRemove={handleRemove}
            onUpdate={handleUpdate}
            onSetKind={handleSetKind}
            onRecategorize={handleRecategorize}
            disabled={pending && busyWord === w.word}
          />
        ))}
      </div>
    </section>
  );
}

type WordPillProps = {
  word: string;
  category: string | null;
  frequency: number;
  heatMax: number;
  sourceKind: string;
  currentKind: string;
  onRemove: (word: string) => void;
  onUpdate: (oldWord: string, newWord: string) => void;
  onSetKind: (word: string, kind: string | null) => void;
  onRecategorize: (word: string, category: string | null) => void;
  disabled: boolean;
};

const WordPill = memo(function WordPill({
  word,
  category,
  frequency,
  heatMax,
  sourceKind,
  currentKind,
  onRemove,
  onUpdate,
  onSetKind,
  onRecategorize,
  disabled,
}: WordPillProps) {
  const c = categoryFor(category);
  const heatShade =
    c.heat && (c.name === CATEGORY.SOLD || c.name === CATEGORY.LIKED)
      ? HEAT_SHADES[c.name][heatLevel(frequency, heatMax)]
      : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(word);
  const [kindPickerOpen, setKindPickerOpen] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== word) onUpdate(word, next);
    else setDraft(word);
  };

  const cancel = () => {
    setDraft(word);
    setEditing(false);
  };

  const onDragStart = (e: React.DragEvent) => {
    if (editing || disabled) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-keyword-word", word);
    e.dataTransfer.setData("application/x-keyword-from", sourceKind);
    setDragging(true);
  };

  const onDragEnd = () => setDragging(false);

  return (
    <span
      className={`chip ${heatShade ? "" : c.chipClass}`}
      draggable={!editing && !disabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 5px 3px 4px",
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        borderRadius: 999,
        boxShadow: "none",
        opacity: disabled ? 0.5 : dragging ? 0.4 : 1,
        cursor: editing || disabled ? "default" : "grab",
        transition: "opacity 160ms ease-out",
        position: "relative",
        ...(heatShade
          ? {
              background: heatShade.bg,
              borderColor: heatShade.border,
              color: heatShade.color,
            }
          : null),
      }}
    >
      <KindDot
        currentKind={currentKind}
        disabled={disabled || editing}
        open={kindPickerOpen}
        onOpenChange={(v) => {
          setKindPickerOpen(v);
          if (v) setSourcePickerOpen(false);
        }}
        onPick={(k) => {
          setKindPickerOpen(false);
          if (k !== currentKind) onSetKind(word, k);
        }}
      />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          size={Math.max(draft.length, 4)}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "inherit",
            background: "transparent",
            border: "none",
            outline: "none",
            padding: "0 2px",
            margin: 0,
            minWidth: 24,
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => !disabled && setEditing(true)}
          disabled={disabled}
          title={pillHoverLabel(category, frequency)}
          style={{
            background: "transparent",
            border: "none",
            padding: "0 2px",
            margin: 0,
            font: "inherit",
            color: "inherit",
            cursor: disabled ? "default" : "text",
          }}
        >
          {word}
        </button>
      )}
      <SourceTag
        category={category}
        disabled={disabled || editing}
        open={sourcePickerOpen}
        onOpenChange={(v) => {
          setSourcePickerOpen(v);
          if (v) setKindPickerOpen(false);
        }}
        onPick={(cat) => {
          setSourcePickerOpen(false);
          onRecategorize(word, cat);
        }}
      />
      <PillIconButton
        ariaLabel={`Remove ${word}`}
        onClick={() => onRemove(word)}
        disabled={disabled || editing}
      >
        <Icon name="x" size={10} />
      </PillIconButton>
    </span>
  );
});

// Native-tooltip content for a pill's word button. Sold-category words
// show the sale count (their `frequency` IS the sold-designs count via
// refreshSoldKeywords). Everything else falls back to the edit hint.
function pillHoverLabel(category: string | null, frequency: number): string {
  const suffix = " — click to edit";
  if (category === CATEGORY.SOLD) {
    // `frequency` sums sale-events across every design that carries the
    // token (see refreshSoldKeywords in page.tsx). One design that sold
    // 75 times → 75; three designs that each sold 25 → 75. Phrase it as
    // "sales" not "designs" so the number reads correctly.
    return `Featured in ${frequency} sale${frequency === 1 ? "" : "s"}${suffix}`;
  }
  if (category === CATEGORY.LIKED) {
    return `Favorited ${frequency} time${frequency === 1 ? "" : "s"}${suffix}`;
  }
  return `Click to edit`;
}

function PillIconButton({
  children,
  onClick,
  disabled,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        padding: 0,
        border: "none",
        background: "transparent",
        borderRadius: 999,
        cursor: disabled ? "default" : "pointer",
        color: "currentColor",
        opacity: 0.5,
        transition: "opacity 120ms ease-out, background 120ms ease-out",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.opacity = "1";
        e.currentTarget.style.background = "rgba(20,24,42,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "0.5";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

// Circle affordance on each pill for reassigning it to a different Kind
// bucket. Neutral visual (slate hairline dot) because Kind has no color
// system — chip background carries source color; this is a "move me"
// control. Opens a picker menu listing all canonical KINDS.
function KindDot({
  currentKind,
  disabled,
  open,
  onOpenChange,
  onPick,
}: {
  currentKind: string;
  disabled: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (kind: string) => void;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <span ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        aria-label={`Move to a different bucket (currently ${currentKind})`}
        title={`${currentKind} — click to move`}
        style={{
          width: 18,
          height: 18,
          padding: 0,
          border: "none",
          background: open ? "rgba(20,24,42,0.08)" : "transparent",
          borderRadius: 4,
          cursor: disabled ? "default" : "pointer",
          color: "var(--ink-500)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition:
            "background 120ms ease-out, color 120ms ease-out, transform 120ms ease-out",
        }}
        onMouseEnter={(e) => {
          if (disabled) return;
          e.currentTarget.style.transform = "scale(1.12)";
          e.currentTarget.style.color = "var(--ink-900)";
          if (!open)
            e.currentTarget.style.background = "rgba(20,24,42,0.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.color = "var(--ink-500)";
          if (!open) e.currentTarget.style.background = "transparent";
        }}
      >
        <Icon name="folder" size={12} />
      </button>
      {open && (
        <KindMenu current={currentKind} onPick={onPick} />
      )}
    </span>
  );
}

function KindMenu({
  current,
  onPick,
}: {
  current: string;
  onPick: (kind: string) => void;
}) {
  return (
    <div
      role="menu"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: -4,
        zIndex: 20,
        minWidth: 180,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-md)",
        padding: "var(--space-1)",
        fontFamily: "var(--font-body)",
      }}
    >
      {KINDS.map((k) => {
        const isCurrent = k === current;
        return (
          <button
            key={k}
            role="menuitem"
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(k);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "6px 8px",
              fontSize: 12.5,
              color: "var(--ink-900)",
              background: isCurrent ? "var(--parchment-100)" : "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              textAlign: "left",
              fontWeight: isCurrent ? 600 : 500,
              transition: "background 100ms ease-out",
            }}
            onMouseEnter={(e) => {
              if (!isCurrent)
                e.currentTarget.style.background = "var(--parchment-50)";
            }}
            onMouseLeave={(e) => {
              if (!isCurrent)
                e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={{ flex: 1 }}>{k}</span>
            {isCurrent && (
              <Icon name="check" size={12} color="var(--ink-500)" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Source affordance — small tag icon on the right side of each pill,
// tinted with the current source's identity color so users can spot
// "this is a Trend word" without opening anything. Click to change source.
function SourceTag({
  category,
  disabled,
  open,
  onOpenChange,
  onPick,
}: {
  category: string | null;
  disabled: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (category: string | null) => void;
}) {
  const c = categoryFor(category);
  const tintColor = c.legendFill === "var(--surface)"
    ? "var(--ink-500)"
    : c.legendFill;
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <span ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        aria-label={`Change source (currently ${c.label})`}
        title={`${c.label} — click to change source`}
        style={{
          width: 18,
          height: 18,
          padding: 0,
          border: "none",
          background: open ? "rgba(20,24,42,0.08)" : "transparent",
          borderRadius: 4,
          cursor: disabled ? "default" : "pointer",
          color: tintColor,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition:
            "background 120ms ease-out, transform 120ms ease-out",
        }}
        onMouseEnter={(e) => {
          if (disabled) return;
          e.currentTarget.style.transform = "scale(1.12)";
          if (!open)
            e.currentTarget.style.background = "rgba(20,24,42,0.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          if (!open) e.currentTarget.style.background = "transparent";
        }}
      >
        <Icon name="tag" size={12} />
      </button>
      {open && <SourceMenu current={c.name} onPick={onPick} />}
    </span>
  );
}

function SourceMenu({
  current,
  onPick,
}: {
  current: string;
  onPick: (category: string | null) => void;
}) {
  return (
    <div
      role="menu"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        right: -4,
        zIndex: 20,
        minWidth: 180,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-md)",
        padding: "var(--space-1)",
        fontFamily: "var(--font-body)",
      }}
    >
      {CATEGORIES.filter((opt) => opt.userSelectable).map((opt) => {
        const isCurrent = opt.name === current;
        return (
          <button
            key={opt.name}
            role="menuitem"
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(opt.name);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "6px 8px",
              fontSize: 12.5,
              color: "var(--ink-900)",
              background: isCurrent ? "var(--parchment-100)" : "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              textAlign: "left",
              fontWeight: isCurrent ? 600 : 500,
              transition: "background 100ms ease-out",
            }}
            onMouseEnter={(e) => {
              if (!isCurrent)
                e.currentTarget.style.background = "var(--parchment-50)";
            }}
            onMouseLeave={(e) => {
              if (!isCurrent)
                e.currentTarget.style.background = "transparent";
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: opt.legendFill,
                border: `1.5px solid ${opt.legendBorder}`,
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1 }}>{opt.label}</span>
            {isCurrent && (
              <Icon name="check" size={12} color="var(--ink-500)" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function AddKeywordsBar({
  addKeywords,
  importKeywordsFromCsv,
  pushToast,
}: {
  addKeywords: (
    entries: {
      word: string;
      category: string | null;
      kind?: string | null;
    }[],
  ) => Promise<AddKeywordsResult>;
  importKeywordsFromCsv: (
    entries: { word: string; category: string; kind: string }[],
  ) => Promise<CsvImportResult>;
  pushToast: PushToast;
}) {
  const [value, setValue] = useState("");
  const [category, setCategory] = useState<string>(CATEGORY.USER);
  // Preselect the first canonical kind so adding a word forces an explicit
  // categorization choice. "Auto" stays as the last option in the dropdown
  // as a fallback for when the user genuinely doesn't know — but it's not
  // the default to discourage lazy classification.
  const [kind, setKind] = useState<string>(KINDS[0]);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const words = splitWords(value);
    if (!words.length) return;
    const cat = category || null;
    const k = kind || null;
    startTransition(async () => {
      const result = await addKeywords(
        words.map((w) => ({ word: w, category: cat, kind: k })),
      );
      setValue("");
      const { inserted, updatedExisting } = result;
      if (updatedExisting.length > 0) {
        const shown = updatedExisting.slice(0, 3).join(", ");
        const rest =
          updatedExisting.length > 3
            ? ` and ${updatedExisting.length - 3} more`
            : "";
        const insertedPart =
          inserted > 0 ? ` · Added ${inserted} new` : "";
        pushToast({
          kind: "info",
          message: `Already in your library: ${shown}${rest} — recategorized to your selection.${insertedPart}`,
        });
      } else if (inserted > 0) {
        pushToast({
          kind: "success",
          message: `Added ${inserted} keyword${inserted === 1 ? "" : "s"}.`,
        });
      }
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (text.includes("\n") || text.includes("\t")) {
      e.preventDefault();
      const normalized = text.replace(/[\t\n\r]+/g, ", ");
      setValue((v) => (v ? `${v}, ${normalized}` : normalized));
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { entries, skipped } = parseCsv(text);
      if (!entries.length) {
        pushToast({
          kind: "error",
          message:
            skipped > 0
              ? `No valid rows in CSV (skipped ${skipped} — check word, category, kind columns).`
              : "No keywords found in CSV.",
        });
        return;
      }
      startTransition(async () => {
        const result = await importKeywordsFromCsv(entries);
        const parts: string[] = [`Imported ${result.written}`];
        if (result.keptTrend > 0)
          parts.push(`kept ${result.keptTrend} in Trend`);
        if (skipped > 0) parts.push(`skipped ${skipped} invalid`);
        pushToast({
          kind: skipped > 0 ? "info" : "success",
          message: parts.join(" · "),
        });
      });
    };
    reader.onerror = () =>
      pushToast({ kind: "error", message: "Couldn't read that file." });
    reader.readAsText(file);
  };

  return (
    <div
      className="s-card"
      style={{
        padding: "var(--space-3) var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          className="input"
          placeholder="Type or paste keyword"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          disabled={pending}
          style={{ flex: "1 1 280px", minWidth: 220 }}
        />
        <select
          className="select select--compact"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          disabled={pending}
          title="Kind — what the word is about. Defaults to the first kind; use Auto only as a fallback when you genuinely don't know."
          style={{ width: "auto", flexShrink: 0 }}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
          <option value="">Auto</option>
        </select>
        <select
          className="select select--compact"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={pending}
          title="Source — where the word came from"
          style={{ width: "auto", flexShrink: 0 }}
        >
          {CATEGORIES.filter((c) => c.userSelectable).map((c) => (
            <option key={c.name} value={c.name}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn--accent"
          onClick={submit}
          disabled={pending || !value.trim()}
        >
          <Icon name="plus" size={13} /> Add
        </button>
        <span
          aria-hidden
          style={{
            width: 1,
            alignSelf: "stretch",
            background: "var(--parchment-200)",
            margin: "0 var(--space-1)",
          }}
        />
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          title="CSV columns: word, category, kind. Spaces in words become hyphens. Category must be sold / liked / trend / user / spoonflower. Kind must be Style / Subject / Color / Technique / Layout / Mood / Use."
        >
          <Icon name="file" size={13} /> Import CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: "var(--ink-500)",
          lineHeight: 1,
          marginTop: -2,
        }}
      >
        * use a hyphen{" "}
        <code style={{ fontFamily: "var(--font-mono)" }}>(-)</code> to keep
        multi-word keywords together
      </div>
    </div>
  );
}

function sortBucketWords(words: SavedWord[]): SavedWord[] {
  return [...words].sort((a, b) => {
    const ra = categoryRank(a.category);
    const rb = categoryRank(b.category);
    if (ra !== rb) return ra - rb;
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    return a.word.localeCompare(b.word);
  });
}

function splitWords(input: string): string[] {
  return input
    .split(/[,\n\r\t]+/g)
    .map((w) => w.trim())
    .filter(Boolean);
}

// CSV import shape (strict): word, category, kind.
//   - word:     spaces collapse to "-", lowercased via normalizeWord
//   - category: must match a canonical CATEGORY slug after normalize
//   - kind:     must match a KIND (case-insensitive); stored title-case
// Rows missing or failing any of these are dropped and counted as skipped
// so the user gets a "imported N · skipped M invalid" summary. Dedupe is
// first-occurrence-wins, matching addKeywords semantics.
function parseCsv(text: string): {
  entries: { word: string; category: string; kind: string }[];
  skipped: number;
} {
  const entries: { word: string; category: string; kind: string }[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  const lines = text.split(/\r?\n/);
  let headerSkipped = false;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const cells = splitCsvLine(raw);
    if (!cells[0]) continue;
    if (
      !headerSkipped &&
      entries.length === 0 &&
      /^(word|keyword|tag|name)$/i.test(cells[0])
    ) {
      headerSkipped = true;
      continue;
    }
    const word = normalizeWord(cells[0] ?? "");
    const category = normalizeCategory(cells[1] ?? "");
    const kind = normalizeKind(cells[2] ?? "");
    if (!word || !category || !kind) {
      skipped++;
      continue;
    }
    if (seen.has(word)) {
      skipped++;
      continue;
    }
    seen.add(word);
    entries.push({ word, category, kind });
  }
  return { entries, skipped };
}

function splitCsvLine(line: string): string[] {
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
    } else if (ch === ",") {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

function HeatLegendSwatch({ base }: { base: "sold" | "liked" }) {
  const shades = HEAT_SHADES[base];
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        borderRadius: 999,
        overflow: "hidden",
        border: `1.5px solid ${shades[3].border}`,
        boxSizing: "border-box",
        height: 14,
        width: 30,
        flexShrink: 0,
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <span style={{ flex: 1, background: shades[1].bg }} />
      <span style={{ flex: 1, background: shades[2].bg }} />
      <span style={{ flex: 1, background: shades[3].bg }} />
    </span>
  );
}

function SearchBar({
  query,
  onChange,
}: {
  query: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="field-icon-wrap"
      style={{
        position: "relative",
        flex: "1 1 220px",
        minWidth: 220,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--ink-500)",
          display: "inline-flex",
          pointerEvents: "none",
        }}
      >
        <Icon name="search" size={13} />
      </span>
      <input
        className="input input--with-icon"
        type="search"
        placeholder="Search"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && query) {
            e.preventDefault();
            onChange("");
          }
        }}
        aria-label="Search keywords"
        style={{
          fontSize: 12.5,
          padding: "7px 10px 7px 30px",
        }}
      />
    </div>
  );
}

function Legend({
  activeCategory,
  countsByCategory,
  totalCount,
  onSelect,
}: {
  activeCategory: string | null;
  countsByCategory: Record<string, number>;
  totalCount: number;
  onSelect: (category: string | null) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "var(--space-2)",
        fontSize: 12,
        color: "var(--ink-500)",
      }}
    >
      <span
        className="eyebrow"
        style={{
          color: "var(--ink-500)",
          marginRight: "var(--space-1)",
          lineHeight: 1,
        }}
      >
        Sources
      </span>
      <LegendChip
        label="All"
        count={totalCount}
        active={activeCategory === null}
        dimmed={false}
        onClick={() => onSelect(null)}
      />
      {CATEGORIES.map((c) => {
        const count = countsByCategory[c.name.toLowerCase()] ?? 0;
        const active = activeCategory?.toLowerCase() === c.name.toLowerCase();
        return (
          <LegendChip
            key={c.name}
            label={c.label}
            title={c.description}
            count={count}
            active={!!active}
            dimmed={activeCategory !== null && !active}
            // Keep the active chip clickable (to toggle off) even if a
            // background refresh dropped its count to 0.
            disabled={count === 0 && !active}
            onClick={() => onSelect(active ? null : c.name)}
            swatch={
              c.heat ? (
                <HeatLegendSwatch base={c.name as "sold" | "liked"} />
              ) : (
                <span
                  style={{
                    boxSizing: "border-box",
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: c.legendFill,
                    border: `1.5px solid ${c.legendBorder}`,
                    boxShadow: "var(--shadow-xs)",
                    flexShrink: 0,
                  }}
                />
              )
            }
          />
        );
      })}
    </div>
  );
}

function LegendChip({
  label,
  title,
  count,
  active,
  dimmed,
  disabled = false,
  onClick,
  swatch,
}: {
  label: string;
  title?: string;
  count?: number;
  active: boolean;
  dimmed: boolean;
  disabled?: boolean;
  onClick: () => void;
  swatch?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 999,
        border: `1px solid ${active ? "var(--ink-300)" : "transparent"}`,
        background: active ? "var(--parchment-200)" : "transparent",
        color: "var(--ink-700)",
        fontFamily: "var(--font-body)",
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : dimmed ? 0.5 : 1,
        transition:
          "opacity 120ms ease-out, background 120ms ease-out, border-color 120ms ease-out",
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.background = "var(--parchment-100)";
      }}
      onMouseLeave={(e) => {
        if (active) return;
        e.currentTarget.style.background = "transparent";
      }}
    >
      {swatch}
      <span
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 6,
          lineHeight: 1,
        }}
      >
        <span>{label}</span>
        {typeof count === "number" && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--ink-500)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {count}
          </span>
        )}
      </span>
    </button>
  );
}

function FilterEmpty({
  category,
  query,
  onClear,
}: {
  category: string | null;
  query: string;
  onClear: () => void;
}) {
  const label = categoryFor(category).label;
  const hasQuery = query.trim().length > 0;
  const hasCategory = !!category;
  return (
    <div
      className="s-card s-card--tinted"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-3)",
        padding: "var(--space-10) var(--space-5)",
        textAlign: "center",
      }}
    >
      <Icon
        name={hasQuery ? "search" : "star"}
        size={28}
        color="var(--ink-300)"
      />
      <p
        style={{
          color: "var(--ink-700)",
          fontSize: 14,
          margin: 0,
        }}
      >
        {hasQuery && hasCategory ? (
          <>
            No matches for &ldquo;<strong>{query.trim()}</strong>&rdquo; in{" "}
            <strong>{label}</strong>.
          </>
        ) : hasQuery ? (
          <>
            No matches for &ldquo;<strong>{query.trim()}</strong>&rdquo;.
          </>
        ) : (
          <>
            No words in <strong>{label}</strong> yet.
          </>
        )}
      </p>
      <button type="button" className="btn btn--ghost btn--sm" onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}

function EmptyLibrary() {
  return (
    <div
      className="s-card s-card--tinted"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-12) var(--space-5)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          maxWidth: 440,
        }}
      >
        <Icon name="star" size={32} color="var(--ink-300)" />
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 500,
            color: "var(--ink-900)",
            margin: "var(--space-3) 0 var(--space-1)",
            letterSpacing: "-0.015em",
          }}
        >
          Your library is empty
        </h2>
        <p
          style={{
            color: "var(--ink-500)",
            fontSize: 13.5,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          Star words in the Seller Lab Chrome extension to save them here.
          They&rsquo;ll appear grouped by character count.
        </p>
      </div>
    </div>
  );
}
