import type { Player } from './player.ts';
import type { BitsManager } from './bits.ts';
import { vec2Sub, vec2Norm, vec2Scale, vec2Add, vec2Len, INVULN_DURATION, MAX_SPEED } from './types.ts';
import { spikeHitTest, circleCollision, resolveCircleCollision } from './physics.ts';

export function processCombat(players: Player[], bitsManager: BitsManager): void {
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      if (!a.alive || !b.alive) continue;

      // Check spike hits (both directions)
      let spikeHandled = false;
      if (spikeHitTest(a, b)) {
        handleSpikeHit(a, b, bitsManager);
        spikeHandled = true;
      }
      if (spikeHitTest(b, a)) {
        handleSpikeHit(b, a, bitsManager);
        spikeHandled = true;
      }

      // Body collision (billiard bounce only if no spike hit)
      if (!spikeHandled && circleCollision(a, b)) {
        resolveCircleCollision(a, b);
      }
    }
  }
}

function handleSpikeHit(attacker: Player, victim: Player, bitsManager: BitsManager): void {
  // If victim has fewer than 10 bits, they explode
  if (victim.bitCount < 10) {
    bitsManager.scatterBits(victim.position, victim.bitCount);
    victim.bitCount = 0;
    victim.kill();
    return;
  }

  // Force factor: 0 (barely moving) to 1 (max speed)
  const speed = vec2Len(attacker.velocity);
  const forceFactor = Math.min(speed / MAX_SPEED, 1);

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

  // Check elimination
  if (victim.bitCount <= 0) {
    victim.kill();
  }
}
