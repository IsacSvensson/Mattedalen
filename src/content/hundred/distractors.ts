import type { DistractorCandidate } from '../../engine';
import { halfSplit } from './items';
import { crossesTen, formatFact, isTen, onesOf, taskAnswer, tenBelow, tensOf, unitOf, type Task } from './tasks';

const MIN_CANDIDATES = 5;
const MAX = 100;

/** 47 and 74: the digits the other way round. */
const reversed = (n: number) => (n >= 10 && n < 100 ? Number(String(n).split('').reverse().join('')) : n);

/** 52 − 6 = 54: the smaller ones digit taken from the larger, tens left alone. */
export const onesTurned = (x: number, y: number) => tenBelow(x) + (y - onesOf(x));

/** Hälften av 56 = 23: half of each digit, the odd ten dropped. */
const halfByDigits = (n: number) => 10 * Math.floor(tensOf(n) / 2) + Math.floor(onesOf(n) / 2);

/**
 * Plausible wrong answers, each from a known misconception:
 *
 * - ±1: one hop short, or the start counted too
 * - ±10: one hop of ten too many or too few, or the ten forgotten (47 + 8 = 45)
 * - 52 − 6 = 54: the ones taken the wrong way round
 * - 26 + 30 = 29: tens added to the ones; 34 + 5 = 84: ones added to the tens
 * - 47 and 74: tens and ones swapped
 * - hälften av 56 = 23: half of each digit
 */
export function hundredDistractors(t: Task): DistractorCandidate[] {
  const answer = taskAnswer(t);
  const out: DistractorCandidate[] = [];
  const add = (value: number, weight: number) => {
    if (Number.isInteger(value) && value >= 0 && value <= MAX && value !== answer && !out.some((c) => c.value === String(value)))
      out.push({ value: String(value), weight });
  };

  switch (t.kind) {
    case 'tens':
      add(t.n, 3);
      add(10 * t.n + 10, 1.5);
      add(10 * t.n - 10, 1.5);
      add(t.n + 10, 1);
      break;
    case 'count':
      add(t.n, 2);
      add(answer + 1, 2);
      add(answer - 1, 2);
      add(10, 1);
      break;
    case 'next':
      add(onesOf(t.n), 3);
      add(answer + 1, 2);
      add(answer - 1, 2);
      add(10 + answer, 1);
      break;
    case 'half':
      if (halfByDigits(t.n) !== answer) add(halfByDigits(t.n), 3);
      add(answer + 1, 2);
      add(answer - 1, 2);
      add(answer + 10, 1.5);
      add(answer - 10, 1.5);
      add(answer + 5, 1);
      break;
    case 'place':
      if (t.ask === 'tens') add(onesOf(t.n), 3);
      if (t.ask === 'ones') add(tensOf(t.n), 3);
      if (t.ask === 'tens' || t.ask === 'ones') {
        add(t.n, 2);
        add(answer + 1, 1);
        add(answer * 10, 1);
      } else {
        add(reversed(t.n), 3);
        add(tensOf(t.n) + onesOf(t.n), 2);
        add(answer + 10, 1);
        add(answer - 10, 1);
      }
      break;
    case 'regroup':
      add(10 * t.tens + onesOf(t.ones), 3);
      add(t.tens + t.ones, 2);
      add(answer + 10, 1);
      add(reversed(answer), 1);
      break;
    case 'fact': {
      const { op, x, y } = t;
      const unit = unitOf(t);
      if (unit === 'hopptio') {
        // 26 + 30 = 29: the tens added to the ones.
        add(op === '+' ? x + y / 10 : x - y / 10, 3);
        add(answer + 10, 2);
        add(answer - 10, 2);
      } else if (op === '+') {
        if (crossesTen(t)) add(answer - 10, 3);
        // 34 + 5 = 84: the ones added to the tens.
        if (!isTen(x) && y < 10 && x + 10 * y <= MAX) add(x + 10 * y, 1.5);
        add(answer + 10, 1);
      } else {
        if (crossesTen(t)) add(onesTurned(x, y), 3);
        if (crossesTen(t)) add(answer + 10, 1.5);
        add(x + y, 1);
        if (isTen(x) && y < 10) add(x - 10 + y, 2);
      }
      add(answer + 1, 2.5);
      add(answer - 1, 2.5);
      if (unit === 'tiotal') add(answer / 10, 2);
      if (reversed(answer) !== answer) add(reversed(answer), 1);
      break;
    }
  }
  add(answer + 2, 0.5);
  add(answer - 2, 0.5);
  for (let k = 3; out.length < MIN_CANDIDATES; k++) {
    add(answer + k, 0.3);
    add(answer - k, 0.3);
  }
  return out;
}

/** A short, kind note when a wrong answer is a typical mix-up; undefined otherwise. */
export function hundredNote(t: Task, given: string): string | undefined {
  const g = Number(given);
  const answer = taskAnswer(t);
  if (given.trim() === '' || !Number.isInteger(g) || g === answer) return undefined;
  if (g === answer + 1 || g === answer - 1) return `${g} är ett ${g > answer ? 'för mycket' : 'för lite'} – nära!`;
  if (answer >= 10 && g === reversed(answer)) return `${g} och ${answer} är olika tal. Tiotalen står först.`;
  switch (t.kind) {
    case 'next':
      if (g === onesOf(t.n)) return `${g} ental finns redan i ${t.n}. Hur många till blir ${answer + t.n}?`;
      return undefined;
    case 'half':
      if (g === halfByDigits(t.n) && halfSplit(t.n).tens) return `Dela upp ${t.n} i ${halfSplit(t.n).tens} och ${halfSplit(t.n).rest}, och ta hälften av båda.`;
      return undefined;
    case 'place':
      if (t.ask === 'tens' && g === onesOf(t.n)) return `${g} är entalen. Tiotalen är siffran som står först.`;
      if (t.ask === 'ones' && g === tensOf(t.n)) return `${g} är tiotalen. Entalen är siffran som står sist.`;
      return undefined;
    case 'regroup':
      if (g === 10 * t.tens + onesOf(t.ones)) return `${t.ones} ental är ett tiotal och ${onesOf(t.ones)} ental. Det tiotalet ska också räknas.`;
      return undefined;
    case 'fact': {
      const { op, x, y } = t;
      if (unitOf(t) === 'hopptio' && g === (op === '+' ? x + y / 10 : x - y / 10))
        return y === 10 ? `10 är ett tiotal. Hoppa tio en gång.` : `${y} är ${y / 10} tiotal. Hoppa tio ${y / 10} gånger.`;
      if (op === '+' && crossesTen(t) && g === answer - 10) return `Glöm inte det nya tiotalet: ${formatFact(op, x, y)} är mer än ${tenBelow(answer)}.`;
      if (op === '+' && !isTen(x) && y < 10 && g === x + 10 * y) return `${y} är ental. Lägg till dem till entalen i ${x}.`;
      if (op === '-' && crossesTen(t) && g === onesTurned(x, y))
        return `Man kan inte ta ${y} från ${onesOf(x)}. Gå ner till ${tenBelow(x)} först: ${formatFact('-', x, onesOf(x))} = ${tenBelow(x)}.`;
      if (op === '-' && g === x + y) return `${g} är ${formatFact('+', x, y)}. Här ska det vara minus.`;
      return undefined;
    }
    default:
      return undefined;
  }
}
