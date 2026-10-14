import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasSwedishVoice, speak } from '../../src/shell/speech';

/** A minimal Web Speech API with the given voices; records what is spoken and with which voice. */
function fakeSpeech(voices: { lang: string; name: string; localService: boolean }[]) {
  const spoken: string[] = [];
  class FakeUtterance {
    lang = '';
    rate = 1;
    voice: { name: string } | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => voices,
    speak: (u: FakeUtterance) => {
      spoken.push(`${u.voice?.name ?? 'standardröst'}: ${u.text}`);
      u.onend?.();
    },
    cancel: () => undefined,
    addEventListener: () => undefined,
  });
  return spoken;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('read-aloud stays on the device', () => {
  it('never uses a network voice, and does not wait for one', async () => {
    vi.useFakeTimers();
    const spoken = fakeSpeech([{ lang: 'sv-SE', name: 'Google svenska', localService: false }]);
    let done = false;
    void speak('3 × 7').then(() => (done = true));
    // Resolved without any time passing: a session times the answer from here.
    await Promise.resolve();
    await Promise.resolve();
    expect(done).toBe(true);
    expect(spoken).toEqual([]);
    const check = hasSwedishVoice();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await check).toBe(false);
  });

  it('uses the Swedish voice on the device when there is one', async () => {
    const spoken = fakeSpeech([
      { lang: 'sv-SE', name: 'Google svenska', localService: false },
      { lang: 'en-US', name: 'Samantha', localService: true },
      { lang: 'sv-SE', name: 'Alva', localService: true },
    ]);
    expect(await hasSwedishVoice()).toBe(true);
    await speak('3 × 7');
    expect(spoken).toEqual(['Alva: 3 gånger 7']);
  });
});
