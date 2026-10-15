import { createMultiplicationPack } from '../../content/multiplication';
import type { AppContext } from '../../shell/app';
import type { GameDeps } from '../../shell/play';

/** Trädgården's content: the multiplication table 1–10, and delat med growing on it. */
export const pack = createMultiplicationPack({ division: true });

/** Storage and pack for the engine, for one session or screen in the garden. */
export const gardenDeps = (ctx: AppContext): GameDeps => ({ store: ctx.store, pack, share: 1 / ctx.places.length });
