import { Player } from './player.ts';
import { BitsManager } from './bits.ts';
import { processCombat } from './combat.ts';
import type { GameMode } from './types.ts';
import { createModeManager } from './modes/index.ts';
import type { ModeManager, SerializedModeState } from './modes/types.ts';
import type { KothMode } from './modes/koth.ts';

export class GameWorld {
  players: Map<string, Player> = new Map();
  bitsManager: BitsManager = new BitsManager();
  modeManager: ModeManager;
  gameMode: GameMode;

  constructor(mode: GameMode = 'freeplay') {
    this.gameMode = mode;
    this.modeManager = createModeManager(mode, this.players);
    this.bitsManager.spawnArenaBits();
  }

  update(dt: number): void {
    // Update all players
    for (const player of this.players.values()) {
      // Apply mode speed cap
      const cap = this.modeManager.getSpeedCap(player.id);
      player.modeSpeedCap = cap;

      // Set respawn permission based on mode
      player.canRespawn = this.modeManager.shouldRespawn(player.id);

      player.update(dt);
    }

    // Update bits
    this.bitsManager.update(dt);

    // Collect bits for all players
    const alivePlayers = [...this.players.values()].filter((p) => p.alive);
    this.bitsManager.collectBitsForAll(alivePlayers);

    // Process combat (mode-aware)
    processCombat(alivePlayers, this.bitsManager, this.modeManager);

    // Update mode
    this.modeManager.update(dt, this.players, this.bitsManager);
  }

  addPlayer(id: string): Player {
    const player = new Player(id);
    this.players.set(id, player);

    // Assign team in KotH
    if (this.gameMode === 'koth') {
      (this.modeManager as KothMode).assignTeam(id);
    }

    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);

    // Clean up team assignment in KotH
    if (this.gameMode === 'koth') {
      (this.modeManager as KothMode).removeTeam(id);
    }
  }

  getLeaderboard(): { id: string; score: number }[] {
    if (this.gameMode === 'skull') {
      // Score is skull hold time
      const modeState = this.modeManager.serialize();
      const scores = modeState.scores ?? {};
      return [...this.players.values()]
        .map((p) => ({ id: p.id, score: Math.floor(scores[p.id] ?? 0) }))
        .sort((a, b) => b.score - a.score);
    }

    return [...this.players.values()]
      .filter((p) => p.alive)
      .map((p) => ({ id: p.id, score: p.bitCount }))
      .sort((a, b) => b.score - a.score);
  }

  serializeModeState(): SerializedModeState {
    return this.modeManager.serialize();
  }
}
