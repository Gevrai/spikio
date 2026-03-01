export type { ModeManager, ModeState, SerializedModeState } from './types.ts';
export { FreePlayMode } from './freeplay.ts';
export { LastStandingMode } from './last-standing.ts';
export { SkullMode } from './skull.ts';
export { KothMode } from './koth.ts';

import type { GameMode } from '../types.ts';
import type { ModeManager } from './types.ts';
import type { Player } from '../player.ts';
import { FreePlayMode } from './freeplay.ts';
import { LastStandingMode } from './last-standing.ts';
import { SkullMode } from './skull.ts';
import { KothMode } from './koth.ts';

export function createModeManager(mode: GameMode, players: Map<string, Player>): ModeManager {
  switch (mode) {
    case 'freeplay': return new FreePlayMode();
    case 'last-standing': return new LastStandingMode();
    case 'skull': return new SkullMode();
    case 'koth': return new KothMode(players);
  }
}
