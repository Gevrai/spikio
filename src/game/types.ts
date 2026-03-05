export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerState {
  id: string;
  position: Vec2;
  velocity: Vec2;
  rotation: number;
  bitCount: number;
  radius: number;
  alive: boolean;
  color: string;
  invulnerableTimer: number;
  respawnTimer: number;
}

export interface BitState {
  id: number;
  position: Vec2;
  velocity: Vec2;
  value: number;
  color: string;
  age: number;
  scattered: boolean;
  lifetime: number;
}

export interface AimState {
  aiming: boolean;
  direction: Vec2;
  power: number;
}

export interface GameState {
  players: PlayerState[];
  bits: BitState[];
}

export const WORLD_W = 2000;
export const WORLD_H = 2000;
export const BASE_RADIUS = 15;
export const RADIUS_SCALE = 3;
export const FRICTION = 0.98;
export const MAX_SPEED = 600;
export const INVULN_DURATION = 1.0;
export const RESPAWN_DELAY = 3.0;
export const START_BITS = 5;
export const ARENA_BIT_COUNT = 200;
export const SCATTER_LIFETIME = 6;
export const SPIKE_LENGTH_FACTOR = 0.4;
export const SPEED_BITS_CAP = 100;
export const SPEED_MAX_MULT = 3.0;

export type GameMode = 'freeplay' | 'last-standing' | 'skull' | 'koth';

export function speedMultiplier(bitCount: number): number {
  return 1.0 + (SPEED_MAX_MULT - 1.0) * Math.min(bitCount / SPEED_BITS_CAP, 1);
}

export const PLAYER_COLORS: string[] = [
  '#FF4757', // red
  '#1E90FF', // blue
  '#2ED573', // green
  '#FFA502', // orange
  '#A55EEA', // purple
  '#FF6B81', // pink
  '#00D2D3', // cyan
  '#FECA57', // yellow
  '#FF9FF3', // magenta
  '#54A0FF', // sky blue
];

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function vec2Len(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vec2Norm(v: Vec2): Vec2 {
  const len = vec2Len(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function vec2Dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function vec2Sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vec2Scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function vec2Dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function playerRadius(bitCount: number): number {
  return BASE_RADIUS + Math.sqrt(bitCount) * RADIUS_SCALE;
}
