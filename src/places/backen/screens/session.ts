import type { Question, SessionMode } from '../../../engine';
import {
  confusionNote,
  derivationSteps,
  EQUALITIES,
  equalityId,
  isEqualityId,
  landings,
  parseFactId,
  type Equality,
} from '../../../content/addition';
import type { Profile } from '../../../storage';
import type { AppContext } from '../../../shell/app';
import { icon } from '../../../shell/components/icons';
import { h } from '../../../shell/dom';
import { runSession, type SessionPlace } from '../../../shell/screens/session';
import { balance } from '../components/balance';
import { numberLine } from '../components/numberLine';
import { tenFrame } from '../components/tenFrame';
import { brookDeps } from '../pack';
import { showBrook } from './brook';
import { showBrookEnd } from './sessionEnd';

/** A session at the brook: hopping on the stones is answering questions. */
export function showBrookSession(ctx: AppContext, profile: Profile, mode: SessionMode): Promise<void> {
  return runSession(ctx, profile, brookSession(ctx, profile), mode);
}

const equalities = new Map<string, Equality>(EQUALITIES.map((e) => [equalityId(e), e]));

/** Landing points of a fact, read aloud (J2): "8 … 10 … 13". */
export const spokenStops = (stops: number[]) => stops.join(' … ');

const tenFrameOf = (q: Question) => {
  const data = q.item.hints.find((x) => x.kind === 'tenframe')?.data as { a: number; b: number } | undefined;
  return data ? tenFrame(data.a, data.b) : null;
};

function brookSession(ctx: AppContext, profile: Profile): SessionPlace {
  /** The number line with every hop, for help and derivation paths. */
  const hopsOf = (q: Question) => numberLine({ stops: landings(parseFactId(q.item.id)).stops });
  const picture = (q: Question): Element => {
    const e = equalities.get(q.item.id);
    return e ? balance(e) : hopsOf(q);
  };
  return {
    deps: brookDeps(ctx),
    homeLabel: 'Tillbaka till bäcken',
    leave: () => showBrook(ctx, profile),
    end: (summary) => showBrookEnd(ctx, profile, summary),
    // Two-digit answers are timed to the first digit (J5).
    timeToFirstDigit: true,

    /** A new fact: the animal hops to the landing points; a new equality: the scale. */
    intro(q, ready) {
      const e = equalities.get(q.item.id);
      if (e) {
        setTimeout(ready, 0);
        return {
          label: [icon('steps'), 'Vågen'],
          spoken: `Vågen. Båda sidor ska vara lika mycket. ${q.item.prompt}`,
          body: balance(e),
          after: [h('p', { class: 'strategy' }, 'Likhetstecknet betyder: lika mycket på båda sidor.')],
        };
      }
      const f = parseFactId(q.item.id);
      const { stops } = landings(f);
      const strategy = q.item.hints.find((x) => x.kind === 'strategy')?.text;
      const frame = tenFrameOf(q);
      return {
        label: [icon('steps'), 'En ny sten'],
        spoken: `En ny sten. ${q.item.prompt}. ${spokenStops(stops)}`,
        body: h('div', { class: 'intro-pictures' }, numberLine({ stops, animate: true, onDone: ready }), frame),
        after: [h('p', { class: 'intro-answer' }, `${q.item.prompt} = ${f.answer}`), strategy ? h('p', { class: 'strategy' }, strategy) : null],
      };
    },

    /**
     * While a fact is new to the child (the first step of learning), the
     * stones are shown with where to start; later only the numbers.
     */
    askVisual(q) {
      const e = equalities.get(q.item.id);
      if (e) return balance(e);
      // Right after the intro the question still carries the state from before it ('new').
      const s = q.state;
      const fresh = s === undefined || s.status === 'new' || (s.status === 'learning' && s.box === 0);
      if (!fresh) return null;
      const { stops } = landings(parseFactId(q.item.id));
      return h('div', { class: 'ask-pictures' }, numberLine({ stops, hops: false }), tenFrameOf(q));
    },

    questionLabel(q) {
      if (!isEqualityId(q.item.id)) return null;
      return q.item.tags.includes('equality:truefalse') ? 'Stämmer det?' : 'Vad ska stå i rutan?';
    },

    choiceLabel: (value) => (value === 'ja' ? 'Ja' : value === 'nej' ? 'Nej' : value),
    // Ja is always on the left, so the child never has to look for it.
    choiceOrder: (values) => (values.includes('ja') ? ['ja', 'nej'] : values),

    derivation(q) {
      if (isEqualityId(q.item.id)) return null;
      const steps = derivationSteps(q.item.id);
      // Only where to start: the hops would show the answer before the child has walked there.
      return steps ? { steps, visual: numberLine({ stops: landings(parseFactId(q.item.id)).stops, hops: false }) } : null;
    },

    help(q, fb) {
      return {
        note: confusionNote(q.item.id, fb.given),
        strategy: q.item.hints.find((x) => x.kind === 'strategy')?.text,
        visual: picture(q),
      };
    },
  };
}
