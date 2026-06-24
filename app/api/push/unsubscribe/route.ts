import { NextRequest, NextResponse } from "next/server";
import { getRedis, DEVICES_SET, deviceKey } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Removes a device so it stops receiving push notifications.
export async function POST(req: NextRequest) {
  try {
    const { deviceId } = (await req.json()) ?? {};
    if (typeof deviceId !== "string" || !deviceId) {
      return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
    }

    const redis = getRedis();
    await redis.del(deviceKey(deviceId));
    await redis.srem(DEVICES_SET, deviceId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
