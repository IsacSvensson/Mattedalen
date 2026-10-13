import type { ItemId } from '../../engine';
import { formatFact } from '../../content/multiplication';
import type { Profile } from '../../storage';
import { show, type AppContext } from '../app';
import { gardenGrid } from '../components/grid';
import { plantIcon, stageFor, type Stage } from '../components/plant';
import { h } from '../dom';
import { engineFor, loadProgress } from '../play';
import { showProfiles } from './profiles';
import { showSession } from './session';
import { CHALLENGE_MIN_FACTS, challengePool } from '../challenge';
import { showChallenge } from './challenge';
import { showDuel } from './duel';

const STAGE_PLURAL: Record<'seed' | 'sprout' | 'bush' | 'tree', string> = {
  seed: 'frön',
  sprout: 'plantor',
  bush: 'buskar',
  tree: 'träd',
};

export async function showGarden(ctx: AppContext, profile: Profile, highlight?: Set<ItemId>): Promise<void> {
  const engine = engineFor(profile, ctx.deps);
  const { states, meta } = await loadProgress(profile, ctx.deps, engine);
  const unlockedUnits = new Set(engine.unlockedUnits(states, meta));
  const unlockedItemIds = new Set(ctx.pack.units.filter((u) => unlockedUnits.has(u.id)).flatMap((u) => u.itemIds));
  const asleep = engine.dailyDone(meta);

  const counts: Record<Stage, number> = { locked: 0, soil: 0, seed: 0, sprout: 0, bush: 0, tree: 0 };
  for (const id of Object.keys(states)) counts[stageFor(states[id], unlockedItemIds.has(id))]++;

  const info = h('p', { class: 'grid-info', 'aria-live': 'polite' }, ' ');
  const grid = gardenGrid({
    states,
    unlockedItemIds,
    highlight,
    onSelect: ({ a, b, stage }) => {
      // Only facts the child has met show their answer.
      info.textContent = ['seed', 'sprout', 'bush', 'tree'].includes(stage)
        ? `${formatFact(a, b)} = ${a * b}`
        : stage === 'soil'
          ? `${formatFact(a, b)} – ett frö väntar här`
          : `${formatFact(a, b)} – kommer senare`;
    },
  });

  const actions = asleep
    ? h(
        'div',
        { class: 'garden-actions' },
        h('p', { class: 'sleep-text' }, '🌙 Trädgården sover. Kom tillbaka i morgon!'),
        h('button', { class: 'soft-button', type: 'button', onclick: () => void showSession(ctx, profile, 'extra') }, 'Öva lite till (frivilligt)'),
      )
    : h(
        'div',
        { class: 'garden-actions' },
        h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void showSession(ctx, profile, 'daily') }, 'Vattna trädgården ▶'),
      );

  // Optional extras, clearly separate from the daily session.
  const canChallenge = challengePool(states).length >= CHALLENGE_MIN_FACTS;
  const extras = h(
    'div',
    { class: 'garden-extras' },
    h(
      'button',
      { class: 'soft-button small', type: 'button', disabled: !canChallenge, onclick: () => void showChallenge(ctx, profile) },
      '⚡ Slå ditt rekord',
    ),
    h('button', { class: 'soft-button small', type: 'button', onclick: () => void showDuel(ctx, profile) }, '🃏 Spela mot en vuxen'),
    canChallenge ? null : h('p', { class: 'extras-note' }, `Rekordjakten öppnar när ${CHALLENGE_MIN_FACTS} plantor blivit buskar.`),
  );

  const view = h(
    'main',
    { class: `screen garden${asleep ? ' asleep' : ''}` },
    h(
      'header',
      { class: 'top-bar' },
      h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Byt spelare', onclick: () => void showProfiles(ctx) }, profile.avatar),
      h('h1', null, `${genitive(profile.name)} trädgård`),
    ),
    grid,
    info,
    h(
      'ul',
      { class: 'garden-counts', 'aria-label': 'Så här växer det' },
      (['seed', 'sprout', 'bush', 'tree'] as const).map((stage) =>
        h('li', { 'aria-label': `${counts[stage]} ${STAGE_PLURAL[stage]}` }, plantIcon(stage), h('span', { 'aria-hidden': 'true' }, counts[stage])),
      ),
    ),
    actions,
    extras,
  );
  show(ctx, view);
}

/** Swedish genitive: "Alvas", but "Lars" and "Max" stay as they are. */
export function genitive(name: string): string {
  return /[sxz]$/i.test(name) ? name : `${name}s`;
}
