// Canonical lowercase slugs stored in user_keywords.category. UI labels
// live on CategoryDef.label and are looked up via categoryFor(). This
// enum is the single source of truth — import it everywhere instead of
// hardcoding string literals so renames stay safe.
export const CATEGORY = {
  SOLD: "sold",
  LIKED: "liked",
  TREND: "trend",
  USER: "user",
  SPOONFLOWER: "spoonflower",
} as const;

export type Category = (typeof CATEGORY)[keyof typeof CATEGORY];

export type CategoryDef = {
  // DB value — the canonical string stored in user_keywords.category.
  name: Category;
  // Display label shown in the UI. Often the same as `name`, but for
  // multi-word categories the DB stores a short slug ("user") while the
  // UI shows the friendlier "User saved".
  label: string;
  chipClass: string;
  description: string;
  // Chip-dot (the small swatch attached to each word pill). Matches the
  // `.chip--*` light tint from app/components.css.
  swatch: string;
  swatchBorder: string;
  // Legend swatch — the canonical 500-level taxonomy color from the design
  // system (matches `.chip--dot.dot-*` semantics).
  legendFill: string;
  legendBorder: string;
  heat: boolean;
  userSelectable: boolean;
};

export const CATEGORIES: CategoryDef[] = [
  {
    name: CATEGORY.SOLD,
    label: "Sold",
    chipClass: "chip--sales",
    description: "Most sold (heatmap by frequency)",
    swatch: "var(--sage-100)",
    swatchBorder: "var(--sage-500)",
    legendFill: "var(--sage-500)",
    legendBorder: "var(--sage-700)",
    heat: true,
    userSelectable: false,
  },
  {
    name: CATEGORY.LIKED,
    label: "Liked",
    chipClass: "chip--liked",
    description: "Most liked (heatmap by frequency)",
    swatch: "var(--blossom-100)",
    swatchBorder: "var(--blossom-300)",
    legendFill: "var(--blossom-500)",
    legendBorder: "var(--blossom-700)",
    heat: true,
    userSelectable: false,
  },
  {
    name: CATEGORY.TREND,
    label: "Trend",
    chipClass: "chip--trend",
    description: "Your trend research",
    swatch: "var(--plum-100)",
    swatchBorder: "var(--plum-300)",
    legendFill: "var(--plum-500)",
    legendBorder: "var(--plum-700)",
    heat: false,
    userSelectable: true,
  },
  {
    name: CATEGORY.USER,
    label: "User Saved",
    chipClass: "",
    description: "Saved by you — manually added or starred",
    swatch: "var(--surface)",
    swatchBorder: "var(--border)",
    legendFill: "var(--surface)",
    legendBorder: "var(--slate-300)",
    heat: false,
    userSelectable: true,
  },
  {
    name: CATEGORY.SPOONFLOWER,
    label: "Spoonflower Categories",
    chipClass: "chip--system",
    description: "Pulled from Spoonflower",
    swatch: "var(--slate-100)",
    swatchBorder: "var(--slate-300)",
    legendFill: "var(--slate-500)",
    legendBorder: "var(--slate-700)",
    heat: false,
    userSelectable: true,
  },
];

// Fallback when categoryFor() is handed a value not in CATEGORIES. After
// the normalize-slugs migration there shouldn't be any in practice — but
// keeps the renderer safe if a new extension build ever introduces an
// unknown value. Not in CATEGORIES, so it doesn't appear in dropdowns /
// legend / popovers.
export const UNCATEGORIZED = {
  name: "uncategorized",
  label: "Uncategorized",
  chipClass: "",
  description: "No category",
  swatch: "var(--surface)",
  swatchBorder: "var(--border)",
  legendFill: "var(--surface)",
  legendBorder: "var(--slate-300)",
  heat: false as const,
  userSelectable: false as const,
} satisfies Omit<CategoryDef, "name"> & { name: string };

// Loose return type — UNCATEGORIZED falls outside the strict Category enum.
export type RenderableCategory = Omit<CategoryDef, "name"> & {
  name: string;
};

// Normalize a CSV/user-supplied category cell to the canonical lowercase
// slug. Returns null if the value doesn't map to a known category.
export function normalizeCategory(s: string): Category | null {
  const lower = s.trim().toLowerCase();
  const match = (Object.values(CATEGORY) as string[]).find(
    (c) => c === lower,
  );
  return (match as Category | undefined) ?? null;
}

export function categoryFor(
  name: string | null | undefined,
): RenderableCategory {
  if (!name) return UNCATEGORIZED;
  const lower = name.toLowerCase();
  return (
    CATEGORIES.find((c) => c.name.toLowerCase() === lower) ?? UNCATEGORIZED
  );
}

export function categoryRank(name: string | null | undefined): number {
  if (!name) return CATEGORIES.length;
  const lower = name.toLowerCase();
  const idx = CATEGORIES.findIndex((c) => c.name.toLowerCase() === lower);
  return idx === -1 ? CATEGORIES.length : idx;
}

export type HeatLevel = 1 | 2 | 3;

export function heatLevel(frequency: number, max: number): HeatLevel {
  if (max <= 1 || frequency <= 1) return 1;
  const pct = frequency / max;
  if (pct >= 0.66) return 3;
  if (pct >= 0.33) return 2;
  return 1;
}

// Shade scales for the two heatmap categories. 3 levels each, lightest →
// darkest. Used to override the chip CSS variant inline when rendering.
export const HEAT_SHADES: Record<
  "sold" | "liked",
  Record<HeatLevel, { bg: string; border: string; color: string }>
> = {
  sold: {
    1: {
      bg: "var(--sage-100)",
      border: "var(--sage-500)",
      color: "var(--sage-700)",
    },
    2: {
      bg: "var(--sage-500)",
      border: "var(--sage-700)",
      color: "#fff",
    },
    3: {
      bg: "var(--sage-700)",
      border: "var(--sage-700)",
      color: "#fff",
    },
  },
  liked: {
    1: {
      bg: "var(--blossom-100)",
      border: "var(--blossom-300)",
      color: "var(--blossom-700)",
    },
    2: {
      bg: "var(--blossom-500)",
      border: "var(--blossom-700)",
      color: "#fff",
    },
    3: {
      bg: "var(--blossom-700)",
      border: "var(--blossom-700)",
      color: "#fff",
    },
  },
};
