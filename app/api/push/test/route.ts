import { NextRequest, NextResponse } from "next/server";
import { getRedis, deviceKey } from "@/lib/redis";
import { getWebPush, type DeviceRecord } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sends an immediate test notification to one device, so the user can confirm
// push works without waiting for the daily cron.
export async function POST(req: NextRequest) {
  try {
    const { deviceId } = (await req.json()) ?? {};
    if (typeof deviceId !== "string" || !deviceId) {
      return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
    }

    const redis = getRedis();
    const record = (await redis.get(deviceKey(deviceId))) as DeviceRecord | null;
    if (!record || !record.subscription) {
      return NextResponse.json({ error: "Device not subscribed" }, { status: 404 });
    }

    const wp = getWebPush();
    await wp.sendNotification(
      record.subscription,
      JSON.stringify({
        title: "ExpiryGuard",
        body: "Test notification — push is working! 🎉",
        url: "/",
        tag: "expiryguard-test"
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
