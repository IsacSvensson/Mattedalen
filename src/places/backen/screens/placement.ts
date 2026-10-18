import { answerDigits, mathRandomRng, Placement, systemClock } from '../../../engine';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { icon } from '../../../shell/components/icons';
import { numPad } from '../../../shell/components/numPad';
import { h } from '../../../shell/dom';
import { savePlacement } from '../../../shell/play';
import { promptView } from '../../../shell/screens/session';
import { hasSwedishVoice, speak, speechSupported, stopSpeaking } from '../../../shell/speech';
import { brookDeps, pack } from '../pack';

/** Set once the start check at the brook has been offered to a child, so it is offered only once. */
export const offeredKey = (profile: Profile) => `brookCheckOffered:${profile.id}`;

/**
 * Offered the first time a child comes to the brook (J4): most children know
 * zero, one more, ten and some and small sums already, and should get to the
 * pairs that make ten and the bridge over ten soon.
 */
export function showBrookPlacementOffer(ctx: AppContext, profile: Profile, back: () => Promise<void>): void {
  const decline = async () => {
    await ctx.store.setSetting(offeredKey(profile), true);
    await back();
  };
  const view = h(
    'main',
    { class: 'screen session-end placement-offer' },
    h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon('search')),
    h('h1', null, 'Kan du redan lite plus och minus?'),
    h('p', { class: 'end-text' }, 'Gör en snabb startkoll, så vet bäcken var du ska börja. Svara på det du kan – det gör inget om du inte kan allt!'),
    h(
      'div',
      { class: 'garden-actions' },
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void runBrookPlacement(ctx, profile, back) }, 'Gör startkollen', icon('arrow', 'on-primary')),
      h('button', { class: 'soft-button', type: 'button', onclick: () => void decline() }, 'Börja från början'),
    ),
  );
  show(ctx, view);
}

/**
 * The check: free answers on the number pad, timed to the first digit (J5),
 * no right/wrong marks and no clock. A miss only skips what builds on it.
 */
export async function runBrookPlacement(ctx: AppContext, profile: Profile, back: () => Promise<void>): Promise<void> {
  await ctx.store.setSetting(offeredKey(profile), true);
  const placement = new Placement(pack, mathRandomRng);
  const startedAt = systemClock.now();
  const voice = profile.settings.readAloud && speechSupported() && (await hasSwedishVoice());
  let onKey: ((e: KeyboardEvent) => void) | undefined;
  let left = false;

  const progress = h('div', { class: 'time-bar placement-bar', style: 'width:0%' });
  const stage = h('section', { class: 'play-stage' });
  const view = h(
    'main',
    { class: 'screen session placement-run keys-stone' },
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

  for (let item = placement.next(); item && !left; item = placement.next()) {
    progress.style.width = `${Math.round(placement.progress() * 100)}%`;
    const prompt = `${item.prompt} = __`;
    if (voice) void speak(prompt);
    const { given, rtMs } = await new Promise<{ given: string; rtMs: number }>((resolve) => {
      const shownAt = performance.now();
      const pad = numPad((v, firstDigitAt) => {
        pad.disable();
        resolve({ given: v, rtMs: Math.round((firstDigitAt ?? performance.now()) - shownAt) });
      }, answerDigits(pack));
      stage.replaceChildren(h('div', { class: 'question free' }, h('div', { class: 'prompt-card card' }, promptView(prompt)), pad.el));
      setKey((e) => pad.onKey(e));
    });
    if (left) return;
    placement.submit(given, rtMs);
  }
  if (left) return;
  setKey(undefined);

  const result = placement.result();
  await savePlacement(profile, brookDeps(ctx), result, startedAt);
  const title = (id: string) => (pack.units.find((u) => u.id === id)?.title ?? id).toLowerCase();
  const known = result.passedUnitIds.map(title);
  const next = result.stoppedAt ? title(result.stoppedAt) : null;

  show(
    ctx,
    h(
      'main',
      { class: 'screen session-end' },
      h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon('steps')),
      h('h1', null, known.length ? 'Bra jobbat!' : 'Tack!'),
      known.length
        ? h('p', { class: 'end-text placement-summary' }, `Du kan redan ${listSv(known)} – de stenarna ligger redan i bron!`)
        : h('p', { class: 'end-text' }, 'Nu vet bäcken var vi ska börja. Vi lägger de första stenarna tillsammans!'),
      next ? h('p', { class: 'end-text' }, `Vi fortsätter med ${next}.`) : h('p', { class: 'end-text' }, 'Du kan allt inom 20! Nu ska det bli riktigt snabbt.'),
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void back() }, 'Till bäcken'),
    ),
  );
}

/** "noll, ett mer och tio och några" */
function listSv(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} och ${items[items.length - 1]}`;
}
