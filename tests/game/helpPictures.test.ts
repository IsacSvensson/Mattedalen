import { describe, expect, it } from 'vitest';
import { divisionId, factId } from '../../src/content/multiplication';
import { clockLine, clockPosition, pictureFor, picturesFor } from '../../src/places/tradgarden/helpPictures';
import { parseExport } from '../../src/storage';
import { hourAngle, minuteAngle } from '../../src/shell/components/clockFace';

/** The pictures in the garden's help (docs/PLAN-KLOCKAN.md, ST1). */
describe('the clock for the five times table', () => {
  it('belongs to every fact with a 5, both ways, and to dividing by 5', () => {
    for (let o = 1; o <= 10; o++) {
      expect(clockPosition(factId(o, 5))).toBe(o);
      expect(clockPosition(factId(5, o))).toBe(o);
      expect(clockPosition(divisionId(o * 5, 5))).toBe(o);
    }
    // Not where the answer is 5: there the clock would show the wrong number.
    expect(clockPosition(divisionId(35, 7))).toBeNull();
    expect(clockPosition(factId(7, 8))).toBeNull();
    expect(clockPosition('lika:skip:5')).toBeNull();
  });

  it('takes turns with the rectangle, one each time the child meets the fact', () => {
    expect(picturesFor(factId(7, 5), {})).toEqual(['array', 'clock']);
    expect(pictureFor(factId(7, 5), 0, {})).toBe('array');
    expect(pictureFor(factId(7, 5), 1, {})).toBe('clock');
    expect(pictureFor(factId(7, 5), 2, {})).toBe('array');
    expect(pictureFor(factId(7, 8), 1, {})).toBe('array');
  });

  it('is gone when a grown-up turns it off', () => {
    expect(picturesFor(factId(7, 5), { helpPicturesOff: ['clock'] })).toEqual(['array']);
    expect(pictureFor(factId(7, 5), 1, { helpPicturesOff: ['clock'] })).toBe('array');
  });

  it('has a line that replaces the rectangle’s', () => {
    expect(clockLine(factId(7, 5))).toBe('Minutvisaren på 7 är 35 minuter. 7 × 5 = 35.');
    expect(clockLine(factId(5, 3))).toBe('Minutvisaren på 3 är 15 minuter. 5 × 3 = 15.');
    expect(clockLine(divisionId(35, 5))).toBe('35 minuter: minutvisaren står på 7. 35 ÷ 5 = 7.');
  });
});

describe('the clock face', () => {
  it('turns the minute hand 6° a minute, and the hour hand on with the minutes', () => {
    expect(minuteAngle(0)).toBe(0);
    expect(minuteAngle(30)).toBe(180);
    expect(minuteAngle(35)).toBe(210);
    // Half past three: halfway between 3 and 4, never on 3.
    expect(hourAngle(3.5)).toBe(105);
    expect(hourAngle(15)).toBe(90);
    for (let m = 0; m < 720; m++) expect(hourAngle(m / 60)).toBeCloseTo(m / 2);
  });
});

describe('"Bilder i hjälpen" in the backup', () => {
  const backup = (settings: Record<string, unknown>) => ({
    format: 'mattedalen-profil',
    version: 1,
    exportedAt: 1,
    profile: { id: 'a', name: 'Alva', avatar: '🦊', createdAt: 1, settings: { sessionMinutes: 12, readAloud: false, allowFree: true, ...settings } },
    progress: [],
    sessions: [],
    attempts: [],
  });
  it('keeps the names it knows, and leaves out the rest', () => {
    expect(parseExport(backup({ helpPicturesOff: ['clock', 'dragons'] })).profile.settings.helpPicturesOff).toEqual(['clock']);
    expect(parseExport(backup({ helpPicturesOff: ['dragons'] })).profile.settings.helpPicturesOff).toBeUndefined();
    expect(parseExport(backup({})).profile.settings.helpPicturesOff).toBeUndefined();
  });
});
