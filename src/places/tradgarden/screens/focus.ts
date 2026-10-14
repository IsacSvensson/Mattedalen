import { atLeast, type FocusSet, type ItemId, type ItemState } from '../../../engine';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { icon } from '../../../shell/components/icons';
import { h } from '../../../shell/dom';
import { canChallenge, CHALLENGE_MIN_FOCUS_FACTS } from '../challenge';
import { engineFor, EXTRA_PRACTICE_MINUTES, loadProgress } from '../../../shell/play';
import { showChallenge } from './challenge';
import { showGarden } from './garden';
import { showSession } from './session';
import { gardenDeps, pack } from '../pack';

export interface FocusProgress {
  total: number;
  /** At least fluent ("bushes" and "trees"). */
  known: number;
  /** Met but not yet fluent. */
  growing: number;
}

export function focusProgress(set: FocusSet, states: Record<ItemId, ItemState>): FocusProgress {
  let known = 0;
  let growing = 0;
  for (const id of set.itemIds) {
    const status = states[id]?.status ?? 'new';
    if (atLeast(status, 'fluent')) known++;
    else if (status !== 'new') growing++;
  }
  return { total: set.itemIds.length, known, growing };
}

/**
 * "Öva på en tabell": the child picks a table and then practises it (mixed
 * with a few other facts) or races their own record on just that table.
 */
export async function showFocusPicker(ctx: AppContext, profile: Profile, selectedId?: string): Promise<void> {
  const sets = pack.focusSets ?? [];
  const engine = engineFor(profile, gardenDeps(ctx));
  const { states } = await loadProgress(profile, gardenDeps(ctx), engine);

  const panel = h('section', { class: 'focus-panel', 'aria-live': 'polite' }, h('p', { class: 'end-text' }, 'Tryck på en tabell.'));
  const tiles = sets.map((set) => {
    const p = focusProgress(set, states);
    return h(
      'button',
      {
        class: 'focus-tile',
        type: 'button',
        'aria-pressed': 'false',
        'aria-label': `${set.title}, ${p.known} av ${p.total} kan du bra`,
        dataset: { focus: set.id },
        onclick: () => select(set),
      },
      h('span', { class: 'focus-title' }, set.title),
      h(
        'span',
        { class: 'focus-meter', 'aria-hidden': 'true' },
        h('span', {
          class: 'focus-known',
          style: `width:${(p.known / p.total) * 100}%`,
        }),
        h('span', {
          class: 'focus-growing',
          style: `width:${(p.growing / p.total) * 100}%`,
        }),
      ),
    );
  });

  function select(set: FocusSet) {
    for (const t of tiles) t.setAttribute('aria-pressed', String(t.dataset.focus === set.id));
    const p = focusProgress(set, states);
    const fresh = p.total - p.known - p.growing;
    const challengeOpen = canChallenge(states, set.itemIds);
    panel.replaceChildren(
      h(
        'div',
        { class: 'focus-choice' },
        h('h2', null, set.title),
        h('p', { class: 'end-text' }, p.known === 0 ? `Du har inga buskar i ${set.title} än.` : `Du kan ${p.known} av ${p.total} bra.`),
        fresh > 0 ? h('p', { class: 'extras-note' }, 'Du får plantera några nya frön också.') : null,
        h(
          'div',
          { class: 'garden-actions' },
          h(
            'button',
            {
              class: 'big-button',
              type: 'button',
              onclick: () => void showSession(ctx, profile, 'focus', set),
            },
            `Öva ${set.title}`,
          icon('arrow', 'on-primary'),
          ),
          h(
            'button',
            {
              class: 'soft-button small',
              type: 'button',
              disabled: !challengeOpen,
              onclick: () => void showChallenge(ctx, profile, set),
            },
            icon('watch'),
          `Rekordjakt ${set.title}`,
          ),
          challengeOpen
            ? null
            : h(
                'p',
                { class: 'extras-note' },
                `Rekordjakten på ${set.title} öppnar när ${CHALLENGE_MIN_FOCUS_FACTS} av plantorna blivit buskar.`,
              ),
        ),
      ),
    );
  }

  const view = h(
    'main',
    { class: 'screen focus-picker' },
    h(
      'header',
      { class: 'top-bar' },
      h(
        'button',
        {
          class: 'icon-button',
          type: 'button',
          'aria-label': 'Tillbaka till trädgården',
          onclick: () => void showGarden(ctx, profile),
        },
        icon('home'),
      ),
      h('h1', null, 'Vilken tabell vill du öva på?'),
    ),
    h('div', { class: 'focus-grid', role: 'group', 'aria-label': 'Tabeller' }, tiles),
    panel,
    h('p', { class: 'extras-note' }, `En runda är ${EXTRA_PRACTICE_MINUTES} minuter. Lite annat blandas in – då minns man bättre.`),
  );
  show(ctx, view);
  const preselected = sets.find((s) => s.id === selectedId);
  if (preselected) select(preselected);
}
