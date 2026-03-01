import { Player } from './player.ts';
import { BitsManager } from './bits.ts';
import { processCombat } from './combat.ts';

export class GameWorld {
  players: Map<string, Player> = new Map();
  bitsManager: BitsManager = new BitsManager();

  constructor() {
    this.bitsManager.spawnArenaBits();
  }

  update(dt: number): void {
    // Update all players
    for (const player of this.players.values()) {
      player.update(dt);
    }

    // Update bits
    this.bitsManager.update(dt);

    // Collect bits for all players (single pass)
    const alivePlayers = [...this.players.values()].filter((p) => p.alive);
    this.bitsManager.collectBitsForAll(alivePlayers);

    // Process combat
    processCombat(alivePlayers, this.bitsManager);
  }

  addPlayer(id: string): Player {
    const player = new Player(id);
    this.players.set(id, player);
    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  getLeaderboard(): { id: string; score: number }[] {
    return [...this.players.values()]
      .filter((p) => p.alive)
      .map((p) => ({ id: p.id, score: p.bitCount }))
      .sort((a, b) => b.score - a.score);
  }
}
