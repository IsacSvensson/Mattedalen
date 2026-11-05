import type { ItemId } from '../../engine';
import { formatClock, phrase, type Time } from './time';

/**
 * Klocktornet's tasks, steps 0–5 of the stair in docs/PLAN-KLOCKAN.md (NCM's
 * MTi1): the day, the face, the hour hand alone, whole and half hours,
 * quarters and five minutes at a time. Each time is asked in several forms,
 * each an item of its own, so "För vuxna" can show them apart.
 */
export type ReadForm = 'ord' | 'dig' | 'stall';
export type HandPlace = 'on' | 'after' | 'half' | 'before';

export type Task =
  /** Step 0: before and after, how long, near and far. */
  | { kind: 'day'; key: string }
  /** Step 1: the face and its hands. */
  | { kind: 'face'; key: string }
  /** Step 2: a clock with only the hour hand: on 3, just after 3, halfway between 3 and 4, just before 4. */
  | { kind: 'hourHand'; h: number; place: HandPlace }
  /** Steps 3–5: a time read as words, read as digital time, or set on the face. */
  | { kind: 'read'; form: ReadForm; t: Time }
  /** Step 5: where the minute hand stands, as minutes past the hour. */
  | { kind: 'minutes'; t: Time }
  /** Why the clock shows what it does: units of time, and how long until the next hour. */
  | { kind: 'why'; key: string };

/** A question with words to choose from (`answer` first). */
export interface WordTask {
  unit: UnitId;
  prompt: string;
  answer: string;
  options: string[];
  /** The line on the help card. */
  why: string;
  /** A time to show on the face beside the question. */
  show?: Time;
}

const LONG = ['några sekunder', 'några minuter', 'några timmar', 'några dagar', 'några veckor'];

export const DAY_TASKS: Record<string, WordTask> = {
  forst1: { unit: 'dagen', prompt: 'Vad kommer först på dagen: frukost eller middag?', answer: 'frukost', options: ['middag'], why: 'Frukost äter man på morgonen, middag på kvällen.' },
  forst2: { unit: 'dagen', prompt: 'Vad kommer först: middag eller läggdags?', answer: 'middag', options: ['läggdags'], why: 'Först äter man middag, sedan är det läggdags.' },
  forst3: { unit: 'dagen', prompt: 'Vad kommer först: skolan eller läggdags?', answer: 'skolan', options: ['läggdags'], why: 'Skolan är på dagen, läggdags på kvällen.' },
  efter1: { unit: 'dagen', prompt: 'Vad kommer efter skolan: middag eller frukost?', answer: 'middag', options: ['frukost'], why: 'Frukost är före skolan, middag efter.' },
  morgon: { unit: 'dagen', prompt: 'När äter man frukost?', answer: 'på morgonen', options: ['på kvällen', 'mitt i natten'], why: 'Frukost är dagens första mål, på morgonen.' },
  tander: { unit: 'dagen', prompt: 'Hur lång tid tar det att borsta tänderna?', answer: 'några minuter', options: LONG, why: 'Att borsta tänderna tar ungefär två minuter.' },
  skoldag: { unit: 'dagen', prompt: 'Hur lång är en skoldag?', answer: 'några timmar', options: LONG, why: 'En skoldag är några timmar, från morgonen till eftermiddagen.' },
  hopp: { unit: 'dagen', prompt: 'Hur lång tid tar det att hoppa jämfota en gång?', answer: 'några sekunder', options: LONG, why: 'Ett hopp går fort: en sekund eller två.' },
  sommarlov: { unit: 'dagen', prompt: 'Hur långt är sommarlovet?', answer: 'några veckor', options: LONG, why: 'Sommarlovet är flera veckor.' },
  nara1: { unit: 'dagen', prompt: 'Vad kommer först: i morgon eller nästa vecka?', answer: 'i morgon', options: ['nästa vecka'], why: 'I morgon är om en dag. Nästa vecka är längre bort.' },
  nara2: { unit: 'dagen', prompt: 'Vad kommer först: i kväll eller i morgon?', answer: 'i kväll', options: ['i morgon'], why: 'I kväll är i dag. I morgon är efter natten.' },
  nara3: { unit: 'dagen', prompt: 'Vad var närmast nu: i går eller förra veckan?', answer: 'i går', options: ['förra veckan'], why: 'I går var för en dag sedan. Förra veckan är längre bort.' },
};

