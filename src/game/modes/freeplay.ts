import type { ModeManager, GameModeState } from './types.ts';
import type { Player } from '../player.ts';
import type { BitsManager } from '../bits.ts';

export class FreePlayMode implements ModeManager {
  state: GameModeState = {
    mode: 'freeplay',
    timer: 0,
    finished: false,
    winnerId: null,
    winnerTeam: null,
  };

  update(_dt: number, _players: Map<string, Player>, _bitsManager: BitsManager): void {
    // No special logic for free play
  }

  onPlayerKilled(_playerId: string, _players: Map<string, Player>): void {
    // Normal respawn in free play
  }

  onPlayerHit(_playerId: string): void {
    // No special behavior
  }

  canAttack(_playerId: string): boolean {
    return true;
  }

  getSpeedCap(_playerId: string): number | null {
    return null;
  }

  shouldRespawn(_playerId: string): boolean {
    return true;
  }

  serialize() {
    return { ...this.state };
  }
}
