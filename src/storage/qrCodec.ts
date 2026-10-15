import { addDays, emptyState, type DayKey, type ItemState } from '../engine';
import { ImportError } from './backup';

/**
 * Compact snapshot of a child's status for moving between devices with a QR
 * code. Per item only a 3-bit level (status + rough Leitner box) is kept, so
 * 100 facts fit in 38 bytes and the whole code stays small and easy to scan.
 * The full history moves with the JSON backup instead.
 *
 * Layout (bytes): version, item count, session minutes, name length, name
 * (UTF-8), avatar length, avatar (UTF-8), packed levels, CRC-8. The bytes are
 * base45-encoded (RFC 9285) so the QR code can use the compact alphanumeric
 * mode, and prefixed with "GT1:".
 */
export const QR_PREFIX = 'GT1:';
const QR_VERSION = 1;
const BITS = 3;
const MAX_NAME_BYTES = 40;

export interface QrSnapshot {
  name: string;
  avatar: string;
  sessionMinutes: number;
  /** One level per item, in the pack's canonical item order. */
  levels: number[];
}

/** 0 new · 1–2 learning · 3–4 fluent · 5–6 automatic (low / high Leitner box). */
export function levelOf(s: ItemState | undefined): number {
  if (!s || s.status === 'new') return 0;
  if (s.status === 'learning') return s.box === 0 ? 1 : 2;
  if (s.status === 'fluent') return s.box < 3 ? 3 : 4;
  return s.box < 4 ? 5 : 6;
}

const LEVEL_STATE: { status: ItemState['status']; box: number }[] = [
  { status: 'new', box: 0 },
  { status: 'learning', box: 0 },
  { status: 'learning', box: 1 },
  { status: 'fluent', box: 2 },
  { status: 'fluent', box: 3 },
  { status: 'automatic', box: 3 },
  { status: 'automatic', box: 5 },
];

/** Rebuilds an item state from a level. Reviews are scheduled from `today`. */
export function stateFromLevel(itemId: string, level: number, today: DayKey, intervalsDays: number[]): ItemState {
  const base = emptyState(itemId);
  const target = LEVEL_STATE[level];
  if (!target || target.status === 'new') return base;
  const box = Math.min(target.box, intervalsDays.length - 1);
  const due = target.status === 'learning' ? 1 : (intervalsDays[box] ?? 1);
  return { ...base, status: target.status, box, dueDay: addDays(today, due), introducedDay: addDays(today, -1) };
}

export function encodeSnapshot(snap: QrSnapshot): string {
  const enc = new TextEncoder();
  const name = truncateUtf8(snap.name, MAX_NAME_BYTES);
  const avatar = enc.encode(snap.avatar).slice(0, 16);
  if (snap.levels.length > 255) throw new Error('Too many items for a QR snapshot');
  const packed = packLevels(snap.levels);
  const bytes = [
    QR_VERSION,
    snap.levels.length,
    Math.max(0, Math.min(255, Math.round(snap.sessionMinutes))),
    name.length,
    ...name,
    avatar.length,
    ...avatar,
    ...packed,
  ];
  bytes.push(crc8(bytes));
  return QR_PREFIX + base45Encode(Uint8Array.from(bytes));
}

export function decodeSnapshot(text: string): QrSnapshot {
  const fail = () => new ImportError('QR-koden gick inte att läsa. Den ska komma från Mattedalen eller Gångerträdgården.');
  const trimmed = text.trim();
  if (!trimmed.startsWith(QR_PREFIX)) throw fail();
  let bytes: Uint8Array;
  try {
    bytes = base45Decode(trimmed.slice(QR_PREFIX.length));
  } catch {
    throw fail();
  }
  if (bytes.length < 6 || crc8([...bytes.subarray(0, -1)]) !== bytes[bytes.length - 1]) throw fail();
  if (bytes[0] !== QR_VERSION) throw new ImportError('QR-koden kommer från en annan version av appen.');
  const dec = new TextDecoder();
  let i = 1;
  const count = bytes[i++] as number;
  const sessionMinutes = bytes[i++] as number;
  const nameLen = bytes[i++] as number;
  const name = dec.decode(bytes.subarray(i, i + nameLen));
  i += nameLen;
  const avatarLen = bytes[i++] as number;
  const avatar = dec.decode(bytes.subarray(i, i + avatarLen));
  i += avatarLen;
  const levelBytes = Math.ceil((count * BITS) / 8);
  if (i + levelBytes !== bytes.length - 1) throw fail();
  const levels = unpackLevels(bytes.subarray(i, i + levelBytes), count);
  if (levels.some((l) => l >= LEVEL_STATE.length)) throw fail();
  return { name, avatar, sessionMinutes, levels };
}

/**
 * A child with every place, for the QR code ("MD1:"): the profile, then one
 * block per content pack with the pack's id and version and a level per item.
 * Codes from Gångerträdgården ("GT1:") are read as a child with the garden.
 *
 * Layout (bytes): version, session minutes, flags (bit 0: the garden is open),
 * name length, name, avatar length, avatar, block count, and per block: id
 * length, id (UTF-8), pack version, item count (2 bytes), packed levels; CRC-8.
 */
export const TRANSFER_PREFIX = 'MD1:';
const TRANSFER_VERSION = 1;

export interface QrPackLevels {
  packId: string;
  packVersion: number;
  /** One level per item, in the pack's canonical item order. */
  levels: number[];
}

export interface QrTransfer {
  name: string;
  avatar: string;
  sessionMinutes: number;
  gardenOpen: boolean;
  packs: QrPackLevels[];
}

