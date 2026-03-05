import type { Vec2 } from './types.ts';
import {
  WORLD_W, WORLD_H, ARENA_BIT_COUNT, SCATTER_LIFETIME,
  FRICTION, PLAYER_COLORS,
} from './types.ts';
import type { Player } from './player.ts';

export const MAX_SCATTERED_BITS = 600;
const GRID_CELL = 64;

let nextBitId = 0;

export function getNextBitId(): number { return nextBitId; }

// Simple seeded LCG PRNG
export function lcgRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0x100000000;
  };
}

export class Bit {
  id: number;
  position: Vec2;
  velocity: Vec2;
  value: number;
  color: string;
  age: number;
  scattered: boolean;
  lifetime: number;

  constructor(position: Vec2, value: number, scattered: boolean, velocity?: Vec2) {
    this.id = nextBitId++;
    this.position = { ...position };
    this.velocity = velocity ? { ...velocity } : { x: 0, y: 0 };
    this.value = value;
    this.age = 0;
    this.scattered = scattered;
    this.lifetime = scattered ? SCATTER_LIFETIME : Infinity;
    this.color = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
  }

  /** Re-initialize a pooled Bit for reuse */
  reset(position: Vec2, value: number, scattered: boolean, velocity?: Vec2, rng?: () => number): void {
    this.id = nextBitId++;
    this.position.x = position.x;
    this.position.y = position.y;
    this.velocity.x = velocity ? velocity.x : 0;
    this.velocity.y = velocity ? velocity.y : 0;
    this.value = value;
    this.age = 0;
    this.scattered = scattered;
    this.lifetime = scattered ? SCATTER_LIFETIME : Infinity;
    const r = rng ? rng() : Math.random();
    this.color = PLAYER_COLORS[Math.floor(r * PLAYER_COLORS.length)];
  }
}

export class BitsManager {
  bits: Bit[] = [];
  private _pool: Bit[] = [];
  private _grid = new Map<number, number[]>();

  private _allocBit(position: Vec2, value: number, scattered: boolean, velocity?: Vec2, rng?: () => number): Bit {
    const pooled = this._pool.pop();
    if (pooled) {
      pooled.reset(position, value, scattered, velocity, rng);
      return pooled;
    }
    return new Bit(position, value, scattered, velocity);
  }

  private _recycleBit(_bit: Bit): void {
    this._pool.push(_bit);
  }

  spawnArenaBits(): void {
    while (this.arenaBitCount < ARENA_BIT_COUNT) {
      const pos: Vec2 = {
        x: 20 + Math.random() * (WORLD_W - 40),
        y: 20 + Math.random() * (WORLD_H - 40),
      };
      this.bits.push(this._allocBit(pos, 1, false));
    }
  }

  private get arenaBitCount(): number {
    let count = 0;
    for (const b of this.bits) {
      if (!b.scattered) count++;
    }
    return count;
  }

  get scatteredBitCount(): number {
    let count = 0;
    for (const b of this.bits) {
      if (b.scattered) count++;
    }
    return count;
  }

  scatterBits(position: Vec2, count: number, seed?: number): number {
    // Cap: clamp spawn count so total scattered ≤ MAX_SCATTERED_BITS
    const currentScattered = this.scatteredBitCount;
    const allowed = Math.max(0, MAX_SCATTERED_BITS - currentScattered);
    const actualCount = Math.min(count, allowed);

    const rng = seed != null ? lcgRandom(seed) : undefined;
    const rand = rng ?? Math.random;

    for (let i = 0; i < actualCount; i++) {
      const angle = rand() * Math.PI * 2;
      const speed = 80 + rand() * 200;
      const colorIdx = Math.floor(rand() * PLAYER_COLORS.length);
      const vel: Vec2 = {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
      };
      const offset: Vec2 = {
        x: position.x + Math.cos(angle) * 5,
        y: position.y + Math.sin(angle) * 5,
      };
      const bit = this._allocBit(offset, 1, true, vel);
      bit.color = PLAYER_COLORS[colorIdx];
      this.bits.push(bit);
    }
    return actualCount;
  }

  collectBitsForAll(players: Player[]): void {
    // Rebuild spatial grid
    const grid = this._grid;
    grid.clear();
    for (let i = 0; i < this.bits.length; i++) {
      const b = this.bits[i];
      const cx = (b.position.x / GRID_CELL) | 0;
      const cy = (b.position.y / GRID_CELL) | 0;
      const key = cx * 10000 + cy;
      let bucket = grid.get(key);
      if (!bucket) { bucket = []; grid.set(key, bucket); }
      bucket.push(i);
    }

    // Mark collected bits
    const eaten = new Uint8Array(this.bits.length);

    for (const player of players) {
      if (!player.alive || player.isInvulnerable) continue;
      const r = player.radius + 6;
      const rSq = r * r;
      const px = player.position.x;
      const py = player.position.y;
      const minCx = ((px - r) / GRID_CELL) | 0;
      const maxCx = ((px + r) / GRID_CELL) | 0;
      const minCy = ((py - r) / GRID_CELL) | 0;
      const maxCy = ((py + r) / GRID_CELL) | 0;

      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cy = minCy; cy <= maxCy; cy++) {
          const key = cx * 10000 + cy;
          const bucket = grid.get(key);
          if (!bucket) continue;
          for (const idx of bucket) {
            if (eaten[idx]) continue;
            const bit = this.bits[idx];
            const dx = px - bit.position.x;
            const dy = py - bit.position.y;
            if (dx * dx + dy * dy < rSq) {
              player.bitCount += bit.value;
              eaten[idx] = 1;
            }
          }
        }
      }
    }

    // Compact: in-place removal with recycling
    let writeIdx = 0;
    for (let i = 0; i < this.bits.length; i++) {
      if (eaten[i]) {
        this._recycleBit(this.bits[i]);
      } else {
        this.bits[writeIdx++] = this.bits[i];
      }
    }
    this.bits.length = writeIdx;
  }

  update(dt: number): void {
    // In-place removal (no filter allocation)
    let writeIdx = 0;
    for (let i = 0; i < this.bits.length; i++) {
      const bit = this.bits[i];
      bit.age += dt;

      if (bit.scattered) {
        const frictionDecay = Math.pow(FRICTION, dt * 60);
        bit.velocity.x *= frictionDecay;
        bit.velocity.y *= frictionDecay;
        bit.position.x += bit.velocity.x * dt;
        bit.position.y += bit.velocity.y * dt;

        // Clamp to world
        bit.position.x = Math.max(5, Math.min(WORLD_W - 5, bit.position.x));
        bit.position.y = Math.max(5, Math.min(WORLD_H - 5, bit.position.y));

        if (bit.age > bit.lifetime) {
          this._recycleBit(bit);
          continue;
        }
      }
      this.bits[writeIdx++] = bit;
    }
    this.bits.length = writeIdx;

    this.spawnArenaBits();
  }
}
