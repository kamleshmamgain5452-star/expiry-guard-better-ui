import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { groqChat, GROQ_VISION_MODEL } from "@/lib/groq";
import type {
  IodineApiResult,
  IodineIntensity,
  PurityVerdict
} from "@/types/product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOOD_LABEL: Record<string, string> = {
  milk: "milk",
  ghee: "ghee (clarified butter)",
  other: "a food sample"
};

function systemPrompt(food: string): string {
  const label = FOOD_LABEL[food] || FOOD_LABEL.other;
  return `You analyze a photograph of ${label} after an iodine (Lugol's) starch test.

Chemistry: iodine reacts with STARCH to turn dark blue / blue-black / dark purple.
With NO starch, iodine stays amber / brown / yellow-orange (no darkening).
For this food, starch is an ADULTERANT, so a blue-black reaction means adulteration.

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
- verdict "adulterated" when starchPresent is true; "pure" when clearly no starch (amber/brown).`;
}

const INTENSITIES: IodineIntensity[] = ["none", "trace", "moderate", "high"];
const VERDICTS: PurityVerdict[] = ["pure", "adulterated", "inconclusive"];

function coerceResult(raw: unknown): IodineApiResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const intensity = INTENSITIES.includes(o.intensity as IodineIntensity)
    ? (o.intensity as IodineIntensity)
    : "none";
  let verdict = VERDICTS.includes(o.verdict as PurityVerdict)
    ? (o.verdict as PurityVerdict)
    : "inconclusive";
  const starchPresent = o.starchPresent === true;

  // Keep verdict and starchPresent consistent.
  if (starchPresent && verdict === "pure") verdict = "adulterated";

  let confidence = typeof o.confidence === "number" ? o.confidence : 0.5;
  confidence = Math.max(0, Math.min(1, confidence));

  const colorHex =
    typeof o.colorHex === "string" && /^#?[0-9a-fA-F]{6}$/.test(o.colorHex)
      ? o.colorHex.startsWith("#")
        ? o.colorHex
        : `#${o.colorHex}`
      : "#b8860b";

  return {
    starchPresent,
    intensity,
    colorHex,
    colorName:
      typeof o.colorName === "string" && o.colorName ? o.colorName.slice(0, 40) : "unclear",
    verdict,
    confidence,
    note:
      typeof o.note === "string" && o.note
        ? o.note.slice(0, 200)
        : "Result could not be determined clearly."
  };
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const imageFile = form.get("image") as File | null;
    const food = ((form.get("food") as string) || "other").trim();

    if (!imageFile) {
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }

    // Downscale + compress to keep token/latency cost low.
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const jpeg = await sharp(buffer)
      .rotate()
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    const base64 = jpeg.toString("base64");

    const payload = {
      model: GROQ_VISION_MODEL,
      messages: [
        { role: "system", content: systemPrompt(food) },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this iodine starch-test photo. Return JSON only."
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64}` }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    };

    let content = await groqChat(payload);
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Model returned prose — surface an inconclusive result rather than 500.
      return NextResponse.json(
        coerceResult({ verdict: "inconclusive", confidence: 0.2 })
      );
    }

    return NextResponse.json(coerceResult(parsed));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
