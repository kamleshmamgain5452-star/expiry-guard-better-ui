function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Last-word variants: "nut" ↔ "nuts", "peanut" ↔ "peanuts".
function wordVariants(word: string): string[] {
  const base = word.endsWith("s") && word.length > 3 ? word.slice(0, -1) : word;
  const plural = `${base}s`;
  return base === plural ? [base] : [base, plural];
}

// Build a Unicode word-boundary pattern for an allergen term.
// - Blocks substring hits ("nut" ≠ "coconut")
// - Allows simple English plurals on the last word
// - Allows flexible separators for multi-word terms ("tree nut" = "tree-nuts")
function termPattern(term: string): RegExp | null {
  const trimmed = term.trim().toLowerCase();
  if (!trimmed) return null;

  const parts = trimmed.split(/[\s/_-]+/).filter(Boolean);
  if (parts.length === 0) return null;

  const body = parts
    .map((part, index) => {
      if (index === parts.length - 1) {
        const variants = wordVariants(part).map(escapeRegExp);
        return variants.length === 1 ? variants[0] : `(?:${variants.join("|")})`;
      }
      return escapeRegExp(part);
    })
    .join("[\\s/_-]+");

  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "u");
}

function containsWholeTerm(text: string, term: string): boolean {
  const pattern = termPattern(term);
  if (!pattern) return false;
  return pattern.test(text.toLowerCase());
}

export function getMatchedAllergens(
  productName: string,
  rawText: string[] | undefined,
  allergens: string[]
): string[] {
  const matches: string[] = [];
  if (!allergens || allergens.length === 0) return matches;

  const sources = [productName, ...(rawText || [])].filter(Boolean);

  for (const allergen of allergens) {
    const term = allergen.trim();
    if (!term) continue;

    if (sources.some((source) => containsWholeTerm(source, term))) {
      matches.push(allergen);
    }
  }

  return matches;
}
