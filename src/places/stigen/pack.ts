import { createHundredPack } from '../../content/hundred';
import type { AppContext } from '../../shell/app';
import type { GameDeps } from '../../shell/play';

/** Stigen's content: the numbers to 100. */
export const pack = createHundredPack();

/** Storage and pack for the engine, with this place's share of the daily session. */
export const pathDeps = (ctx: AppContext): GameDeps => ({ store: ctx.store, pack, share: 1 / ctx.places.length });
