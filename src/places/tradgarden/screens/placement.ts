import { emptyState, mathRandomRng, Placement, systemClock, type Item, type ItemState, type PlacementResult } from '../../../engine';
import { divisionPlacementPack } from '../../../content/multiplication';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { numPad } from '../../../shell/components/numPad';
import { icon } from '../../../shell/components/icons';
import { bloomIcon, plantIcon } from '../../../shell/components/plant';
import { DEFAULT_DIVISION_SIGN } from '../../../shell/divisionSign';
import { promptView } from '../../../shell/screens/session';
import { h } from '../../../shell/dom';
import { savePlacement } from '../../../shell/play';
import { hasSwedishVoice, speak, speechSupported, stopSpeaking } from '../../../shell/speech';
import { showGarden } from './garden';
import { gardenDeps, pack } from '../pack';
import { readShown } from '../../../shell/components/readAloud';

/** Set once the garden's start check has been offered to a child, so it is offered only once. */
export const gardenOfferedKey = (profile: Profile) => `gardenCheckOffered:${profile.id}`;

/** Offered the first time a child comes to the garden (and from the parent view). */
export async function showPlacementOffer(ctx: AppContext, profile: Profile): Promise<void> {
  await ctx.store.setSetting(gardenOfferedKey(profile), true);
  const view = h(
    'main',
    { class: 'screen session-end placement-offer' },
    h('div', { class: 'end-icon', 'aria-hidden': 'true' }, plantIcon('sprout')),
    // Words a child can answer (docs/PLAN-ENKLARE.md, E3); what it is about, in two words under them.
    h('h1', null, 'Vill du visa vad du redan kan?'),
    h('p', { class: 'end-text' }, 'Gånger.'),
    h(
      'div',
      { class: 'garden-actions' },
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void runPlacement(ctx, profile) }, 'Ja!', icon('arrow', 'on-primary')),
      h('button', { class: 'soft-button', type: 'button', onclick: () => void showGarden(ctx, profile) }, 'Börja från början'),
    ),
  );
  show(ctx, view);
  void readShown(ctx, profile, { auto: true });
}

/**
 * The check itself: free answers on the number pad (no guessing among
 * options), no right/wrong marks and no clock – just "show what you know".
 * Answer times are measured, but only decide whether a known table is placed
 * as bushes (fast) or as sprouts (right but slow).
 */
