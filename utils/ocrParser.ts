import { statusFromExpiry, validateAndCorrectDates } from "@/utils/dates";

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

const EXPIRY_KEYWORDS = [
  "exp",
  "expiry",
  "expires",
  "best before",
  "use before",
  "use by",
  "valid upto",
  "consume before",
  "समाप्ति",
  "समाप्त",
  "उपयोग",
];

const MFD_KEYWORDS = [
  "mfd",
  "mfg",
  "manufacturing",
  "manufactured",
  "manufacture",
  "pkd",
  "packed",
  "packing",
  "निर्माण",
  "बनाया",
  "पैक",
];

const MONTH_LOOKUP: { [key: string]: number } = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH_PATTERN = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const DATE_PATTERNS = [
  // DD/MM/YYYY, DD-MM-YYYY
  new RegExp("\\b([0-3]?\\d[/-][01]?\\d[/-](?:20)?\\d{2})\\b", "gi"),
  // DD.MM.YYYY
  new RegExp("\\b([0-3]?\\d\\.[01]?\\d\\.(?:20)?\\d{2})\\b", "gi"),
  // DD Mon YYYY, DD MON YY
  new RegExp("\\b([0-3]?\\d\\s+(?:" + MONTH_PATTERN + ")\\s+(?:20)?\\d{2})\\b", "gi"),
  // MM/YYYY, MM-YYYY, MM/YY
  new RegExp("\\b([01]?\\d[/-](?:20)?\\d{2})\\b", "gi"),
  // MON/YY, MON-YYYY, MON.YY, MON YYYY (e.g. OCT/26, Oct-2026, Oct 2026)
  new RegExp("\\b((?:" + MONTH_PATTERN + ")[/\\-.\\s]+(?:20)?\\d{2})\\b", "gi"),
  // MON+YY concatenated without separator (e.g. OCT26, oct2026)
  new RegExp("\\b((?:" + MONTH_PATTERN + ")(?:20)?\\d{2})\\b", "gi"),
  // YYYY/MON, YYYY-Mon (e.g. 2026/OCT, 2026-Oct)
  new RegExp("\\b(20\\d{2}[/\\-.\\s]+(?:" + MONTH_PATTERN + "))\\b", "gi"),
  // MM.YY (e.g. 10.26)
  new RegExp("\\b([01]?\\d\\.(?:20)?\\d{2})\\b", "gi"),
];

const BARCODE_PATTERN = new RegExp("\\b(\\d{8,14})\\b", "g");

/**
 * Pre-process OCR text to fix common character-confusion errors.
 */
function fixOcrText(text: string): string {
  let fixed = text;
  // Fix "0CT" → "OCT" (zero mistaken for O)
  fixed = fixed.replace(/\b0CT\b/g, "OCT");
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

export function parseOcrResult(
  lines: string[],
  ocrConfidence: number,
  structuredData: StructuredOcrData,
  clientBarcode?: string | null
): ScanResult {
  // Pre-process OCR lines for character-confusion fixes
  const normalizedLines = lines
    .map(line => fixOcrText(line.trim()))
    .filter(line => line.length > 0);

  // 1. Product Name (prefer structured data, fallback to regex)
  let productName = structuredData.product_name;
  if (!productName || productName.toLowerCase() === "none" || productName.toLowerCase() === "null") {
    productName = extractProductName(normalizedLines) || "Packaged Product";
  }

  // 2. Dates (prefer structured data, fallback to regex)
  let expiryDate = structuredData.expiry_date;
  if (expiryDate === "none" || expiryDate === "null") expiryDate = null;
  let mfdDate = structuredData.mfd_date;
  if (mfdDate === "none" || mfdDate === "null") mfdDate = null;

  if (!expiryDate || !mfdDate) {
    const [regexExpiry, regexMfd] = extractDates(normalizedLines);
    if (!expiryDate) {
      expiryDate = regexExpiry;
    }
    if (!mfdDate) {
      mfdDate = regexMfd;
    }
  }

  // Normalize formats
  if (expiryDate) {
    const normalized = normalizeDate(expiryDate);
    if (normalized) expiryDate = normalized;
  }
  if (mfdDate) {
    const normalized = normalizeDate(mfdDate);
    if (normalized) mfdDate = normalized;
  }

  // 2.b Support Relative Expiry Durations
  let mfdMissingForDuration = false;
  let isRelativeComputed = false;
  if (!expiryDate) {
    const relative = parseRelativeExpiry(normalizedLines, mfdDate);
    if (relative.expiryDate) {
      expiryDate = relative.expiryDate;
      isRelativeComputed = true;
    } else if (relative.mfdMissingForDuration) {
      mfdMissingForDuration = true;
    }
  }

  // Validate chronological order — auto-swap if MFG > EXP
  const dateValidation = validateAndCorrectDates(mfdDate, expiryDate);
  mfdDate = dateValidation.mfdDate;
  expiryDate = dateValidation.expiryDate;


  // 3. Barcodes
  let mergedBarcode = cleanBarcode(clientBarcode);
  if (!mergedBarcode) {
    mergedBarcode = cleanBarcode(structuredData.barcode);
  }
  if (!mergedBarcode) {
    mergedBarcode = extractBarcode(normalizedLines);
  }

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
    mfd_missing_for_duration: mfdMissingForDuration,
  };
}

