"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PurityTest } from "@/types/product";

const STORAGE_KEY = "expiryguard_purity_tests";

export function usePurityTests() {
  const [tests, setTests] = useState<PurityTest[]>([]);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PurityTest[];
        window.queueMicrotask(() => {
          setTests(parsed);
          hydratedRef.current = true;
        });
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        hydratedRef.current = true;
      }
    } else {
      hydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tests));
    } catch {
      // Quota exceeded (test images add up) — persist without images instead.
      try {
        const lean = tests.map(({ imageDataUrl, ...rest }) => rest);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lean));
      } catch {
        /* keep in memory for this session */
      }
    }
  }, [tests]);

  const addTest = (test: PurityTest) => {
    setTests((current) => [test, ...current]);
    return test;
  };

  const deleteTest = (id: string) => {
    setTests((current) => current.filter((t) => t.id !== id));
  };

  // Latest test attached to a given product (drives the inventory purity badge).
  const latestForProduct = useMemo(() => {
    const map = new Map<string, PurityTest>();
    for (const t of tests) {
      if (t.productId && !map.has(t.productId)) map.set(t.productId, t);
    }
    return map;
  }, [tests]);

  return { tests, addTest, deleteTest, latestForProduct };
}
