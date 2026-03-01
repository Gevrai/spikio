import type { ModeManager, SkullState, SerializedModeState } from './types.ts';
import type { Player } from '../player.ts';
import type { BitsManager } from '../bits.ts';
import { WORLD_W, WORLD_H, vec2Dist } from '../types.ts';

const SKULL_SCORE_TO_WIN = 60;
const SKULL_MATCH_DURATION = 120; // 2 minutes
const SKULL_PICKUP_COOLDOWN = 1.0; // seconds after drop before re-pickup
const SKULL_CARRIER_SPEED_CAP = 1.5;
const SKULL_IDLE_TELEPORT = 10; // teleport to center if uncollected

export class SkullMode implements ModeManager {
  state: SkullState;
  private idleTimer = 0;

  constructor() {
    this.state = {
      mode: 'skull',
      timer: 0,
      finished: false,
      winnerId: null,
      winnerTeam: null,
      skullPosition: { x: WORLD_W / 2, y: WORLD_H / 2 },
      skullCarrierId: null,
      scores: new Map(),
      pickupCooldown: 3, // 3 second delay at start
    };
  }

  update(dt: number, players: Map<string, Player>, _bitsManager: BitsManager): void {
    if (this.state.finished) return;

    this.state.timer += dt;

    // Pickup cooldown
    if (this.state.pickupCooldown > 0) {
      this.state.pickupCooldown -= dt;
    }

    // Score for carrier
    if (this.state.skullCarrierId) {
      const carrier = players.get(this.state.skullCarrierId);
      if (carrier && carrier.alive) {
        const prev = this.state.scores.get(this.state.skullCarrierId) ?? 0;
        this.state.scores.set(this.state.skullCarrierId, prev + dt);

        // Update skull position to follow carrier
        this.state.skullPosition = { ...carrier.position };

        // Check win by score
        if (prev + dt >= SKULL_SCORE_TO_WIN) {
          this.state.finished = true;
          this.state.winnerId = this.state.skullCarrierId;
          return;
        }
      } else {
        // Carrier died, drop skull
        this.dropSkull();
      }
      this.idleTimer = 0;
    } else {
      // Skull is on the ground, check pickups
      this.idleTimer += dt;

      if (this.state.pickupCooldown <= 0) {
        for (const player of players.values()) {
          if (!player.alive) continue;
          const dist = vec2Dist(player.position, this.state.skullPosition);
          if (dist < player.radius + 15) {
            this.state.skullCarrierId = player.id;
            this.idleTimer = 0;
            break;
          }
        }
      }

      // Teleport to center if uncollected for too long
      if (this.idleTimer >= SKULL_IDLE_TELEPORT) {
        this.state.skullPosition = { x: WORLD_W / 2, y: WORLD_H / 2 };
        this.idleTimer = 0;
      }
    }

    // Check timer
    if (this.state.timer >= SKULL_MATCH_DURATION) {
      this.state.finished = true;
      // Highest score wins
      let bestId: string | null = null;
      let bestScore = -1;
      for (const [id, score] of this.state.scores) {
        if (score > bestScore) {
          bestScore = score;
          bestId = id;
        }
      }
      this.state.winnerId = bestId;
    }
  }

  private dropSkull(): void {
    this.state.skullCarrierId = null;
    this.state.pickupCooldown = SKULL_PICKUP_COOLDOWN;
  }

  onPlayerKilled(playerId: string, _players: Map<string, Player>): void {
    if (this.state.skullCarrierId === playerId) {
      this.dropSkull();
    }
  }

  onPlayerHit(playerId: string): void {
    // Any hit on the skull carrier drops the skull
    if (this.state.skullCarrierId === playerId) {
      this.dropSkull();
    }
  }

  canAttack(playerId: string): boolean {
    return this.state.skullCarrierId !== playerId;
  }

  getSpeedCap(playerId: string): number | null {
    if (this.state.skullCarrierId === playerId) {
      return SKULL_CARRIER_SPEED_CAP;
    }
    return null;
  }

  shouldRespawn(_playerId: string): boolean {
    return true;
  }

  serialize(): SerializedModeState {
    const scores: Record<string, number> = {};
    for (const [id, s] of this.state.scores) {
      scores[id] = Math.round(s * 10) / 10;
    }
    return {
      mode: 'skull',
      timer: this.state.timer,
      finished: this.state.finished,
      winnerId: this.state.winnerId,
      winnerTeam: null,
      skullX: this.state.skullPosition.x,
      skullY: this.state.skullPosition.y,
      skullCarrierId: this.state.skullCarrierId,
      scores,
    };
  }
}
