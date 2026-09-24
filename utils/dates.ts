import type { ExpiryStatus } from "@/types/product";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MON =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?![a-z])";
const SEP = "\\s*[./-]\\s*";
const ORD = "(?:st|nd|rd|th)?";

type DateParts = { y: number; m: number; d?: number }; // no day = month-only date

const monthOf = (name: string) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
const yearOf = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

// Every date layout printed on packs. Month-only dates resolve to the month's
// last day. "Weak" layouts are too easy to confuse with prices, weights, or
// batch codes, so label scanning only trusts them right after an EXP/MFD word.
const FORMATS: { rx: RegExp; weak?: (g: RegExpMatchArray) => boolean; get: (g: RegExpMatchArray) => DateParts }[] = [
  // 2027-02-04, 2027/02/04
  {
    rx: new RegExp(`(?<!\\d)((?:19|20)\\d{2})${SEP}(\\d{1,2})${SEP}(\\d{1,2})(?!\\d)`, "gi"),
    get: (g) => ({ y: +g[1], m: +g[2], d: +g[3] })
  },
  // 04/02/2027, 04.02.27, 04 - 02 - 2027; month-first (12/31/2026) only when unambiguous
  {
    rx: new RegExp(`(?<!\\d)(\\d{1,2})${SEP}(\\d{1,2})${SEP}(\\d{4}|\\d{2})(?!\\d)`, "gi"),
    get: (g) =>
      +g[2] > 12 && +g[1] <= 12
        ? { y: yearOf(g[3]), m: +g[1], d: +g[2] }
        : { y: yearOf(g[3]), m: +g[2], d: +g[1] }
  },
  // 04 Feb 2027, 04-FEB-27, 04FEB27, 5th Feb, 2027
  {
    rx: new RegExp(`(?<!\\d)(\\d{1,2})${ORD}[\\s./-]*${MON}[\\s.,/'-]*(\\d{4}|\\d{2})(?!\\d)`, "gi"),
    get: (g) => ({ y: yearOf(g[3]), m: monthOf(g[2]), d: +g[1] })
  },
  // Feb 4, 2027 / FEB 04 2027
  {
    rx: new RegExp(`(?<![a-z])${MON}\\.?\\s*(\\d{1,2})${ORD}\\s*,?\\s*(\\d{4})(?!\\d)`, "gi"),
    get: (g) => ({ y: +g[3], m: monthOf(g[1]), d: +g[2] })
  },
  // FEB 2027, Feb-27, FEB'27, FEB27
  {
    rx: new RegExp(`(?<![a-z])${MON}[\\s./'-]*(\\d{4}|\\d{2})(?!\\d)`, "gi"),
    get: (g) => ({ y: yearOf(g[2]), m: monthOf(g[1]) })
  },
  // 2027 FEB
  {
    rx: new RegExp(`(?<!\\d)((?:19|20)\\d{2})[\\s./-]*${MON}`, "gi"),
    get: (g) => ({ y: +g[1], m: monthOf(g[2]) })
  },
  // 02/2027, 02-27, 12.26 — but not ₹5.00, 1.25 kg, or the tail of 31/02/2027
  {
    rx: new RegExp(
      `(?<!(?:₹|\\brs|\\binr|\\bmrp|\\$)\\.?\\s*)(?<!\\d\\s*[./-]\\s*)(?<!\\d)(\\d{1,2})\\s*([./-])\\s*(\\d{4}|\\d{2})(?!\\d)` +
        `(?!\\s*(?:[./-]\\s*\\d|%|kg|gm?|mg|ml|l|ltr|kcal|kj|cm|mm)(?![a-z]))`,
      "gi"
    ),
    weak: (g) => g[2] === "." || g[3].length === 2,
    get: (g) => ({ y: yearOf(g[3]), m: +g[1] })
  },
  // Stamped without separators: 040227, 04022027, 20270204
  {
    rx: /(?<!\d)(\d{8}|\d{6})(?!\d)/g,
    weak: () => true,
    get: ([, s]) => {
      const ymd = { y: +s.slice(0, 4), m: +s.slice(4, 6), d: +s.slice(6) };
      if (s.length === 8 && toDate(ymd)) return ymd;
      return { y: yearOf(s.slice(4)), m: +s.slice(2, 4), d: +s.slice(0, 2) };
    }
  }
];

function toDate({ y, m, d }: DateParts): Date | null {
  if (y < 1990 || y > 2099 || m < 1 || m > 12) return null;
  const day = d ?? new Date(y, m, 0).getDate();
  const date = new Date(y, m - 1, day, 12, 0, 0);
  return date.getMonth() === m - 1 && date.getDate() === day ? date : null;
}

export type DateHit = { at: number; end: number; date: Date; weak: boolean };

