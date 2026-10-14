import type { FocusSet, Question, SessionMode } from '../../../engine';
import { confusionNote, derivationSteps, parseFactId } from '../../../content/multiplication';
import type { Profile } from '../../../storage';
import type { AppContext } from '../../../shell/app';
import { icon } from '../../../shell/components/icons';
import { plantIcon } from '../../../shell/components/plant';
import { h } from '../../../shell/dom';
import { runSession, type SessionPlace } from '../../../shell/screens/session';
import { arrayBuilder } from '../components/arrayBuilder';
import { arrayView, partsOf } from '../components/arrayView';
import { gardenDeps } from '../pack';
import { showGarden } from './garden';
import { showSessionEnd } from './sessionEnd';

/** A session in the garden: watering it is answering questions. */
export function showSession(ctx: AppContext, profile: Profile, mode: SessionMode, focus?: FocusSet): Promise<void> {
  return runSession(ctx, profile, gardenSession(ctx, profile), mode, focus);
}

function gardenSession(ctx: AppContext, profile: Profile): SessionPlace {
  const picture = (q: Question) => {
    const { a, b } = parseFactId(q.item.id);
    return arrayView(a, b, { size: 'small', parts: partsOf(q.item.hints) });
  };
  return {
    deps: gardenDeps(ctx),
    homeLabel: 'Tillbaka till trädgården',
    leave: (grew) => showGarden(ctx, profile, grew),
    end: (summary, focus) => showSessionEnd(ctx, profile, summary, focus),

    /**
     * A new fact: the child builds it as a rectangle of dots (or turns the
     * known mirrored fact around) and sees how it splits into known parts.
     */
    intro(q, ready) {
      const { a, b } = parseFactId(q.item.id);
      const strategy = q.item.hints.find((x) => x.kind === 'strategy')?.text;
      const swap = q.pairKnown ? q.item.hints.find((x) => x.kind === 'swap')?.text : undefined;
      return {
        label: [plantIcon('seed'), 'Ett nytt frö'],
        spoken: `Ett nytt frö. ${q.prompt}`,
        body: arrayBuilder({ rows: a, cols: b, parts: partsOf(q.item.hints), startRotated: q.pairKnown, onDone: ready }),
        after: [
          strategy ? h('p', { class: 'strategy' }, strategy) : null,
          swap ? h('p', { class: 'strategy swap' }, icon('rotate'), swap) : null,
        ],
      };
    },

    derivation(q) {
      const { a, b } = parseFactId(q.item.id);
      const steps = derivationSteps(a, b);
      return steps ? { steps, visual: picture(q) } : null;
    },

    help(q, fb) {
      const { a, b } = parseFactId(q.item.id);
      return {
        note: confusionNote(a, b, fb.given),
        strategy: q.item.hints.find((x) => x.kind === 'strategy')?.text,
        visual: picture(q),
      };
    },
  };
}
