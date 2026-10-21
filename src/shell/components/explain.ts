import type { Profile } from '../../storage';
import { h } from '../dom';
import { speak, stopSpeaking } from '../speech';
import { choose } from './modal';
import { voiceFor } from './readAloud';

/** One picture and a few words about it, for a child. */
export interface PictureWords {
  picture: Element;
  words: string;
}

/**
 * "Vad betyder bilderna?" beside a place's name (docs/PLAN-ENKLARE.md, E4): a
 * card with the place's own pictures and a few words, read aloud when the
 * child has read-aloud. Shown only when the child taps, never by itself.
 */
export function explainButton(profile: Profile, items: PictureWords[]): HTMLElement {
  return h(
    'button',
    {
      class: 'icon-button explain-button',
      type: 'button',
      'aria-label': 'Vad betyder bilderna?',
      onclick: async () => {
        const card = choose(
          'Vad betyder bilderna?',
          h('ul', { class: 'explain-list' }, items.map((i) => h('li', null, h('span', { class: 'explain-picture', 'aria-hidden': 'true' }, i.picture), h('span', null, i.words)))),
          [{ value: 'ok', label: 'Okej', primary: true }],
          { cancel: false },
        );
        if (await voiceFor(profile)) void speak(items.map((i) => i.words).join(' '));
        await card;
        stopSpeaking();
      },
    },
    h('span', { class: 'explain-mark', 'aria-hidden': 'true' }, '?'),
  );
}
