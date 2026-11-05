import { isStruggling, plausibleAnswer, systemClock, type Engine, type ItemId, type ItemState } from '../../engine';
import { CHECK_CATEGORIES, parseClock, parseTaskId, taskWithAnswer } from '../../content/clock';
import { checkResultsView } from '../../shell/components/checkResults';
import type { StoredAttempt } from '../../storage';
import { runTowerPlacement } from './screens/placement';
import { showTower } from './screens/tower';
import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { helpTip } from '../../shell/components/helpTip';
import { icon } from '../../shell/components/icons';
import { limitedList } from '../../shell/components/limitedList';
import { h } from '../../shell/dom';
import type { PlaceSummary, SaveProfile } from '../../shell/place';
import { engineFor, loadProgress } from '../../shell/play';
import { bestTimes, formatDay, knownOf, partNow, partNowUnit, slowButRight, STATUS_TEXT, topConfusions } from '../../shell/stats';
import { partProgress } from '../stigen/logic';
import { towerIsOpen } from './isOpen';
import { pack, towerDeps, towerHeld } from './pack';
import { TOWER_TIPS } from './tips';

/** What Klocktornet covers, for grown-ups. */
export const TOWER_ABOUT = 'Klockan: hela och halva timmar, kvart och fem minuter, analogt och digitalt.';
const CLOSED_FOR_ADULTS = 'Klocktornet är inte öppet än. Det öppnar av sig självt när barnet kan små summor vid bäcken.';

/**
 * Klocktornet's page in "För vuxna" (docs/PLAN-KLOCKAN.md, KL4): the state,
 * the parts with how much of each sits, what is hard right now and the mix-ups.
 */
export async function towerParentPage(ctx: AppContext, profile: Profile, save: SaveProfile): Promise<HTMLElement> {
  const deps = towerDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const sessions = (await ctx.store.listSessions(profile.id)).filter((s) => s.packId === pack.id);
  const open = await towerIsOpen(ctx, profile);
  const heldIds = await towerHeld(ctx, profile);
  const held = new Set(heldIds);
  const counts = engine.statusCounts(states);
  const unlocked = new Set(engine.unlockedUnits(states, meta, undefined, heldIds));
  const lastPlayed = sessions.length ? sessions[sessions.length - 1]!.day : null;
  const parts = partProgress(pack, states, unlocked);

  return h(
    'section',
    { class: 'place-section', 'aria-labelledby': 'place-tower-heading' },
    h('h2', { id: 'place-tower-heading', class: 'place-heading' }, icon('watch'), 'Klocktornet'),
    h('p', { class: 'muted place-about' }, TOWER_ABOUT),
    open ? null : openingNote(save),
    h('h3', null, 'Läget'),
    h(
      'ul',
      { class: 'status-summary' },
      (['automatic', 'fluent', 'learning', 'new'] as const).map((s) => h('li', { class: `status-${s}` }, h('strong', null, counts[s]), ` ${STATUS_TEXT[s]}`)),
    ),
    h('p', { class: 'muted' }, `${meta.sessionsCompleted} fullständiga pass`, lastPlayed ? ` · senast ${formatDay(lastPlayed)}` : '', ` · ${unlocked.size} av ${pack.units.length} delar öppna`),
    h('h4', null, 'Delarna'),
    h('p', { class: 'muted' }, 'Ett fönster i tornet för varje del. Det tänds när det mesta av delen sitter. Klockan är förståelse: ingen tid räknas.'),
    h(
      'ul',
      { class: 'brook-parts parent' },
      parts.map((p) =>
        h(
          'li',
          { class: p.open ? undefined : 'closed' },
          h('span', { class: 'part-name' }, p.title),
          h('span', { class: 'part-count' }, p.open ? `${p.known} av ${p.total} sitter` : held.has(p.id) ? 'väntar på stigen' : 'inte öppen än'),
        ),
      ),
    ),
    h('h4', null, 'Förmågorna'),
    h('p', { class: 'muted' }, 'Samma tid frågas på olika sätt. Ett barn kan kunna läsa klockan men inte ställa den, eller tvärtom.'),
    h(
      'ul',
      { class: 'brook-parts parent tower-skills' },
      skills(states).map((k) => h('li', null, h('span', { class: 'part-name' }, k.title), h('span', { class: 'part-count' }, `${k.known} av ${k.total} sitter`))),
    ),
    h('h3', null, 'Svåra just nu'),
    hardList(states, engine),
    open ? helpTip(TOWER_TIPS[partNowUnit(pack, states, unlocked)?.id ?? '']) : null,
    h('h3', null, 'Vanligaste förväxlingarna'),
    confusionList(states),
    h('h3', null, 'Hur barnet ställer visarna'),
    handsView(await ctx.store.listAttempts(profile.id)),
    h('h3', null, 'Tornets koll'),
    checkResultsView(
      sessions.filter((x) => x.mode === 'check'),
      CHECK_CATEGORIES,
      'Samma sorts frågor ungefär var sjunde speldag i tornet, utan anpassning, så att det går att jämföra över tid: läsa klockan, ställa visarna, timvisaren och minuter, kvartar och timmar. Tiderna dras från alla tider, också sådana barnet inte har övat.',
      'Ingen koll än. Den första kommer andra dagen barnet är i tornet.',
    ),
    h('h3', null, 'Startkoll'),
    h('p', { class: 'muted' }, 'En kort koll av vad barnet redan kan av klockan. Den kan bara flytta fram barnet, aldrig bakåt.'),
    h('button', { class: 'soft-button', type: 'button', onclick: () => void runTowerPlacement(ctx, profile, () => showTower(ctx, profile)) }, 'Gör om startkollen i tornet'),
  );
}

