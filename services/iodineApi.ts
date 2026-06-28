import type { IodineApiResult, IodineFood } from "@/types/product";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

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
    const message = await response.text();
    throw new Error(message || "Test failed");
  }

  return response.json() as Promise<IodineApiResult>;
}
