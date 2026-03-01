import type { Player } from './player.ts';
import type { BitsManager } from './bits.ts';
import { vec2Sub, vec2Norm, vec2Scale, vec2Add, INVULN_DURATION } from './types.ts';
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
  const bitsLost = Math.max(10, Math.floor(victim.bitCount * 0.5));
  const actualLoss = Math.min(bitsLost, victim.bitCount);
  victim.bitCount -= actualLoss;

  // Scatter bits
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
