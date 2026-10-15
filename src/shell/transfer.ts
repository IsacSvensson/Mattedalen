import qrcode from 'qrcode-generator';
import { computeUnlocked, sortedUnits, type ContentPack, type Engine, type ItemState, type LearnerMeta, type Unit } from '../engine';
import { DEFAULT_SETTINGS, levelOf, stateFromLevel, type Profile, type QrSnapshot, type QrTransfer } from '../storage';

/** Snapshot of a profile for the QR code (levels follow the pack's item order). */
export function snapshotOf(profile: Profile, pack: ContentPack, states: Record<string, ItemState>): QrSnapshot {
  return {
    name: profile.name,
    avatar: profile.avatar,
    sessionMinutes: profile.settings.sessionMinutes,
    levels: pack.items.map((it) => levelOf(states[it.id])),
  };
}

/** A child with every place for the QR code: one block of levels per pack. */
export function transferOf(profile: Profile, packs: { pack: ContentPack; states: Record<string, ItemState> }[]): QrTransfer {
  return {
    name: profile.name,
    avatar: profile.avatar,
    sessionMinutes: profile.settings.sessionMinutes,
    gardenOpen: profile.settings.gardenOpen === true,
    packs: packs.map(({ pack, states }) => ({ packId: pack.id, packVersion: pack.version, levels: pack.items.map((it) => levelOf(states[it.id])) })),
  };
}

/** Rebuilds item states and learner meta from a scanned snapshot. */
export function progressFromSnapshot(snap: Pick<QrSnapshot, 'levels'>, engine: Engine, today: string): { states: Record<string, ItemState>; meta: LearnerMeta } {
  const { pack, config } = engine;
  if (snap.levels.length !== pack.items.length) throw new Error('QR-koden passar inte den här versionen av spelet.');
  const states = Object.fromEntries(
    pack.items.map((it, i) => [it.id, stateFromLevel(it.id, snap.levels[i] ?? 0, today, config.leitner.intervalsDays)]),
  );
  // A unit that has started stays open, and so do the units it builds on (its
  // prerequisites, and theirs), but not every unit that merely comes earlier:
  // in a knowledge graph an earlier unit may still be waiting for its own.
  const sorted = sortedUnits(pack.units);
  const byId = new Map(pack.units.map((u) => [u.id, u]));
  const reached = new Set<string>();
  const keep = (unit: Unit | undefined): void => {
    if (!unit || reached.has(unit.id)) return;
    reached.add(unit.id);
    const rule = unit.unlockRule;
    if (rule.kind === 'previous') keep(sorted[sorted.indexOf(unit) - 1]);
    else if (rule.kind === 'after') rule.requires.forEach((id) => keep(byId.get(id)));
  };
  for (const unit of pack.units) if (unit.itemIds.some((id) => states[id]?.status !== 'new')) keep(unit);
  const meta = { ...engine.initialMeta(), unlockedUnitIds: computeUnlocked(pack.units, states, [...reached]) };
  return { states, meta };
}

export function profileFromSnapshot(snap: Pick<QrSnapshot, 'name' | 'avatar' | 'sessionMinutes'> & { gardenOpen?: boolean }, id: string, now: number): Profile {
  const minutes = Math.min(15, Math.max(10, snap.sessionMinutes || DEFAULT_SETTINGS.sessionMinutes));
  return {
    id,
    name: snap.name || 'Spelare',
    avatar: snap.avatar || '🌱',
    createdAt: now,
    settings: { ...DEFAULT_SETTINGS, sessionMinutes: minutes, ...(snap.gardenOpen ? { gardenOpen: true } : {}) },
  };
}

/** QR code as a scalable SVG string (alphanumeric mode keeps it small). */
export function qrSvgMarkup(text: string): { svg: string; version: number } {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Alphanumeric');
  qr.make();
  const version = (qr.getModuleCount() - 17) / 4;
  return { svg: qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true }), version };
}
