import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { parseOcrResult } from "@/utils/ocrParser";
import { getGroqKeys, GROQ_VISION_MODEL, nextKeyIndex } from "@/lib/groq";

export const dynamic = "force-dynamic";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are an expert OCR and metadata extraction system for packaged product labels.
Extract ALL visible text from the image. Pay special attention to:
- Expiry dates (EXP, EXPIRY, BEST BEFORE, BB, USE BY, USE BEFORE, BEST BY, समाप्ति तिथि)
- Manufacturing dates (MFD, MFG, PKD, PACKED, MANUFACTURED, manufacturing date, उत्पादन तिथि)
- Product name / brand name
- Barcodes (any digits printed below or near a barcode, typically 8 to 14 digits)
- Batch numbers, lot numbers

Return the extracted text as a JSON object with these fields:
{
  "all_text": ["line1", "line2", ...],
  "expiry_date": "expiry/best-before/use-by date exactly as printed, e.g. \"04/02/2027\", \"FEB 2027\", \"05AUG26\"; or the printed shelf life if there is no date, e.g. \"12 months from manufacture\"; or null",
  "mfd_date": "manufacturing/packing date exactly as printed, or null",
  "product_name": "product name or null if not found",
  "barcode": "barcode number or null if not found",
  "batch_number": "batch number or lot number or null if not found",
  "confidence": 0.95
}

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks, no explanation.
- Copy dates exactly as printed. Do not reformat them, swap day and month, invent a missing day, or calculate a date from a shelf life.
- In all_text, keep each date on the same line as its label word (e.g. "EXP: 04/02/2027").
- If a barcode is visible, extract the numbers underneath it.
- Set confidence between 0.0 and 1.0 based on image clarity.
`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    const barcode = formData.get("barcode") as string | null;
    const locale = formData.get("locale") as string || "en";

    if (!imageFile) {
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }

    // 1. Process image with sharp
    let jpegBuffer: Buffer;
    try {
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let sharpImg = sharp(buffer);
      const metadata = await sharpImg.metadata();

      if (metadata.width && metadata.height) {
        const maxDim = 1024;
        if (Math.max(metadata.width, metadata.height) > maxDim) {
          const scale = maxDim / Math.max(metadata.width, metadata.height);
          const newWidth = Math.round(metadata.width * scale);
          const newHeight = Math.round(metadata.height * scale);
          sharpImg = sharpImg.resize(newWidth, newHeight);
        }
      }

      jpegBuffer = await sharpImg.jpeg({ quality: 85 }).toBuffer();
    } catch (err: any) {
      console.error("Image processing error:", err);
      return NextResponse.json({ error: `Invalid image: ${err.message}` }, { status: 400 });
    }

    // 2. Call Groq Vision API
    const base64Image = jpegBuffer.toString("base64");
    const groqKeys = getGroqKeys();
    if (groqKeys.length === 0) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not set." },
        { status: 500 }
      );
    }

    const payload = {
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text and structured dates from this product label. Return JSON only.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 2048,
      reasoning_effort: "none",
    };

    // Start at a round-robin key and fail over across every configured key on
    // rate-limit (429), auth (401/403), or server (5xx) errors. A malformed
    // request (400) stops immediately because changing credentials cannot fix it.
    const start = await nextKeyIndex(groqKeys.length);
    let response: Response | null = null;
    let lastStatus = 0;
    let lastError = "";

    for (let attempt = 0; attempt < groqKeys.length; attempt++) {
      const keyIndex = (start + attempt) % groqKeys.length;
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKeys[keyIndex]}`,
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        response = res;
        break;
      }

      lastStatus = res.status;
      lastError = await res.text();
      const retryable =
        res.status === 429 ||
        res.status === 401 ||
        res.status === 403 ||
        res.status >= 500;
      console.warn(
        `Groq key #${keyIndex} failed (status ${res.status})${retryable ? ", trying next key…" : ""}`
      );
      if (!retryable) break;
    }

    if (!response) {
      console.error("Groq API error (all keys exhausted):", lastStatus, lastError);
      const modelUnavailable =
        lastStatus === 404 && /model|not found|does not exist/i.test(lastError);
      return NextResponse.json(
        {
          error: modelUnavailable
            ? "The OCR model is temporarily unavailable. Please try again later."
            : `Label scan failed (service status ${lastStatus || 503}).`
        },
        { status: 503 }
      );
    }

    const responseData = await response.json();
    let content = responseData.choices?.[0]?.message?.content?.trim() || "";

    // Some reasoning models wrap the answer in <think>…</think> and/or a JSON
    // code fence even when explicitly asked for JSON only. Strip both wrappers
    // before parsing so internal reasoning can never be mistaken for label text.
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const fencedJson = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedJson) content = fencedJson[1].trim();

    // If the model adds a short sentence around its answer, keep only the
    // outermost JSON object.
    const objectStart = content.indexOf("{");
    const objectEnd = content.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      content = content.slice(objectStart, objectEnd + 1);
    }

    // 3. Parse result
    let structuredData: any = {};
    let lines: string[] = [];
    let ocrConfidence = 0.9;

    try {
      structuredData = JSON.parse(content);
      ocrConfidence = typeof structuredData.confidence === "number" ? structuredData.confidence : parseFloat(structuredData.confidence || "0.9");
      if (Array.isArray(structuredData.all_text)) {
        lines = structuredData.all_text.map((t: any) => String(t).trim()).filter(Boolean);
      }
    } catch (e) {
      console.warn("Failed to parse Groq response as JSON. Falling back to raw text lines.", e);
      lines = content.split("\n").map((l: string) => l.trim()).filter(Boolean);
      ocrConfidence = 0.5;
    }

    const result = parseOcrResult(lines, ocrConfidence, structuredData, barcode);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Internal OCR API Route error:", error);
    return NextResponse.json({ error: "Internal server error during OCR scan" }, { status: 500 });
  }
}
