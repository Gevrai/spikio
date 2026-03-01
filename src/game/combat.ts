import type { Player } from './player.ts';
import type { BitsManager } from './bits.ts';
import type { ModeManager } from './modes/types.ts';
import { vec2Sub, vec2Norm, vec2Scale, vec2Add, vec2Len, INVULN_DURATION, MAX_SPEED, speedMultiplier } from './types.ts';
import { spikeHitTest, circleCollision, resolveCircleCollision } from './physics.ts';
import type { KothMode } from './modes/koth.ts';

export function processCombat(players: Player[], bitsManager: BitsManager, modeManager?: ModeManager): void {
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      if (!a.alive || !b.alive) continue;

      // Check friendly fire in team modes
      if (modeManager && modeManager.state.mode === 'koth') {
        const koth = modeManager as unknown as KothMode;
        if (koth.isFriendlyFire(a.id, b.id)) {
          // Only body collision, no spike damage
          if (circleCollision(a, b)) {
            resolveCircleCollision(a, b);
          }
          continue;
        }
      }

      // Check spike hits (both directions)
      let spikeHandled = false;
      const aCanAttack = !modeManager || modeManager.canAttack(a.id);
      const bCanAttack = !modeManager || modeManager.canAttack(b.id);

      if (aCanAttack && spikeHitTest(a, b)) {
        handleSpikeHit(a, b, bitsManager, modeManager);
        spikeHandled = true;
      }
      if (bCanAttack && spikeHitTest(b, a)) {
        handleSpikeHit(b, a, bitsManager, modeManager);
        spikeHandled = true;
      }

      // Body collision (billiard bounce only if no spike hit)
      if (!spikeHandled && circleCollision(a, b)) {
        resolveCircleCollision(a, b);
      }
    }
  }
}

function handleSpikeHit(attacker: Player, victim: Player, bitsManager: BitsManager, modeManager?: ModeManager): void {
  // If victim has fewer than 10 bits, they explode
  if (victim.bitCount < 10) {
    bitsManager.scatterBits(victim.position, victim.bitCount);
    victim.bitCount = 0;
    victim.kill();
    if (modeManager) modeManager.onPlayerKilled(victim.id, new Map());
    return;
  }

  // Force factor: 0 (barely moving) to 1 (max speed), normalized to attacker's actual max
  const speed = vec2Len(attacker.velocity);
  const attackerMaxSpeed = MAX_SPEED * speedMultiplier(attacker.bitCount);
  const forceFactor = Math.min(speed / attackerMaxSpeed, 1);

  // Loss percentage: 25% at minimum force, 75% at max force
  const lossPercent = 0.25 + forceFactor * 0.50;
  const bitsLost = Math.max(10, Math.floor(victim.bitCount * lossPercent));
  const actualLoss = Math.min(bitsLost, victim.bitCount);
  victim.bitCount -= actualLoss;

  // Scatter bits outward (Sonic-style ring loss)
  bitsManager.scatterBits(victim.position, actualLoss);

  // Bounce apart
  const dir = vec2Norm(vec2Sub(victim.position, attacker.position));
  const bounceStrength = 250;
  victim.velocity = vec2Add(victim.velocity, vec2Scale(dir, bounceStrength));
  attacker.velocity = vec2Add(attacker.velocity, vec2Scale(dir, -bounceStrength * 0.5));

  // Invulnerability
  victim.invulnerableTimer = INVULN_DURATION;

  // Notify mode of non-lethal hit
  if (modeManager) modeManager.onPlayerHit(victim.id);

  // Check elimination
  if (victim.bitCount <= 0) {
    victim.kill();
    if (modeManager) modeManager.onPlayerKilled(victim.id, new Map());
  }
}
