/**
 * Keys for a multiple choice. When every choice is a number, the digit keys
 * type the answer, as on the number pad: 3 is the answer 3, and 2 then 4 is 24.
 * A number that begins a longer choice (2 among 2 and 24) waits a moment for
 * the next digit, or for Enter. Choices that are not numbers ("ja", "nej")
 * keep 1, 2, 3 … as shortcuts for the first, second, third choice.
 */

/** How long a typed number that begins a longer choice waits for the next digit. */
export const CHOICE_WAIT_MS = 900;

type Key = Pick<KeyboardEvent, 'key' | 'preventDefault'>;

export interface ChoiceKeys {
  onKey(e: Key): void;
  /** Whether the digit keys type the answer (every choice is a number). */
  numeric: boolean;
}

export function choiceKeys(
  choices: readonly string[],
  choose: (index: number) => void,
  opts: { waitMs?: number; typed?: (text: string) => void } = {},
): ChoiceKeys {
  const numeric = choices.length > 0 && choices.every((c) => /^\d+$/.test(c));
  let typed = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;

  const show = (text: string) => {
    typed = text;
    opts.typed?.(text);
  };
  const finish = (i: number) => {
    clearTimeout(timer);
    if (finished) return;
    finished = true;
    show('');
    choose(i);
  };

  const onKey = (e: Key) => {
    if (finished) return;
    if (!numeric) {
      if (/^[1-9]$/.test(e.key) && Number(e.key) <= choices.length) finish(Number(e.key) - 1);
      return;
    }
    if (/^\d$/.test(e.key)) {
      clearTimeout(timer);
      // A digit that fits no choice after what was typed starts over from that digit.
      let next = typed + e.key;
      if (!choices.some((c) => c.startsWith(next))) next = choices.some((c) => c.startsWith(e.key)) ? e.key : '';
      show(next);
      if (!next) return;
      const exact = choices.indexOf(next);
      const longer = choices.some((c) => c !== next && c.startsWith(next));
      if (exact >= 0 && !longer) finish(exact);
      else if (exact >= 0) timer = setTimeout(() => finish(exact), opts.waitMs ?? CHOICE_WAIT_MS);
    } else if (e.key === 'Enter') {
      const exact = choices.indexOf(typed);
      if (exact >= 0) {
        // Not also a click on a focused button.
        e.preventDefault();
        finish(exact);
      }
    } else if (e.key === 'Backspace') {
      clearTimeout(timer);
      show(typed.slice(0, -1));
    } else if (e.key === 'Escape') {
      clearTimeout(timer);
      show('');
    }
  };
  return { onKey, numeric };
}
