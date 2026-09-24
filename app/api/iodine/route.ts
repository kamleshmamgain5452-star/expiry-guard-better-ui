import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { groqChat, GROQ_VISION_MODEL } from "@/lib/groq";
import {
  coercePhResult,
  coerceStarchResult,
  measureCenterColour,
  parseModelJson,
  systemPrompt
} from "@/lib/purity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const imageFile = form.get("image") as File | null;
    const food = ((form.get("food") as string) || "other").trim();

    if (!imageFile) {
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }
    if (food !== "dairy" && food !== "other") {
      return NextResponse.json(
        { error: "Choose a supported test type." },
        { status: 400 }
      );
    }
    if (!imageFile.type.startsWith("image/")) {
      return NextResponse.json({ error: "Upload an image file." }, { status: 400 });
    }
    if (imageFile.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image is too large. Choose an image under 8 MB." },
        { status: 413 }
      );
    }

    // Downscale + compress to keep token/latency cost low.
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    let jpeg: Buffer;
    try {
      jpeg = await sharp(buffer)
        .rotate()
        .resize(800, 800, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch {
      return NextResponse.json(
        { error: "The image could not be read. Choose another photo." },
        { status: 400 }
      );
    }
    const base64 = jpeg.toString("base64");
    const colorEvidence = await measureCenterColour(jpeg);

    const payload = {
      model: GROQ_VISION_MODEL,
      messages: [
        { role: "system", content: systemPrompt(food) },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                food === "other"
                  ? "Estimate only the universal-indicator pH colour category. Return JSON only."
                  : "Assess only whether this milk test shows a blue-black starch reaction. Return JSON only."
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64}` }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 800,
      reasoning_effort: "none"
    };

    // Unparseable replies still return a (necessarily inconclusive) result.
    const parsed = parseModelJson(await groqChat(payload));
    return NextResponse.json(
      food === "other"
        ? coercePhResult(parsed, colorEvidence)
        : coerceStarchResult(parsed, colorEvidence)
    );
  } catch (err) {
    console.error("Purity test analysis failed:", err);
    return NextResponse.json(
      { error: "The test service is busy right now. Please try again in a moment." },
      { status: 503 }
    );
  }
}
