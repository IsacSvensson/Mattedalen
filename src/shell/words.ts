/** Swedish genitive: "Alvas", but "Lars" and "Max" stay as they are. */
export function genitive(name: string): string {
  return /[sxz]$/i.test(name) ? name : `${name}s`;
}

/**
 * A way of thinking ("18 + 6 = 18 + 2 + 4 = 20 + 4 = 24.") that breaks only at
 * the equals signs on a narrow screen, never inside a term ("20 +" / "4").
 */
export function keepTerms(text: string): string {
  return text.replace(/ ([+−×]) /g, ' $1 ');
}
