import sharp from "sharp";
import type {
  IodineApiResult,
  IodineIntensity,
  PhCategory
} from "@/types/product";

export type ColorEvidence = {
  hex: string;
  hue: number;
  saturation: number;
  value: number;
};

type StarchColour = "reaction" | "no_reaction" | "unknown";

function toHexByte(value: number): string {
  return Math.round(value).toString(16).padStart(2, "0");
}

// Average colour of the central box of the (already viewfinder-cropped) photo.
export async function measureCenterColour(jpeg: Buffer): Promise<ColorEvidence | null> {
  try {
    const { data, info } = await sharp(jpeg)
      .resize(96, 96, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const x0 = Math.floor(info.width * 0.25);
    const x1 = Math.ceil(info.width * 0.75);
    const y0 = Math.floor(info.height * 0.25);
    const y1 = Math.ceil(info.height * 0.75);
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const offset = (y * info.width + x) * info.channels;
        r += data[offset];
        g += data[offset + 1];
        b += data[offset + 2];
        count++;
      }
    }
    if (!count) return null;
    r /= count;
    g /= count;
    b /= count;

    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;
    let hue = 0;
    if (delta > 0) {
      if (max === rn) hue = 60 * (((gn - bn) / delta) % 6);
      else if (max === gn) hue = 60 * ((bn - rn) / delta + 2);
      else hue = 60 * ((rn - gn) / delta + 4);
    }
    if (hue < 0) hue += 360;

    return {
      hex: `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`,
      hue,
      saturation: max === 0 ? 0 : delta / max,
      value: max
    };
  } catch {
    return null;
  }
}

// Iodine turns blue / violet / blue-black with starch (light lavender for a
// trace in milk) and otherwise keeps its own yellow → amber → red-brown tint.
// Grey, white, black, and green frames can't be read either way.
function measuredStarchColour(evidence: ColorEvidence | null): StarchColour {
  if (!evidence || evidence.value < 0.06) return "unknown";
  const { hue, saturation } = evidence;
  if (hue >= 185 && hue <= 330 && saturation >= 0.12) return "reaction";
  if (hue <= 75 && saturation >= 0.1) return "no_reaction";
  return "unknown";
}

// Universal-indicator hue bands, in degrees. Strong acid (red) wraps past 360.
const PH_BANDS: Record<Exclude<PhCategory, "unknown">, [number, number]> = {
  strong_acidic: [345, 375],
  weak_acidic: [15, 65],
  neutral: [65, 170],
  weak_alkaline: [170, 265],
  strong_alkaline: [265, 345]
};
// Near a band edge the photo alone can't separate neighbours (yellow vs
// yellow-green), so the model's reading is accepted this far past its band.
const PH_HUE_TOLERANCE = 12;

function phColourFits(category: PhCategory, evidence: ColorEvidence | null): boolean {
  if (category === "unknown" || !evidence || evidence.value < 0.12 || evidence.saturation < 0.1) {
    return false;
  }
  const [from, to] = PH_BANDS[category];
  const start = from - PH_HUE_TOLERANCE;
  return (((evidence.hue - start) % 360) + 360) % 360 < to - start + PH_HUE_TOLERANCE;
}

export function systemPrompt(food: string): string {
  if (food === "other") {
    return `You analyze a photograph of a food sample mixed with UNIVERSAL INDICATOR solution for an approximate pH colour reading.

Use only the indicator-treated region. Standard approximate colours are:
- red: strongly acidic (about pH 1-3)
- orange/yellow: weakly acidic (about pH 4-6)
- green: near neutral (about pH 7)
- blue: weakly alkaline (about pH 8-10)
- violet/purple: strongly alkaline (about pH 11-14)

The food's own colour, lighting, indicator brand, concentration, and camera white balance can change the appearance. This image cannot determine purity, adulteration, spoilage, edibility, or safety.

Return ONLY a JSON object, no markdown:
{
  "phCategory": "strong_acidic" | "weak_acidic" | "neutral" | "weak_alkaline" | "strong_alkaline" | "unknown",
  "colorHex": "#rrggbb",
  "colorName": "short plain colour name",
  "confidence": number between 0 and 1
}

Rules:
- Use "unknown" with confidence below 0.6 if the treated area is unclear, uneven, poorly lit, or dominated by the food's natural colour.
- Report only an approximate indicator colour category. Never call the food pure, adulterated, spoiled, edible, or safe.`;
  }

  return `You analyze a photograph of a MILK sample after an iodine/Lugol's starch screening test.

Chemistry: iodine reacts with STARCH to turn dark blue / blue-black / dark purple.
With NO starch, iodine stays amber / brown / yellow-orange (no darkening).
This is only a visual screen for a possible starch reaction. It cannot establish the milk's overall purity, quality, or safety.

Examine the dominant colour of the sample. Respond with ONLY a JSON object, no markdown:
{
  "starchPresent": boolean,
  "intensity": "none" | "trace" | "moderate" | "high",
  "colorHex": "#rrggbb",
  "colorName": "short plain colour name e.g. amber, dark blue-black",
  "verdict": "pure" | "adulterated" | "inconclusive",
  "confidence": number between 0 and 1,
  "note": "one short plain sentence explaining the result"
}

Rules:
- starchPresent is true ONLY if a clear blue / black / dark-purple shift is visible.
- If lighting is poor, the sample is unclear, or you cannot tell, use verdict "inconclusive" with low confidence.
- Use verdict "adulterated" only as the internal code when a starch reaction is visible.
- Use verdict "pure" only as the internal code when no starch reaction is visible.
- Never claim the milk is safe, genuine, or fully pure.`;
}

