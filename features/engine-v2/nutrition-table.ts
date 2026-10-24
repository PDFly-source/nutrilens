/**
 * Nutrition table parser v2.
 *
 * The v1 parser matches whole lines. Real Indian packages often print
 * TWO-COLUMN tables:
 *
 *                          Per 100g   Per Serving (70g)
 *   Energy                  406 kcal   284 kcal
 *   Protein                  9.1 g       6.4 g
 *
 * v2 first detects a column-header line, then splits each row into label +
 * numeric columns and assigns values to the right basis. Falls back to the
 * v1 single-column line parsing when no header row is found.
 *
 * Basis policy: per-100g values are preferred (stable, comparable); per-serving
 * values are recorded only when per-100g is absent, and always marked with
 * their basis. Units (kcal/g/mg) are preserved from the printed text.
 */

export type TableBasis = 'per_100g' | 'per_serving' | 'per_package';

export interface TableRow {
  label: string;
  values: { basis: TableBasis; value: number; unit: string | null }[];
}

export interface NutritionTable {
  detected: boolean;
  bases: TableBasis[];
  rows: TableRow[];
  rawHeader: string | null;
}

const HEADER_PATTERNS: { re: RegExp; basis: TableBasis }[] = [
  { re: /per\s*100\s*g/i, basis: 'per_100g' },
  { re: /per\s*serving/i, basis: 'per_serving' },
  { re: /per\s*(pack|package|portion)/i, basis: 'per_package' },
];

/**
 * Detect a nutrition-table header row and return the column bases it defines.
 * Returns null when the line is not a header.
 */
export function detectHeaderBases(line: string): TableBasis[] | null {
  const bases: TableBasis[] = [];
  for (const { re, basis } of HEADER_PATTERNS) {
    if (re.test(line)) bases.push(basis);
  }
  // A header needs at least one basis and should NOT contain nutrients itself.
  const containsNutrientWord =
    /(energy|protein|fat|carbohydrate|sugar|fibre|fiber|sodium|salt|cholesterol)/i.test(line);
  if (bases.length === 0 || containsNutrientWord) return null;
  return bases;
}

const NUM = /[0-9]+(?:[.,][0-9]+)?/;

/**
 * Split a table row into its label and numeric cells.
 * Rows are split on 2+ spaces (OCR preserves column gaps) or tabs.
 */
export function splitTableRow(line: string): { label: string; cells: string[] } | null {
  const parts = line.split(/\s{2,}|\t+/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length < 2) return null;
  const label = parts[0];
  const cells = parts.slice(1);
  const numericCells = cells.filter((c) => NUM.test(c));
  if (numericCells.length === 0) return null;
  // Label must not itself be just a number.
  if (/^[0-9.,\s]+$/.test(label)) return null;
  return { label, cells };
}

/** Parse a numeric cell like "406 kcal", "9.1g", "<0.1", "Nil". */
export function parseCell(cell: string): { value: number; unit: string | null } | null {
  const t = cell.trim();
  if (/^(nil|not detected|traces?)$/i.test(t)) return { value: 0, unit: null };
  const m = t.match(/([0-9]+(?:[.,][0-9]+)?)/);
  if (!m) return null;
  const value = parseFloat(m[1].replace(',', '.'));
  if (isNaN(value)) return null;
  // Unit may be glued to the digit (910mg) or separated (406 kcal).
  const unitMatch = t.match(/[0-9]\s*(kcal|k\s*j|mg|mcg|µg|ug|g)\b/i);
  const unit = unitMatch
    ? unitMatch[1].toLowerCase().replace(' ', '').replace('µ', 'u')
    : null;
  return { value, unit };
}

