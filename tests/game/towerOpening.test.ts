import { describe, expect, it } from 'vitest';
import { emptyState, type ItemState } from '../../src/engine';
import { createAdditionPack } from '../../src/content/addition';
import { createHundredPack } from '../../src/content/hundred';
import { towerOpens, towerWaiting } from '../../src/places/klocktornet/opening';
import { planDay } from '../../src/shell/dayPlan';
import { decodeTransfer, encodeTransfer, parseExport, DEFAULT_SETTINGS } from '../../src/storage';
import { transferOf } from '../../src/shell/transfer';

/** Klocktornet in the valley (docs/PLAN-KLOCKAN.md, KL4). */
const brook = createAdditionPack();
const path = createHundredPack();
const fluentIn = (pack: typeof brook, units: string[]) =>
  Object.fromEntries(pack.units.filter((u) => units.includes(u.id)).flatMap((u) => u.itemIds).map((id): [string, ItemState] => [id, { ...emptyState(id), status: 'fluent', box: 3 }]));

describe('when the tower opens', () => {
  it('opens when small sums sit at the brook, when the child has started, or when a grown-up opens it', () => {
    expect(towerOpens({ towerStates: {}, brook: { pack: brook, states: fluentIn(brook, ['ettmer']) }, openedByAdult: false })).toBe(false);
    expect(towerOpens({ towerStates: {}, brook: { pack: brook, states: fluentIn(brook, ['ettmer', 'sma']) }, openedByAdult: false })).toBe(true);
    expect(towerOpens({ towerStates: {}, brook: { pack: brook, states: {} }, openedByAdult: true })).toBe(true);
    expect(towerOpens({ towerStates: { 'ur:tim': { ...emptyState('ur:tim'), status: 'learning' } }, brook: { pack: brook, states: {} }, openedByAdult: false })).toBe(true);
  });

  it('lets five minutes at a time wait for whole tens on Stigen', () => {
    expect(towerWaiting(path, {})).toEqual(['femmin']);
    expect(towerWaiting(path, fluentIn(path, ['tiotal']))).toEqual([]);
    expect(towerWaiting(undefined, {})).toEqual([]);
  });
});

describe('the day with four places', () => {
  it('still visits at most two; a new child with the brook and the tower open gets both', () => {
    expect(Object.keys(planDay('2026-02-02', 12, [{ id: 'backen', due: 0 }, { id: 'klocktornet', due: 0 }]).minutes)).toEqual(['backen', 'klocktornet']);
    const four = planDay('2026-02-02', 14, [
      { id: 'backen', due: 20 },
      { id: 'stigen', due: 5 },
      { id: 'tradgarden', due: 3 },
      { id: 'klocktornet', due: 9 },
    ]);
    expect(Object.keys(four.minutes)).toEqual(['backen', 'klocktornet']);
  });
});

describe('"towerOpen" travels with the child', () => {
  const profile = { id: 'a', name: 'Alva', avatar: '🦊', createdAt: 1, settings: { ...DEFAULT_SETTINGS, towerOpen: true } };
  it('in the QR code (bit 7) and in the backup', () => {
    expect(decodeTransfer(encodeTransfer(transferOf(profile, []))).towerOpen).toBe(true);
    expect(decodeTransfer(encodeTransfer(transferOf({ ...profile, settings: DEFAULT_SETTINGS }, []))).towerOpen).toBeUndefined();
    const backup = { format: 'mattedalen-profil', version: 1, exportedAt: 1, profile, progress: [], sessions: [], attempts: [] };
    expect(parseExport(backup).profile.settings.towerOpen).toBe(true);
  });
});
