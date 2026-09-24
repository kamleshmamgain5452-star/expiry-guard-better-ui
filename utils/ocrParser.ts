import { findDateHits, fixOcrErrors, parseProductDate, statusFromExpiry, validateAndCorrectDates } from "@/utils/dates";

export type StructuredOcrData = {
  all_text?: string[];
  expiry_date?: string | null;
  mfd_date?: string | null;
  product_name?: string | null;
  barcode?: string | null;
  batch_number?: string | null;
  confidence?: number;
  mfd_missing_for_duration?: boolean;
};

export type ExpiryStatus = "safe" | "near_expiry" | "expired";

export type ScanResult = {
  product_name: string;
  expiry_date: string | null;
  mfd_date: string | null;
  barcode: string | null;
  batch_number: string | null;
  confidence: number;
  status: ExpiryStatus;
  raw_text?: string[];
  mfd_missing_for_duration?: boolean;
};

// Label words that introduce an expiry or a manufacture/pack date. Whole words
// only, so "Exported" or "Product" never count as a date label.
const EXP_KEYWORDS =
  /\b(?:exp(?:iry|iration|ires?|y)?|best\s*before|bb|b\.b|use\s*(?:by|before)|consume\s*(?:by|before)|valid\s*(?:up\s*to|upto|till|until)|sell\s*by)(?![a-z])|समाप्ति|समाप्त|उपयोग/gi;
