import { atLeast, systemClock, type ContentPack, type ItemId, type ItemState } from '../../../engine';
import { checkDue } from '../../../shell/check';
import { gardenCheckLaterKey, showGardenCheckOffer } from './check';
import { focusTable, formatDivision, formatFact, isDivisionId, isFactId } from '../../../content/multiplication';
import { harvestTables } from '../division';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { gardenGrid } from '../components/grid';
import { BLOOM_LABEL, bloomFor, bloomIcon, plantIcon, stageFor, type Bloom, type Stage } from '../../../shell/components/plant';
import { DEFAULT_DIVISION_SIGN, mathNodes } from '../../../shell/divisionSign';
import { avatarIcon } from '../../../shell/components/avatars';
import { icon } from '../../../shell/components/icons';
import { scene } from '../../../shell/components/scene';
import { h } from '../../../shell/dom';
import { genitive } from '../../../shell/words';
import { engineFor, loadProgress } from '../../../shell/play';
import { showValley } from '../../../shell/screens/valley';
import { showSession } from './session';
import { CHALLENGE_MIN_FACTS, canChallenge as challengeOpen } from '../challenge';
import { showChallenge } from './challenge';
import { showDuel } from './duel';
import { showFocusPicker } from './focus';
import { gardenWaits } from '../held';
import { waitText } from '../waits';
import { gardenDeps, pack } from '../pack';
import { gardenOfferedKey, showPlacementOffer } from './placement';

const STAGE_PLURAL: Record<'seed' | 'sprout' | 'bush' | 'tree', string> = {
  seed: 'frön',
  sprout: 'plantor',
  bush: 'buskar',
  tree: 'träd',
};