export function extractDates(lines: string[]): [string | null, string | null] {
  let expiryDate: string | null = null;
  let mfdDate: string | null = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const nextLine = index + 1 < lines.length ? lines[index + 1] : "";
    const context = `${line} ${nextLine}`;
    const dates = findDates(context);
    if (dates.length === 0) {
      continue;
    }
    const lowered = context.toLowerCase();
    if (expiryDate === null && containsKeyword(lowered, EXPIRY_KEYWORDS)) {
      expiryDate = dates[0];
    }
    if (mfdDate === null && containsKeyword(lowered, MFD_KEYWORDS)) {
      mfdDate = dates[0];
    }
  }

  const allDates = findDates(lines.join(" "));
  const parsedDates: { value: string; date: Date }[] = [];
  for (const val of allDates) {
    const parsed = parseDate(val);
    if (parsed) {
      parsedDates.push({ value: val, date: parsed });
    }
  }

  if (expiryDate === null && parsedDates.length > 0) {
    let maxItem = parsedDates[0];
    for (const item of parsedDates) {
      if (item.date > maxItem.date) {
        maxItem = item;
      }
    }
    expiryDate = maxItem.value;
  }

  if (mfdDate === null && parsedDates.length > 1) {
    let minItem = parsedDates[0];
    for (const item of parsedDates) {
      if (item.date < minItem.date) {
        minItem = item;
      }
    }
    mfdDate = minItem.value;
  }

  return [expiryDate, mfdDate];
}

export function findDates(text: string): string[] {
  const values: string[] = [];
  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const dateStr = match[1];
      const normalized = normalizeDate(dateStr);
      if (normalized && !values.includes(normalized)) {
        values.push(normalized);
      }
    }
  }
  return values;
}

