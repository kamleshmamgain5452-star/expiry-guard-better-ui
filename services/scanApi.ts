import type { Locale, ScanResult } from "@/types/product";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
    const message = await response.text();
    throw new Error(message || "Scan failed");
  }

  return response.json() as Promise<ScanResult>;
}
