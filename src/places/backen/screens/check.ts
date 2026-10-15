import { mathRandomRng, systemClock } from '../../../engine';
import { buildCheck, summarizeCheck, type CheckAnswer } from '../../../content/addition';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { icon } from '../../../shell/components/icons';
import { numPad } from '../../../shell/components/numPad';
import { h } from '../../../shell/dom';
import { promptView } from '../../../shell/screens/session';
import { hasSwedishVoice, speak, speechSupported, stopSpeaking } from '../../../shell/speech';
import { checkLaterKey } from '../check';
import { pack } from '../pack';

/**
 * Bäckens koll, offered before the day's session when it is due. Kindly put:
 * a few tasks, answer what you can. "Inte nu" lets it wait until another day.
 */
export function showCheckOffer(ctx: AppContext, profile: Profile, then: () => Promise<void>): void {
  const later = async () => {
    await ctx.store.setSetting(checkLaterKey(profile.id), systemClock.today());
    await then();
  };
  show(
    ctx,
    h(
      'main',
      { class: 'screen session-end placement-offer' },
      h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon('search')),
      h('h1', null, 'Bäckens koll'),
      h('p', { class: 'end-text' }, 'Först några uppgifter, sedan hoppar vi på stenarna. Svara på det du kan – det gör inget om du inte kan allt!'),
      h(
        'div',
        { class: 'garden-actions' },
        h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void runCheck(ctx, profile, then) }, 'Börja kollen', icon('arrow', 'on-primary')),
        h('button', { class: 'soft-button', type: 'button', onclick: () => void later() }, 'Inte nu'),
      ),
    ),
  );
}

/**
 * The check itself: free answers on the stones of the number pad, timed to
 * the first digit, with no right/wrong marks and no clock. It does not change
 * what the brook knows about the child; the result is for grown-ups only.
 */
export async function runCheck(ctx: AppContext, profile: Profile, then: () => Promise<void>): Promise<void> {
  const items = buildCheck(mathRandomRng);
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

  const answers: CheckAnswer[] = [];
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
      const label = item.category === 'equality' ? h('p', { class: 'ask-label' }, 'Vad ska stå i rutan?') : null;
      stage.replaceChildren(h('div', { class: 'question free check' }, h('div', { class: 'prompt-card card' }, label, promptView(item.prompt)), pad.el));
      setKey((e) => pad.onKey(e));
    });
    if (left) return;
    answers.push({ item, given, rtMs });
  }
  setKey(undefined);

  const now = systemClock.now();
  const extra = summarizeCheck(answers);
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
    extra,
  });

  show(
    ctx,
    h(
      'main',
      { class: 'screen session-end' },
      h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon('steps')),
      h('h1', null, 'Tack!'),
      h('p', { class: 'end-text' }, 'Nu hoppar vi på stenarna.'),
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void then() }, 'Till stenarna', icon('arrow', 'on-primary')),
    ),
  );
}
