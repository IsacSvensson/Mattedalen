import type { AnswerFormat, Hint, Item } from '../../engine';
import { allTasks, HAND_MINUTES, taskAnswer, taskId, taskUnit, UNIT_DEFS, wordTask, type Task } from './tasks';
import { formatClock, hourName, nextHour, phrase, type Time } from './time';

/**
 * What the face beside a question shows (the `clock` hint, for the place's
 * screens in KL3): a time, or only the hour hand. No face for a question in words.
 */
export interface ClockShow {
  time: Time;
  /** Only the hour hand (step 2). */
  hourOnly?: boolean;
}

const fives = (m: number) => Array.from({ length: m / 5 }, (_, i) => (i + 1) * 5).join(', ');

/** The line on the help card: why the clock shows what it does, in the right words (timvisaren, minutvisaren). */
export function strategyFor(task: Task): string {
  switch (task.kind) {
    case 'read':
    case 'minutes': {
      const t = task.t;
      const digital = formatClock(t);
      const next = hourName(nextHour(t.h));
      if (task.kind === 'minutes' || ![0, 15, 30, 45].includes(t.m)) {
        return `Minutvisaren på ${t.m / 5}: räkna ${fives(t.m)}. Det är ${t.m} minuter över ${t.h}: ${digital}.`;
      }
      if (t.m === 0) return `Minutvisaren på 12 och timvisaren på ${t.h}: klockan är ${hourName(t.h)}, ${digital}.`;
      if (t.m === 30) return `Minutvisaren på 6 är 30 minuter, en halv timme. Timvisaren är halvvägs till ${nextHour(t.h)}: halv ${next}, ${digital}.`;
      if (t.m === 15) return `Minutvisaren på 3 är 15 minuter, en kvart. ${capital(phrase(t)!)}, ${digital}.`;
      return `Minutvisaren på 9 är 45 minuter. En kvart kvar till ${next}: kvart i ${next}, ${digital}.`;
    }
    case 'hourHand': {
      const next = nextHour(task.h);
      switch (task.place) {
        case 'on':
          return `Timvisaren står på ${task.h}. Då är det hel timme.`;
        case 'after':
          return `Timvisaren har nyss gått förbi ${task.h}. Den rör sig hela tiden.`;
        case 'half':
          return `Timvisaren står mitt emellan ${task.h} och ${next}. Det är halvvägs till ${next}.`;
        case 'before':
          return `Timvisaren är nästan framme vid ${next}.`;
      }
    }
    // falls through: never reached
    default:
      return wordTask(task)!.why;
  }
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The question, before `present` chooses its form. */
function promptFor(task: Task): string {
  switch (task.kind) {
    case 'read':
      if (task.form === 'ord') return 'Vad är klockan?';
      if (task.form === 'dig') return 'Vilken digital tid visar klockan?';
      return `Ställ klockan på ${phrase(task.t) ?? formatClock(task.t)}.`;
    case 'minutes':
      return `Minutvisaren står på ${task.t.m / 5}. Hur många minuter över?`;
    case 'hourHand':
      return 'Var står timvisaren?';
    default:
      return wordTask(task)!.prompt;
  }
}

function showFor(task: Task): ClockShow | null {
  switch (task.kind) {
    case 'read':
      return task.form === 'stall' ? null : { time: task.t };
    case 'minutes':
      return { time: task.t };
    case 'hourHand':
      return { time: { h: task.h, m: HAND_MINUTES[task.place] }, hourOnly: true };
    default: {
      const show = wordTask(task)!.show;
      return show ? { time: show } : null;
    }
  }
}

/** Words are chosen; numbers can be written; the hands are set on the face (an answer of its own, KL3). */
function formatsFor(task: Task, answer: string): AnswerFormat[] {
  if (task.kind === 'read' && task.form === 'stall') return ['free'];
  return /^\d+$/.test(answer) ? ['choice', 'free'] : ['choice'];
}

export function buildItems(): Item[] {
  const order = new Map<string, number>();
  return allTasks().map((task) => {
    const id = taskId(task);
    const unitId = taskUnit(task);
    const answer = taskAnswer(task);
    const n = order.get(unitId) ?? 0;
    order.set(unitId, n + 1);
    const show = showFor(task);
    const hints: Hint[] = [{ kind: 'strategy', text: strategyFor(task) }];
    if (show) hints.push({ kind: 'clock', data: show });
    return {
      id,
      prompt: promptFor(task),
      answer,
      unitId,
      tags: [`unit:${unitId}`, `kind:${task.kind}`, ...(task.kind === 'read' ? [`form:${task.form}`] : [])],
      derivedFrom: [],
      hints,
      formats: formatsFor(task, answer),
      order: n,
    };
  });
}

export const UNIT_IDS = UNIT_DEFS.map((d) => d.id);