export async function showGarden(ctx: AppContext, profile: Profile, highlight?: Set<ItemId>): Promise<void> {
  const engine = engineFor(profile, gardenDeps(ctx));
  const { states, meta } = await loadProgress(profile, gardenDeps(ctx), engine);
  // The first time in the garden, with nothing planted yet: offer the start check (once).
  const fresh = Object.values(states).every((s) => s.status === 'new');
  if (fresh && !(await ctx.store.getSetting<boolean>(gardenOfferedKey(profile)))) return showPlacementOffer(ctx, profile);
  // Tables that wait for their part on Stigen are not dug yet (docs/PLAN-HUNDRA.md).
  const waits = await gardenWaits(ctx, profile, { states, meta }, engine);
  const unlockedUnits = new Set(engine.unlockedUnits(states, meta, undefined, waits.held));
  const nextWaiting = pack.units.find((u) => waits.waitingNow.includes(u.id));
  const unlockedItemIds = new Set(pack.units.filter((u) => unlockedUnits.has(u.id)).flatMap((u) => u.itemIds));
  const asleep = engine.dailyDone(meta);
  // Trädgårdens koll comes first on the days it is due (about every seventh play day in the garden).
  const checkFirst =
    !asleep && checkDue(await ctx.store.listSessions(profile.id), pack.id, systemClock.today(), await ctx.store.getSetting<string>(gardenCheckLaterKey(profile.id)));
  const play = () => showSession(ctx, profile, 'daily');

  // The plants are the multiplications; the divisions grow on them as blossoms and fruit.
  const counts: Record<Stage, number> = { locked: 0, soil: 0, seed: 0, sprout: 0, bush: 0, tree: 0 };
  const blooms: Record<Bloom, number> = { none: 0, blossom: 0, kart: 0, fruit: 0 };
  for (const id of Object.keys(states)) {
    if (isFactId(id)) counts[stageFor(states[id], unlockedItemIds.has(id))]++;
    else if (isDivisionId(id)) blooms[bloomFor(states[id])]++;
  }

  const sign = profile.settings.divisionSign ?? DEFAULT_DIVISION_SIGN;
  const info = h('p', { class: 'grid-info', 'aria-live': 'polite' }, ' ');
  const harvest = harvestTables(states);
  const grid = gardenGrid({
    states,
    unlockedItemIds,
    highlight,
    masteredTables: knownTables(pack, states),
    harvestTables: harvest,
    onSelect: ({ a, b, stage, bloom }) => {
      // Only facts the child has met show their answer.
      const fact = formatFact(a, b);
      if (!['seed', 'sprout', 'bush', 'tree'].includes(stage)) {
        info.textContent = stage === 'soil' ? `${fact} – ett frö väntar här` : `${fact} – kommer senare`;
        return;
      }
      const division = bloom !== 'none' ? [' · ', ...mathNodes(`${formatDivision(a * b, b)} = ${a}`, sign)] : [];
      info.replaceChildren(`${fact} = ${a * b}`, ...division);
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
          { class: 'big-button', type: 'button', autofocus: true, onclick: () => void (checkFirst ? showGardenCheckOffer(ctx, profile, play) : play()) },
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
    pack.focusSets?.length ? tile('target', 'Öva en tabell', () => void showFocusPicker(ctx, profile)) : null,
    tile('watch', 'Slå rekord', () => void showChallenge(ctx, profile), !canChallenge),
    tile('cards', 'Mot en vuxen', () => void showDuel(ctx, profile)),
  );

  const known = knownTables(pack, states);
  const view = h(
    'main',
    { class: `screen garden has-scene${asleep ? ' asleep' : ''}` },
    h(
      'header',
      { class: 'garden-head' },
      scene({ height: 150, sunflowers: known.size, baskets: [...harvest].filter((t) => known.has(t)).length, cloud: false }),
      h(
        'div',
        { class: 'scene-title' },
        // The child's animal walks back to the valley; players are switched there.
        h('button', { class: 'avatar-badge avatar-button', type: 'button', 'aria-label': 'Till dalen', onclick: () => void showValley(ctx, profile) }, avatarIcon(profile.avatar)),
        h('h1', { class: profile.name.length > 10 ? 'long-name' : undefined }, `${genitive(profile.name)} trädgård`),
      ),
    ),
    await bloomNews(ctx, profile, states),
    h('div', { class: 'garden-bed' }, grid),
    known.size
      ? h('p', { class: 'sr-only' }, `Tabeller du kan: ${[...known].map((t) => `×${t}`).join(', ')}.`)
      : null,
    // Beside the bed on wide screens, below it on phones.
    h(
      'div',
      { class: 'garden-side' },
      info,
      // Before the first table: what comes first, so a bed of meadow is not a puzzle.
      unlockedUnits.has('u2')
        ? nextWaiting
          ? h('p', { class: 'garden-next' }, icon('lantern'), waitText(nextWaiting.id))
          : null
        : h('p', { class: 'garden-next' }, icon('basket'), 'Först: lika stora grupper. Sedan planterar vi ×2.'),
      h(
        'ul',
        { class: 'garden-counts', 'aria-label': 'Så här växer det' },
        (['seed', 'sprout', 'bush', 'tree'] as const).map((stage) =>
          h('li', { 'aria-label': `${counts[stage]} ${STAGE_PLURAL[stage]}` }, plantIcon(stage), h('span', { 'aria-hidden': 'true' }, counts[stage])),
        ),
      ),
      blooms.blossom + blooms.kart + blooms.fruit
        ? h(
            'ul',
            { class: 'garden-counts blooms', 'aria-label': 'Delat med' },
            (['blossom', 'kart', 'fruit'] as const).map((bloom) =>
              h('li', { 'aria-label': `${blooms[bloom]} med ${BLOOM_LABEL[bloom]}` }, bloomIcon(bloom), h('span', { 'aria-hidden': 'true' }, blooms[bloom])),
            ),
          )
        : null,
      actions,
      extras,
      canChallenge ? null : h('p', { class: 'extras-note' }, `Rekordjakten öppnar när ${CHALLENGE_MIN_FACTS} plantor blivit buskar.`),
    ),
  );
  show(ctx, view);
}

export const bloomNewsKey = (profile: Profile) => `bloomNews:${profile.id}`;

/**
 * Bushes and trees used to carry berries and flowers as decoration; now they
 * are green until delat med grows on them. A child who already has bushes
 * is told once, so the change is something to look forward to.
 */
async function bloomNews(ctx: AppContext, profile: Profile, states: Record<ItemId, ItemState>): Promise<HTMLElement | null> {
  const hasBush = Object.values(states).some((s) => isFactId(s.itemId) && atLeast(s.status, 'fluent'));
  if (!hasBush || (await ctx.store.getSetting<boolean>(bloomNewsKey(profile)))) return null;
  await ctx.store.setSetting(bloomNewsKey(profile), true);
  const card: HTMLElement = h(
    'aside',
    { class: 'bloom-news card', role: 'status' },
    h('span', { class: 'bloom-news-icons', 'aria-hidden': 'true' }, bloomIcon('blossom'), bloomIcon('fruit', 'tree')),
    h(
      'div',
      { class: 'bloom-news-text' },
      h('p', { class: 'bloom-news-title' }, 'Nyhet i trädgården!'),
      h('p', null, 'Nu kan dina buskar och träd få blommor och frukt! Dela lika med frukten, så mognar den.'),
      h('button', { class: 'soft-button', type: 'button', onclick: () => card.remove() }, 'Vad roligt!'),
    ),
  );
  return card;
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

export { genitive } from '../../../shell/words';
