import type { Vec2 } from './types.ts';
import { vec2Dist, vec2Sub, vec2Norm, vec2Dot, vec2Scale, vec2Add, SPIKE_LENGTH_FACTOR } from './types.ts';
import type { Player } from './player.ts';

export function getSpikePoint(player: Player): Vec2 {
  const spikeLen = player.radius * SPIKE_LENGTH_FACTOR;
  return {
    x: player.position.x + Math.cos(player.rotation) * (player.radius + spikeLen),
    y: player.position.y + Math.sin(player.rotation) * (player.radius + spikeLen),
  };
}

export function spikeHitTest(attacker: Player, target: Player): boolean {
  if (!attacker.isMoving) return false;
  if (attacker.isInvulnerable || target.isInvulnerable) return false;
  if (!attacker.alive || !target.alive) return false;

  const spike = getSpikePoint(attacker);
  const dist = vec2Dist(spike, target.position);
  return dist < target.radius;
}

export function circleCollision(a: Player, b: Player): boolean {
  if (!a.alive || !b.alive) return false;
  const dist = vec2Dist(a.position, b.position);
  return dist < a.radius + b.radius;
}

export function resolveCircleCollision(a: Player, b: Player): void {
  const diff = vec2Sub(a.position, b.position);
  const dist = vec2Dist(a.position, b.position);
  if (dist === 0) return;

  const normal = vec2Norm(diff);
  const overlap = (a.radius + b.radius) - dist;

  // Separate
  const massA = a.radius * a.radius;
  const massB = b.radius * b.radius;
  const total = massA + massB;
  a.position.x += normal.x * overlap * (massB / total);
  a.position.y += normal.y * overlap * (massB / total);
  b.position.x -= normal.x * overlap * (massA / total);
  b.position.y -= normal.y * overlap * (massA / total);

  // Billiard bounce
  const relVel = vec2Sub(a.velocity, b.velocity);
  const velAlongNormal = vec2Dot(relVel, normal);
  if (velAlongNormal > 0) return; // Moving apart

  const restitution = 0.8;
  const impulse = -(1 + restitution) * velAlongNormal / total;
  const impulseVec = vec2Scale(normal, impulse);

  a.velocity = vec2Add(a.velocity, vec2Scale(impulseVec, massB));
  b.velocity = vec2Sub(b.velocity, vec2Scale(impulseVec, massA));
}