export function normalizeDate(raw: string): string | null {
  // Apply OCR fixes first
  let clean = fixOcrText(raw).replace(/\./g, "/").trim().replace(/\s+/g, " ");

  // 1. Full numeric: DD/MM/YYYY, DD-MM-YYYY
  const numericMatch = clean.match(/^([0-3]?\d)[/-]([01]?\d)[/-]((?:20)?\d{2})$/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1], 10);
    const month = parseInt(numericMatch[2], 10);
    const year = normalizeYear(numericMatch[3]);
    if (isValidDate(year, month, day)) {
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }
    return null;
  }

  // 2. DD Mon YYYY, DD MON YY
  const namedRegex = new RegExp("^([0-3]?\\d)\\s+(" + MONTH_PATTERN + ")\\s+((?:20)?\\d{2})$", "i");
  const namedMatch = clean.match(namedRegex);
  if (namedMatch) {
    const day = parseInt(namedMatch[1], 10);
    const monthStr = namedMatch[2].toLowerCase().substring(0, 3);
    const month = MONTH_LOOKUP[monthStr];
    const year = normalizeYear(namedMatch[3]);
    if (month && isValidDate(year, month, day)) {
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }
    return null;
  }

  // 3. Numeric month/year: MM/YY, MM-YYYY, MM/YYYY
  const monthYearMatch = clean.match(/^([01]?\d)[/-]((?:20)?\d{2})$/);
  if (monthYearMatch) {
    const month = parseInt(monthYearMatch[1], 10);
    const year = normalizeYear(monthYearMatch[2]);
    if (month >= 1 && month <= 12) {
      const lastDay = getDaysInMonth(year, month);
      return `${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }
  }

  // 4. Month-name + year with separator: "OCT/26", "Oct-2026", "Oct 2026", "OCT/26"
  const monthNameYearRegex = new RegExp("^(" + MONTH_PATTERN + ")[/\\-\\s]+((?:20)?\\d{2})$", "i");
  const monthNameYearMatch = clean.match(monthNameYearRegex);
  if (monthNameYearMatch) {
    const monthStr = monthNameYearMatch[1].toLowerCase().substring(0, 3);
    const month = MONTH_LOOKUP[monthStr];
    if (month) {
      const year = normalizeYear(monthNameYearMatch[2]);
      const lastDay = getDaysInMonth(year, month);
      return `${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }
  }

  // 5. Concatenated month-name + year: "oct26", "OCT26", "OCT2026"
  const concatRegex = new RegExp("^(" + MONTH_PATTERN + ")((?:20)?\\d{2})$", "i");
  const concatMatch = clean.match(concatRegex);
  if (concatMatch) {
    const monthStr = concatMatch[1].toLowerCase().substring(0, 3);
    const month = MONTH_LOOKUP[monthStr];
    if (month) {
      const year = normalizeYear(concatMatch[2]);
      const lastDay = getDaysInMonth(year, month);
      return `${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }
  }

  // 6. Year + month-name: "2026 OCT", "2026-Oct", "2026/October"
  const yearMonthRegex = new RegExp("^(20\\d{2})[/\\-\\s]+(" + MONTH_PATTERN + ")$", "i");
  const yearMonthMatch = clean.match(yearMonthRegex);
  if (yearMonthMatch) {
    const monthStr = yearMonthMatch[2].toLowerCase().substring(0, 3);
    const month = MONTH_LOOKUP[monthStr];
    if (month) {
      const year = parseInt(yearMonthMatch[1], 10);
      const lastDay = getDaysInMonth(year, month);
      return `${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }
  }

  return null;
}

export function parseDate(value: string): Date | null {
  const parts = value.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
    return d;
  }
  return null;
}

// statusFromExpiry is imported from @/utils/dates (single source of truth) to avoid
// the status drift that previously existed between this file and the client.

export function extractBarcode(lines: string[]): string | null {
  for (const line of lines) {
    const cleanLine = line.replace(/\s+/g, "");
    BARCODE_PATTERN.lastIndex = 0;
    const match = BARCODE_PATTERN.exec(cleanLine);
    if (match) {
      return match[1];
    }
  }
  return null;
}

