import { h } from '../dom';
import { icon } from './icons';

/** Digits the pad takes unless told otherwise (`answerDigits` of the pack). */
const MAX_DIGITS = 3;

export interface NumPad {
  el: HTMLElement;
  display: HTMLElement;
  /** Keyboard support: digits, Backspace, Enter. */
  onKey(e: KeyboardEvent): void;
  disable(): void;
}

/**
 * Large number pad for free answers. `onSubmit` also gets the time
 * (`performance.now()`) the first digit was typed, so a place can time the
 * answer to the first digit: a two-digit answer then takes no longer than a
 * one-digit one.
 */
export function numPad(onSubmit: (value: string, firstDigitAt: number | null) => void, maxDigits = MAX_DIGITS): NumPad {
  let value = '';
  let disabled = false;
  let firstDigitAt: number | null = null;
  const display = h('output', { class: 'numpad-display', 'aria-live': 'polite', 'aria-label': 'Ditt svar' }, ' ');
  const ok = h('button', { class: 'numpad-key ok', type: 'button', 'aria-label': 'Svara', disabled: true, onclick: () => submit() }, icon('check'));
  const keys = [...'123456789'].map((d) => key(d));
  const back = h('button', { class: 'numpad-key back', type: 'button', 'aria-label': 'Sudda', onclick: () => erase() }, icon('erase'));
  const buttons = [...keys, back, key('0'), ok];

  function key(d: string) {
    return h('button', { class: 'numpad-key', type: 'button', onclick: () => type(d) }, d);
  }
  function update() {
    display.textContent = value || ' ';
    ok.disabled = disabled || value === '';
  }
  function type(d: string) {
    if (disabled || value.length >= maxDigits) return;
    firstDigitAt ??= performance.now();
    value = value === '0' ? d : value + d;
    update();
  }
  function erase() {
    if (disabled) return;
    value = value.slice(0, -1);
    update();
  }
  function submit() {
    if (disabled || value === '') return;
    onSubmit(value, firstDigitAt);
  }

  return {
    el: h('div', { class: 'numpad' }, display, h('div', { class: 'numpad-keys' }, buttons)),
    display,
    onKey(e) {
      if (/^\d$/.test(e.key)) type(e.key);
      else if (e.key === 'Backspace') erase();
      else if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else return;
    },
    disable() {
      disabled = true;
      for (const b of buttons) b.disabled = true;
    },
  };
}
