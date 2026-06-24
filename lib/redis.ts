import { Redis } from "@upstash/redis";

// Lazily create a single Upstash Redis client. Supports both the env-var names
// the Upstash Vercel integration may use (UPSTASH_* or the older KV_* prefix).
let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;

  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
  }

  client = new Redis({ url, token });
  return client;
}

// Redis keys
export const DEVICES_SET = "expiryguard:devices";
export const deviceKey = (id: string) => `expiryguard:device:${id}`;
