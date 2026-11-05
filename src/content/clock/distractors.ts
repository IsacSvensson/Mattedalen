import type { DistractorCandidate } from '../../engine';
import { handWords, HAND_PLACES, taskAnswer, wordTask, type Task } from './tasks';
import { formatClock, hourHandAt, hourName, nextHour, parseClock, phrase, prevHour, type Time } from './time';

/**
 * The known mistakes with a clock (docs/PLAN-KLOCKAN.md, KLOCKAN-UNDERLAG):
 * every wrong choice is one of them, and the help card says which.
 */
export type Mistake =
  /** The wrong hour's name at half past and quarter to: 3:30 as "halv tre", or as 4:30. */
  | 'hourName'
  /** The hands mixed up: the hour hand read as the minutes and the other way round. */
  | 'handsSwapped'
  /** The number under the minute hand read as minutes: 3:30 as 3:06. */
  | 'digitAsMinutes'
  /** "i" and "över" mixed up: 3:45 as "kvart över". */
  | 'pastTo'
  /** The hour hand read as standing on a number, not between two. */
  | 'hourOnNumber'
  /** The wrong unit or the wrong place on the face in a question about why. */
  | 'other';

export interface Candidate extends DistractorCandidate {
  mistake: Mistake;
}

/** Where the minute hand points, as the number under it: 30 minutes is 6, 0 is 12. */
const handNumber = (m: number) => (m === 0 ? 12 : m / 5);

/** A time with the hands swapped: the minute hand's number as the hour, the hour hand's place as minutes (to five). */
function swapped(t: Time): Time {
  return { h: handNumber(t.m), m: Math.floor(hourHandAt(t) % 12) * 5 };
}

/** Wrong times a child might read, each with its mistake. */
function wrongTimes(t: Time): { t: Time; mistake: Mistake; weight: number }[] {
  const out: { t: Time; mistake: Mistake; weight: number }[] = [];
  if (t.m >= 30) out.push({ t: { h: nextHour(t.h), m: t.m }, mistake: 'hourName', weight: 3 });
  else out.push({ t: { h: nextHour(t.h), m: t.m }, mistake: 'hourOnNumber', weight: 1 }, { t: { h: prevHour(t.h), m: t.m }, mistake: 'hourOnNumber', weight: 1 });
  if (t.m === 15) out.push({ t: { h: t.h, m: 45 }, mistake: 'pastTo', weight: 2 });
  if (t.m === 45) out.push({ t: { h: t.h, m: 15 }, mistake: 'pastTo', weight: 2 }, { t: { h: nextHour(t.h), m: 15 }, mistake: 'pastTo', weight: 2 });
  out.push({ t: swapped(t), mistake: 'handsSwapped', weight: 2 });
  return out;
}

/** The wrong words for a time: the same mistakes, said. */
function wrongWords(t: Time): { value: string; mistake: Mistake; weight: number }[] {
  const out: { value: string; mistake: Mistake; weight: number }[] = [];
  const add = (time: Time, mistake: Mistake, weight: number) => {
    const words = phrase(time);
    if (words) out.push({ value: words, mistake, weight });
  };
  // Half past: half of this hour, "halv tre" for 3:30 (the Swedish trap).
  if (t.m === 30) add({ h: prevHour(t.h), m: 30 }, 'hourName', 3);
  if (t.m === 45) add({ h: prevHour(t.h), m: 45 }, 'hourName', 2);
  for (const w of wrongTimes(t)) add(w.t, w.mistake, w.weight);
  // A whole hour: the hour before or after.
  if (t.m === 0) add({ h: nextHour(t.h), m: 0 }, 'hourOnNumber', 1);
  return out;
}

