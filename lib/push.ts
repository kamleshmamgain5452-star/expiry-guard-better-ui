import webpush from "web-push";

export type StoredProduct = {
  id: string;
  name: string;
  expiryDate: string | null;
};

export type DeviceRecord = {
  subscription: webpush.PushSubscription;
  products: StoredProduct[];
  lang: "en" | "hi";
  updatedAt: string;
};

// Configure web-push with the VAPID keys once per server instance.
let configured = false;

export function getWebPush() {
  if (!configured) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:notify@expiryguard.app";

    if (!publicKey || !privateKey) {
      throw new Error("VAPID keys are not configured.");
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return webpush;
}
