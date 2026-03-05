import type { SerializedModeState } from '../game/modes/types.ts';
import type { GameMode } from '../game/types.ts';

// Client → Host
export type ClientMessage =
  | { type: 'input'; aim: { aiming: boolean; angle: number; power: number } | null; launch: boolean }
  | { type: 'join'; name: string };

// Host → Client
export type ServerMessage =
  | { type: 'state'; players: SerializedPlayer[]; bits: SerializedBit[]; modeState: SerializedModeState }
  | { type: 'welcome'; playerId: string; worldW: number; worldH: number; mode: GameMode; scatteredBits?: SerializedScatteredBit[] }
  | { type: 'player-joined'; id: string; name: string }
  | { type: 'player-left'; id: string }
  | { type: 'scatter'; x: number; y: number; count: number; seed: number; startId: number }
  | { type: 'scatter_remove'; ids: number[] };

export interface SerializedPlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  bitCount: number;
  alive: boolean;
  invulnerable: boolean;
  color: number; // color index
}

export interface SerializedBit {
  id: number;
  x: number;
  y: number;
  color: string;
  scattered: boolean;
}

export interface SerializedScatteredBit {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  color: string;
}
