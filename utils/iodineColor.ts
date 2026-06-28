import type { IodineApiResult, IodineIntensity, PurityVerdict } from "@/types/product";

export type RGB = { r: number; g: number; b: number };

// Average the colour of the central region of a canvas (where the sample sits
// inside the circular viewfinder). Returns null if the canvas can't be read.
export function sampleCenterColor(canvas: HTMLCanvasElement): RGB | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = canvas;
  // Central 44%-wide box ≈ the viewfinder circle.
  const bw = Math.floor(width * 0.44);
  const bh = Math.floor(height * 0.44);
  const bx = Math.floor((width - bw) / 2);
  const by = Math.floor((height - bh) / 2);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(bx, by, bw, bh).data;
  } catch {
    return null;
  }
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  // Sample every 4th pixel for speed.
  for (let i = 0; i < data.length; i += 16) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  if (n === 0) return null;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function toHex({ r, g, b }: RGB): string {
  const h = (v: number) => v.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function colorName({ r, g, b }: RGB): string {
  const bright = (r + g + b) / 3;
  if (bright < 55) return "near black";
  if (b > r && bright < 120) return "dark blue-black";
  if (b > r) return "blue-purple";
  if (r > g && g > b) return bright > 150 ? "amber" : "brown";
  if (bright > 180) return "pale";
  return "muted";
}

// On-device classification of the iodine reaction colour. Returns a result plus
// a `clear` flag: when true the colour is unambiguous and we can skip the AI
// call (the cheap half of the hybrid); when false, defer to the vision API.
export function classifyIodineColor(rgb: RGB): IodineApiResult & { clear: boolean } {
  const { r, g, b } = rgb;
  const brightness = (r + g + b) / 3;
  const colorHex = toHex(rgb);
  const name = colorName(rgb);

  // Starch reaction = blue/black/dark-purple: blue channel dominant AND dark.
  const blueish = b >= r - 8;
  const dark = brightness < 125;
  const veryDark = brightness < 70;

  // Clearly amber/brown/yellow and reasonably bright → no starch (pure).
  if (r > b + 25 && brightness > 95) {
    return {
      starchPresent: false,
      intensity: "none",
      colorHex,
      colorName: name,
      verdict: "pure",
      confidence: 0.86,
      note: "Stayed amber/brown — no starch reaction detected.",
      clear: true
    };
  }

  // Clearly dark blue-black → starch present (adulterated).
  if (blueish && veryDark) {
    return {
      starchPresent: true,
      intensity: "high",
      colorHex,
      colorName: name,
      verdict: "adulterated",
      confidence: 0.85,
      note: "Strong blue-black reaction — starch detected.",
      clear: true
    };
  }

  // Anything in between is ambiguous → let the AI decide.
  const intensity: IodineIntensity = veryDark
    ? "high"
    : dark && blueish
    ? "moderate"
    : "trace";
  const verdict: PurityVerdict = "inconclusive";
  return {
    starchPresent: blueish && dark,
    intensity,
    colorHex,
    colorName: name,
    verdict,
    confidence: 0.4,
    note: "Colour is borderline — confirming with AI.",
    clear: false
  };
}
