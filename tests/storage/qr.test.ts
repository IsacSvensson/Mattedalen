import jsQR from 'jsqr';
import qrcode from 'qrcode-generator';
import { describe, expect, it } from 'vitest';
import { createEngine, emptyState, ManualClock, seededRng, type ItemState } from '../../src/engine';
import { createMultiplicationPack } from '../../src/content/multiplication';
import {
  base45Decode,
  base45Encode,
  decodeSnapshot,
  DEFAULT_SETTINGS,
  encodeSnapshot,
  ImportError,
  levelOf,
  packLevels,
  unpackLevels,
  type Profile,
} from '../../src/storage';
import { progressFromSnapshot, qrSvgMarkup, snapshotOf } from '../../src/shell/transfer';

const pack = createMultiplicationPack();
const profile: Profile = { id: 'p', name: 'Åsa', avatar: '🦊', createdAt: 0, settings: { ...DEFAULT_SETTINGS, sessionMinutes: 14 } };

/** A child in the middle of learning: every kind of level is present. */
function midway(): Record<string, ItemState> {
  const states: Record<string, ItemState> = {};
  pack.items.forEach((it, i) => {
    const kinds: Partial<ItemState>[] = [
      {},
      { status: 'learning', box: 0 },
      { status: 'learning', box: 2 },
      { status: 'fluent', box: 1 },
      { status: 'fluent', box: 4 },
      { status: 'automatic', box: 3 },
      { status: 'automatic', box: 5 },
    ];
    states[it.id] = { ...emptyState(it.id), ...kinds[i % kinds.length] };
  });
  return states;
}

/** Renders a QR code to RGBA pixels, like a camera frame. */
function render(text: string, cell = 4) {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Alphanumeric');
  qr.make();
  const n = qr.getModuleCount() + 8;
  const size = n * cell;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.floor(y / cell) - 4;
      const c = Math.floor(x / cell) - 4;
      if (r >= 0 && c >= 0 && r < n - 8 && c < n - 8 && qr.isDark(r, c)) {
        const o = (y * size + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = 0;
      }
    }
  }
  return { data, size };
}

describe('base45 and bit packing', () => {
  it('round-trips arbitrary bytes', () => {
    const rng = seededRng(9);
    for (let len = 0; len < 40; len++) {
      const bytes = Uint8Array.from({ length: len }, () => Math.floor(rng.next() * 256));
      expect(base45Decode(base45Encode(bytes))).toEqual(bytes);
    }
    expect(base45Encode(new TextEncoder().encode('AB'))).toBe('BB8'); // RFC 9285 example
  });

  it('packs 3-bit levels', () => {
    const levels = Array.from({ length: 100 }, (_, i) => i % 7);
    expect(packLevels(levels)).toHaveLength(38);
    expect(unpackLevels(Uint8Array.from(packLevels(levels)), 100)).toEqual(levels);
  });
});

describe('QR snapshot', () => {
  it('encodes a whole child into a small QR code', () => {
    const text = encodeSnapshot(snapshotOf(profile, pack, midway()));
    expect(text.startsWith('GT1:')).toBe(true);
    expect(text.length).toBeLessThan(110);
    expect(/^[0-9A-Z $%*+\-./:]+$/.test(text)).toBe(true);
    expect(qrSvgMarkup(text).version).toBeLessThanOrEqual(6);
  });

  it('round-trips through a real QR image and recreates the status on another device', () => {
    const states = midway();
    const text = encodeSnapshot(snapshotOf(profile, pack, states));
    const { data, size } = render(text);
    const scanned = jsQR(data, size, size)!;
    expect(scanned.data).toBe(text);

    const snap = decodeSnapshot(scanned.data);
    expect(snap).toMatchObject({ name: 'Åsa', avatar: '🦊', sessionMinutes: 14 });
    const clock = new ManualClock(Date.UTC(2026, 5, 1, 12));
    const engine = createEngine({ pack, clock, rng: seededRng(1) });
    const restored = progressFromSnapshot(snap, engine, clock.today());
    for (const it of pack.items) {
      expect(restored.states[it.id]!.status, it.id).toBe(states[it.id]!.status);
      expect(levelOf(restored.states[it.id]), it.id).toBe(levelOf(states[it.id]));
    }
    // The restored child can play straight away.
    const session = engine.startSession(restored);
    expect(session.next()).not.toBeNull();
  });

  it('opens the units the child had reached', () => {
    const engine = createEngine({ pack, clock: new ManualClock(0), rng: seededRng(1) });
    const states = Object.fromEntries(pack.items.map((it) => [it.id, emptyState(it.id)]));
    states['3x7'] = { ...emptyState('3x7'), status: 'learning', box: 1 }; // ×3 is unit 6
    const { meta } = progressFromSnapshot(decodeSnapshot(encodeSnapshot(snapshotOf(profile, pack, states))), engine, '2026-06-01');
    expect(meta.unlockedUnitIds).toEqual(['u10', 'u2', 'u5', 'u1', 'u4', 'u3']);
  });

  it('rejects damaged or foreign codes', () => {
    const text = encodeSnapshot(snapshotOf(profile, pack, midway()));
    expect(() => decodeSnapshot('https://example.com')).toThrow(ImportError);
    expect(() => decodeSnapshot(text.slice(0, -3))).toThrow(ImportError);
    const flipped = text.slice(0, 10) + (text[10] === 'A' ? 'B' : 'A') + text.slice(11);
    expect(() => decodeSnapshot(flipped)).toThrow(ImportError);
  });

  it('keeps long names within limits', () => {
    const snap = decodeSnapshot(encodeSnapshot({ name: 'Å'.repeat(40), avatar: '🐢', sessionMinutes: 12, levels: [1, 2, 3] }));
    expect(snap.name).toBe('Å'.repeat(20));
    expect(snap.levels).toEqual([1, 2, 3]);
  });
});
