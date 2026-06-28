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
