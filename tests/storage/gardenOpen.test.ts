import { describe, expect, it } from 'vitest';
import { EXPORT_FORMAT, LEGACY_EXPORT_FORMAT, parseExport } from '../../src/storage';

const backup = (format: string, settings: Record<string, unknown> = {}) => ({
  format,
  version: 1,
  exportedAt: 1,
  profile: { id: 'p', name: 'Alva', avatar: '🦊', createdAt: 1, settings: { sessionMinutes: 12, readAloud: false, allowFree: true, ...settings } },
  progress: [],
  sessions: [],
  attempts: [],
});

describe('the garden in backups', () => {
  it('is open for children from Gångerträdgården', () => {
    expect(parseExport(backup(LEGACY_EXPORT_FORMAT)).profile.settings.gardenOpen).toBe(true);
  });

  it('keeps a grown-up’s choice, and is not opened for anyone else', () => {
    expect(parseExport(backup(EXPORT_FORMAT, { gardenOpen: true })).profile.settings.gardenOpen).toBe(true);
    expect(parseExport(backup(EXPORT_FORMAT)).profile.settings.gardenOpen).toBeUndefined();
  });
});

describe('Stigen in backups', () => {
  it('keeps a grown-up’s choice to open it, and is not opened for anyone else', () => {
    expect(parseExport(backup(EXPORT_FORMAT, { pathOpen: true })).profile.settings.pathOpen).toBe(true);
    expect(parseExport(backup(EXPORT_FORMAT, { pathOpen: 'ja' })).profile.settings.pathOpen).toBeUndefined();
  });
});

describe('the garden’s waits in backups', () => {
  it('keeps the days the tables could open, and a grown-up’s choice to turn the waiting off', () => {
    const settings = parseExport(backup(EXPORT_FORMAT, { tablesWait: false, tableReady: { u10: '2026-02-02', u4: 'i går', u3: 7 } })).profile.settings;
    expect(settings.tablesWait).toBe(false);
    expect(settings.tableReady).toEqual({ u10: '2026-02-02' });
    const plain = parseExport(backup(EXPORT_FORMAT, { tablesWait: true, tableReady: [] })).profile.settings;
    expect(plain.tablesWait).toBeUndefined();
    expect(plain.tableReady).toBeUndefined();
  });
});