export function encodeTransfer(t: QrTransfer): string {
  const enc = new TextEncoder();
  const name = truncateUtf8(t.name, MAX_NAME_BYTES);
  const avatar = enc.encode(t.avatar).slice(0, 16);
  if (t.packs.length > 255) throw new Error('Too many packs for a QR code');
  const bytes = [
    TRANSFER_VERSION,
    Math.max(0, Math.min(255, Math.round(t.sessionMinutes))),
    t.gardenOpen ? 1 : 0,
    name.length,
    ...name,
    avatar.length,
    ...avatar,
    t.packs.length,
  ];
  for (const block of t.packs) {
    const id = enc.encode(block.packId).slice(0, 32);
    if (block.levels.length > 0xffff) throw new Error('Too many items for a QR code');
    bytes.push(id.length, ...id, block.packVersion & 0xff, block.levels.length >> 8, block.levels.length & 0xff, ...packLevels(block.levels));
  }
  bytes.push(crc8(bytes));
  return TRANSFER_PREFIX + base45Encode(Uint8Array.from(bytes));
}

/** Reads a code from Mattedalen (MD1) or Gångerträdgården (GT1). */
export function decodeTransfer(text: string): QrTransfer {
  const trimmed = text.trim();
  if (trimmed.startsWith(QR_PREFIX)) {
    const snap = decodeSnapshot(trimmed);
    // A child from Gångerträdgården: the garden only, and open.
    return { ...snap, gardenOpen: true, packs: [{ packId: 'multiplication', packVersion: 1, levels: snap.levels }] };
  }
  const fail = () => new ImportError('QR-koden gick inte att läsa. Den ska komma från Mattedalen eller Gångerträdgården.');
  if (!trimmed.startsWith(TRANSFER_PREFIX)) throw fail();
  let bytes: Uint8Array;
  try {
    bytes = base45Decode(trimmed.slice(TRANSFER_PREFIX.length));
  } catch {
    throw fail();
  }
  if (bytes.length < 7 || crc8([...bytes.subarray(0, -1)]) !== bytes[bytes.length - 1]) throw fail();
  if (bytes[0] !== TRANSFER_VERSION) throw new ImportError('QR-koden kommer från en annan version av appen.');
  const end = bytes.length - 1;
  const dec = new TextDecoder();
  let i = 1;
  const take = (n: number) => {
    if (i + n > end) throw fail();
    const out = bytes.subarray(i, i + n);
    i += n;
    return out;
  };
  const byte = () => take(1)[0] as number;
  const sessionMinutes = byte();
  const flags = byte();
  const name = dec.decode(take(byte()));
  const avatar = dec.decode(take(byte()));
  const packs: QrPackLevels[] = [];
  for (let n = byte(); n > 0; n--) {
    const packId = dec.decode(take(byte()));
    const packVersion = byte();
    const count = byte() * 256 + byte();
    const levels = unpackLevels(take(Math.ceil((count * BITS) / 8)), count);
    if (levels.some((l) => l >= LEVEL_STATE.length)) throw fail();
    packs.push({ packId, packVersion, levels });
  }
  if (i !== end) throw fail();
  return { name, avatar, sessionMinutes, gardenOpen: (flags & 1) === 1, packs };
}

function truncateUtf8(s: string, max: number): Uint8Array {
  const enc = new TextEncoder();
  let out = enc.encode(s);
  let chars = [...s];
  while (out.length > max) {
    chars = chars.slice(0, -1);
    out = enc.encode(chars.join(''));
  }
  return out;
}

export function packLevels(levels: number[]): number[] {
  const out = new Array<number>(Math.ceil((levels.length * BITS) / 8)).fill(0);
  levels.forEach((level, n) => {
    for (let b = 0; b < BITS; b++) {
      if ((level >> b) & 1) {
        const bit = n * BITS + b;
        out[bit >> 3] = (out[bit >> 3] as number) | (1 << (bit & 7));
      }
    }
  });
  return out;
}

export function unpackLevels(bytes: Uint8Array, count: number): number[] {
  const out: number[] = [];
  for (let n = 0; n < count; n++) {
    let level = 0;
    for (let b = 0; b < BITS; b++) {
      const bit = n * BITS + b;
      if (((bytes[bit >> 3] as number) >> (bit & 7)) & 1) level |= 1 << b;
    }
    out.push(level);
  }
  return out;
}

/** CRC-8 (polynomial 0x07). */
export function crc8(bytes: number[]): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
  }
  return crc;
}

const B45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

/** Base45 (RFC 9285): bytes → characters of the QR alphanumeric set. */
export function base45Encode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      let n = (bytes[i] as number) * 256 + (bytes[i + 1] as number);
      const c = n % 45;
      n = (n - c) / 45;
      out += B45[c]! + B45[n % 45]! + B45[Math.floor(n / 45)]!;
    } else {
      const n = bytes[i] as number;
      out += B45[n % 45]! + B45[Math.floor(n / 45)]!;
    }
  }
  return out;
}

export function base45Decode(text: string): Uint8Array {
  const vals = [...text].map((ch) => {
    const v = B45.indexOf(ch);
    if (v < 0) throw new Error('Invalid base45');
    return v;
  });
  const out: number[] = [];
  for (let i = 0; i < vals.length; i += 3) {
    const chunk = vals.slice(i, i + 3);
    if (chunk.length === 3) {
      const n = chunk[0]! + chunk[1]! * 45 + chunk[2]! * 2025;
      if (n > 0xffff) throw new Error('Invalid base45');
      out.push(n >> 8, n & 0xff);
    } else if (chunk.length === 2) {
      const n = chunk[0]! + chunk[1]! * 45;
      if (n > 0xff) throw new Error('Invalid base45');
      out.push(n);
    } else throw new Error('Invalid base45');
  }
  return Uint8Array.from(out);
}
