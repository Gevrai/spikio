import type { Vec2 } from './types.ts';
import {
  WORLD_W, WORLD_H, ARENA_BIT_COUNT, SCATTER_LIFETIME,
  FRICTION, PLAYER_COLORS,
} from './types.ts';
import type { Player } from './player.ts';

let nextBitId = 0;

export class Bit {
  id: number;
  position: Vec2;
  velocity: Vec2;
  value: number;
  color: string;
  age = 0;
  scattered: boolean;
  lifetime: number;

  constructor(position: Vec2, value: number, scattered: boolean, velocity?: Vec2) {
    this.id = nextBitId++;
    this.position = { ...position };
    this.velocity = velocity ? { ...velocity } : { x: 0, y: 0 };
    this.value = value;
    this.scattered = scattered;
    this.lifetime = scattered ? SCATTER_LIFETIME : Infinity;
    this.color = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
  }
}

export class BitsManager {
  bits: Bit[] = [];

  spawnArenaBits(): void {
    while (this.arenaBitCount < ARENA_BIT_COUNT) {
      const pos: Vec2 = {
        x: 20 + Math.random() * (WORLD_W - 40),
        y: 20 + Math.random() * (WORLD_H - 40),
      };
      this.bits.push(new Bit(pos, 1, false));
    }
  }

  private get arenaBitCount(): number {
    let count = 0;
    for (const b of this.bits) {
      if (!b.scattered) count++;
    }
    return count;
  }

  scatterBits(position: Vec2, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200;
      const vel: Vec2 = {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
      };
      const offset: Vec2 = {
        x: position.x + Math.cos(angle) * 5,
        y: position.y + Math.sin(angle) * 5,
      };
      this.bits.push(new Bit(offset, 1, true, vel));
    }
  }

  collectBitsForAll(players: Player[]): void {
    let writeIdx = 0;
    for (let i = 0; i < this.bits.length; i++) {
      const bit = this.bits[i];
      let eaten = false;
      for (const player of players) {
        if (!player.alive) continue;
        const dx = player.position.x - bit.position.x;
        const dy = player.position.y - bit.position.y;
        const r = player.radius + 6;
        if (dx * dx + dy * dy < r * r) {
          player.bitCount += bit.value;
          eaten = true;
          break;
        }
      }
      if (!eaten) {
        this.bits[writeIdx++] = bit;
      }
    }
    this.bits.length = writeIdx;
  }

  update(dt: number): void {
    this.bits = this.bits.filter((bit) => {
      bit.age += dt;

      if (bit.scattered) {
        bit.velocity.x *= FRICTION;
        bit.velocity.y *= FRICTION;
        bit.position.x += bit.velocity.x * dt;
        bit.position.y += bit.velocity.y * dt;

        // Clamp to world
        bit.position.x = Math.max(5, Math.min(WORLD_W - 5, bit.position.x));
        bit.position.y = Math.max(5, Math.min(WORLD_H - 5, bit.position.y));

        if (bit.age > bit.lifetime) return false;
      }
      return true;
    });

    this.spawnArenaBits();
  }
}
