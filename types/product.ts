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
