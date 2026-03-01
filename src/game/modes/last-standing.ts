import type { ModeManager, LastStandingState, SerializedModeState } from './types.ts';
import type { Player } from '../player.ts';
import type { BitsManager } from '../bits.ts';
import { WORLD_W, WORLD_H } from '../types.ts';

const ZONE_PHASES = [
  { duration: 30, radiusPct: 1.0, damage: 0 },
  { duration: 30, radiusPct: 0.8, damage: 2 },
  { duration: 30, radiusPct: 0.6, damage: 3 },
  { duration: 30, radiusPct: 0.4, damage: 5 },
  { duration: 30, radiusPct: 0.2, damage: 8 },
  { duration: 30, radiusPct: 0.1, damage: 15 },
];

const MAX_DURATION = 210; // 3.5 min hard cap

const MAX_ZONE_RADIUS = Math.min(WORLD_W, WORLD_H) / 2;
const WARNING_TIME = 5;

export class LastStandingMode implements ModeManager {
  state: LastStandingState;

  constructor() {
    this.state = {
      mode: 'last-standing',
      timer: 0,
      finished: false,
      winnerId: null,
      winnerTeam: null,
      zoneRadius: MAX_ZONE_RADIUS,
      zoneCenter: { x: WORLD_W / 2, y: WORLD_H / 2 },
      zoneDamage: 0,
      phase: 0,
      phaseTimer: 0,
      eliminated: new Set(),
      warning: false,
    };
  }

  update(dt: number, players: Map<string, Player>, _bitsManager: BitsManager): void {
    if (this.state.finished) return;

    this.state.timer += dt;
    this.state.phaseTimer += dt;

    const phase = ZONE_PHASES[this.state.phase];
    if (!phase) {
      this.state.finished = true;
      return;
    }

    // Warning before next phase
    const timeLeft = phase.duration - this.state.phaseTimer;
    this.state.warning = timeLeft <= WARNING_TIME && this.state.phase < ZONE_PHASES.length - 1;

    // Phase transition
    if (this.state.phaseTimer >= phase.duration && this.state.phase < ZONE_PHASES.length - 1) {
      this.state.phase++;
      this.state.phaseTimer = 0;
      const nextPhase = ZONE_PHASES[this.state.phase];
      this.state.zoneRadius = MAX_ZONE_RADIUS * nextPhase.radiusPct;
      this.state.zoneDamage = nextPhase.damage;
    }

    // Interpolate zone radius within phase for smooth shrinking
    if (this.state.phase < ZONE_PHASES.length - 1) {
      const currentPct = ZONE_PHASES[this.state.phase].radiusPct;
      const nextPct = ZONE_PHASES[this.state.phase + 1].radiusPct;
      const t = this.state.phaseTimer / phase.duration;
      this.state.zoneRadius = MAX_ZONE_RADIUS * (currentPct + (nextPct - currentPct) * t);
    }

    // Apply zone damage
    for (const player of players.values()) {
      if (!player.alive || this.state.eliminated.has(player.id)) continue;

      const dx = player.position.x - this.state.zoneCenter.x;
      const dy = player.position.y - this.state.zoneCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > this.state.zoneRadius) {
        const damage = this.state.zoneDamage * dt;
        player.bitCount = Math.max(0, player.bitCount - damage);
        if (player.bitCount <= 0) {
          player.kill();
          this.state.eliminated.add(player.id);
        }
      }
    }

    // Check win condition
    const alivePlayers = [...players.values()].filter(
      p => p.alive && !this.state.eliminated.has(p.id)
    );

    if (alivePlayers.length <= 1) {
      this.state.finished = true;
      this.state.winnerId = alivePlayers[0]?.id ?? null;
    } else if (this.state.timer >= MAX_DURATION) {
      // Time limit fallback: highest bit count wins
      this.state.finished = true;
      let best: Player | null = null;
      for (const p of alivePlayers) {
        if (!best || p.bitCount > best.bitCount) best = p;
      }
      this.state.winnerId = best?.id ?? null;
    }
  }

  onPlayerKilled(playerId: string, _players: Map<string, Player>): void {
    this.state.eliminated.add(playerId);
  }

  onPlayerHit(_playerId: string): void {
    // No special behavior for Last Standing hits
  }

  canAttack(_playerId: string): boolean {
    return true;
  }

  getSpeedCap(_playerId: string): number | null {
    return null;
  }

  shouldRespawn(playerId: string): boolean {
    return !this.state.eliminated.has(playerId) && false;
  }

  serialize(): SerializedModeState {
    return {
      mode: 'last-standing',
      timer: this.state.timer,
      finished: this.state.finished,
      winnerId: this.state.winnerId,
      winnerTeam: null,
      zoneRadius: this.state.zoneRadius,
      zoneCenterX: this.state.zoneCenter.x,
      zoneCenterY: this.state.zoneCenter.y,
      zoneDamage: this.state.zoneDamage,
      phase: this.state.phase,
      warning: this.state.warning,
      eliminated: [...this.state.eliminated],
    };
  }
}
