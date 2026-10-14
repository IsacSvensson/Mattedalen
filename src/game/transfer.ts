import qrcode from 'qrcode-generator';
import { computeUnlocked, type ContentPack, type Engine, type ItemState, type LearnerMeta } from '../engine';
import { DEFAULT_SETTINGS, levelOf, stateFromLevel, type Profile, type QrSnapshot } from '../storage';

/** Snapshot of a profile for the QR code (levels follow the pack's item order). */
export function snapshotOf(profile: Profile, pack: ContentPack, states: Record<string, ItemState>): QrSnapshot {
  return {
    name: profile.name,
    avatar: profile.avatar,
    sessionMinutes: profile.settings.sessionMinutes,
    levels: pack.items.map((it) => levelOf(states[it.id])),
  };
}

/** Rebuilds item states and learner meta from a scanned snapshot. */
export function progressFromSnapshot(snap: QrSnapshot, engine: Engine, today: string): { states: Record<string, ItemState>; meta: LearnerMeta } {
  const { pack, config } = engine;
  if (snap.levels.length !== pack.items.length) throw new Error('QR-koden passar inte den här versionen av spelet.');
  const states = Object.fromEntries(
    pack.items.map((it, i) => [it.id, stateFromLevel(it.id, snap.levels[i] ?? 0, today, config.leitner.intervalsDays)]),
  );
  const meta = { ...engine.initialMeta(), unlockedUnitIds: computeUnlocked(pack.units, states, []) };
  // A unit that has started keeps the units before it open as well.
  const started = pack.units.filter((u) => u.itemIds.some((id) => states[id]?.status !== 'new'));
  const lastStarted = Math.max(-1, ...started.map((u) => u.order));
  meta.unlockedUnitIds = pack.units.filter((u) => u.order <= lastStarted || meta.unlockedUnitIds.includes(u.id)).map((u) => u.id);
  return { states, meta };
}

export function profileFromSnapshot(snap: QrSnapshot, id: string, now: number): Profile {
  const minutes = Math.min(15, Math.max(10, snap.sessionMinutes || DEFAULT_SETTINGS.sessionMinutes));
  return { id, name: snap.name || 'Spelare', avatar: snap.avatar || '🌱', createdAt: now, settings: { ...DEFAULT_SETTINGS, sessionMinutes: minutes } };
}

/** QR code as a scalable SVG string (alphanumeric mode keeps it small). */
export function qrSvgMarkup(text: string): { svg: string; version: number } {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Alphanumeric');
  qr.make();
  const version = (qr.getModuleCount() - 17) / 4;
  return { svg: qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true }), version };
}
