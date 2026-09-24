import type { Locale, ScanResult } from "@/types/product";

// The scan endpoint lives inside this Next.js app at /api/scan, so a relative
// path is used by default. This works on localhost, Vercel, and any domain
// without configuration.
const API_URL = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");

type ScanPayload = {
  image: Blob;
  barcode?: string | null;
  locale: Locale;
};

export async function scanProductLabel({
  image,
  barcode,
  locale
}: ScanPayload): Promise<ScanResult> {
  const formData = new FormData();
  formData.append("image", image, `expiryguard-${Date.now()}.jpg`);
  formData.append("locale", locale);
  if (barcode) formData.append("barcode", barcode);

  const response = await fetch(`${API_URL}/scan`, {
    method: "POST",
    headers: {
      "Bypass-Tunnel-Reminder": "true"
    },
    body: formData
  });

  if (!response.ok) {
    let message = "Scan failed. Please try again.";
    try {
      const payload = (await response.json()) as { error?: string; detail?: string };
      message = payload.error || payload.detail || message;
    } catch {
      // Keep the friendly fallback when a proxy returns an HTML error page.
    }
    throw new Error(message);
  }

  return response.json() as Promise<ScanResult>;
}