const NUTRIENT_ROW_PATTERNS: { re: RegExp; keys: string[] }[] = [
  { re: /^(total\s*)?energy|^energy\b/i, keys: ['calories', 'energyKj'] },
  { re: /^protein\b/i, keys: ['protein'] },
  { re: /^(total\s*)?fat\b(?!.*saturated)(?!.*trans)/i, keys: ['totalFat'] },
  { re: /^saturated\s*fat|^sat(\.|urated)?\s*fat/i, keys: ['saturatedFat'] },
  { re: /^trans\s*fat/i, keys: ['transFat'] },
  { re: /^cholesterol/i, keys: ['cholesterol'] },
  { re: /^sodium\b/i, keys: ['sodium'] },
  { re: /^salt\b/i, keys: ['salt'] },
  { re: /^(total\s*)?carbohyd/i, keys: ['totalCarbs'] },
  { re: /^dietary\s*(fibre|fib)|^fib(re|er)\b/i, keys: ['dietaryFiber'] },
  { re: /^(total\s*)?sugars?\b(?!.*added)/i, keys: ['totalSugars'] },
  { re: /^added\s*sugars?\b/i, keys: ['addedSugars'] },
];

export function matchNutrientRow(label: string): string | null {
  for (const { re, keys } of NUTRIENT_ROW_PATTERNS) {
    if (re.test(label)) return keys[0];
  }
  return null;
}

/**
 * Parse a full OCR text block into a structured nutrition table.
 */
export function parseNutritionTable(text: string): NutritionTable {
  const lines = (text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim().length > 0);

  // 1. Find a header line announcing the bases.
  let headerIdx = -1;
  let bases: TableBasis[] = [];
  let rawHeader: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const found = detectHeaderBases(lines[i]);
    if (found) {
      headerIdx = i;
      bases = found;
      rawHeader = lines[i].trim();
      break;
    }
  }

  if (headerIdx === -1) {
    return { detected: false, bases: [], rows: [], rawHeader: null };
  }

  // 2. Parse rows after the header until a non-table line.
  const rows: TableRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    // Stop at ingredient sections / allergen lines.
    if (/^(ingredients?|contains|allergy|may contain|storage|address|marketed)/i.test(line.trim())) {
      // ingredient lists can follow; stop table parsing but don't consume
      break;
    }
    const split = splitTableRow(line);
    if (!split) {
      // Single-column rows after a header are uncommon; tolerate 1 blank-ish line.
      if (line.trim().length < 3) continue;
      if (rows.length === 0) continue; // header noise
      continue;
    }
    const nutrient = matchNutrientRow(split.label);
    if (!nutrient) continue;
    const values: TableRow['values'] = [];
    split.cells.forEach((cell, colIdx) => {
      const parsed = parseCell(cell);
      if (!parsed) return;
      const basis = bases[colIdx] ?? bases[bases.length - 1];
      values.push({ basis, value: parsed.value, unit: parsed.unit });
    });
    if (values.length > 0) {
      rows.push({ label: split.label, values });
    }
  }

  return { detected: rows.length > 0, bases, rows, rawHeader };
}

export interface BasisResolvedNutrition {
  /** values normalized to per-100g where possible, with their original basis */
  values: Record<string, { value: number; unit: string | null; basis: TableBasis }>;
  basis: TableBasis | null;
}

/**
 * Resolve the parsed table into nutrient values, preferring per-100g column.
 * Returns null-keyed "missing" only for nutrients actually absent.
 */
export function resolveBasis(table: NutritionTable): BasisResolvedNutrition {
  const out: BasisResolvedNutrition['values'] = {};
  if (!table.detected) return { values: out, basis: null };

  const priority: TableBasis[] = ['per_100g', 'per_serving', 'per_package'];
  let chosenBasis: TableBasis | null = null;
  for (const b of priority) {
    if (table.bases.includes(b)) {
      chosenBasis = b;
      break;
    }
  }

  for (const row of table.rows) {
    let nutrient = matchNutrientRow(row.label);
    if (!nutrient) continue;
    let chosen = row.values.find((v) => v.basis === chosenBasis);
    if (!chosen) chosen = row.values[0];
    // An Energy row printed only in kJ is energy in kilojoules — map it to
    // energyKj, never silently treated as kcal.
    if (nutrient === 'calories' && row.values.length > 0 && row.values.every((v) => v.unit === 'kj')) {
      nutrient = 'energyKj';
    }
    out[nutrient] = { value: chosen.value, unit: chosen.unit, basis: chosen.basis };
  }
  return { values: out, basis: chosenBasis };
}
