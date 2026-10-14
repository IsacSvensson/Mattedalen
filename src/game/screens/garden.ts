import { atLeast, type ContentPack, type ItemId, type ItemState } from '../../engine';
import { focusTable, formatFact } from '../../content/multiplication';
import type { Profile } from '../../storage';
import { show, type AppContext } from '../app';
import { gardenGrid } from '../components/grid';
import { plantIcon, stageFor, type Stage } from '../components/plant';
import { avatarIcon } from '../components/avatars';
import { icon } from '../components/icons';
import { scene } from '../components/scene';
import { h } from '../dom';
import { engineFor, loadProgress } from '../play';
import { showProfiles } from './profiles';
import { showSession } from './session';
import { CHALLENGE_MIN_FACTS, canChallenge as challengeOpen } from '../challenge';
import { showChallenge } from './challenge';
import { showDuel } from './duel';
import { showFocusPicker } from './focus';

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
    masteredTables: knownTables(ctx.pack, states),
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
        h('p', { class: 'sleep-text' }, icon('moon'), 'Trädgården sover. Kom tillbaka i morgon!'),
        h('button', { class: 'soft-button', type: 'button', onclick: () => void showSession(ctx, profile, 'extra') }, 'Öva lite till (frivilligt)'),
      )
    : h(
        'div',
        { class: 'garden-actions' },
        h(
          'button',
          { class: 'big-button', type: 'button', autofocus: true, onclick: () => void showSession(ctx, profile, 'daily') },
          icon('can'),
          'Vattna trädgården',
        ),
      );

  // Optional extras, clearly separate from the daily session.
  const canChallenge = challengeOpen(states);
  const tile = (iconName: Parameters<typeof icon>[0], label: string, onclick: () => void, disabled = false) =>
    h('button', { class: 'extra-tile', type: 'button', disabled, onclick }, icon(iconName), h('span', null, label));
  const extras = h(
    'nav',
    { class: 'garden-extras', 'aria-label': 'Mer att göra' },
    ctx.pack.focusSets?.length ? tile('target', 'Öva en tabell', () => void showFocusPicker(ctx, profile)) : null,
    tile('watch', 'Slå rekord', () => void showChallenge(ctx, profile), !canChallenge),
    tile('cards', 'Mot en vuxen', () => void showDuel(ctx, profile)),
  );

  const known = knownTables(ctx.pack, states);
  const view = h(
    'main',
    { class: `screen garden has-scene${asleep ? ' asleep' : ''}` },
    h(
      'header',
      { class: 'garden-head' },
      scene({ height: 150, sunflowers: known.size, cloud: false }),
      h(
        'div',
        { class: 'scene-title' },
        h('button', { class: 'avatar-badge avatar-button', type: 'button', 'aria-label': 'Byt spelare', onclick: () => void showProfiles(ctx) }, avatarIcon(profile.avatar)),
        h('h1', null, `${genitive(profile.name)} trädgård`),
      ),
    ),
    h('div', { class: 'garden-bed' }, grid),
    known.size
      ? h('p', { class: 'sr-only' }, `Tabeller du kan: ${[...known].map((t) => `×${t}`).join(', ')}.`)
      : null,
    // Beside the bed on wide screens, below it on phones.
    h(
      'div',
      { class: 'garden-side' },
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
      canChallenge ? null : h('p', { class: 'extras-note' }, `Rekordjakten öppnar när ${CHALLENGE_MIN_FACTS} plantor blivit buskar.`),
    ),
  );
  show(ctx, view);
}

/** Tables (e.g. 7 for ×7) where every fact is at least fluent. */
export function knownTables(pack: ContentPack, states: Record<ItemId, ItemState>): Set<number> {
  const out = new Set<number>();
  for (const set of pack.focusSets ?? []) {
    const table = focusTable(set.id);
    if (table !== null && set.itemIds.every((id) => atLeast(states[id]?.status ?? 'new', 'fluent'))) out.add(table);
  }
  return out;
}

/** Swedish genitive: "Alvas", but "Lars" and "Max" stay as they are. */
export function genitive(name: string): string {
  return /[sxz]$/i.test(name) ? name : `${name}s`;
}