/**
 * Pull the JSON object out of a model reply. Tolerates reasoning tags, code
 * fences, surrounding prose, trailing commas, and single-quoted keys/strings.
 * Returns null when there is no usable object.
 */
export function parseModelJson(content: string): Record<string, unknown> | null {
  let text = content.replace(/<think>[\s\S]*?<\/think>/gi, "");
  text = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  text = text.slice(start, end + 1);
  for (const candidate of [text, text.replace(/,\s*([}\]])/g, "$1").replace(/'/g, '"')]) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      // try the repaired candidate next
    }
  }
  return null;
}

const lower = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const text = lower(value);
  return text === "true" || text === "yes" ? true : text === "false" || text === "no" ? false : null;
}

// Accepts 0.82, "0.82", 82, or "82%"; clamps to [0, max].
function asConfidence(value: unknown, fallback: number, max: number): number {
  let n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) n = fallback;
  if (n > 1 && n <= 100) n /= 100;
  return Math.max(0, Math.min(max, n));
}

// "Weakly Acidic", "slightly basic", "neutral (pH 7)" → the enum value.
function asPhCategory(value: unknown): PhCategory {
  const text = lower(value);
  const strong = /strong|very|highly/.test(text);
  if (/neutral/.test(text)) return "neutral";
  if (/acid/.test(text)) return strong ? "strong_acidic" : "weak_acidic";
  if (/alkal|basic|base/.test(text)) return strong ? "strong_alkaline" : "weak_alkaline";
  return "unknown";
}

function asHex(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#?[0-9a-fA-F]{6}$/.test(value)
    ? value.startsWith("#") ? value : `#${value}`
    : fallback;
}

const INTENSITIES: IodineIntensity[] = ["none", "trace", "moderate", "high"];

// Darker reaction colour ≈ more starch; used when the model gives no level.
function measuredIntensity(evidence: ColorEvidence | null): IodineIntensity {
  if (!evidence) return "moderate";
  return evidence.value < 0.3 ? "high" : evidence.value < 0.6 ? "moderate" : "trace";
}

export function coerceStarchResult(
  raw: unknown,
  evidence: ColorEvidence | null
): IodineApiResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  // The model's reading, from starchPresent and/or verdict. Contradictory or
  // explicitly inconclusive answers count as no reading.
  const present = asBoolean(o.starchPresent);
  const verdictSays = { adulterated: true, pure: false }[lower(o.verdict)] ?? null;
  const reading =
    lower(o.verdict) === "inconclusive" || (present !== null && verdictSays !== null && present !== verdictSays)
      ? null
      : present ?? verdictSays;

  let confidence = asConfidence(o.confidence, 0.5, 0.95);

  // A definite verdict needs a confident model AND a photo colour that agrees.
  const measured = measuredStarchColour(evidence);
  const agreed =
    reading !== null && confidence >= 0.65 && measured === (reading ? "reaction" : "no_reaction");
  if (!agreed) confidence = Math.min(confidence, 0.45);
  const verdict = !agreed ? "inconclusive" : reading ? "adulterated" : "pure";

  const modelIntensity = INTENSITIES.find((i) => i === lower(o.intensity) && i !== "none");
  const intensity: IodineIntensity =
    verdict === "adulterated" ? modelIntensity ?? measuredIntensity(evidence) : "none";

  return {
    testKind: "starch",
    starchPresent: verdict === "adulterated",
    intensity,
    colorHex: evidence?.hex || asHex(o.colorHex, "#b8860b"),
    colorName:
      typeof o.colorName === "string" && o.colorName ? o.colorName.slice(0, 40) : "unclear",
    verdict,
    confidence,
    note:
      verdict === "adulterated"
        ? "A blue-black colour reaction consistent with starch was detected."
        : verdict === "pure"
        ? "No blue-black starch reaction was detected in this image."
        : "The image is not clear enough to assess the starch reaction reliably."
  };
}

const PH_RANGES: Record<PhCategory, string> = {
  strong_acidic: "1–3",
  weak_acidic: "4–6",
  neutral: "about 7",
  weak_alkaline: "8–10",
  strong_alkaline: "11–14",
  unknown: "unknown"
};

export function coercePhResult(
  raw: unknown,
  evidence: ColorEvidence | null
): IodineApiResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  let confidence = asConfidence(o.confidence, 0.4, 0.9);

  // Report the model's category only when it is confident and the measured
  // indicator colour falls in (or right next to) that category's hue band.
  let phCategory = asPhCategory(o.phCategory);
  if (confidence < 0.6 || !phColourFits(phCategory, evidence)) {
    phCategory = "unknown";
    confidence = Math.min(confidence, 0.45);
  }
  const estimatedPhRange = PH_RANGES[phCategory];

  return {
    testKind: "ph",
    starchPresent: false,
    intensity: "none",
    colorHex: evidence?.hex || asHex(o.colorHex, "#808080"),
    colorName:
      typeof o.colorName === "string" && o.colorName
        ? o.colorName.slice(0, 40)
        : "unclear",
    // pH is not a purity verdict. Keep the legacy field neutral while the UI
    // renders the dedicated pH result fields above.
    verdict: "inconclusive",
    confidence,
    phCategory,
    estimatedPhRange,
    note:
      phCategory === "unknown"
        ? "The indicator colour is not clear enough for a reliable pH estimate."
        : `The indicator colour suggests an approximate pH of ${estimatedPhRange}; this does not determine purity or safety.`
  };
}
