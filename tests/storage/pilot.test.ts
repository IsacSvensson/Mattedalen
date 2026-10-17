import { describe, expect, it } from 'vitest';
import { emptyState } from '../../src/engine';
import { DEFAULT_SETTINGS, EXPORT_FORMAT, pilotCode, pilotExport, pilotFileName, type ProfileExport } from '../../src/storage';

/** The file for the pilot (docs/PLAN-PILOT.md). */
const backup: ProfileExport = {
  format: EXPORT_FORMAT,
  version: 1,
  exportedAt: 1,
  profile: { id: 'p-123', name: 'Alva Andersson', avatar: '🦊', createdAt: 5, settings: { ...DEFAULT_SETTINGS, moreTime: true } },
  progress: [
    {
      profileId: 'p-123',
      packId: 'multiplication',
      packVersion: 3,
      states: {
        '7x8': { ...emptyState('7x8'), status: 'learning', box: 1, seen: 4, correct: 2, introducedDay: '2026-10-01' },
        '9x9': emptyState('9x9'),
      },
      meta: { pacingGap: 6, unlockedUnitIds: ['u2'], accuracyEma: 0.8, sessionsCompleted: 3, lastSessionDay: '2026-10-16' },
      updatedAt: 9,
    },
  ],
  sessions: [{ id: 's1', profileId: 'p-123', packId: 'multiplication', mode: 'daily', day: '2026-10-16', startedAt: 1, endedAt: 2, answered: 4, correct: 2, introduced: [] }],
  attempts: [{ id: 7, profileId: 'p-123', packId: 'multiplication', itemId: '7x8', ts: 1, sessionId: 's1', format: 'choice', kind: 'due', given: '54', correct: false, rtMs: 4200 }],
  daySummaries: [{ profileId: 'p-123', packId: 'multiplication', day: '2026-09-01', itemId: '2x3', attempts: 3, correct: 3, totalRtMs: 6000 }],
};

describe('the file for the pilot', () => {
  const file = pilotExport(backup, 'P03', 'test', 10);

  it('has the child under its pilot code, never its name, animal or id', () => {
    const text = JSON.stringify(file);
    for (const secret of ['Alva', 'Andersson', '🦊', 'p-123']) expect(text).not.toContain(secret);
    expect(file).toMatchObject({ format: 'mattedalen-pilot', version: 1, app: 'test', exportedAt: 10, code: 'P03' });
  });

  it('has the answers, the sessions, the older summaries and how each fact stands', () => {
    expect(file.attempts).toEqual([{ packId: 'multiplication', itemId: '7x8', ts: 1, sessionId: 's1', format: 'choice', kind: 'due', given: '54', correct: false, rtMs: 4200 }]);
    expect(file.sessions[0]).toMatchObject({ id: 's1', mode: 'daily', answered: 4, correct: 2 });
    expect(file.daySummaries).toEqual([{ packId: 'multiplication', day: '2026-09-01', itemId: '2x3', attempts: 3, correct: 3, totalRtMs: 6000 }]);
    expect(file.places[0]!.items).toEqual({ '7x8': expect.objectContaining({ status: 'learning', seen: 4, correct: 2 }) });
    expect(file.places[0]!.meta.unlockedUnitIds).toEqual(['u2']);
    expect(file.settings.moreTime).toBe(true);
  });

  it('takes only what it lists: a new field in the profile does not slip in', () => {
    const more = { ...backup, profile: { ...backup.profile, settings: { ...backup.profile.settings, secretNote: 'x' } as never } };
    expect(JSON.stringify(pilotExport(more, 'P03', 'test'))).not.toContain('secretNote');
  });

  it('accepts short codes of letters, digits and dashes, in capitals', () => {
    expect(pilotCode(' p03 ')).toBe('P03');
    expect(pilotCode('A-12')).toBe('A-12');
    for (const bad of ['', 'Alva Andersson', 'ö1', '1234567890123']) expect(pilotCode(bad)).toBeNull();
    expect(pilotFileName('P03', new Date(2026, 9, 17))).toBe('mattedalen-pilot-P03-2026-10-17.json');
  });
});
