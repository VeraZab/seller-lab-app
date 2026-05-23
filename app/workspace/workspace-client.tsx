"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrandLockup } from "@/components/brand";
import { Icon } from "@/components/icon";
import {
  CATEGORIES,
  HEAT_SHADES,
  UNCATEGORIZED,
  categoryFor,
  categoryRank,
  heatLevel,
} from "./categories";

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

export type CharBucket = {
  charCount: number;
  words: SavedWord[];
};

type WorkspaceClientProps = {
  user: SessionUser;
  buckets: CharBucket[];
  heatMaxByCategory: Record<string, number>;
  signOut: () => Promise<void>;
  removeKeyword: (word: string) => Promise<void>;
  updateKeyword: (oldWord: string, newWord: string) => Promise<void>;
  recategorizeKeyword: (
    word: string,
    category: string | null,
  ) => Promise<void>;
  addKeywords: (
    entries: { word: string; category: string | null }[],
  ) => Promise<void>;
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
}: WorkspaceClientProps) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

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
        />
      </div>
    </div>
  );
}

// ---------------- Sidebar ----------------

type SidebarProps = {
  user: SessionUser;
  signOut: () => Promise<void>;
};

function Sidebar({ user, signOut }: SidebarProps) {
  const [isSigningOut, startSignOut] = useTransition();
  const items = [
    { id: "keyword-library", label: "Keyword Library", icon: "star" as const },
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
          <div
            key={it.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              fontFamily: "var(--font-body)",
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--ink-900)",
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 8,
              width: "100%",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <Icon name={it.icon} size={15} />
            <span style={{ flex: 1, textAlign: "left" }}>{it.label}</span>
          </div>
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
  buckets: CharBucket[];
  heatMaxByCategory: Record<string, number>;
  removeKeyword: (word: string) => Promise<void>;
  updateKeyword: (oldWord: string, newWord: string) => Promise<void>;
  recategorizeKeyword: (
    word: string,
    category: string | null,
  ) => Promise<void>;
  addKeywords: (
    entries: { word: string; category: string | null }[],
  ) => Promise<void>;
};

function KeywordLibrary({
  buckets,
  heatMaxByCategory,
  removeKeyword,
  updateKeyword,
  recategorizeKeyword,
  addKeywords,
}: KeywordLibraryProps) {
  const totalWords = buckets.reduce((sum, b) => sum + b.words.length, 0);

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
        <Header
          totalWords={totalWords}
          bucketCount={buckets.length}
        />
        <AddKeywordsBar addKeywords={addKeywords} />
        <Legend />
        {buckets.length === 0 ? (
          <EmptyLibrary />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "var(--space-4)",
            }}
          >
            {buckets.map((b) => (
              <CharBucketCard
                key={b.charCount}
                bucket={b}
                heatMaxByCategory={heatMaxByCategory}
                removeKeyword={removeKeyword}
                updateKeyword={updateKeyword}
                recategorizeKeyword={recategorizeKeyword}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Header({
  totalWords,
  bucketCount,
}: {
  totalWords: number;
  bucketCount: number;
}) {
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
        {totalWords} {totalWords === 1 ? "word" : "words"}{" "}
        <span style={{ color: "var(--ink-300)" }}>·</span>{" "}
        <span style={{ color: "var(--ink-500)", fontWeight: 400 }}>
          {bucketCount} {bucketCount === 1 ? "bucket" : "buckets"} by character
          count
        </span>
      </h1>
    </div>
  );
}

function CharBucketCard({
  bucket,
  heatMaxByCategory,
  removeKeyword,
  updateKeyword,
  recategorizeKeyword,
}: {
  bucket: CharBucket;
  heatMaxByCategory: Record<string, number>;
  removeKeyword: (word: string) => Promise<void>;
  updateKeyword: (oldWord: string, newWord: string) => Promise<void>;
  recategorizeKeyword: (
    word: string,
    category: string | null,
  ) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [busyWord, setBusyWord] = useState<string | null>(null);

  const handleRemove = (word: string) => {
    setBusyWord(word);
    startTransition(async () => {
      await removeKeyword(word);
      setBusyWord(null);
    });
  };

  const handleUpdate = (oldWord: string, newWord: string) => {
    setBusyWord(oldWord);
    startTransition(async () => {
      await updateKeyword(oldWord, newWord);
      setBusyWord(null);
    });
  };

  const handleRecategorize = (word: string, category: string | null) => {
    setBusyWord(word);
    startTransition(async () => {
      await recategorizeKeyword(word, category);
      setBusyWord(null);
    });
  };

  return (
    <section
      className="s-card"
      style={{
        padding: "var(--space-4) var(--space-5) var(--space-5)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          marginBottom: "var(--space-3)",
          paddingBottom: "var(--space-3)",
          borderBottom: "1px solid var(--parchment-200)",
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
            display: "inline-flex",
            alignItems: "baseline",
            gap: 6,
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
            {bucket.charCount}
          </span>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--ink-500)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {bucket.charCount === 1 ? "char" : "chars"}
          </span>
        </h2>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            color: "var(--ink-500)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {bucket.words.length}{" "}
          {bucket.words.length === 1 ? "word" : "words"}
        </span>
      </header>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-2)",
        }}
      >
        {sortBucketWords(bucket.words).map((w) => (
          <WordPill
            key={w.word}
            word={w.word}
            category={w.category}
            frequency={w.frequency}
            heatMax={
              w.category ? (heatMaxByCategory[w.category] ?? 1) : 1
            }
            onRemove={() => handleRemove(w.word)}
            onUpdate={(next) => handleUpdate(w.word, next)}
            onRecategorize={(cat) => handleRecategorize(w.word, cat)}
            disabled={pending && busyWord === w.word}
          />
        ))}
      </div>
    </section>
  );
}

function WordPill({
  word,
  category,
  frequency,
  heatMax,
  onRemove,
  onUpdate,
  onRecategorize,
  disabled,
}: {
  word: string;
  category: string | null;
  frequency: number;
  heatMax: number;
  onRemove: () => void;
  onUpdate: (next: string) => void;
  onRecategorize: (category: string | null) => void;
  disabled: boolean;
}) {
  const c = categoryFor(category);
  const heatShade =
    c.heat && (c.name === "Sold" || c.name === "Liked")
      ? HEAT_SHADES[c.name][heatLevel(frequency, heatMax)]
      : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(word);
  const [pickerOpen, setPickerOpen] = useState(false);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== word) onUpdate(next);
    else setDraft(word);
  };

  const cancel = () => {
    setDraft(word);
    setEditing(false);
  };

  return (
    <span
      className={`chip ${heatShade ? "" : c.chipClass}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 5px 3px 4px",
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        borderRadius: 999,
        boxShadow: "none",
        opacity: disabled ? 0.5 : 1,
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
      <CategoryDot
        category={category}
        frequency={frequency}
        heatMax={heatMax}
        disabled={disabled || editing}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(cat) => {
          setPickerOpen(false);
          onRecategorize(cat);
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
          title="Click to edit"
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
      <PillIconButton
        ariaLabel={`Remove ${word}`}
        onClick={onRemove}
        disabled={disabled || editing}
      >
        <Icon name="x" size={10} />
      </PillIconButton>
    </span>
  );
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

function CategoryDot({
  category,
  frequency,
  heatMax,
  disabled,
  open,
  onOpenChange,
  onPick,
}: {
  category: string | null;
  frequency: number;
  heatMax: number;
  disabled: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (category: string | null) => void;
}) {
  const c = categoryFor(category);
  const heatShade =
    c.heat && (c.name === "Sold" || c.name === "Liked")
      ? HEAT_SHADES[c.name][heatLevel(frequency, heatMax)]
      : null;
  const dotBg = heatShade?.bg ?? c.swatch;
  const dotBorder = heatShade?.border ?? c.swatchBorder;
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
        aria-label={`Change category (currently ${c.name})`}
        title={`${c.name} — click to recategorize`}
        style={{
          width: 16,
          height: 16,
          padding: 0,
          border: `1.5px solid ${dotBorder}`,
          background: dotBg,
          borderRadius: 999,
          cursor: disabled ? "default" : "pointer",
          boxShadow: open ? "0 0 0 2px rgba(20,24,42,0.12)" : "none",
          transition: "box-shadow 120ms ease-out, transform 120ms ease-out",
        }}
        onMouseEnter={(e) => {
          if (disabled) return;
          e.currentTarget.style.transform = "scale(1.12)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      />
      {open && (
        <CategoryMenu
          current={c.name}
          onPick={onPick}
        />
      )}
    </span>
  );
}

function CategoryMenu({
  current,
  onPick,
}: {
  current: string;
  onPick: (category: string | null) => void;
}) {
  const options = [...CATEGORIES, UNCATEGORIZED];
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
      {options.map((opt) => {
        const isCurrent = opt.name === current;
        const value = opt === UNCATEGORIZED ? null : opt.name;
        return (
          <button
            key={opt.name}
            role="menuitem"
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(value);
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
                borderRadius: 3,
                background: opt.swatch,
                border: `1.5px solid ${opt.swatchBorder}`,
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1 }}>{opt.name}</span>
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
}: {
  addKeywords: (
    entries: { word: string; category: string | null }[],
  ) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [category, setCategory] = useState<string>("Spoonflower");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const words = splitWords(value);
    if (!words.length) return;
    const cat = category || null;
    startTransition(async () => {
      await addKeywords(words.map((w) => ({ word: w, category: cat })));
      setValue("");
      setError(null);
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
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const entries = parseCsv(text);
      if (!entries.length) {
        setError("No keywords found in file.");
        return;
      }
      startTransition(async () => {
        await addKeywords(entries);
      });
    };
    reader.onerror = () => setError("Couldn't read that file.");
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
          placeholder="Type or paste keyword (use hyphen to keep multi word together)"
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
          className="select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={pending}
          style={{ width: "auto", minWidth: 160, flexShrink: 0 }}
        >
          {CATEGORIES.filter((c) => c.userSelectable).map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
          <option value="">Uncategorized</option>
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
          title="CSV columns: word, category (category optional)"
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
      {error && <div className="help help--error">{error}</div>}
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

function parseCsv(
  text: string,
): { word: string; category: string | null }[] {
  const out: { word: string; category: string | null }[] = [];
  const lines = text.split(/\r?\n/);
  let headerSkipped = false;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const cells = splitCsvLine(raw);
    if (!cells[0]) continue;
    if (
      !headerSkipped &&
      out.length === 0 &&
      /^(word|keyword|tag|name)$/i.test(cells[0])
    ) {
      headerSkipped = true;
      continue;
    }
    out.push({
      word: cells[0],
      category: cells[1]?.trim() ? cells[1].trim() : null,
    });
  }
  return out;
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

function HeatLegendSwatch({ base }: { base: "Sold" | "Liked" }) {
  const shades = HEAT_SHADES[base];
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        borderRadius: 999,
        overflow: "hidden",
        border: `1.5px solid ${shades[3].border}`,
        height: 14,
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <span style={{ width: 10, background: shades[1].bg }} />
      <span style={{ width: 10, background: shades[2].bg }} />
      <span style={{ width: 10, background: shades[3].bg }} />
    </span>
  );
}

function Legend() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "var(--space-4)",
        fontSize: 12,
        color: "var(--ink-500)",
      }}
    >
      <span
        className="eyebrow"
        style={{ color: "var(--ink-500)" }}
      >
        Categories
      </span>
      {[...CATEGORIES, UNCATEGORIZED].map((c) => (
        <span
          key={c.name}
          title={c.description}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--ink-700)",
            fontSize: 12.5,
          }}
        >
          {c.heat ? (
            <HeatLegendSwatch base={c.name as "Sold" | "Liked"} />
          ) : (
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: c.legendFill,
                border: `1.5px solid ${c.legendBorder}`,
                boxShadow: "var(--shadow-xs)",
              }}
            />
          )}
          {c.name}
        </span>
      ))}
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
