import type { Vec2 } from './types.ts';
import {
  WORLD_W, WORLD_H,
  FRICTION, MAX_SPEED, INVULN_DURATION, START_BITS,
  PLAYER_COLORS, playerRadius, vec2Len, speedMultiplier,
} from './types.ts';

let nextColor = 0;

export class Player {
  id: string;
  position: Vec2;
  velocity: Vec2 = { x: 0, y: 0 };
  rotation = 0;
  bitCount: number;
  radius: number;
  alive = true;
  invulnerableTimer = 0;
  respawnTimer = 0;
  color: string;
  modeSpeedCap: number | null = null;
  canRespawn = true;

  constructor(id: string, position?: Vec2) {
    this.id = id;
    this.position = position ?? {
      x: 100 + Math.random() * (WORLD_W - 200),
      y: 100 + Math.random() * (WORLD_H - 200),
    };
    this.bitCount = START_BITS;
    this.radius = playerRadius(this.bitCount);
    this.color = PLAYER_COLORS[nextColor % PLAYER_COLORS.length];
    nextColor++;
  }

  update(dt: number): void {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0 && this.canRespawn) {
        this.respawn();
      }
      return;
    }

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer < 0) this.invulnerableTimer = 0;
    }

    // Apply friction
    this.velocity.x *= FRICTION;
    this.velocity.y *= FRICTION;

    // Clamp speed (scaled by bit count)
    const speed = vec2Len(this.velocity);
    let spdMult = this.speedMultiplier;
    if (this.modeSpeedCap !== null) {
      spdMult = Math.min(spdMult, this.modeSpeedCap);
    }
    const maxSpd = MAX_SPEED * spdMult;
    if (speed > maxSpd) {
      const ratio = maxSpd / speed;
      this.velocity.x *= ratio;
      this.velocity.y *= ratio;
    }
    // Stop if very slow
    if (speed < 0.5) {
      this.velocity.x = 0;
      this.velocity.y = 0;
    }

    // Move
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Update rotation to face velocity
    if (speed > 1) {
      this.rotation = Math.atan2(this.velocity.y, this.velocity.x);
    }

    // Update radius
    this.radius = playerRadius(this.bitCount);

    // Wall bounce
    this.wallBounce();
  }

  private wallBounce(): void {
    const r = this.radius;
    if (this.position.x - r < 0) {
      this.position.x = r;
      this.velocity.x = Math.abs(this.velocity.x) * 0.8;
    } else if (this.position.x + r > WORLD_W) {
      this.position.x = WORLD_W - r;
      this.velocity.x = -Math.abs(this.velocity.x) * 0.8;
    }
    if (this.position.y - r < 0) {
      this.position.y = r;
      this.velocity.y = Math.abs(this.velocity.y) * 0.8;
    } else if (this.position.y + r > WORLD_H) {
      this.position.y = WORLD_H - r;
      this.velocity.y = -Math.abs(this.velocity.y) * 0.8;
    }
  }

  get speedMultiplier(): number {
    return speedMultiplier(this.bitCount);
  }

  launch(dirX: number, dirY: number, power: number): void {
    if (!this.alive) return;
    const launchSpeed = (200 + power * 400) * this.speedMultiplier;
    this.velocity.x = dirX * launchSpeed;
    this.velocity.y = dirY * launchSpeed;
    this.rotation = Math.atan2(dirY, dirX);
  }

  kill(): void {
    this.alive = false;
    this.respawnTimer = 3;
    this.bitCount = 0;
    this.velocity = { x: 0, y: 0 };
  }

  private respawn(): void {
    this.alive = true;
    this.bitCount = START_BITS;
    this.radius = playerRadius(this.bitCount);
    this.position = {
      x: 100 + Math.random() * (WORLD_W - 200),
      y: 100 + Math.random() * (WORLD_H - 200),
    };
    this.velocity = { x: 0, y: 0 };
    this.invulnerableTimer = INVULN_DURATION;
  }

  get isInvulnerable(): boolean {
    return this.invulnerableTimer > 0;
  }

  get isMoving(): boolean {
    return vec2Len(this.velocity) > 5;
  }

  static _resetColorIndex(): void {
    nextColor = 0;
  }
}
