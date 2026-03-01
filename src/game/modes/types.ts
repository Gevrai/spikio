import type { Vec2, GameMode } from '../types.ts';
import type { Player } from '../player.ts';
import type { BitsManager } from '../bits.ts';

export interface GameModeState {
  mode: GameMode;
  timer: number;
  finished: boolean;
  winnerId: string | null;
  winnerTeam: 'red' | 'blue' | null;
}

export interface LastStandingState extends GameModeState {
  mode: 'last-standing';
  zoneRadius: number;
  zoneCenter: Vec2;
  zoneDamage: number;
  phase: number;
  phaseTimer: number;
  eliminated: Set<string>;
  warning: boolean;
}

export interface SkullState extends GameModeState {
  mode: 'skull';
  skullPosition: Vec2;
  skullCarrierId: string | null;
  scores: Map<string, number>;
  pickupCooldown: number;
}

export interface KothState extends GameModeState {
  mode: 'koth';
  hillCenter: Vec2;
  hillRadius: number;
  teamScores: { red: number; blue: number };
  playerTeams: Map<string, 'red' | 'blue'>;
  contested: boolean;
  controllingTeam: 'red' | 'blue' | null;
}

export type ModeState = GameModeState | LastStandingState | SkullState | KothState;

export interface SerializedModeState {
  mode: GameMode;
  timer: number;
  finished: boolean;
  winnerId: string | null;
  winnerTeam: 'red' | 'blue' | null;
  // Last Standing
  zoneRadius?: number;
  zoneCenterX?: number;
  zoneCenterY?: number;
  zoneDamage?: number;
  phase?: number;
  warning?: boolean;
  eliminated?: string[];
  // Skull
  skullX?: number;
  skullY?: number;
  skullCarrierId?: string | null;
  scores?: Record<string, number>;
  // KotH
  hillCenterX?: number;
  hillCenterY?: number;
  hillRadius?: number;
  teamScoresRed?: number;
  teamScoresBlue?: number;
  playerTeams?: Record<string, 'red' | 'blue'>;
  contested?: boolean;
  controllingTeam?: 'red' | 'blue' | null;
}

export interface ModeManager {
  state: ModeState;
  update(dt: number, players: Map<string, Player>, bitsManager: BitsManager): void;
  onPlayerKilled(playerId: string, players: Map<string, Player>): void;
  onPlayerHit(playerId: string): void;
  canAttack(playerId: string): boolean;
  getSpeedCap(playerId: string): number | null;
  shouldRespawn(playerId: string): boolean;
  serialize(): SerializedModeState;
}
