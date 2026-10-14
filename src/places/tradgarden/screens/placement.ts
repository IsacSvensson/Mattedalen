import { mathRandomRng, Placement, systemClock } from '../../../engine';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { numPad } from '../../../shell/components/numPad';
import { icon } from '../../../shell/components/icons';
import { plantIcon } from '../../../shell/components/plant';
import { h } from '../../../shell/dom';
import { savePlacement } from '../../../shell/play';
import { hasSwedishVoice, speak, speechSupported, stopSpeaking } from '../../../shell/speech';
import { showGarden } from './garden';
import { gardenDeps, pack } from '../pack';

/** Offered right after a new player is created (and from the parent view). */
export function showPlacementOffer(ctx: AppContext, profile: Profile): void {
  const view = h(
    'main',
    { class: 'screen session-end placement-offer' },
    h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon('search')),
    h('h1', null, 'Kan du redan lite gånger?'),
    h('p', { class: 'end-text' }, 'Gör en snabb startkoll, så vet trädgården var du ska börja. Svara på det du kan – det gör inget om du inte kan allt!'),
    h(
      'div',
      { class: 'garden-actions' },
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void runPlacement(ctx, profile) }, 'Gör startkollen', icon('arrow', 'on-primary')),
      h('button', { class: 'soft-button', type: 'button', onclick: () => void showGarden(ctx, profile) }, 'Börja från början'),
    ),
  );
  show(ctx, view);
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

  for (let item = placement.next(); item && !left; item = placement.next()) {
    progress.style.width = `${Math.round(placement.progress() * 100)}%`;
    if (voice) void speak(item.prompt);
    const { given, rtMs } = await new Promise<{ given: string; rtMs: number }>((resolve) => {
      const shownAt = performance.now();
      const pad = numPad((v) => {
        pad.disable();
        resolve({ given: v, rtMs: Math.round(performance.now() - shownAt) });
      });
      stage.replaceChildren(h('div', { class: 'question free' }, h('div', { class: 'prompt-card card' }, h('p', { class: 'prompt' }, item.prompt)), pad.el));
      setKey((e) => pad.onKey(e));
    });
    if (left) return;
    placement.submit(given, rtMs);
  }
  if (left) return;
  setKey(undefined);

  const result = placement.result();
  await savePlacement(profile, gardenDeps(ctx), result, startedAt);
  const title = (id: string) => pack.units.find((u) => u.id === id)?.title ?? id;
  const titles = result.passedUnitIds.map(title);
  const fastTitles = result.fluentUnitIds.map(title);
  const slowTitles = result.passedUnitIds.filter((id) => !result.fluentUnitIds.includes(id)).map(title);
  const next = result.stoppedAt ? pack.units.find((u) => u.id === result.stoppedAt)?.title : null;
  const passed = new Set(pack.units.filter((u) => result.passedUnitIds.includes(u.id)).flatMap((u) => u.itemIds));

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
      next ? h('p', { class: 'end-text' }, `Vi fortsätter med ${next}.`) : h('p', { class: 'end-text' }, 'Du kan hela tabellen! Nu ska vi göra den riktigt snabb.'),
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void showGarden(ctx, profile, passed) }, 'Till trädgården'),
    ),
  );
}

/** "×10, ×2 och ×5" */
function listSv(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} och ${items[items.length - 1]}`;
}
