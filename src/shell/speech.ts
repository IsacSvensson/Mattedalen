/**
 * Optional read-aloud in Swedish (Web Speech API). Only voices on the device
 * are used: some browsers (Chrome) also offer network voices
 * (`localService === false`) that send the text to a server, and nothing may
 * leave the device. Without a local Swedish voice nothing is read aloud, not
 * even with the browser's default voice, which may be a network one.
 */

const LANG = 'sv-SE';

function synth(): SpeechSynthesis | undefined {
  return typeof speechSynthesis !== 'undefined' ? speechSynthesis : undefined;
}

export function speechSupported(): boolean {
  return synth() !== undefined && typeof SpeechSynthesisUtterance !== 'undefined';
}

function swedishVoice(): SpeechSynthesisVoice | undefined {
  const voices = (synth()?.getVoices() ?? []).filter((v) => v.localService === true);
  return voices.find((v) => v.lang === LANG) ?? voices.find((v) => v.lang.toLowerCase().startsWith('sv'));
}

/** A Swedish voice among the voices already loaded, without waiting for more (asking also starts the loading). */
export function swedishVoiceLoaded(): boolean {
  return swedishVoice() !== undefined;
}

/** Voices load asynchronously in some browsers. True if a Swedish voice on the device exists. */
export async function hasSwedishVoice(): Promise<boolean> {
  const s = synth();
  if (!s) return false;
  if (swedishVoice()) return true;
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    s.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
  return swedishVoice() !== undefined;
}

/** "3 × 7 = ?" → "3 gånger 7", as a child would say it. */
export function spokenText(text: string): string {
  return text
    .replace(/×/g, ' gånger ')
    .replace(/÷/g, ' delat med ')
    .replace(/−/g, ' minus ')
    .replace(/\+/g, ' plus ')
    .replace(/__/g, ' hur mycket ')
    .replace(/=\s*\?/g, '')
    .replace(/=/g, ' är ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chrome drops an utterance spoken right after `cancel()`: this long a pause first. */
export const CANCEL_GAP_MS = 80;
/** An utterance that has not started after this long is tried once more. */
export const START_WAIT_MS = 1200;
/** Some engines never fire `end`; the game never waits longer than this. */
const LONGEST_MS = 6000;

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Wakes an engine left paused (every browser has `resume`; a stand-in for one may not). */
function wake(s: SpeechSynthesis): void {
  if (typeof s.resume === 'function') s.resume();
}

/**
 * Speaks the text with a Swedish voice on the device; resolves when done, or
 * right away if there is no such voice. It never waits for voices to load:
 * a session times the answer from when the question has been read, so a wait
 * here would make the measured time shorter. Screens that read aloud check
 * `hasSwedishVoice()` once when they open.
 *
 * Chrome on Android can get stuck: paused, or still "speaking" an earlier
 * utterance, so that new ones wait in silence until the phone is restarted.
 * So the engine is woken (`resume`) before each utterance, an earlier one is
 * cancelled with a short pause after it, and an utterance that has not
 * started after a moment is tried once more.
 */
export async function speak(text: string): Promise<void> {
  const s = synth();
  const voice = swedishVoice();
  if (!s || typeof SpeechSynthesisUtterance === 'undefined' || !voice) return;
  if (s.speaking || s.pending) {
    s.cancel();
    await pause(CANCEL_GAP_MS);
  }
  wake(s);
  return new Promise((resolve) => {
    let started = false;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const say = (again: boolean) => {
      const u = new SpeechSynthesisUtterance(spokenText(text));
      u.lang = LANG;
      u.voice = voice;
      u.rate = 0.9;
      u.onstart = () => {
        started = true;
      };
      u.onend = finish;
      u.onerror = finish;
      s.speak(u);
      if (again) return;
      setTimeout(() => {
        if (started || settled || s.speaking) return;
        // Not started: the engine was stuck. Clear it and try once more.
        s.cancel();
        setTimeout(() => {
          if (settled) return;
          wake(s);
          say(true);
        }, CANCEL_GAP_MS);
      }, START_WAIT_MS);
    };
    say(false);
    setTimeout(finish, LONGEST_MS);
  });
}

export function stopSpeaking(): void {
  synth()?.cancel();
}
