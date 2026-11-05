import { mathRandomRng, systemClock, type PlacementAnswer } from '../../../engine';
import { normalizeAnswer, parseTaskId } from '../../../content/clock';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { icon } from '../../../shell/components/icons';
import { readShown } from '../../../shell/components/readAloud';
import { h } from '../../../shell/dom';
import { savePlacement } from '../../../shell/play';
import { hasSwedishVoice, speak, speechSupported, stopSpeaking } from '../../../shell/speech';
import { pack, towerDeps, towerHeld } from '../pack';
import { DAY_QUESTIONS, PER_PART, stairFor, stairsOutcome, type PartScore } from '../stairs';
import { askTowerTask } from './checkQuestion';

/** Set once the start check in the tower has been offered to a child, so it is offered only once. */
export const offeredKey = (profile: Profile) => `towerCheckOffered:${profile.id}`;

/**
 * Offered the first time a child comes to the tower, as on Stigen: a child who
 * can already read whole and half hours should not start at the clock face.
 * The check can only move the child forward.
 */
export function showTowerPlacementOffer(ctx: AppContext, profile: Profile, back: () => Promise<void>): void {
  const decline = async () => {
    await ctx.store.setSetting(offeredKey(profile), true);
    await back();
  };
  show(
    ctx,
    h(
      'main',
      { class: 'screen session-end placement-offer' },
      h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon('watch')),
      h('h1', null, 'Vill du visa vad du redan kan?'),
      h('p', { class: 'end-text' }, 'Klockan.'),
      h(
        'div',
        { class: 'garden-actions' },
        h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void runTowerPlacement(ctx, profile, back) }, 'Ja!', icon('arrow', 'on-primary')),
        h('button', { class: 'soft-button', type: 'button', onclick: () => void decline() }, 'Börja från början'),
      ),
    ),
  );
  void readShown(ctx, profile, { auto: true });
}

/** A few of a part's tasks, in mixed forms, drawn at random. */
function draw(unitId: string, n: number): string[] {
  const ids = [...(pack.units.find((u) => u.id === unitId)?.itemIds ?? [])];
  const out: string[] = [];
  while (out.length < n && ids.length) out.push(ids.splice(Math.floor(mathRandomRng.next() * ids.length), 1)[0]!);
  return out;
}

/** The check: up the stair of the clock, three questions a part, stopping at the first part not passed. */
export async function runTowerPlacement(ctx: AppContext, profile: Profile, back: () => Promise<void>): Promise<void> {
  await ctx.store.setSetting(offeredKey(profile), true);
  const startedAt = systemClock.now();
  const voice = profile.settings.readAloud && speechSupported() && (await hasSwedishVoice());
  const held = await towerHeld(ctx, profile);
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
      h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Hoppa över startkollen', onclick: () => ((left = true), void back()) }, icon('home')),
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

  const stair = stairFor(held);
  const scores: Record<string, PartScore> = {};
  const answers: PlacementAnswer[] = [];
  const total = DAY_QUESTIONS + stair.length * PER_PART;
  const ask = async (unitId: string, n: number): Promise<boolean> => {
    const score: PartScore = { right: 0, asked: 0 };
    scores[unitId] = score;
    for (const id of draw(unitId, n)) {
      if (left) return false;
      progress.style.width = `${Math.round((answers.length / total) * 100)}%`;
      const item = pack.items.find((it) => it.id === id)!;
      if (voice) void speak(item.prompt);
      const given = await askTowerTask(stage, parseTaskId(id), setKey);
      if (left) return false;
      const correct = normalizeAnswer(given) === normalizeAnswer(item.answer);
      answers.push({ itemId: id, unitId, given, correct, rtMs: 0 });
      score.asked++;
      if (correct) score.right++;
    }
    return true;
  };

  if (!(await ask('dagen', DAY_QUESTIONS))) return;
  for (const unitId of stair) {
    if (!(await ask(unitId, PER_PART))) return;
    if (scores[unitId]!.right < 2) break;
  }
  setKey(undefined);

  // Understanding is not timed: a part passed sits, as its window shows.
  const outcome = stairsOutcome(scores, held);
  await savePlacement(profile, towerDeps(ctx), { ...outcome, fluentUnitIds: outcome.passedUnitIds, failedUnitIds: outcome.stoppedAt ? [outcome.stoppedAt] : [], answers }, startedAt);
  const title = (id: string) => (pack.units.find((u) => u.id === id)?.title ?? id).toLowerCase();
  const known = outcome.passedUnitIds.filter((id) => id !== 'dagen').map(title);
  const next = outcome.stoppedAt ? title(outcome.stoppedAt) : null;
  show(
    ctx,
    h(
      'main',
      { class: 'screen session-end' },
      h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon('watch')),
      h('h1', null, known.length ? 'Bra jobbat!' : 'Tack!'),
      known.length
        ? h('p', { class: 'end-text placement-summary' }, `Du kan redan ${listSv(known)} – de fönstren lyser redan!`)
        : h('p', { class: 'end-text' }, 'Nu vet tornet var vi ska börja. Vi tänder de första fönstren tillsammans!'),
      next ? h('p', { class: 'end-text' }, `Vi fortsätter med ${next}.`) : h('p', { class: 'end-text' }, 'Du kan klockan! Snart kommer mer i tornet.'),
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void back() }, 'Till tornet'),
    ),
  );
  void readShown(ctx, profile, { auto: true });
}

function listSv(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} och ${items[items.length - 1]}`;
}