export const FACE_TASKS: Record<string, WordTask> = {
  tim: { unit: 'urtavlan', prompt: 'Vilken visare visar vilken timme det är?', answer: 'timvisaren', options: ['minutvisaren'], why: 'Timvisaren är den korta visaren. Den visar timmen.', show: { h: 3, m: 0 } },
  min: { unit: 'urtavlan', prompt: 'Vad visar minutvisaren?', answer: 'minuterna', options: ['timmen'], why: 'Minutvisaren är den långa visaren. Den visar hur många minuter som har gått.', show: { h: 3, m: 0 } },
  topp: { unit: 'urtavlan', prompt: 'Vilken siffra står högst upp på klockan?', answer: '12', options: ['1', '6', '3'], why: 'Högst upp står 12. Där börjar visarna sitt varv.' },
  varv: { unit: 'urtavlan', prompt: 'Minutvisaren går ett helt varv. Hur många minuter är det?', answer: '60', options: ['12', '100', '30'], why: 'Ett helt varv för minutvisaren är 60 minuter, en timme.' },
};

export const WHY_TASKS: Record<string, WordTask> = {
  helvarv: { unit: 'hel', prompt: 'Minutvisaren går ett helt varv. Hur lång tid har gått?', answer: 'en timme', options: ['en minut', 'tolv minuter', 'en halvtimme'], why: 'Ett helt varv är 60 minuter. Det är en timme.' },
  halvtimme: { unit: 'halv', prompt: 'Hur många minuter är en halvtimme?', answer: '30', options: ['50', '15', '20'], why: 'En timme är 60 minuter. Hälften av 60 är 30.' },
  kvarhalv: { unit: 'halv', prompt: 'Klockan är 7:30. Hur många minuter är det kvar till 8:00?', answer: '30', options: ['70', '8', '50'], why: 'Minutvisaren har gått ett halvt varv. Ett halvt varv till är 30 minuter.', show: { h: 7, m: 30 } },
  timhalv: { unit: 'halv', prompt: 'Var står timvisaren när klockan är halv åtta?', answer: 'mitt emellan 7 och 8', options: ['på 8', 'på 7', 'på 6'], why: 'Halv åtta är halvvägs till åtta. Timvisaren står mitt emellan 7 och 8.' },
  kvart: { unit: 'kvart', prompt: 'Hur många minuter är en kvart?', answer: '15', options: ['4', '25', '10'], why: 'En kvart är en fjärdedel av en timme: 15 minuter.' },
  kvartar: { unit: 'kvart', prompt: 'Hur många kvartar är en timme?', answer: '4', options: ['2', '15', '60'], why: 'Fyra kvartar är ett helt varv: 15 + 15 + 15 + 15 = 60 minuter.' },
  tvakvartar: { unit: 'kvart', prompt: 'Två kvartar, hur lång tid är det?', answer: 'en halvtimme', options: ['en timme', 'en kvart', 'två minuter'], why: 'Två kvartar är 15 + 15 = 30 minuter, en halvtimme.' },
  kvarkvart: { unit: 'kvart', prompt: 'Klockan är 3:45. Hur många minuter är det kvar till 4:00?', answer: '15', options: ['45', '5', '4'], why: 'Minutvisaren står på 9. Till 12 är det tre steg: 5, 10, 15 minuter.', show: { h: 3, m: 45 } },
  minutsteg: { unit: 'femmin', prompt: 'Minutvisaren går från 3 till 4. Hur många minuter har gått?', answer: '5', options: ['1', '10', '60'], why: 'Mellan två siffror är det fem minuter för minutvisaren.' },
};

/** The parts, in the order of the stair. */
export const UNIT_DEFS = [
  { id: 'dagen', title: 'Dagen', requires: [], lane: 'dag' },
  { id: 'urtavlan', title: 'Urtavlan', requires: [] },
  { id: 'timvisaren', title: 'Timvisaren', requires: ['urtavlan'], lane: 'tim' },
  { id: 'hel', title: 'Hela timmar', requires: ['urtavlan'] },
  { id: 'halv', title: 'Halvtimmar', requires: ['hel'] },
  { id: 'kvart', title: 'Kvart över och kvart i', requires: ['halv'] },
  { id: 'femmin', title: 'Fem minuter i taget', requires: ['kvart'] },
] as const;

export type UnitId = (typeof UNIT_DEFS)[number]['id'];

const at = (h: number, m: number): Time => ({ h, m });
/** The times of each part: spread round the face, with the hour after 12 (12:30 is "halv ett"). */
export const TIMES: Record<'hel' | 'halv' | 'kvart' | 'femmin', Time[]> = {
  hel: [1, 3, 6, 8, 10, 12].map((h) => at(h, 0)),
  halv: [12, 2, 3, 5, 9, 11].map((h) => at(h, 30)),
  kvart: [at(1, 15), at(4, 15), at(7, 15), at(12, 15), at(2, 45), at(5, 45), at(8, 45), at(11, 45)],
  femmin: [at(1, 5), at(2, 10), at(3, 20), at(4, 25), at(6, 35), at(7, 40), at(9, 50), at(10, 55)],
};
/** The hours of the clock with only the hour hand. */
export const HOUR_HAND_HOURS = [3, 8];
export const HAND_PLACES: HandPlace[] = ['on', 'after', 'half', 'before'];
/** Where the hour hand stands for each place: minutes past the hour. */
export const HAND_MINUTES: Record<HandPlace, number> = { on: 0, after: 8, half: 30, before: 52 };

