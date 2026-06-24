import { NextRequest, NextResponse } from "next/server";
import { getRedis, DEVICES_SET, deviceKey } from "@/lib/redis";
import type { DeviceRecord, StoredProduct } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stores (or refreshes) a device's push subscription + the products it tracks,
// so the daily cron knows what to notify about and where to send it.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceId, subscription, products, lang } = body ?? {};

    if (typeof deviceId !== "string" || !deviceId) {
      return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
    }
    if (!subscription || typeof subscription.endpoint !== "string") {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const cleanProducts: StoredProduct[] = Array.isArray(products)
      ? products
          .filter((p) => p && typeof p.id === "string")
          .map((p) => ({
            id: String(p.id),
            name: typeof p.name === "string" ? p.name : "",
            expiryDate: p.expiryDate ?? null
          }))
      : [];

    const record: DeviceRecord = {
      subscription,
      products: cleanProducts,
      lang: lang === "hi" ? "hi" : "en",
      updatedAt: new Date().toISOString()
    };

    const redis = getRedis();
    await redis.set(deviceKey(deviceId), record);
    await redis.sadd(DEVICES_SET, deviceId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
