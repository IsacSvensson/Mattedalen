import { createClockPack } from '../../content/clock';
import type { AppContext } from '../../shell/app';
import type { GameDeps } from '../../shell/play';

/** Klocktornet's content: reading the clock (docs/PLAN-KLOCKAN.md). */
export const pack = createClockPack();

/** Storage and pack for the engine, with this place's share of the daily session. Waiting for Stigen comes in KL4. */
export const towerDeps = (ctx: AppContext): GameDeps => ({ store: ctx.store, pack, share: 1 / Math.max(1, ctx.places.length) });
