import { mathRandomRng, systemClock } from '../../../engine';
import { buildGardenCheck, summarizeGardenCheck, type GardenCheckAnswer } from '../../../content/multiplication';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { icon } from '../../../shell/components/icons';
import { numPad } from '../../../shell/components/numPad';
import { DEFAULT_DIVISION_SIGN } from '../../../shell/divisionSign';
import { h } from '../../../shell/dom';
import { promptView } from '../../../shell/screens/session';
import { hasSwedishVoice, speak, speechSupported, stopSpeaking } from '../../../shell/speech';
import { shareBuilder } from '../components/shareBuilder';
import { pack } from '../pack';

/** Set when the child chose "not now": the check waits until another day. */
export const gardenCheckLaterKey = (profileId: string) => `gardenCheckLater:${profileId}`;

/**
 * Trädgårdens koll, offered before the day's session when it is due. Kindly
 * put: a few tasks, answer what you can. "Inte nu" lets it wait until another day.
 */
export function showGardenCheckOffer(ctx: AppContext, profile: Profile, then: () => Promise<void>): void {
  const later = async () => {
    await ctx.store.setSetting(gardenCheckLaterKey(profile.id), systemClock.today());
    await then();
  };
  show(
    ctx,
    h(
      'main',
      { class: 'screen session-end placement-offer' },
      h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon('search')),
      h('h1', null, 'Trädgårdens koll'),
      h('p', { class: 'end-text' }, 'Först några uppgifter, sedan vattnar vi. Svara på det du kan – det gör inget om du inte kan allt!'),
      h(
        'div',
        { class: 'garden-actions' },
        h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void runGardenCheck(ctx, profile, then) }, 'Börja kollen', icon('arrow', 'on-primary')),
        h('button', { class: 'soft-button', type: 'button', onclick: () => void later() }, 'Inte nu'),
      ),
    ),
  );
}

/**
 * The check itself: free answers on the number pad, with no right/wrong marks
 * and no clock. "Dela lika" comes with its berries and baskets, to deal out if
 * the child wants to. It does not change what the garden knows about the
 * child; the result is for grown-ups only.
 */
export async function runGardenCheck(ctx: AppContext, profile: Profile, then: () => Promise<void>): Promise<void> {
  const items = buildGardenCheck(mathRandomRng);
  const startedAt = systemClock.now();
  const voice = profile.settings.readAloud && speechSupported() && (await hasSwedishVoice());
  const sign = profile.settings.divisionSign ?? DEFAULT_DIVISION_SIGN;
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
      h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Hoppa över kollen', onclick: () => ((left = true), void then()) }, icon('home')),
      h('div', { class: 'time-track', role: 'progressbar', 'aria-label': 'Hur långt kollen har kommit' }, progress),
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

  const answers: GardenCheckAnswer[] = [];
  for (const [i, item] of items.entries()) {
    if (left) return;
    progress.style.width = `${Math.round((i / items.length) * 100)}%`;
    if (voice) void speak(item.prompt);
    const { given, rtMs } = await new Promise<{ given: string; rtMs: number }>((resolve) => {
      const shownAt = performance.now();
      const pad = numPad((v, firstDigitAt) => {
        pad.disable();
        resolve({ given: v, rtMs: Math.round((firstDigitAt ?? performance.now()) - shownAt) });
      });
      const label = item.category === 'missing' ? h('p', { class: 'ask-label' }, 'Vad ska stå i rutan?') : null;
      const picture = item.share ? shareBuilder({ task: item.share, reveal: false }) : null;
      stage.replaceChildren(h('div', { class: 'question free check' }, h('div', { class: 'prompt-card card' }, label, promptView(item.prompt, sign), picture), pad.el));
      setKey((e) => pad.onKey(e));
    });
    if (left) return;
    answers.push({ item, given, rtMs });
  }
  setKey(undefined);

  const now = systemClock.now();
  await ctx.store.saveSession({
    id: `check-${now}`,
    profileId: profile.id,
    packId: pack.id,
    mode: 'check',
    day: systemClock.today(),
    startedAt,
    endedAt: now,
    answered: answers.length,
    correct: answers.filter((a) => a.given.trim() === a.item.answer).length,
    introduced: [],
    extra: summarizeGardenCheck(answers),
  });

  show(
    ctx,
    h(
      'main',
      { class: 'screen session-end' },
      h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon('can')),
      h('h1', null, 'Tack!'),
      h('p', { class: 'end-text' }, 'Nu vattnar vi trädgården.'),
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void then() }, 'Till vattnet', icon('arrow', 'on-primary')),
    ),
  );
}
