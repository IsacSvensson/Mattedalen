import type { FocusSet, Question, SessionMode } from '../../../engine';
import { confusionNote, derivationStepsFor, divisionNote, isDivisionId, parseDivisionId, parseFactId } from '../../../content/multiplication';
import type { Profile } from '../../../storage';
import type { AppContext } from '../../../shell/app';
import { icon } from '../../../shell/components/icons';
import { bloomIcon, plantIcon } from '../../../shell/components/plant';
import { DEFAULT_DIVISION_SIGN, mathNodes } from '../../../shell/divisionSign';
import { h } from '../../../shell/dom';
import { runSession, type SessionPlace } from '../../../shell/screens/session';
import { arrayBuilder } from '../components/arrayBuilder';
import { divisionBuilder } from '../components/divisionBuilder';
import { shareBuilder, shareTaskOf } from '../components/shareBuilder';
import { groupsView, skipView } from '../components/groupsView';
import { arrayView, partsOf } from '../components/arrayView';
import { gardenDeps } from '../pack';
import { showGarden } from './garden';
import { showSessionEnd } from './sessionEnd';
import { keepTerms } from '../../../shell/words';

/** The square an item belongs to: a × b, or for ab ÷ b the rectangle of a rows of b. */
function square(id: string): { a: number; b: number } {
  if (!isDivisionId(id)) return parseFactId(id);
  const { quotient, divisor } = parseDivisionId(id);
  return { a: quotient, b: divisor };
}

/**
 * The picture of a "Lika stora grupper" task: baskets, or hops on the number
 * line (null when the hops go past 20). Undefined for every other item.
 */
function groupsPicture(q: Question): HTMLElement | null | undefined {
  const groups = q.item.hints.find((x) => x.kind === 'groups')?.data as { groups: number; each: number } | undefined;
  if (groups) return groupsView(groups.groups, groups.each);
  const skip = q.item.hints.find((x) => x.kind === 'skip')?.data as { stops: number[] } | undefined;
  return skip ? skipView(skip.stops) : undefined;
}

/** A session in the garden: watering it is answering questions. */
export function showSession(ctx: AppContext, profile: Profile, mode: SessionMode, focus?: FocusSet): Promise<void> {
  return runSession(ctx, profile, gardenSession(ctx, profile), mode, focus);
}

function gardenSession(ctx: AppContext, profile: Profile): SessionPlace {
  const picture = (q: Question) => {
    const { a, b } = square(q.item.id);
    return arrayView(a, b, { size: 'small', parts: partsOf(q.item.hints) });
  };
  const strategyText = (q: Question) => q.item.hints.find((x) => x.kind === 'strategy')?.text;
  /** The strategy, with delat med in the child's sign. */
  const strategyLine = (q: Question) => {
    const text = strategyText(q);
    return text ? h('p', { class: 'strategy' }, mathNodes(keepTerms(text), profile.settings.divisionSign ?? DEFAULT_DIVISION_SIGN)) : null;
  };
  /** A division as its rectangle, built with fixed rows: 42 ÷ 6 is 6 in each row, how many rows? */
  const buildDivision = (q: Question, ready: () => void) => {
    const { dividend, divisor } = parseDivisionId(q.item.id);
    return divisionBuilder({ dividend, divisor, onDone: ready });
  };

  return {
    deps: gardenDeps(ctx),
    homeLabel: 'Tillbaka till trädgården',
    leave: (grew) => showGarden(ctx, profile, grew),
    end: (summary, focus) => showSessionEnd(ctx, profile, summary, focus),

    /**
     * A new fact: the child builds it as a rectangle of dots (or turns the
     * known mirrored fact around) and sees how it splits into known parts.
     * A new division is built with rows of a given length; a "Dela lika"
     * task is dealt out into baskets.
     */
    intro(q, ready) {
      const groups = groupsPicture(q);
      if (groups !== undefined) {
        // Nothing to do with the hands here: the picture and the way to think, then the child answers.
        setTimeout(ready, 0);
        return {
          label: [icon('basket'), 'Lika stora grupper'],
          spoken: q.item.prompt,
          body: groups ?? h('span'),
          after: [strategyLine(q)],
        };
      }
      const share = shareTaskOf(q.item.hints);
      if (share) {
        return {
          label: [icon('basket'), 'Dela lika'],
          spoken: q.item.prompt,
          body: shareBuilder({ task: share, onDone: ready }),
          after: [strategyLine(q)],
        };
      }
      if (isDivisionId(q.item.id)) {
        return {
          label: [bloomIcon('blossom'), 'En ny blomma'],
          spoken: `En ny blomma. ${q.item.prompt}`,
          body: buildDivision(q, ready),
          after: [strategyLine(q)],
        };
      }
      const { a, b } = parseFactId(q.item.id);
      const swap = q.pairKnown ? q.item.hints.find((x) => x.kind === 'swap')?.text : undefined;
      return {
        label: [plantIcon('seed'), 'Ett nytt frö'],
        spoken: `Ett nytt frö. ${q.prompt}`,
        body: arrayBuilder({ rows: a, cols: b, parts: partsOf(q.item.hints), startRotated: q.pairKnown, onDone: ready }),
        after: [strategyLine(q), swap ? h('p', { class: 'strategy swap' }, icon('rotate'), swap) : null],
      };
    },

    /**
     * A hard fact: räknestigen. A hard division is built as its rectangle
     * where it has no path, and otherwise every other time.
     */
    derivation(q) {
      const steps = derivationStepsFor(q.item.id);
      if (isDivisionId(q.item.id) && (!steps || (q.state?.seen ?? 0) % 2 === 0)) {
        return {
          build: (q, ready) => ({
            label: [icon('steps'), 'Bygg den först'],
            spoken: `Bygg den först. ${q.item.prompt}`,
            body: buildDivision(q, ready),
            after: [],
          }),
        };
      }
      return steps ? { steps, visual: picture(q) } : null;
    },

    /** "Dela lika": the berries and baskets beside the question, to deal out if the child wants to. */
    askVisual(q) {
      const groups = groupsPicture(q);
      if (groups !== undefined) return groups;
      const share = shareTaskOf(q.item.hints);
      return share ? shareBuilder({ task: share, reveal: false }) : null;
    },

    help(q, fb) {
      const groups = groupsPicture(q);
      if (groups !== undefined) return { strategy: strategyText(q), visual: groups ?? undefined };
      const share = shareTaskOf(q.item.hints);
      if (share) return { strategy: strategyText(q), visual: shareBuilder({ task: share }) };
      const { a, b } = square(q.item.id);
      return {
        note: isDivisionId(q.item.id) ? divisionNote(a * b, b, fb.given) : confusionNote(a, b, fb.given),
        strategy: strategyText(q),
        visual: picture(q),
      };
    },
  };
}