/** Every wrong answer for a task with the mistake behind it, without the answer and without repeats. */
export function candidates(task: Task): Candidate[] {
  const answer = taskAnswer(task);
  const out: Candidate[] = [];
  const add = (value: string, mistake: Mistake, weight: number) => {
    if (value !== answer && !out.some((c) => c.value === value)) out.push({ value, mistake, weight });
  };
  switch (task.kind) {
    case 'read':
      if (task.form === 'ord') for (const w of wrongWords(task.t)) add(w.value, w.mistake, w.weight);
      else {
        // The number under the minute hand read as minutes: 3:30 as 3:06.
        add(formatClock({ h: task.t.h, m: handNumber(task.t.m) % 60 }), 'digitAsMinutes', 3);
        for (const w of wrongTimes(task.t)) add(formatClock(w.t), w.mistake, w.weight);
      }
      break;
    case 'minutes':
      add(String(handNumber(task.t.m)), 'digitAsMinutes', 3);
      add(String((task.t.m + 5) % 60), 'other', 1);
      add(String((task.t.m + 55) % 60), 'other', 1);
      add(String(60 - task.t.m), 'pastTo', 1);
      break;
    case 'hourHand': {
      for (const place of HAND_PLACES) add(handWords(task.h, place), place === 'on' ? 'hourOnNumber' : 'other', place === 'on' ? 2 : 1.5);
      add(handWords(prevHour(task.h), 'half'), 'other', 1);
      break;
    }
    default:
      for (const option of wordTask(task)!.options) add(option, 'other', 1);
  }
  return out;
}

export function clockDistractors(task: Task): DistractorCandidate[] {
  return candidates(task).map(({ value, weight }) => ({ value, weight }));
}

/** The mistake behind a wrong answer, or null when it is none of the known ones. */
export function mistakeOf(task: Task, given: string): Mistake | null {
  return candidates(task).find((c) => c.value === given)?.mistake ?? null;
}

/** A friendly line about the mistake, for the help card. Undefined when there is nothing to say. */
export function clockNote(task: Task, given: string): string | undefined {
  const mistake = mistakeOf(task, given);
  const t = task.kind === 'read' || task.kind === 'minutes' ? task.t : null;
  switch (mistake) {
    case 'digitAsMinutes':
      return 'Minutvisaren visar minuter. Varje steg mellan siffrorna är fem minuter: fem, tio, femton …';
    case 'handsSwapped':
      return 'Timvisaren är den korta visaren. Den visar timmen. Den långa visar minuterna.';
    case 'hourName': {
      if (!t) return undefined;
      const next = hourName(nextHour(t.h));
      if (t.m === 30) return `Halv ${next} är halvvägs till ${next}. Timvisaren står mitt emellan ${t.h} och ${nextHour(t.h)}.`;
      if (t.m === 45) return `Kvart i ${next} är en kvart kvar till ${next}. Timvisaren står nästan på ${nextHour(t.h)}.`;
      return `Timvisaren har gått förbi ${t.h}, men inte ända till ${nextHour(t.h)}.`;
    }
    case 'pastTo':
      return 'Kvart över: minutvisaren står på 3. Kvart i: minutvisaren står på 9.';
    case 'hourOnNumber':
      return 'Timvisaren rör sig hela tiden. Den står bara på en siffra vid hel timme.';
    default:
      return undefined;
  }
}

/** Where the hour hand should stand, in words: "på 3", or "mellan 3 och 4" when the minutes have moved it on. */
function hourPlace(t: Time): string {
  return t.m === 0 ? `på ${t.h}` : `mellan ${t.h} och ${nextHour(t.h)}`;
}

/**
 * Which hand is wrong when the child has set the hands (docs/PLAN-KLOCKAN.md,
 * KL3): "Minutvisaren står rätt. Timvisaren ska stå mellan 3 och 4." Undefined
 * when the answer is no time, or the right one.
 */
export function handsNote(expected: Time, given: string): string | undefined {
  const g = parseClock(given);
  if (!g) return undefined;
  const minuteRight = g.m === expected.m;
  const hourRight = g.h === expected.h;
  if (minuteRight && hourRight) return undefined;
  const minute = `på ${handNumber(expected.m)}, ${expected.m === 0 ? 'hel timme' : `${expected.m} minuter`}`;
  if (minuteRight) return `Minutvisaren står rätt. Timvisaren ska stå ${hourPlace(expected)}.`;
  if (hourRight) return `Timvisaren står rätt. Minutvisaren ska stå ${minute}.`;
  return `Minutvisaren ska stå ${minute}, och timvisaren ${hourPlace(expected)}.`;
}