const MFD_KEYWORDS =
  /\b(?:mfd|mfg|mfgd|manufactur(?:ed|ing|e)|pkd|pkg|packed|packing|packaging|prod(?:uction|uced)?|dom)(?![a-z])|निर्माण|पैक/gi;

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, eighteen: 18, twenty: 20, "twenty four": 24, thirty: 30, "thirty six": 36
};
const NUMBER_WORD_PATTERN = Object.keys(NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .map((w) => w.replace(" ", "[\\s-]*"))
  .join("|");
const DURATION = new RegExp(
  `\\b(\\d{1,3}|${NUMBER_WORD_PATTERN})\\s*-?\\s*(days?|weeks?|wks?|months?|mths?|mons?|years?|yrs?)(?![a-z])`,
  "gi"
);
// Sentence breaks, but not abbreviations: "Exp. 12 months" stays one clause.
const CLAUSE_BREAK = /[;\n]|\.(?=\s+[A-Z])/g;
// "... from the date of packaging", "... after mfg", "... of manufacture"
const FROM_MANUFACTURE = /^\s*(?:from|after|of)\s+(?:the\s+)?(?:date\s+of\s+)?(?:mfg|mfd|manuf\w*|pack\w*|pkd|pkg|prod\w*)/i;

type Duration = { n: number; unit: "days" | "weeks" | "months" | "years" };
type Keyword = { at: number; end: number; line: number; kind: "exp" | "mfd"; used: boolean };
type LabelDates = { expiry: Date | null; mfd: Date | null; duration: Duration | null; unlabeled: Date[] };

const BARCODE_PATTERN = /\b(\d{8,14})\b/;

export function parseOcrResult(
  lines: string[],
  ocrConfidence: number,
  structuredData: StructuredOcrData,
  clientBarcode?: string | null
): ScanResult {
  const normalizedLines = lines
    .map((line) => fixOcrErrors(line).replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);

  // 1. Product Name (prefer structured data, fallback to regex)
  let productName = structuredData.product_name;
  if (!productName || productName.toLowerCase() === "none" || productName.toLowerCase() === "null") {
    productName = extractProductName(normalizedLines) || "Packaged Product";
  }

  // 2. Dates. Trust order: a date printed next to its own label word, then the
  // model's structured fields, then unlabeled dates on the pack.
  const label = scanLabel(normalizedLines);
  const model = scanLabel([
    `EXP: ${structuredData.expiry_date ?? ""}`,
    `MFD: ${structuredData.mfd_date ?? ""}`
  ]);
  const plausible = label.unlabeled.filter(isPlausible);

  let mfd = label.mfd ?? model.mfd;
  let expiry = label.expiry;
  let isRelativeComputed = false;
  const duration = label.duration ?? model.duration;
  if (!expiry && label.duration && mfd) {
    expiry = addDuration(mfd, label.duration);
    isRelativeComputed = true;
  }
  expiry ??= model.expiry;
  if (!expiry && model.duration && mfd) {
    expiry = addDuration(mfd, model.duration);
    isRelativeComputed = true;
  }
  expiry ??= plausible.length ? latest(plausible) : null;
  if (!mfd && expiry) {
    const earlier = plausible.filter((d) => d < expiry!);
    mfd = earlier.length ? earliest(earlier) : null;
  }
  const mfdMissingForDuration = !expiry && !mfd && duration !== null;

  // Validate chronological order — auto-swap if MFG > EXP
  const dateValidation = validateAndCorrectDates(mfd && formatDate(mfd), expiry && formatDate(expiry));
  const mfdDate = dateValidation.mfdDate;
  const expiryDate = dateValidation.expiryDate;

  // 3. Barcodes
  const mergedBarcode =
    cleanBarcode(clientBarcode) || cleanBarcode(structuredData.barcode) || extractBarcode(normalizedLines);

  // 4. Batch Number (prefer structured data)
  let batchNumber = structuredData.batch_number;
  if (!batchNumber || batchNumber.toLowerCase() === "none" || batchNumber.toLowerCase() === "null") {
    batchNumber = null;
  }

  // 5. Confidence
  let confidence = calculateConfidence(ocrConfidence, expiryDate, mfdDate);
  if (isRelativeComputed) {
    confidence = Math.max(confidence, 0.95);
  }

  return {
    product_name: productName,
    expiry_date: expiryDate,
    mfd_date: mfdDate,
    barcode: mergedBarcode,
    batch_number: batchNumber,
    confidence: confidence,
    status: statusFromExpiry(expiryDate),
    raw_text: normalizedLines,
    mfd_missing_for_duration: mfdMissingForDuration
  };
}

/**
 * Pair every date on the label with the label word it belongs to.
 * - A date takes the nearest unused EXP/MFD word before it on its own line
 *   ("MFD 05/08/26 EXP 04/02/27").
 * - Otherwise it takes the first unused word from the two lines above, which
 *   covers table layouts ("MFG DATE  EXP DATE" over "05/08/26  04/02/27").
 * - Weak dates (MM.YY, 040227…) only count directly after a label word.
 * - "Best before 6 months from mfg" is a shelf life, not a date label.
 * Wrongly ordered pairs are fixed later by validateAndCorrectDates' swap.
 */
function scanLabel(lines: string[]): LabelDates {
  const text = lines.join("\n");
  const lineAt = (i: number) => text.slice(0, i).split("\n").length - 1;
  const keywords: Keyword[] = [
    ...[...text.matchAll(EXP_KEYWORDS)].map((m) => ({ m, kind: "exp" as const })),
    ...[...text.matchAll(MFD_KEYWORDS)].map((m) => ({ m, kind: "mfd" as const }))
  ]
    .map(({ m, kind }) => ({ at: m.index!, end: m.index! + m[0].length, line: lineAt(m.index!), kind, used: false }))
    .sort((a, b) => a.at - b.at);

  let duration: Duration | null = null;
  for (const m of text.matchAll(DURATION)) {
    const at = m.index!;
    const end = at + m[0].length;
    const clauseStart = Math.max(0, ...[...text.slice(0, at).matchAll(CLAUSE_BREAK)].map((b) => b.index! + 1));
    const clauseEnd = text.slice(end).search(CLAUSE_BREAK);
    const before = text.slice(clauseStart, at);
    const after = text.slice(end, clauseEnd < 0 ? undefined : end + clauseEnd);
    const fromMfg = after.match(FROM_MANUFACTURE);
    const labelled = before.search(EXP_KEYWORDS) >= 0 || /shelf\s*life|within/i.test(before);
    // "consume within 3 days of opening" is storage advice, not a shelf life.
    if (!fromMfg && !(labelled && !/open/i.test(before + after))) continue;

    const phraseEnd = end + (fromMfg?.[0].length ?? 0);
    for (const k of keywords) {
      if ((k.kind === "exp" && k.at >= clauseStart && k.at < at) || (k.at >= end && k.at < phraseEnd)) k.used = true;
    }
    duration ??= { n: numberOf(m[1]), unit: unitOf(m[2]) };
  }

  let expiry: Date | null = null;
  let mfd: Date | null = null;
  const unlabeled: Date[] = [];
  for (const hit of findDateHits(text)) {
    const line = lineAt(hit.at);
    const open = keywords.filter(
      (k) => !k.used && k.at < hit.at && k.line >= line - 2 && (k.kind === "exp" ? !expiry : !mfd)
    );
    const sameLine = open.filter((k) => k.line === line);
    let keyword: Keyword | undefined = sameLine.length ? sameLine[sameLine.length - 1] : open[0];
    if (hit.weak && keyword && !(keyword.line === line && /^\D{0,12}$/.test(text.slice(keyword.end, hit.at)))) {
      keyword = undefined;
    }
    if (keyword) {
      keyword.used = true;
      if (keyword.kind === "exp") expiry = hit.date;
      else mfd = hit.date;
    } else if (!hit.weak) {
      unlabeled.push(hit.date);
    }
  }

  return { expiry, mfd, duration, unlabeled };
}

// Called again from the scan result screen once the user fills in a missing MFD.
export function parseRelativeExpiry(
  lines: string[],
  mfdDate: string | null
): { expiryDate: string | null; mfdMissingForDuration: boolean } {
  const { duration } = scanLabel(lines.map(fixOcrErrors));
  if (!duration) return { expiryDate: null, mfdMissingForDuration: false };
  const mfd = parseProductDate(mfdDate);
  if (!mfd) return { expiryDate: null, mfdMissingForDuration: true };
  return { expiryDate: formatDate(addDuration(mfd, duration)), mfdMissingForDuration: false };
}

// Month/year shelf lives keep month-end dates at month end (31 Jan + 1 month = 28 Feb).
function addDuration(mfd: Date, { n, unit }: Duration): Date {
  const y = mfd.getFullYear();
  if (unit === "days" || unit === "weeks") {
    return new Date(y, mfd.getMonth(), mfd.getDate() + n * (unit === "weeks" ? 7 : 1), 12);
  }
  const month = mfd.getMonth() + n * (unit === "years" ? 12 : 1);
  const lastDay = (m: number) => new Date(y, m + 1, 0).getDate();
  const day = mfd.getDate() === lastDay(mfd.getMonth()) ? lastDay(month) : Math.min(mfd.getDate(), lastDay(month));
  return new Date(y, month, day, 12);
}

function numberOf(value: string): number {
  return NUMBER_WORDS[value.toLowerCase().replace(/[\s-]+/, " ")] ?? parseInt(value, 10);
}

function unitOf(value: string): Duration["unit"] {
  const u = value[0].toLowerCase();
  return u === "d" ? "days" : u === "w" ? "weeks" : u === "y" ? "years" : "months";
}

// Unlabeled dates far from today are more likely batch codes or misreads.
function isPlausible(date: Date): boolean {
  const year = new Date().getFullYear();
  return date.getFullYear() >= year - 10 && date.getFullYear() <= year + 15;
}

const latest = (dates: Date[]) => dates.reduce((a, b) => (b > a ? b : a));
const earliest = (dates: Date[]) => dates.reduce((a, b) => (b < a ? b : a));

function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

export function extractBarcode(lines: string[]): string | null {
  for (const line of lines) {
    const match = line.replace(/\s+/g, "").match(BARCODE_PATTERN);
    if (match) return match[1];
  }
  return null;
}

export function cleanBarcode(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

export function extractProductName(lines: string[]): string | null {
  for (const line of lines.slice(0, 8)) {
    const clean = line.replace(/[^0-9A-Za-zऀ-ॿ &+.\-]/g, " ").trim().replace(/\s+/g, " ");
    if (!clean || clean.length < 3 || clean.length > 48) {
      continue;
    }
    if (clean.search(EXP_KEYWORDS) >= 0 || clean.search(MFD_KEYWORDS) >= 0) {
      continue;
    }
    if (findDateHits(clean).length > 0 || cleanBarcode(clean) !== null) {
      continue;
    }
    const isUpper = clean === clean.toUpperCase() && clean !== clean.toLowerCase();
    return isUpper ? titleCase(clean) : clean;
  }
  return null;
}

export function calculateConfidence(
  ocrConfidence: number,
  expiryDate: string | null,
  mfdDate: string | null
): number {
  let score = Math.max(0.0, Math.min(1.0, ocrConfidence));
  if (expiryDate) {
    score += 0.08;
  } else {
    score -= 0.22;
  }
  if (mfdDate) {
    score += 0.04;
  }
  return Math.round(Math.max(0.0, Math.min(0.99, score)) * 100) / 100;
}

function titleCase(str: string): string {
  return str.toLowerCase().split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