/** The tower opens by itself when small sums sit at the brook; a grown-up who knows the child is ready opens it here. */
function openingNote(save: SaveProfile): HTMLElement {
  const note: HTMLElement = h(
    'div',
    { class: 'notice garden-opening' },
    h('p', null, CLOSED_FOR_ADULTS),
    h(
      'button',
      {
        class: 'soft-button',
        type: 'button',
        onclick: async () => {
          await save({ settings: { towerOpen: true } });
          note.replaceChildren(h('p', null, 'Klocktornet är öppet.'));
        },
      },
      'Öppna Klocktornet nu',
    ),
  );
  return note;
}

const sits = (s: ItemState | undefined) => !!s && (s.status === 'fluent' || s.status === 'automatic');

/** The same times asked in different forms (docs/PLAN-KLOCKAN.md): how much of each sits. */
export function skills(states: Record<ItemId, ItemState>): { title: string; known: number; total: number }[] {
  const of = (title: string, test: (id: string) => boolean) => {
    const ids = pack.items.map((it) => it.id).filter(test);
    return { title, known: ids.filter((id) => sits(states[id])).length, total: ids.length };
  };
  return [
    of('Läsa klockan i ord', (id) => id.startsWith('kl:ord:')),
    of('Läsa digitalt', (id) => id.startsWith('kl:dig:')),
    of('Ställa visarna', (id) => id.startsWith('kl:stall:')),
    of('Minuterna', (id) => id.startsWith('kl:min:')),
  ];
}

/**
 * How the child sets the hands when wrong (Nilsson 2022): the minute hand
 * right but the wrong hour (often the hour hand read as standing on a
 * number), the hour right but the minute hand wrong, or both.
 */
export function handsMistakes(attempts: readonly Pick<StoredAttempt, 'itemId' | 'given' | 'correct'>[]): { hour: number; minute: number; both: number } {
  const out = { hour: 0, minute: 0, both: 0 };
  for (const a of attempts) {
    if (a.correct || !a.itemId.startsWith('kl:stall:')) continue;
    const t = parseTaskId(a.itemId);
    const g = parseClock(a.given);
    if (t.kind !== 'read' || !g) continue;
    if (g.m === t.t.m && g.h !== t.t.h) out.hour++;
    else if (g.h === t.t.h && g.m !== t.t.m) out.minute++;
    else if (g.h !== t.t.h) out.both++;
  }
  return out;
}

