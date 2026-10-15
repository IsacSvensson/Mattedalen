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
    .replace(/−/g, ' minus ')
    .replace(/\+/g, ' plus ')
    .replace(/__/g, ' hur mycket ')
    .replace(/=\s*\?/g, '')
    .replace(/=/g, ' är ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Speaks the text with a Swedish voice on the device; resolves when done, or
 * right away if there is no such voice. It never waits for voices to load:
 * a session times the answer from when the question has been read, so a wait
 * here would make the measured time shorter. Screens that read aloud check
 * `hasSwedishVoice()` once when they open.
 */
export async function speak(text: string): Promise<void> {
  const s = synth();
  const voice = swedishVoice();
  if (!s || typeof SpeechSynthesisUtterance === 'undefined' || !voice) return;
  s.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(spokenText(text));
    u.lang = LANG;
    u.voice = voice;
    u.rate = 0.9;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    s.speak(u);
    // Some engines never fire `end`; don't let the game wait forever.
    setTimeout(resolve, 6000);
  });
}

export function stopSpeaking(): void {
  synth()?.cancel();
}
