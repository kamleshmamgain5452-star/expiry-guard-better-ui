"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale, Product } from "@/types/product";

const DEVICE_ID_KEY = "expiryguard_device_id";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export type PushState = {
  supported: boolean;
  // iOS only allows push when the app is installed to the home screen.
  needsInstall: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  busy: boolean;
};

function getDeviceId(): string {
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

function toStored(products: Product[]) {
  return products.map((p) => ({
    id: p.id,
    name: p.productName,
    expiryDate: p.expiryDate
  }));
}

// Detect iOS Safari that is NOT running as an installed PWA — push is blocked there.
function isIosNeedsInstall(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS-only Safari property
    window.navigator.standalone === true;
  return isIos && !standalone;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>({
    supported: false,
    needsInstall: false,
    permission: "unsupported",
    subscribed: false,
    busy: false
  });

  // Detect support, register the service worker, and read current status.
  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    if (!supported) {
      setState((s) => ({
        ...s,
        supported: false,
        needsInstall: isIosNeedsInstall()
      }));
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setState((s) => ({
          ...s,
          supported: true,
          needsInstall: isIosNeedsInstall(),
          permission: Notification.permission,
          subscribed: !!sub
        }));
      } catch {
        if (!cancelled) setState((s) => ({ ...s, supported: false }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const register = useCallback(
    async (subscriptionJson: unknown, products: Product[], lang: Locale) => {
      await fetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          subscription: subscriptionJson,
          products: toStored(products),
          lang
        })
      });
    },
    []
  );

  const subscribe = useCallback(
    async (products: Product[], lang: Locale): Promise<{ ok: boolean; reason?: string }> => {
      if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "not-configured" };
      setState((s) => ({ ...s, busy: true }));
      try {
        const reg = await navigator.serviceWorker.ready;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState((s) => ({ ...s, permission, busy: false }));
          return { ok: false, reason: permission };
        }

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          });
        }

        await register(sub.toJSON(), products, lang);
        setState((s) => ({ ...s, permission, subscribed: true, busy: false }));
        return { ok: true };
      } catch (err) {
        setState((s) => ({ ...s, busy: false }));
        return { ok: false, reason: err instanceof Error ? err.message : "error" };
      }
    },
    [register]
  );

  const unsubscribe = useCallback(async () => {
    setState((s) => ({ ...s, busy: true }));
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: getDeviceId() })
      });
      setState((s) => ({ ...s, subscribed: false, busy: false }));
    } catch {
      setState((s) => ({ ...s, busy: false }));
    }
  }, []);

  const sendTest = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: getDeviceId() })
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  // Keep the server's copy of products in sync (only when already subscribed).
  const syncProducts = useCallback(
    async (products: Product[], lang: Locale) => {
      if (!state.subscribed) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;
        await register(sub.toJSON(), products, lang);
      } catch {
        /* best-effort sync */
      }
    },
    [register, state.subscribed]
  );

  return { ...state, subscribe, unsubscribe, sendTest, syncProducts };
}
