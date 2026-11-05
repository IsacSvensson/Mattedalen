import { mathRandomRng, systemClock } from '../../../engine';
import { buildTowerCheck, checkRight, checkTask, summarizeTowerCheck, type CheckAnswer } from '../../../content/clock';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { icon } from '../../../shell/components/icons';
import { h } from '../../../shell/dom';
import { hasSwedishVoice, speak, speechSupported, stopSpeaking } from '../../../shell/speech';
import { pack } from '../pack';
import { askTowerTask } from './checkQuestion';

/** Set when the child chose "not now": Tornets koll waits until another day. */
export const towerCheckLaterKey = (profileId: string) => `towerCheckLater:${profileId}`;

/**
 * Tornets koll, offered before the day's session when it is due (about every
 * seventh play day in the tower), as on Stigen. "Inte nu" lets it wait a day.
 */
export function showTowerCheckOffer(ctx: AppContext, profile: Profile, then: () => Promise<void>): void {
  const later = async () => {
    await ctx.store.setSetting(towerCheckLaterKey(profile.id), systemClock.today());
    await then();
  };
  show(
    ctx,
    h(
      'main',
      { class: 'screen session-end placement-offer' },
      h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon('search')),
      h('h1', null, 'Tornets koll'),
      h('p', { class: 'end-text' }, 'Först några klockor, sedan går vi upp i tornet. Svara på det du kan – det gör inget om du inte kan allt!'),
      h(
        'div',
        { class: 'garden-actions' },
        h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void runTowerCheck(ctx, profile, then) }, 'Börja kollen', icon('arrow', 'on-primary')),
        h('button', { class: 'soft-button', type: 'button', onclick: () => void later() }, 'Inte nu'),
      ),
    ),
  );
}

/** The check itself, with no right/wrong marks and no clock. It does not change what the tower knows about the child. */
export async function runTowerCheck(ctx: AppContext, profile: Profile, then: () => Promise<void>): Promise<void> {
  const items = buildTowerCheck(mathRandomRng);
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
    if (voice) void speak(pack.items.find((it) => it.id === item.id)?.prompt ?? '');
    const given = await askTowerTask(stage, checkTask(item), setKey);
    if (left) return;
    answers.push({ item, given });
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
    correct: answers.filter(checkRight).length,
    introduced: [],
    extra: summarizeTowerCheck(answers),
  });

  show(
    ctx,
    h(
      'main',
      { class: 'screen session-end' },
      h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon('watch')),
      h('h1', null, 'Tack!'),
      h('p', { class: 'end-text' }, 'Nu går vi upp i tornet.'),
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void then() }, 'Till tornet', icon('arrow', 'on-primary')),
    ),
  );
}
