import type { ModeManager, KothState, SerializedModeState } from './types.ts';
import type { Player } from '../player.ts';
import type { BitsManager } from '../bits.ts';
import { WORLD_W, WORLD_H, vec2Dist } from '../types.ts';

const KOTH_SCORE_TO_WIN = 100;
const KOTH_MATCH_DURATION = 180; // 3 minutes
const HILL_RADIUS = 150;

export class KothMode implements ModeManager {
  state: KothState;

  constructor(players: Map<string, Player>) {
    const teams = new Map<string, 'red' | 'blue'>();
    let i = 0;
    for (const id of players.keys()) {
      teams.set(id, i % 2 === 0 ? 'red' : 'blue');
      i++;
    }

    this.state = {
      mode: 'koth',
      timer: 0,
      finished: false,
      winnerId: null,
      winnerTeam: null,
      hillCenter: { x: WORLD_W / 2, y: WORLD_H / 2 },
      hillRadius: HILL_RADIUS,
      teamScores: { red: 0, blue: 0 },
      playerTeams: teams,
      contested: false,
      controllingTeam: null,
    };
  }

  assignTeam(playerId: string): void {
    if (this.state.playerTeams.has(playerId)) return;
    // Count current teams and assign to smaller
    let red = 0, blue = 0;
    for (const team of this.state.playerTeams.values()) {
      if (team === 'red') red++;
      else blue++;
    }
    this.state.playerTeams.set(playerId, red <= blue ? 'red' : 'blue');
  }

  removeTeam(playerId: string): void {
    this.state.playerTeams.delete(playerId);
  }

  update(dt: number, players: Map<string, Player>, _bitsManager: BitsManager): void {
    if (this.state.finished) return;

    this.state.timer += dt;

    // Check who's in the hill
    let redInHill = 0;
    let blueInHill = 0;

    for (const player of players.values()) {
      if (!player.alive) continue;
      this.assignTeam(player.id);
      const team = this.state.playerTeams.get(player.id);
      if (!team) continue;

      const dist = vec2Dist(player.position, this.state.hillCenter);
      if (dist <= this.state.hillRadius) {
        if (team === 'red') redInHill++;
        else blueInHill++;
      }
    }

    // Determine control
    if (redInHill > 0 && blueInHill > 0) {
      this.state.contested = true;
      this.state.controllingTeam = null;
    } else if (redInHill > 0) {
      this.state.contested = false;
      this.state.controllingTeam = 'red';
      this.state.teamScores.red += dt * redInHill;
    } else if (blueInHill > 0) {
      this.state.contested = false;
      this.state.controllingTeam = 'blue';
      this.state.teamScores.blue += dt * blueInHill;
    } else {
      this.state.contested = false;
      this.state.controllingTeam = null;
    }

    // Check win
    if (this.state.teamScores.red >= KOTH_SCORE_TO_WIN) {
      this.state.finished = true;
      this.state.winnerTeam = 'red';
    } else if (this.state.teamScores.blue >= KOTH_SCORE_TO_WIN) {
      this.state.finished = true;
      this.state.winnerTeam = 'blue';
    } else if (this.state.timer >= KOTH_MATCH_DURATION) {
      this.state.finished = true;
      this.state.winnerTeam = this.state.teamScores.red >= this.state.teamScores.blue ? 'red' : 'blue';
    }
  }

  onPlayerKilled(_playerId: string, _players: Map<string, Player>): void {
    // Normal respawn in KotH
  }

  onPlayerHit(_playerId: string): void {
    // No special behavior
  }

  canAttack(_playerId: string): boolean {
    // No friendly fire
    return true; // Combat system will check teams
  }

  getSpeedCap(_playerId: string): number | null {
    return null;
  }

  shouldRespawn(_playerId: string): boolean {
    return true;
  }

  getTeam(playerId: string): 'red' | 'blue' | undefined {
    return this.state.playerTeams.get(playerId);
  }

  isFriendlyFire(attackerId: string, victimId: string): boolean {
    const aTeam = this.state.playerTeams.get(attackerId);
    const vTeam = this.state.playerTeams.get(victimId);
    return aTeam !== undefined && aTeam === vTeam;
  }

  serialize(): SerializedModeState {
    const playerTeams: Record<string, 'red' | 'blue'> = {};
    for (const [id, team] of this.state.playerTeams) {
      playerTeams[id] = team;
    }
    return {
      mode: 'koth',
      timer: this.state.timer,
      finished: this.state.finished,
      winnerId: null,
      winnerTeam: this.state.winnerTeam,
      hillCenterX: this.state.hillCenter.x,
      hillCenterY: this.state.hillCenter.y,
      hillRadius: this.state.hillRadius,
      teamScoresRed: Math.round(this.state.teamScores.red * 10) / 10,
      teamScoresBlue: Math.round(this.state.teamScores.blue * 10) / 10,
      playerTeams,
      contested: this.state.contested,
      controllingTeam: this.state.controllingTeam,
    };
  }
}
