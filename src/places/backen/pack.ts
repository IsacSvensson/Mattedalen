import { createAdditionPack } from '../../content/addition';
import type { AppContext } from '../../shell/app';
import type { GameDeps } from '../../shell/play';

/** Bäcken's content: addition and subtraction within 20, and the equal sign. */
export const pack = createAdditionPack();

/** Storage and pack for the engine, with this place's share of the daily session. */
export const brookDeps = (ctx: AppContext): GameDeps => ({ store: ctx.store, pack, share: 1 / ctx.places.length });
