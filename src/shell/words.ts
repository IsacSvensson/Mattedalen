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

/**
 * The way the game helps with a hard fact, shown on its own line under the fact
 * in "För vuxna". A dash between them read as one more minus sign
 * ("1 − 1 = 0 – 1 − 1 = 0: allt tas bort."), and a way that starts by repeating
 * the fact drops the repeat ("Allt tas bort.").
 */
export function wayFor(fact: string, strategy: string): string {
  const own = `${fact}: `;
  const rest = strategy.startsWith(own) ? strategy.slice(own.length) : strategy;
  return keepTerms(rest.charAt(0).toUpperCase() + rest.slice(1));
}
