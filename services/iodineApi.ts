import type { IodineApiResult, IodineFood } from "@/types/product";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");

type AnalyzeArgs = {
  image: Blob;
  food: IodineFood;
};

export async function analyzeIodineTest({
  image,
  food
}: AnalyzeArgs): Promise<IodineApiResult> {
  const formData = new FormData();
  formData.append("image", image, `iodine-${Date.now()}.jpg`);
  formData.append("food", food);

  const response = await fetch(`${API_URL}/iodine`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    let message = "The test could not be analyzed. Please try another photo.";
    try {
      const payload = (await response.json()) as { error?: string; detail?: string };
      message = payload.error || payload.detail || message;
    } catch {
      // Keep the actionable fallback if a proxy returns HTML.
    }
    throw new Error(message);
  }

  return response.json() as Promise<IodineApiResult>;
}
