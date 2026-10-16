import type { Question, SessionMode } from '../../../engine';
import { confusionNote, derivationSteps, formOf, landings, parseTaskId, taskAnswer, taskWithAnswer, unitOf, type Task } from '../../../content/hundred';
import type { Profile } from '../../../storage';
import type { AppContext } from '../../../shell/app';
import { icon } from '../../../shell/components/icons';
import { h } from '../../../shell/dom';
import { runSession, type SessionPlace } from '../../../shell/screens/session';
import { base10, base10Builder, base10Sum } from '../components/base10';
import { emptyNumberLine } from '../components/emptyLine';
import { hundredChart } from '../components/hundredChart';
import { pathDeps } from '../pack';
import { showPath } from './path';
import { showPathEnd } from './sessionEnd';
import { keepTerms } from '../../../shell/words';

/** A session on Stigen: walking from post to post is answering questions. */
export function showPathSession(ctx: AppContext, profile: Profile, mode: SessionMode): Promise<void> {
  return runSession(ctx, profile, pathSession(ctx, profile), mode);
}

/** Where the hops land, read aloud: "47 … 50 … 55". */
const spokenStops = (stops: number[]) => stops.join(' … ');

const tensOnes = (n: number) => ({ tens: Math.floor(n / 10), ones: n % 10 });

/** What to build for a task about tens and ones, and how to say it. */
function buildTask(t: Task): { target: number; start?: { tens: number; ones: number }; instruction: string } | null {
  if (t.kind === 'place') {
    const { tens, ones } = tensOnes(t.n);
    if (t.ask === 'number') return { target: t.n, instruction: `Bygg ${tens} tiotal och ${ones} ental.` };
    if (t.ask === 'swapped') return { target: t.n, instruction: `Bygg ${ones} ental och ${tens} tiotal.` };
    return { target: t.n, instruction: `Bygg ${t.n} med tiotal och ental.` };
  }
  if (t.kind === 'regroup') return { target: taskAnswer(t), start: { tens: t.tens, ones: t.ones }, instruction: `Här är ${t.tens} tiotal och ${t.ones} ental. Byt tio ental mot ett tiotal.` };
  if (t.kind === 'tens') return { target: 10 * t.n, instruction: `Bygg ${t.n} tiotal.` };
  if (t.kind === 'count') return { target: t.n, instruction: `Bygg ${t.n} med tiotal.` };
  return null;
}

/** Rods and cubes for a task about tens and ones, whole tens or halves; null for a calculation on the line. */
function rodsOf(t: Task): HTMLElement | null {
  switch (t.kind) {
    case 'place':
    case 'half':
      return base10(Math.floor(t.n / 10), t.n % 10);
    case 'regroup':
      return base10(t.tens + Math.floor(t.ones / 10), t.ones % 10);
    case 'tens':
      return base10(t.n, 0);
    case 'count':
      return base10(t.n / 10, 0);
    default:
      return null;
  }
}

/** The picture of a task: rods and cubes, or the hops on the empty number line. */
function picture(t: Task, opts: { hops?: boolean; animate?: boolean; onDone?: () => void } = {}): HTMLElement | null {
  const line = landings(t);
  if (t.kind === 'fact' || t.kind === 'next') {
    if (line) return emptyNumberLine({ stops: line.stops, hops: opts.hops ?? true, animate: opts.animate, onDone: opts.onDone });
  }
  if (opts.onDone) setTimeout(opts.onDone, 0);
  return rodsOf(t);
}

/** A second picture beside the line: rods and cubes for a two-digit sum or a double, the hundred chart for hops of ten. */
function extraPicture(t: Task): HTMLElement | null {
  if (t.kind !== 'fact') return null;
  const unit = formOf(t);
  if (unit === 'hopptio') return hundredChart(landings(t)!.stops.filter((n) => n >= 1));
  if (t.op === '+' && (unit === 'tvasiffr' || unit === 'dubbla')) return base10Sum(t.x, t.y);
  return null;
}

function pathSession(ctx: AppContext, profile: Profile): SessionPlace {
  const strategyOf = (q: Question) => q.item.hints.find((x) => x.kind === 'strategy')?.text;
  return {
    deps: pathDeps(ctx),
    homeLabel: 'Tillbaka till stigen',
    leave: () => showPath(ctx, profile),
    end: (summary) => showPathEnd(ctx, profile, summary),
    // Two-digit answers are timed to the first digit, as at the brook.
    timeToFirstDigit: true,
    keys: 'stone',

    /**
     * A new task: tens and ones are built with rods and cubes first; a
     * calculation is shown as hops on the empty number line.
     */
    intro(q, ready) {
      const t = parseTaskId(q.item.id);
      const build = buildTask(t);
      const answerLine = h('p', { class: 'intro-answer' }, taskWithAnswer(t));
      if (build) {
        const after = [answerLine, h('p', { class: 'strategy' }, keepTerms(strategyOf(q) ?? ''))];
        return {
          label: [icon('lantern'), unitOf(t) === 'tiental' ? 'Tiotal och ental' : 'Hela tiotal'],
          spoken: `${build.instruction} ${q.item.prompt}`,
          body: base10Builder({ ...build, onDone: ready }),
          after,
        };
      }
      const line = landings(t);
      // A hop of ten is shown on the hundred chart, as a step straight down; the rest as hops on the line.
      const hop = t.kind === 'fact' && formOf(t) === 'hopptio';
      if (hop) setTimeout(ready, 0);
      const body = h('div', { class: 'intro-pictures' }, hop ? null : picture(t, { animate: true, onDone: ready }), extraPicture(t));
      return {
        label: [icon('lantern'), 'Nytt på stigen'],
        spoken: `Nytt på stigen. ${q.item.prompt}.${line ? ` ${spokenStops(line.stops)}` : ''}`,
        body,
        after: [answerLine, strategyOf(q) ? h('p', { class: 'strategy' }, keepTerms(strategyOf(q)!)) : null],
      };
    },

    /** While a task is new to the child, where to start (or the rods and cubes); later only the numbers. */
    askVisual(q) {
      const s = q.state;
      const fresh = s === undefined || s.status === 'new' || (s.status === 'learning' && s.box === 0);
      if (!fresh) return null;
      const t = parseTaskId(q.item.id);
      // Rods and cubes would be the answer to a task about tens and ones; whole tens are counted on the rods.
      if (t.kind === 'place' || t.kind === 'regroup') return null;
      return h('div', { class: 'ask-pictures' }, picture(t, { hops: false }));
    },

    /** Steps from what the child knows; only where to start on the line, so the hops do not give the answer away. */
    derivation(q) {
      const steps = derivationSteps(q.item.id);
      if (!steps) return null;
      const t = parseTaskId(q.item.id);
      const start = picture(t, { hops: false });
      return { steps, visual: start ?? h('span') };
    },

    help(q, fb) {
      const t = parseTaskId(q.item.id);
      return {
        note: confusionNote(q.item.id, fb.given),
        strategy: strategyOf(q),
        visual: h('div', { class: 'help-pictures' }, picture(t), extraPicture(t)),
      };
    },
  };
}
