import type { ExpiryStatus } from "@/types/product";

const monthNames: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11
};

export function parseProductDate(value?: string | null): Date | null {
  if (!value) return null;
  let trimmed = value.trim();
  if (!trimmed) return null;

  // --- OCR error correction pre-pass ---
  trimmed = fixOcrErrors(trimmed);

  // 0. ISO: YYYY-MM-DD (what <input type="date"> and formatDateForInput emit)
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return validDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  // 1. Full numeric: DD/MM/YYYY, DD-MM-YYYY
  const numeric = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    const year = normalizeYear(numeric[3]);
    return validDate(year, month, day);
  }

  // 2. Full dotted: DD.MM.YYYY
  const dotted = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotted) {
    const day = Number(dotted[1]);
    const month = Number(dotted[2]) - 1;
    const year = normalizeYear(dotted[3]);
    return validDate(year, month, day);
  }

  // 3. Numeric month/year: MM/YYYY, MM-YYYY, MM/YY, MM.YY
  const monthYear = trimmed.match(/^(\d{1,2})[/\-.](\d{2,4})$/);
  if (monthYear) {
    const month = Number(monthYear[1]) - 1;
    const year = normalizeYear(monthYear[2]);
    if (month >= 0 && month <= 11) {
      return new Date(year, month + 1, 0, 12, 0, 0); // last day of month
    }
  }

  // 4. Named full: DD Mon YYYY / DD MON YY (e.g. "21 Oct 2026", "21 OCT 26")
  const named = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/);
  if (named) {
    const month = monthNames[named[2].toLowerCase()];
    if (month !== undefined) {
      return validDate(normalizeYear(named[3]), month, Number(named[1]));
    }
  }

  // 5. Month-name + year: "OCT/26", "Oct-2026", "Oct 2026", "October 2026", "OCT.26"
  const monthNameYear = trimmed.match(/^([A-Za-z]+)[/\-.\s]+(\d{2,4})$/);
  if (monthNameYear) {
    const monthKey = monthNameYear[1].toLowerCase();
    const month = monthNames[monthKey] ?? monthNames[monthKey.substring(0, 3)];
    if (month !== undefined) {
      const year = normalizeYear(monthNameYear[2]);
      return new Date(year, month + 1, 0, 12, 0, 0); // last day of month
    }
  }

  // 6. Concatenated month-name + year without separator: "oct26", "OCT26", "OCT2026"
  const concatMonthYear = trimmed.match(/^([A-Za-z]{3,})(\d{2,4})$/);
  if (concatMonthYear) {
    const monthKey = concatMonthYear[1].toLowerCase();
    const month = monthNames[monthKey] ?? monthNames[monthKey.substring(0, 3)];
    if (month !== undefined) {
      const year = normalizeYear(concatMonthYear[2]);
      return new Date(year, month + 1, 0, 12, 0, 0); // last day of month
    }
  }

  // 7. Year + month-name: "2026 OCT", "2026-Oct", "2026/October"
  const yearMonthName = trimmed.match(/^(\d{4})[/\-.\s]+([A-Za-z]+)$/);
  if (yearMonthName) {
    const monthKey = yearMonthName[2].toLowerCase();
    const month = monthNames[monthKey] ?? monthNames[monthKey.substring(0, 3)];
    if (month !== undefined) {
      return new Date(Number(yearMonthName[1]), month + 1, 0, 12, 0, 0);
    }
  }

  return null;
}

/**
 * Fix common OCR character-confusion errors in date strings.
 * E.g. "0CT" → "OCT", "2l" → "21", "I0" → "10"
 */
function fixOcrErrors(text: string): string {
  let fixed = text;
  // Fix "0CT" → "OCT" (zero mistaken for O)
  fixed = fixed.replace(/\b0CT\b/g, "OCT");
  // Fix "0ct" → "oct"
  fixed = fixed.replace(/\b0ct\b/g, "oct");
  // Fix lowercase L mistaken for 1 in numeric context
  fixed = fixed.replace(/(\d)l/g, "$11");
  fixed = fixed.replace(/l(\d)/g, "1$1");
  // Fix uppercase I mistaken for 1 in numeric context
  fixed = fixed.replace(/(\d)I/g, "$11");
  fixed = fixed.replace(/I(\d)/g, "1$1");
  // Fix uppercase O mistaken for 0 in numeric context
  fixed = fixed.replace(/(\d)O/g, "$10");
  fixed = fixed.replace(/O(\d)/g, "0$1");
  // Collapse multiple spaces
  fixed = fixed.replace(/\s+/g, " ").trim();
  return fixed;
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

function normalizeYear(value: string): number {
  const year = Number(value);
  return year < 100 ? 2000 + year : year;
}

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month, day, 12, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}
