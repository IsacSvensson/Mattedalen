import type { Profile } from '../../storage';
import type { AppContext } from '../app';
import { h } from '../dom';
import { hasSwedishVoice, speak, speechSupported } from '../speech';
import { icon } from './icons';

/** What a screen says, in the order it stands: the heading, the texts, the list and the big button. */
const SAID = 'h1, .end-text, .end-list li, .sleep-text, .place-now, .big-button';

/** The words of a screen to read aloud. */
export function screenWords(view: HTMLElement): string {
  return [...view.querySelectorAll<HTMLElement>(SAID)]
    .map((e) => e.textContent?.trim() ?? '')
    .filter(Boolean)
    .map((t) => (/[.!?]$/.test(t) ? t : `${t}.`))
    .join(' ');
}

/** A grown-up has said the child reads by themselves: the question about read-aloud is not asked again (docs/PLAN-ENKLARE.md, E3). */
export const readsSelfKey = (profileId: string) => `readsSelf:${profileId}`;

/** Whether to read aloud for this child: the setting is on and the device has a Swedish voice. */
export async function voiceFor(profile: Profile): Promise<boolean> {
  return profile.settings.readAloud && speechSupported() && (await hasSwedishVoice());
}

/**
 * Read-aloud for a screen a child reads (docs/PLAN-ENKLARE.md, E3): a speaker
 * button, in `into` when given (beside a place's name) or in the top corner,
 * and with `auto` the words at once (screens that come after a tap). Nothing
 * when the child has no read-aloud.
 */
export async function readAloud(view: HTMLElement, profile: Profile, opts: { auto?: boolean; into?: string } = {}): Promise<void> {
  if (!(await voiceFor(profile)) || !view.isConnected) return;
  const words = screenWords(view);
  if (!words) return;
  const button = h('button', { class: `icon-button speak-button${opts.into ? '' : ' screen-speak'}`, type: 'button', 'aria-label': 'Läs upp', onclick: () => void speak(screenWords(view)) }, icon('speaker'));
  const place = opts.into ? view.querySelector(opts.into) : null;
  (place ?? view).append(button);
  if (opts.auto) void speak(words);
}

/** `readAloud` for the screen just shown. */
export function readShown(ctx: AppContext, profile: Profile, opts: { auto?: boolean; into?: string } = {}): Promise<void> {
  const view = ctx.root.firstElementChild;
  return view instanceof HTMLElement ? readAloud(view, profile, opts) : Promise.resolve();
}
