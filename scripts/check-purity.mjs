// Edge-case check for the Food Test Lab analysis. Run: node scripts/check-purity.mjs
import { registerHooks } from "node:module";
import sharp from "sharp";

// Resolve the app's "@/..." alias and extensionless .ts imports (see check-date-parser.mjs).
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith("@/")) spec = new URL(`../${spec.slice(2)}`, import.meta.url).href;
    try {
      return next(spec, ctx);
    } catch {
      return next(`${spec}.ts`, ctx);
    }
  }
});

const purity = await import("../lib/purity.ts");

// A test photo: sample colour in a dish of `radius` (fraction of the frame) on
// a background, optionally with a glare spot. Mimics the cropped camera frame.
async function photo({ sample, bg = sample, radius = 0.45, glare = false }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <rect width="400" height="400" fill="${bg}"/>
    <circle cx="200" cy="200" r="${radius * 400}" fill="${sample}"/>
    ${glare ? `<ellipse cx="170" cy="165" rx="45" ry="22" fill="#ffffff"/>` : ""}
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

const noStarch = { starchPresent: false, intensity: "none", verdict: "pure", confidence: 0.85 };
const starch = (intensity = "high") => ({ starchPresent: true, intensity, verdict: "adulterated", confidence: 0.85 });
const ph = (phCategory, confidence = 0.8) => ({ phCategory, confidence });

// [name, food, photo, what the model answered, expected verdict / pH category]
const cases = [
  ["pale yellow milk", "dairy", { sample: "#f4e7b8" }, noStarch, "pure"],
  ["bright cream milk", "dairy", { sample: "#fbf4de" }, noStarch, "pure"],
  ["amber", "dairy", { sample: "#d9a441" }, noStarch, "pure"],
  ["red-brown iodine", "dairy", { sample: "#7a2a12" }, noStarch, "pure"],
  ["underexposed amber", "dairy", { sample: "#3d2c12" }, noStarch, "pure"],
  ["amber, glare spot", "dairy", { sample: "#e2b35a", glare: true }, noStarch, "pure"],
  ["amber in small dish on dark table", "dairy", { sample: "#d9a441", bg: "#2b2420", radius: 0.3 }, noStarch, "pure"],
  ["blue-black", "dairy", { sample: "#14131f" }, starch(), "adulterated"],
  ["dark navy", "dairy", { sample: "#1f2a5c" }, starch(), "adulterated"],
  ["purple", "dairy", { sample: "#5b3a7a" }, starch("moderate"), "adulterated"],
  ["light lavender (trace starch)", "dairy", { sample: "#aaa6d8" }, starch("trace"), "adulterated"],
  ["blue-black in small dish on white, glare", "dairy", { sample: "#1a1a2e", bg: "#f2f2f2", radius: 0.3, glare: true }, starch(), "adulterated"],
  ["black frame (lens covered)", "dairy", { sample: "#000000" }, starch(), "inconclusive"],
  ["plain white (no iodine visible)", "dairy", { sample: "#f7f7f7" }, noStarch, "inconclusive"],
  ["model contradicts colour", "dairy", { sample: "#d9a441" }, starch(), "inconclusive"],
  ["model sends strings", "dairy", { sample: "#1f2a5c" }, { starchPresent: "true", intensity: "High", verdict: "adulterated", confidence: "0.9" }, "adulterated"],
  ["model sends percent confidence", "dairy", { sample: "#d9a441" }, { starchPresent: false, verdict: "pure", confidence: 88 }, "pure"],
  ["model unsure", "dairy", { sample: "#d9a441" }, { ...noStarch, confidence: 0.4 }, "inconclusive"],

  ["red (pH 1-3)", "other", { sample: "#d42a2a" }, ph("strong_acidic"), "strong_acidic"],
  ["orange (pH 4-5)", "other", { sample: "#ee8a2a" }, ph("weak_acidic"), "weak_acidic"],
  ["yellow (pH 6)", "other", { sample: "#e6d23c" }, ph("weak_acidic"), "weak_acidic"],
  ["green (pH 7)", "other", { sample: "#3aa84a" }, ph("neutral"), "neutral"],
  ["pale green (pH 7)", "other", { sample: "#cde9c8" }, ph("neutral"), "neutral"],
  ["teal (pH 8)", "other", { sample: "#1fa5a0" }, ph("weak_alkaline"), "weak_alkaline"],
  ["blue (pH 9-10)", "other", { sample: "#2a5ad0" }, ph("weak_alkaline"), "weak_alkaline"],
  ["violet (pH 11+)", "other", { sample: "#7a3ab8" }, ph("strong_alkaline"), "strong_alkaline"],
  ["green in small white dish", "other", { sample: "#3aa84a", bg: "#f4f4f4", radius: 0.3 }, ph("neutral"), "neutral"],
  ["yellow-green, model says weak acidic", "other", { sample: "#c4d43a" }, ph("weak_acidic"), "weak_acidic"],
  ["model says 'Weakly Acidic'", "other", { sample: "#ee8a2a" }, ph("Weakly Acidic"), "weak_acidic"],
  ["model contradicts colour", "other", { sample: "#d42a2a" }, ph("neutral"), "unknown"],
  ["grey, no indicator colour", "other", { sample: "#eeeeee" }, ph("neutral"), "unknown"]
];

let failed = 0;
for (const [name, food, spec, answer, want] of cases) {
  const sample = await purity.measureCenterColour(await photo(spec));
  const r = food === "dairy" ? purity.coerceStarchResult(answer, sample) : purity.coercePhResult(answer, sample);
  const got = food === "dairy" ? r.verdict : r.phCategory;
  // A definitive starch verdict must come with a matching starch level.
  const levelOk = r.verdict !== "pure" || r.intensity === "none";
  if (got !== want || !levelOk) {
    failed++;
    console.log(`FAIL ${food} "${name}": got ${got} (${r.intensity}, ${r.colorHex}), want ${want}`);
  }
}

let total = cases.length;
if (purity.parseModelJson) {
  // Replies with reasoning, code fences, trailing commas, or single quotes still parse.
  const replies = [
    '<think>looks amber</think>{"starchPresent": false, "confidence": 0.8}',
    'Here you go:\n```json\n{"starchPresent": false, "confidence": 0.8,}\n```',
    "{'starchPresent': false, 'confidence': 0.8}"
  ];
  for (const reply of replies) {
    total++;
    const parsed = purity.parseModelJson(reply);
    if (parsed?.starchPresent !== false || parsed?.confidence !== 0.8) {
      failed++;
      console.log(`FAIL parseModelJson ${JSON.stringify(reply)} -> ${JSON.stringify(parsed)}`);
    }
  }
}

console.log(`${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
