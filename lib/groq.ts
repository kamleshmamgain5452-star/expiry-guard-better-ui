import { getRedis } from "@/lib/redis";

// Collect every configured Groq API key. Supports a comma/space/newline
// separated GROQ_API_KEYS list, plus the legacy single GROQ_API_KEY and
// numbered GROQ_API_KEY_2..GROQ_API_KEY_5. Order preserved, duplicates removed.
export function getGroqKeys(): string[] {
  const keys: string[] = [];

  const list = process.env.GROQ_API_KEYS || "";
  for (const part of list.split(/[\s,]+/)) {
    const trimmed = part.trim();
    if (trimmed) keys.push(trimmed);
  }

  for (const name of [
    "GROQ_API_KEY",
    "GROQ_API_KEY_2",
    "GROQ_API_KEY_3",
    "GROQ_API_KEY_4",
    "GROQ_API_KEY_5"
  ]) {
    const v = (process.env[name] || "").trim();
    if (v) keys.push(v);
  }

  return [...new Set(keys)];
}

// Round-robin starting index, shared across serverless instances via a Redis
// counter so rotation is deterministic. Best-effort: falls back to a random
// index if Redis is unavailable, so a Redis hiccup never blocks a scan.
export async function nextKeyIndex(count: number): Promise<number> {
  if (count <= 1) return 0;
  try {
    const redis = getRedis();
    const n = (await redis.incr("expiryguard:groq_rr")) as number;
    return ((n % count) + count) % count;
  } catch {
    return Math.floor(Math.random() * count);
  }
}

export const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Send a chat/vision request to Groq, rotating across keys and failing over to
// the next key on rate-limit/auth/server errors. Returns the message content.
// Uses a stateless RANDOM start (no Redis) so callers like the purity test never
// consume backend/Upstash commands — keys still spread out and fail over.
export async function groqChat(payload: object): Promise<string> {
  const keys = getGroqKeys();
  if (keys.length === 0) throw new Error("GROQ_API_KEY is not set.");

  const start = keys.length > 1 ? Math.floor(Math.random() * keys.length) : 0;
  let lastStatus = 0;
  let lastError = "";

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (start + attempt) % keys.length;
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keys[idx]}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || "";
    }

    lastStatus = res.status;
    lastError = await res.text();
    const retryable =
      res.status === 429 ||
      res.status === 401 ||
      res.status === 403 ||
      res.status >= 500;
    if (!retryable) break;
  }

  throw new Error(`Groq request failed: ${lastStatus} ${lastError.slice(0, 200)}`);
}
