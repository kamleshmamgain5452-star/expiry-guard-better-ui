import { NextRequest, NextResponse } from "next/server";
import { getRedis, DEVICES_SET, deviceKey } from "@/lib/redis";
import { getWebPush, type DeviceRecord, type StoredProduct } from "@/lib/push";
import { daysUntil } from "@/utils/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Build a localized notification for the products expiring within the next week.
function buildMessage(products: StoredProduct[], lang: "en" | "hi") {
  const upcoming = products
    .map((p) => ({ p, days: daysUntil(p.expiryDate) }))
    .filter((x) => x.days !== null && x.days <= 7 && x.days >= -2)
    .sort((a, b) => (a.days as number) - (b.days as number));

  if (upcoming.length === 0) return null;

  const en = lang !== "hi";
  const title = en ? "Expiry reminder" : "समाप्ति अनुस्मारक";

  if (upcoming.length === 1) {
    const { p, days } = upcoming[0];
    const name = p.name || (en ? "A product" : "एक उत्पाद");
    let when: string;
    if ((days as number) < 0) when = en ? "has expired" : "की समय-सीमा समाप्त हो गई है";
    else if (days === 0) when = en ? "expires today" : "आज समाप्त हो रही है";
    else if (days === 1) when = en ? "expires tomorrow" : "कल समाप्त हो रही है";
    else when = en ? `expires in ${days} days` : `${days} दिनों में समाप्त हो रही है`;
    return { title, body: `${name} ${when}.` };
  }

  return {
    title,
    body: en
      ? `${upcoming.length} products are expiring soon.`
      : `${upcoming.length} उत्पाद जल्द समाप्त हो रहे हैं।`
  };
}

// Invoked daily by Vercel Cron. Sends each device a reminder about its
// soon-to-expire products, and prunes dead push subscriptions.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const redis = getRedis();
    const ids = ((await redis.smembers(DEVICES_SET)) as string[]) ?? [];
    const wp = getWebPush();

    let sent = 0;
    let skipped = 0;
    let pruned = 0;

    // Fetch all device records in one round-trip instead of one GET per device.
    const records =
      ids.length > 0
        ? ((await redis.mget(...ids.map(deviceKey))) as (DeviceRecord | null)[])
        : [];

    // Process devices in bounded-concurrency waves so N devices don't serialize
    // into N sequential push round-trips (which would blow the function timeout).
    const CONCURRENCY = 25;
    for (let start = 0; start < ids.length; start += CONCURRENCY) {
      const slice = ids.slice(start, start + CONCURRENCY);
      const results = await Promise.allSettled(
        slice.map(async (id, i) => {
          const record = records[start + i];
          if (!record || !record.subscription) {
            await redis.srem(DEVICES_SET, id);
            return "pruned" as const;
          }

          const message = buildMessage(record.products ?? [], record.lang);
          if (!message) return "skipped" as const;

          try {
            await wp.sendNotification(
              record.subscription,
              JSON.stringify({ ...message, url: "/", tag: "expiry-daily" })
            );
            return "sent" as const;
          } catch (err) {
            const status = (err as { statusCode?: number })?.statusCode;
            // 404/410 mean the subscription is gone — remove it.
            if (status === 404 || status === 410) {
              await redis.del(deviceKey(id));
              await redis.srem(DEVICES_SET, id);
              return "pruned" as const;
            }
            return "failed" as const;
          }
        })
      );

      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        if (r.value === "sent") sent++;
        else if (r.value === "skipped") skipped++;
        else if (r.value === "pruned") pruned++;
      }
    }

    return NextResponse.json({ ok: true, devices: ids.length, sent, skipped, pruned });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