export function unitOfTime(t: Time): 'hel' | 'halv' | 'kvart' | 'femmin' {
  if (t.m === 0) return 'hel';
  if (t.m === 30) return 'halv';
  if (t.m === 15 || t.m === 45) return 'kvart';
  return 'femmin';
}

const timeKey = (t: Time) => `${t.h}:${String(t.m).padStart(2, '0')}`;

export function taskId(t: Task): ItemId {
  switch (t.kind) {
    case 'day':
      return `day:${t.key}`;
    case 'face':
      return `ur:${t.key}`;
    case 'hourHand':
      return `tim:${t.h}:${t.place}`;
    case 'read':
      return `kl:${t.form}:${timeKey(t.t)}`;
    case 'minutes':
      return `kl:min:${timeKey(t.t)}`;
    case 'why':
      return `fs:${t.key}`;
  }
}

export function parseTaskId(id: ItemId): Task {
  const [head, a, b, c] = id.split(':');
  const time = (h?: string, m?: string): Time => ({ h: Number(h), m: Number(m) });
  switch (head) {
    case 'day':
      return { kind: 'day', key: a! };
    case 'ur':
      return { kind: 'face', key: a! };
    case 'tim':
      return { kind: 'hourHand', h: Number(a), place: b as HandPlace };
    case 'fs':
      return { kind: 'why', key: a! };
    case 'kl':
      return a === 'min' ? { kind: 'minutes', t: time(b, c) } : { kind: 'read', form: a as ReadForm, t: time(b, c) };
    default:
      throw new Error(`Not a clock task: ${id}`);
  }
}

/** The words for the hour hand alone: "strax efter 3", "mitt emellan 3 och 4". */
export function handWords(h: number, place: HandPlace): string {
  const next = (h % 12) + 1;
  switch (place) {
    case 'on':
      return `på ${h}`;
    case 'after':
      return `strax efter ${h}`;
    case 'half':
      return `mitt emellan ${h} och ${next}`;
    case 'before':
      return `strax före ${next}`;
  }
}

export function wordTask(t: Task): WordTask | null {
  if (t.kind === 'day') return DAY_TASKS[t.key] ?? null;
  if (t.kind === 'face') return FACE_TASKS[t.key] ?? null;
  if (t.kind === 'why') return WHY_TASKS[t.key] ?? null;
  return null;
}

export function taskAnswer(t: Task): string {
  switch (t.kind) {
    case 'hourHand':
      return handWords(t.h, t.place);
    case 'read':
      return t.form === 'ord' ? phrase(t.t)! : formatClock(t.t);
    case 'minutes':
      return String(t.t.m);
    default:
      return wordTask(t)!.answer;
  }
}

export function taskUnit(t: Task): UnitId {
  switch (t.kind) {
    case 'hourHand':
      return 'timvisaren';
    case 'read':
    case 'minutes':
      return unitOfTime(t.t);
    default:
      return wordTask(t)!.unit;
  }
}

/** Every task of steps 0–5. Words only where there are words yet (not for five minutes: KL5). */
export function allTasks(): Task[] {
  const out: Task[] = [];
  for (const key of Object.keys(DAY_TASKS)) out.push({ kind: 'day', key });
  for (const key of Object.keys(FACE_TASKS)) out.push({ kind: 'face', key });
  for (const h of HOUR_HAND_HOURS) for (const place of HAND_PLACES) out.push({ kind: 'hourHand', h, place });
  for (const unit of ['hel', 'halv', 'kvart', 'femmin'] as const) {
    for (const t of TIMES[unit]) {
      if (unit !== 'femmin') out.push({ kind: 'read', form: 'ord', t });
      out.push({ kind: 'read', form: 'dig', t }, { kind: 'read', form: 'stall', t });
      if (unit === 'femmin') out.push({ kind: 'minutes', t });
    }
  }
  for (const key of Object.keys(WHY_TASKS)) out.push({ kind: 'why', key });
  return out;
}

/** A task and its answer, for grown-ups: "3:30 i ord: halv fyra", "ställa visarna på 3:30". */
export function taskWithAnswer(t: Task): string {
  switch (t.kind) {
    case 'read': {
      const time = `${t.t.h}:${String(t.t.m).padStart(2, '0')}`;
      if (t.form === 'ord') return `${time} i ord: ${taskAnswer(t)}`;
      if (t.form === 'dig') return `urtavlan som digital tid: ${time}`;
      return `ställa visarna på ${time}`;
    }
    case 'minutes':
      return `minutvisaren på ${t.t.m / 5}: ${t.t.m} minuter`;
    case 'hourHand':
      return `timvisaren ${taskAnswer(t)}`;
    default: {
      const w = wordTask(t)!;
      return `${w.prompt} ${w.answer}`;
    }
  }
}