// All dates in `text`, in reading order. Where layouts overlap the longest
// match wins, so "04/02/2027" never also yields "04/02" or "02/2027".
export function findDateHits(text: string): DateHit[] {
  const fixed = fixOcrErrors(text);
  const hits: DateHit[] = [];
  for (const format of FORMATS) {
    for (const g of fixed.matchAll(format.rx)) {
      const date = toDate(format.get(g));
      if (date) {
        hits.push({ at: g.index!, end: g.index! + g[0].length, date, weak: format.weak?.(g) ?? false });
      }
    }
  }
  hits.sort((a, b) => a.at - b.at || b.end - a.end);
  const result: DateHit[] = [];
  for (const hit of hits) {
    if (!result.length || hit.at >= result[result.length - 1].end) result.push(hit);
  }
  return result;
}

export function parseProductDate(value?: string | null): Date | null {
  return value ? findDateHits(value)[0]?.date ?? null : null;
}

/**
 * Fix common OCR character confusions in dates ("0CT" → "OCT", "2l" → "21",
 * "O5" → "05"). One-for-one replacements, so string positions don't shift.
 */
export function fixOcrErrors(text: string): string {
  return text
    .replace(/(?<![a-z])0(?=ct(?![a-z]))/gi, "O")
    .replace(/(?<=n)0(?=v(?![a-z]))/gi, "O")
    .replace(/(?<=\d)[lI](?=[\d./-])|(?<![A-Za-z])[lI](?=\d)/g, "1")
    .replace(/(?<=\d)O(?=[\d./-])|(?<![A-Za-z])O(?=\d)/g, "0");
}

/**
 * Result of validating the chronological relationship between MFG and EXP dates.
 * Used for UI feedback — metadata flags are not persisted.
 */
export type DateValidationResult = {
  mfdDate: string | null;
  expiryDate: string | null;
  wasSwapped: boolean;
  sameDates: boolean;
  missingExpiry: boolean;
  unrealisticRange: boolean;
};

/**
 * Validate and correct the chronological relationship between MFG and EXP dates.
 * If MFG > EXP, auto-swaps. Flags edge cases for UI warnings.
 */
export function validateAndCorrectDates(
  mfdDate: string | null,
  expiryDate: string | null
): DateValidationResult {
  const result: DateValidationResult = {
    mfdDate,
    expiryDate,
    wasSwapped: false,
    sameDates: false,
    missingExpiry: !expiryDate,
    unrealisticRange: false,
  };

  const parsedMfd = parseProductDate(mfdDate);
  const parsedExp = parseProductDate(expiryDate);

  // If either date is missing or unparseable, return as-is with flags
  if (!parsedMfd || !parsedExp) {
    return result;
  }

  // Normalize to midnight for comparison
  const mfdTime = new Date(parsedMfd.getFullYear(), parsedMfd.getMonth(), parsedMfd.getDate()).getTime();
  const expTime = new Date(parsedExp.getFullYear(), parsedExp.getMonth(), parsedExp.getDate()).getTime();

  // Same dates — suspicious
  if (mfdTime === expTime) {
    result.sameDates = true;
    return result;
  }

  // MFG is after EXP — swap them
  if (mfdTime > expTime) {
    result.mfdDate = expiryDate;
    result.expiryDate = mfdDate;
    result.wasSwapped = true;
  }

  // Check for unrealistic range (> 10 years ≈ 3650 days)
  const correctedMfd = parseProductDate(result.mfdDate);
  const correctedExp = parseProductDate(result.expiryDate);
  if (correctedMfd && correctedExp) {
    const diffDays = Math.abs(correctedExp.getTime() - correctedMfd.getTime()) / 86400000;
    if (diffDays > 3650) {
      result.unrealisticRange = true;
    }
  }

  return result;
}

export function daysUntil(value?: string | null): number | null {
  const parsed = parseProductDate(value);
  if (!parsed) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Clone before mutating so we never corrupt the Date returned by parseProductDate.
  const date = new Date(parsed.getTime());
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}

// Single source of truth for expiry status (kept in sync with backend/ocr/parser.py).
// Traffic light: no date -> safe, past date -> expired (red), within a week -> near (amber), else safe (green).
export function statusFromExpiry(value?: string | null): ExpiryStatus {
  const days = daysUntil(value);
  if (days === null) return "safe";
  if (days < 0) return "expired";
  if (days <= 7) return "near_expiry";
  return "safe";
}

export function freshnessPercent(value?: string | null): number {
  const days = daysUntil(value);
  if (days === null || days <= 0) return 0;
  return Math.max(4, Math.min(100, Math.round((days / 60) * 100)));
}

// Friendly weekday for a date in the next week ("Tue"), so users don't have to
// decode a raw "28/06/2026". Returns null outside the 0-6 day window.
export function upcomingWeekday(value?: string | null, locale = "en"): string | null {
  const days = daysUntil(value);
  if (days === null || days < 0 || days > 6) return null;
  const date = parseProductDate(value);
  if (!date) return null;
  return date.toLocaleDateString(locale === "hi" ? "hi-IN" : "en-US", { weekday: "short" });
}

export function formatDateForInput(value?: string | null): string {
  const date = parseProductDate(value);
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function fromDateInput(value: string): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
