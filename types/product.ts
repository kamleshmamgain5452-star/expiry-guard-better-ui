export type Locale = "en" | "hi";

export type ExpiryStatus = "safe" | "near_expiry" | "expired";

export type ScanResult = {
  product_name: string;
  expiry_date: string | null;
  mfd_date: string | null;
  barcode: string | null;
  batch_number?: string | null;
  confidence: number;
  status: ExpiryStatus;
  raw_text?: string[];
  quantity?: number;
  category?: string;
  notes?: string;
  mfd_missing_for_duration?: boolean;
};

export type Product = {
  id: string;
  productName: string;
  expiryDate: string | null;
  mfdDate: string | null;
  barcode: string | null;
  batchNumber?: string | null;
  confidence: number;
  status: ExpiryStatus;
  imageDataUrl?: string;
  createdAt: string;
  quantity?: number;
  category?: string;
  notes?: string;
};

// --- Iodine / starch purity test ---
export type IodineFood = "milk" | "ghee" | "other";
export type PurityVerdict = "pure" | "adulterated" | "inconclusive";
export type IodineIntensity = "none" | "trace" | "moderate" | "high";

// Result returned by the /api/iodine vision endpoint.
export type IodineApiResult = {
  starchPresent: boolean;
  intensity: IodineIntensity;
  colorHex: string;
  colorName: string;
  verdict: PurityVerdict;
  confidence: number; // 0..1
  note: string;
};

// A saved purity test, optionally linked to a product in the inventory.
export type PurityTest = IodineApiResult & {
  id: string;
  food: IodineFood;
  imageDataUrl?: string;
  productId?: string | null;
  productName?: string | null;
  source: "ai" | "device"; // whether AI confirmed or the on-device color decided
  createdAt: string;
};
