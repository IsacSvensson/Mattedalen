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

describe('read-aloud when the engine is stuck (Chrome on Android)', () => {
  /** An engine that may be left "speaking", and that ignores the first utterance once. */
  function stuckSpeech(opts: { busy: boolean; ignoreFirst: boolean }) {
    const log: string[] = [];
    let busy = opts.busy;
    let ignore = opts.ignoreFirst;
    class FakeUtterance {
      lang = '';
      rate = 1;
      voice: { name: string } | null = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [{ lang: 'sv-SE', name: 'Alva', localService: true }],
      get speaking() {
        return busy;
      },
      pending: false,
      speak: (u: FakeUtterance) => {
        if (ignore) {
          ignore = false;
          log.push(`ignored: ${u.text}`);
          return;
        }
        log.push(`said: ${u.text}`);
        u.onstart?.();
        u.onend?.();
      },
      cancel: () => {
        busy = false;
        log.push('cancel');
      },
      resume: () => log.push('resume'),
      addEventListener: () => undefined,
    });
    return log;
  }

  it('wakes the engine, and cancels what it is stuck on with a pause before speaking', async () => {
    vi.useFakeTimers();
    const log = stuckSpeech({ busy: true, ignoreFirst: false });
    const done = speak('3 + 4');
    await vi.advanceTimersByTimeAsync(100);
    await done;
    expect(log).toEqual(['cancel', 'resume', 'said: 3 plus 4']);
  });

  it('tries once more when the utterance does not start', async () => {
    vi.useFakeTimers();
    const log = stuckSpeech({ busy: false, ignoreFirst: true });
    const done = speak('3 + 4');
    await vi.advanceTimersByTimeAsync(1500);
    await done;
    expect(log).toEqual(['resume', 'ignored: 3 plus 4', 'cancel', 'resume', 'said: 3 plus 4']);
  });
});