function handsView(attempts: readonly StoredAttempt[]): HTMLElement {
  const m = handsMistakes(attempts);
  if (m.hour + m.minute + m.both === 0) return h('p', { class: 'muted' }, 'Inga fel när barnet ställer visarna ännu.');
  const times = (n: number) => `${n} ${n === 1 ? 'gång' : 'gånger'}`;
  return h(
    'div',
    null,
    h(
      'ul',
      { class: 'brook-parts parent tower-hands' },
      h('li', null, h('span', { class: 'part-name' }, 'Minutvisaren rätt, fel timme'), h('span', { class: 'part-count' }, times(m.hour))),
      h('li', null, h('span', { class: 'part-name' }, 'Timmen rätt, fel minutvisare'), h('span', { class: 'part-count' }, times(m.minute))),
      h('li', null, h('span', { class: 'part-name' }, 'Båda fel'), h('span', { class: 'part-count' }, times(m.both))),
    ),
    h('p', { class: 'muted' }, 'Fel timme när minutvisaren står rätt är vanligt. Timvisaren rör sig mellan siffrorna: vid halv fyra står den mitt emellan 3 och 4.'),
  );
}

function hardTasks(states: Record<ItemId, ItemState>, engine: Engine): { text: string; strategy: string | undefined }[] {
  const today = systemClock.today();
  return Object.values(states)
    .filter((s) => isStruggling(s, today, engine.config.support))
    .map((s) => ({ text: taskWithAnswer(parseTaskId(s.itemId)), strategy: engine.item(s.itemId).hints.find((x) => x.kind === 'strategy')?.text }));
}

function hardList(states: Record<ItemId, ItemState>, engine: Engine): HTMLElement {
  const hard = hardTasks(states, engine);
  if (hard.length === 0) return h('p', { class: 'muted' }, 'Inga just nu.');
  return limitedList(
    'ul',
    'hard-list',
    hard.map(({ text, strategy }) => h('li', null, h('strong', null, text), strategy ? h('span', { class: 'muted hard-way' }, strategy) : null)),
  );
}

function confusionList(states: Record<ItemId, ItemState>): HTMLElement {
  const list = topConfusions(states, 8, (id) => taskWithAnswer(parseTaskId(id)), (given) => plausibleAnswer(pack, given));
  if (!list.length) return h('p', { class: 'muted' }, 'Inga förväxlingar ännu.');
  return h(
    'ol',
    { class: 'confusions' },
    list.map((c) => h('li', null, h('strong', null, c.fact), `: svarade ${c.given} `, h('span', { class: 'muted' }, `(${c.count} ${c.count === 1 ? 'gång' : 'gånger'})`))),
  );
}

/** The tower in the overview of "För vuxna": what the child is on, what is hardest, how much sits, and opening it early. */
export async function towerParentSummary(ctx: AppContext, profile: Profile, save: SaveProfile): Promise<PlaceSummary> {
  const deps = towerDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const hardest = hardTasks(states, engine)[0];
  const open = await towerIsOpen(ctx, profile);
  const unlocked = new Set(engine.unlockedUnits(states, meta, undefined, await towerHeld(ctx, profile)));
  return {
    now: open ? partNow(pack, states, unlocked) : null,
    tip: open ? (TOWER_TIPS[partNowUnit(pack, states, unlocked)?.id ?? ''] ?? null) : null,
    hardest: hardest ? [hardest.text] : null,
    ...knownOf(pack, states),
    slow: slowButRight(engine, states),
    bestTimes: bestTimes(states),
    todo: open ? [] : [{ text: CLOSED_FOR_ADULTS, action: { label: 'Öppna Klocktornet nu', run: () => save({ settings: { towerOpen: true } }) } }],
  };
}