export async function runPlacement(ctx: AppContext, profile: Profile): Promise<void> {
  const placement = new Placement(pack, mathRandomRng);
  const startedAt = systemClock.now();
  const voice = profile.settings.readAloud && speechSupported() && (await hasSwedishVoice());
  let onKey: ((e: KeyboardEvent) => void) | undefined;
  let left = false;

  const progress = h('div', { class: 'time-bar placement-bar', style: 'width:0%' });
  const stage = h('section', { class: 'play-stage' });
  const view = h(
    'main',
    { class: 'screen session placement-run' },
    h(
      'header',
      { class: 'top-bar' },
      h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Hoppa över startkollen', onclick: () => ((left = true), void showGarden(ctx, profile)) }, icon('home')),
      h('div', { class: 'time-track', role: 'progressbar', 'aria-label': 'Hur långt startkollen har kommit' }, progress),
    ),
    stage,
  );
  const setKey = (handler?: (e: KeyboardEvent) => void) => {
    if (onKey) document.removeEventListener('keydown', onKey);
    onKey = handler;
    if (handler) document.addEventListener('keydown', handler);
  };
  show(ctx, view, () => {
    setKey(undefined);
    stopSpeaking();
  });

  const sign = profile.settings.divisionSign ?? DEFAULT_DIVISION_SIGN;
  /** One question on the number pad; `share` is how far the whole check has come. */
  const ask = (item: Item, share: number) =>
    new Promise<{ given: string; rtMs: number }>((resolve) => {
      progress.style.width = `${Math.round(share * 100)}%`;
      if (voice) void speak(item.prompt);
      const shownAt = performance.now();
      const pad = numPad((v) => {
        pad.disable();
        resolve({ given: v, rtMs: Math.round(performance.now() - shownAt) });
      });
      stage.replaceChildren(h('div', { class: 'question free' }, h('div', { class: 'prompt-card card' }, promptView(item.prompt, sign)), pad.el));
      setKey((e) => pad.onKey(e));
    });

  for (let item = placement.next(); item && !left; item = placement.next()) {
    const { given, rtMs } = await ask(item, placement.progress() * TIMES_SHARE);
    if (left) return;
    placement.submit(given, rtMs);
  }
  if (left) return;

  const result = placement.result();
  const placed = await savePlacement(profile, gardenDeps(ctx), result, startedAt);

  // Then delat med, for the families that sit now. Passing it shows "Dela lika" is understood too.
  const divisionPack = divisionPlacementPack(pack, placed.states);
  let divisionResult: PlacementResult | null = null;
  if (divisionPack) {
    const divisions = new Placement(divisionPack, mathRandomRng);
    for (let item = divisions.next(); item && !left; item = divisions.next()) {
      const { given, rtMs } = await ask(item, TIMES_SHARE + divisions.progress() * (1 - TIMES_SHARE));
      if (left) return;
      divisions.submit(given, rtMs);
    }
    if (left) return;
    divisionResult = divisions.result();
    if (divisionResult.answers.length) {
      await savePlacement(profile, gardenDeps(ctx), divisionResult, startedAt, {
        from: divisionPack,
        adjust: (states) => (divisionResult!.passedUnitIds.length ? withSharing(states) : states),
      });
    }
  }
  setKey(undefined);

  const title = (id: string) => pack.units.find((u) => u.id === id)?.title ?? id;
  const titles = result.passedUnitIds.map(title);
  const fastTitles = result.fluentUnitIds.map(title);
  const slowTitles = result.passedUnitIds.filter((id) => !result.fluentUnitIds.includes(id)).map(title);
  const next = result.stoppedAt ? pack.units.find((u) => u.id === result.stoppedAt)?.title : null;
  const passedUnits = [...result.passedUnitIds, ...(divisionResult?.passedUnitIds ?? [])];
  const passed = new Set(pack.units.filter((u) => passedUnits.includes(u.id)).flatMap((u) => u.itemIds));
  const divisionLine = divisionResult?.passedUnitIds.length ? divisionSummary(divisionResult) : null;

  show(
    ctx,
    h(
      'main',
      { class: 'screen session-end' },
      h('div', { class: 'end-icon plant-badge', 'aria-hidden': 'true' }, plantIcon(titles.length ? 'tree' : 'sprout')),
      h('h1', null, titles.length ? 'Bra jobbat!' : 'Tack!'),
      fastTitles.length
        ? h(
            'p',
            { class: 'end-text placement-summary' },
            plantIcon('bush'),
            ` Du kan redan ${listSv(fastTitles)} – de blev buskar i trädgården!`,
          )
        : null,
      slowTitles.length
        ? h(
            'p',
            { class: 'end-text placement-summary' },
            plantIcon('sprout'),
            ` Du kan ${listSv(slowTitles)}${fastTitles.length ? ' också' : ''} – de blev plantor. När du svarar snabbt blir de buskar.`,
          )
        : null,
      titles.length ? null : h('p', { class: 'end-text' }, 'Nu vet trädgården var vi ska börja. Vi planterar de första fröna tillsammans!'),
      divisionLine,
      next ? h('p', { class: 'end-text' }, `Vi fortsätter med ${next}.`) : h('p', { class: 'end-text' }, 'Du kan hela tabellen! Nu ska vi göra den riktigt snabb.'),
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void showGarden(ctx, profile, passed) }, 'Till trädgården'),
    ),
  );
  void readShown(ctx, profile, { auto: true });
}

/** How much of the check is about the multiplications (the rest is delat med, when there is any). */
const TIMES_SHARE = 0.75;

/** The "Dela lika" tasks as known: a child who divides quickly understands sharing. */
function withSharing(states: Record<string, ItemState>): Record<string, ItemState> {
  const out = { ...states };
  for (const id of pack.units.find((u) => u.id === 'delalika')?.itemIds ?? []) {
    const prev = out[id] ?? emptyState(id);
    if (prev.status === 'new' || prev.status === 'learning') out[id] = { ...prev, status: 'fluent', box: Math.max(prev.box, 2), introducedDay: prev.introducedDay ?? systemClock.today() };
  }
  return out;
}

/** "Du kan dela med 10, 2 och 5 också – buskarna fick kart!" */
function divisionSummary(result: PlacementResult): HTMLElement {
  const name = (id: string) => DIVISION_PLACEMENT_NAMES[id] ?? id;
  const fast = result.fluentUnitIds.map(name);
  const slow = result.passedUnitIds.filter((id) => !result.fluentUnitIds.includes(id)).map(name);
  return h(
    'p',
    { class: 'end-text placement-summary' },
    bloomIcon(fast.length ? 'kart' : 'blossom'),
    fast.length ? ` Du kan dela med ${listSv(fast)} också – buskarna fick kart!` : '',
    slow.length ? ` Du kan dela med ${listSv(slow)}${fast.length ? '' : ' också'} – där kom blommor. När du svarar snabbt blir det frukt.` : '',
  );
}

const DIVISION_PLACEMENT_NAMES: Record<string, string> = {
  d10: '10',
  d2: '2',
  d5: '5',
  d1: '1',
  d4: '4',
  d3: '3',
  dsq: 'kvadrattalen',
  d9: '9',
  d6: '6',
  d78: '7 och 8',
};

/** "×10, ×2 och ×5" */
function listSv(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} och ${items[items.length - 1]}`;
}
