import { describe, expect, it } from 'vitest';
import { detectPlatform } from '../../src/shell/pwa';

describe('platform detection for the install guide', () => {
  it('recognises iPhone and iPad (also iPadOS posing as a Mac)', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', 5)).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 5)).toBe('ios');
  });
  it('recognises Android and everything else', () => {
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/126', 5)).toBe('android');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 0)).toBe('other');
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126', 0)).toBe('other');
  });
});

import { spokenText } from '../../src/shell/speech';

describe('read-aloud text', () => {
  it('says facts the way children say them', () => {
    expect(spokenText('3 × 7 = ?')).toBe('3 gånger 7');
    expect(spokenText('3 × 7 = 21')).toBe('3 gånger 7 är 21');
    expect(spokenText('9 × 6 = 10 × 6 − 6')).toBe('9 gånger 6 är 10 gånger 6 minus 6');
    expect(spokenText('13 − 5 = __')).toBe('13 minus 5 är hur mycket');
    expect(spokenText('5 + __ = 13')).toBe('5 plus hur mycket är 13');
  });
});