export function cleanBarcode(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

export function extractProductName(lines: string[]): string | null {
  const combinedKeywords = [...EXPIRY_KEYWORDS, ...MFD_KEYWORDS];
  for (const line of lines.slice(0, 8)) {
    const clean = line.replace(/[^0-9A-Za-z\u0900-\u097F &+.\-]/g, " ").trim().replace(/\s+/g, " ");
    const lowered = clean.toLowerCase();
    if (!clean || clean.length < 3 || clean.length > 48) {
      continue;
    }
    if (containsKeyword(lowered, combinedKeywords)) {
      continue;
    }
    if (findDates(clean).length > 0 || cleanBarcode(clean) !== null) {
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

function containsKeyword(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword));
}

function normalizeYear(value: string | number): number {
  const year = typeof value === 'string' ? parseInt(value, 10) : value;
  return year < 100 ? 2000 + year : year;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function titleCase(str: string): string {
  return str.toLowerCase().split(' ').map(word => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

export function parseRelativeExpiry(
  lines: string[],
  mfdDate: string | null
): { expiryDate: string | null; mfdMissingForDuration: boolean } {
  const patterns = [
    /(?:best\s+before|shelf\s+life|use\s+within|use\s+before|expires?|valid\s+(?:for|upto)|expiry|exp|use\s+by)\s*:?\s*(\d+)\s*(month|mth|mon|year|yr|day|week)s?\b/i,
    /\b(\d+)\s*(month|mth|mon|year|yr|day|week)s?\s+(?:from|after|of)\s+(?:manufacture|mfg|mfd|pkd|pack|pkg|date\s+of\s+manufacture)\b/i,
    /\b(\d+)\s*(month|mth|mon|year|yr|day|week)s?\b/i
  ];

  let durationValue: number | null = null;
  let durationUnit: string | null = null;

  for (const line of lines) {
    const cleanLine = line.toLowerCase();
    
    let match = cleanLine.match(patterns[0]) || cleanLine.match(patterns[1]);
    if (match) {
      durationValue = parseInt(match[1], 10);
      durationUnit = normalizeUnit(match[2]);
      if (durationUnit) break;
    }

    const contextKeywords = [
      "best before", "shelf life", "use within", "use before", 
      "expires", "valid", "expiry", "exp", "from manufacture", 
      "from packaging", "after packaging", "from mfg"
    ];
    if (contextKeywords.some(kw => cleanLine.includes(kw))) {
      match = cleanLine.match(patterns[2]);
      if (match) {
        durationValue = parseInt(match[1], 10);
        durationUnit = normalizeUnit(match[2]);
        if (durationUnit) break;
      }
    }
  }

  if (!durationValue || !durationUnit) {
    return { expiryDate: null, mfdMissingForDuration: false };
  }

  if (!mfdDate) {
    return { expiryDate: null, mfdMissingForDuration: true };
  }

  const computed = computeExpiryDate(mfdDate, durationValue, durationUnit);
  return { expiryDate: computed, mfdMissingForDuration: false };
}

function normalizeUnit(unitRaw: string): string | null {
  const u = unitRaw.toLowerCase();
  if (["month", "mth", "mon", "months", "mths", "mons"].includes(u)) {
    return "months";
  }
  if (["year", "yr", "years", "yrs"].includes(u)) {
    return "years";
  }
  if (["day", "days"].includes(u)) {
    return "days";
  }
  if (["week", "weeks"].includes(u)) {
    return "weeks";
  }
  return null;
}

function computeExpiryDate(mfdStr: string, value: number, unit: string): string | null {
  const parts = mfdStr.split("/");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (unit === "days") {
    const mfd = new Date(year, month - 1, day);
    mfd.setDate(mfd.getDate() + value);
    return `${String(mfd.getDate()).padStart(2, "0")}/${String(mfd.getMonth() + 1).padStart(2, "0")}/${mfd.getFullYear()}`;
  }
  
  if (unit === "weeks") {
    const mfd = new Date(year, month - 1, day);
    mfd.setDate(mfd.getDate() + value * 7);
    return `${String(mfd.getDate()).padStart(2, "0")}/${String(mfd.getMonth() + 1).padStart(2, "0")}/${mfd.getFullYear()}`;
  }

  if (unit === "months") {
    const totalMonths = (month - 1) + value;
    const targetYear = year + Math.floor(totalMonths / 12);
    const targetMonth = (totalMonths % 12) + 1;

    const origLastDay = new Date(year, month, 0).getDate();
    const targetLastDay = new Date(targetYear, targetMonth, 0).getDate();

    let targetDay = day;
    if (day === origLastDay) {
      targetDay = targetLastDay;
    } else {
      targetDay = Math.min(day, targetLastDay);
    }

    return `${String(targetDay).padStart(2, "0")}/${String(targetMonth).padStart(2, "0")}/${targetYear}`;
  }

  if (unit === "years") {
    const targetYear = year + value;
    const targetMonth = month;

    const origLastDay = new Date(year, month, 0).getDate();
    const targetLastDay = new Date(targetYear, targetMonth, 0).getDate();

    let targetDay = day;
    if (day === origLastDay) {
      targetDay = targetLastDay;
    } else {
      targetDay = Math.min(day, targetLastDay);
    }

    return `${String(targetDay).padStart(2, "0")}/${String(targetMonth).padStart(2, "0")}/${targetYear}`;
  }

  return null;
}
