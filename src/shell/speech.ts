/**
 * Optional read-aloud in Swedish (Web Speech API). Uses voices installed on
 * the device, so it also works offline where such a voice exists.
 */

const LANG = 'sv-SE';

function synth(): SpeechSynthesis | undefined {
  return typeof speechSynthesis !== 'undefined' ? speechSynthesis : undefined;
}

export function speechSupported(): boolean {
  return synth() !== undefined && typeof SpeechSynthesisUtterance !== 'undefined';
}

function swedishVoice(): SpeechSynthesisVoice | undefined {
  const voices = synth()?.getVoices() ?? [];
  return voices.find((v) => v.lang === LANG) ?? voices.find((v) => v.lang.toLowerCase().startsWith('sv'));
}

/** Voices load asynchronously in some browsers. */
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
    .replace(/=\s*\?/g, '')
    .replace(/=/g, ' är ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Speaks the text; resolves when done (or right away if speech is unavailable). */
export function speak(text: string): Promise<void> {
  const s = synth();
  if (!s || typeof SpeechSynthesisUtterance === 'undefined') return Promise.resolve();
  s.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(spokenText(text));
    u.lang = LANG;
    const voice = swedishVoice();
    if (voice) u.voice = voice;
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
