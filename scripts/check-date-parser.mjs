// Edge-case check for the label date parser. Run: node scripts/check-date-parser.mjs
import { registerHooks } from "node:module";

// Resolve the app's "@/..." alias and extensionless .ts imports so plain Node
// (with built-in type stripping) can load the parser without a build step.
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

const { parseOcrResult, parseRelativeExpiry } = await import("../utils/ocrParser.ts");

// [label lines, expected expiry, expected mfd, LLM structured fields]
const cases = [
  [["MFD: 05/08/2026", "EXP: 04/02/2027"], "04/02/2027", "05/08/2026"],
  [["MFD: 05/08/26 EXP: 04/02/27"], "04/02/2027", "05/08/2026"],
  [["PKD 05.08.2026 USE BY 04.02.2027"], "04/02/2027", "05/08/2026"],
  [["MFG DATE  EXP DATE", "05/08/2026  04/02/2027"], "04/02/2027", "05/08/2026"],
  [["MFD:", "EXP:", "05/08/2026", "04/02/2027"], "04/02/2027", "05/08/2026"],
  [["Mfg: AUG 2026", "Best Before: FEB 2027"], "28/02/2027", "31/08/2026"],
  [["EXP 05-AUG-2027"], "05/08/2027", null],
  [["EXP12/2026"], "31/12/2026", null],
  [["EXP: 0CT 2026"], "31/10/2026", null],
  [["USE BEFORE 5TH FEB 2027"], "05/02/2027", null],
  [["Expiry: 2027-02-04"], "04/02/2027", null],
  [["USE BY 12/31/2026"], "31/12/2026", null],
  [["EXP: 04 / 02 / 2027"], "04/02/2027", null],
  [["BB 12.2026"], "31/12/2026", null],
  [["MFD 050826 EXP 040227"], "04/02/2027", "05/08/2026"],
  [["समाप्ति तिथि: 04/02/2027", "निर्माण तिथि: 05/08/2026"], "04/02/2027", "05/08/2026"],
  [["MRP ₹45.00 (incl. of all taxes)", "Net Wt. 1.25 kg", "EXP 03/2027"], "31/03/2027", null],
  [["Mfd. by: ABC Foods Pvt Ltd, Mumbai 400001", "Batch No: B12/26", "Best Before: 04 Feb 2027"], "04/02/2027", null],
  [["EXP. DATE: SEE BOTTOM", "MFD 05/08/26"], null, "05/08/2026"],
  [["Aug 5, 2026", "Feb 4, 2027"], "04/02/2027", "05/08/2026"],
  [["BEST BEFORE 12 MONTHS FROM MFG", "MFG: 05/08/2026"], "05/08/2027", "05/08/2026"],
  [["Best before 6 months from the date of packaging", "Pkd: 15/01/2026"], "15/07/2026", "15/01/2026"],
  [["BEST BEFORE SIX MONTHS FROM MANUFACTURE", "MFD 05/08/2026"], "05/02/2027", "05/08/2026"],
  [["Once opened, consume within 3 days.", "PKD: 05/08/2026"], null, "05/08/2026"],
  [["Consume within 3 days of opening", "Use by: 10/10/2026"], "10/10/2026", null],
  [["Exported by XYZ. Best before 04/02/2027"], "04/02/2027", null],
  // LLM structured fields that the old parser passed through unparsed or wrong.
  [[], "05/02/2027", "05/08/2026", { expiry_date: "6 months from manufacture", mfd_date: "05/08/2026" }],
  [[], "04/02/2027", null, { expiry_date: "04 Feb, 2027" }],
  [["EXP: 04/02/2027"], "04/02/2027", "05/08/2026", { expiry_date: "05/08/2026", mfd_date: "05/08/2026" }]
];

let failed = 0;
for (const [lines, exp, mfd, structured = {}] of cases) {
  const r = parseOcrResult(lines, 0.9, structured, null);
  if (r.expiry_date !== exp || r.mfd_date !== mfd) {
    failed++;
    console.log(`FAIL ${JSON.stringify(lines)} ${JSON.stringify(structured)}\n  got exp=${r.expiry_date} mfd=${r.mfd_date}, want exp=${exp} mfd=${mfd}`);
  }
}

// Filling in MFD later (scan result screen) recomputes a shelf-life expiry.
const later = parseRelativeExpiry(["Best before 9 months from packaging"], "31/01/2026");
if (later.expiryDate !== "31/10/2026") {
  failed++;
  console.log(`FAIL parseRelativeExpiry got ${later.expiryDate}, want 31/10/2026`);
}

console.log(`${cases.length + 1 - failed}/${cases.length + 1} passed`);
process.exit(failed ? 1 : 0);
