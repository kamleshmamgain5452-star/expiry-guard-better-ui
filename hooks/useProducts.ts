"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Product, ScanResult } from "@/types/product";
import { statusFromExpiry, validateAndCorrectDates } from "@/utils/dates";

const STORAGE_KEY = "expiryguard_products";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Product[];
        window.queueMicrotask(() => {
          setProducts(parsed);
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    } catch {
      // localStorage quota exceeded (large base64 images add up). Retry without
      // images so the inventory itself still persists rather than losing data.
      try {
        const lean = products.map(({ imageDataUrl, ...rest }) => rest);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lean));
      } catch {
        /* give up silently — data stays in memory for this session */
      }
    }
  }, [products]);

  // Real-time sync across tabs/windows: when another tab writes products,
  // mirror it here so every open instance shows the same inventory.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;
      try {
        setProducts(event.newValue ? (JSON.parse(event.newValue) as Product[]) : []);
      } catch {
        /* ignore malformed external writes */
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addProduct = (result: ScanResult, imageDataUrl?: string) => {
    // Final date validation guard
    const validated = validateAndCorrectDates(result.mfd_date, result.expiry_date);
    const product: Product = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36),
      productName: result.product_name,
      expiryDate: validated.expiryDate,
      mfdDate: validated.mfdDate,
      barcode: result.barcode,
      batchNumber: result.batch_number || null,
      confidence: result.confidence,
      status: statusFromExpiry(validated.expiryDate),
      imageDataUrl,
      createdAt: new Date().toISOString(),
      quantity: result.quantity,
      category: result.category,
      notes: result.notes
    };
    setProducts((current) => [product, ...current]);
    return product;
  };

  const updateProduct = (product: Product) => {
    // Final date validation guard
    const validated = validateAndCorrectDates(product.mfdDate, product.expiryDate);
    const corrected = {
      ...product,
      mfdDate: validated.mfdDate,
      expiryDate: validated.expiryDate,
      status: statusFromExpiry(validated.expiryDate),
    };
    setProducts((current) =>
      current.map((item) => (item.id === corrected.id ? corrected : item))
    );
  };

  const deleteProduct = (id: string) => {
    const removed = products.find((item) => item.id === id);
    setProducts((current) => current.filter((item) => item.id !== id));
    return removed;
  };

  // Re-insert a previously deleted product (used by the Undo toast).
  const restoreProduct = (product: Product) => {
    setProducts((current) =>
      current.some((item) => item.id === product.id) ? current : [product, ...current]
    );
  };

  const summary = useMemo(() => {
    let safeCount = 0;
    let soonCount = 0;
    let criticalCount = 0;

    // Count by the same status rule the badges use, so dashboard counts and
    // badge colours never disagree.
    for (const p of products) {
      const status = statusFromExpiry(p.expiryDate);
      if (status === "expired") {
        criticalCount++;
      } else if (status === "near_expiry") {
        soonCount++;
      } else {
        safeCount++;
      }
    }

    return {
      safe: safeCount,
      expiring_soon: soonCount,
      critical: criticalCount
    };
  }, [products]);

  return { products, summary, addProduct, updateProduct, deleteProduct, restoreProduct };
}
