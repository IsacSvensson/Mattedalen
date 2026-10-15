/** Swedish genitive: "Alvas", but "Lars" and "Max" stay as they are. */
export function genitive(name: string): string {
  return /[sxz]$/i.test(name) ? name : `${name}s`;
}
