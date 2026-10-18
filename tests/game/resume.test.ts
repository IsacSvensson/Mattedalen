import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { markResume, RESUME_WITHIN_MS, setWhere, takeResume } from '../../src/shell/resume';

/** sessionStorage as the browser has it, for the node test run. */
class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

describe('back to the same screen after an update (docs/PLAN-UPPDATERING.md)', () => {
  beforeEach(() => {
    (globalThis as { sessionStorage?: unknown }).sessionStorage = new MemoryStorage();
  });
  afterEach(() => {
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    setWhere(null);
  });

  it('comes back once to where the app was when the update reloaded it', () => {
    setWhere({ kind: 'place', profileId: 'p1', placeId: 'backen' });
    markResume(1000);
    expect(takeResume(2000)).toEqual({ kind: 'place', profileId: 'p1', placeId: 'backen' });
    // Once: the next start is an ordinary one.
    expect(takeResume(3000)).toBeNull();
  });

  it('starts over after an ordinary start, a late reload or from the list of players', () => {
    expect(takeResume(1000)).toBeNull();
    setWhere({ kind: 'valley', profileId: 'p1' });
    markResume(1000);
    expect(takeResume(1000 + RESUME_WITHIN_MS + 1)).toBeNull();
    setWhere(null);
    markResume(5000);
    expect(takeResume(6000)).toBeNull();
  });

  it('ignores what is not a screen, and works without sessionStorage', () => {
    sessionStorage.setItem('mattedalen:resume', JSON.stringify({ where: { kind: 'session' }, at: 1000 }));
    expect(takeResume(2000)).toBeNull();
    sessionStorage.setItem('mattedalen:resume', '{not json');
    expect(takeResume(2000)).toBeNull();
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    setWhere({ kind: 'parent', page: 'device' });
    expect(() => markResume(1000)).not.toThrow();
    expect(takeResume(2000)).toBeNull();
  });
});
