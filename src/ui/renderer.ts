import type { Camera } from '../engine/canvas.ts';
import type { Player } from '../game/player.ts';
import type { Bit } from '../game/bits.ts';
import type { GameWorld } from '../game/world.ts';
import type { AimState, Vec2 } from '../game/types.ts';
import { WORLD_W, WORLD_H, SPIKE_LENGTH_FACTOR } from '../game/types.ts';
import type { TouchRing } from '../engine/input.ts';
import type { SerializedModeState } from '../game/modes/types.ts';

// --- Effect state ---
interface DeathEffect {
  x: number; y: number; age: number; color: string;
  particles: { x: number; y: number; vx: number; vy: number }[];
}

interface SpawnEffect {
  x: number; y: number; age: number; color: string;
}

const deathEffects: DeathEffect[] = [];
const spawnEffects: SpawnEffect[] = [];
const playerTrails = new Map<string, Vec2[]>();

// Lazy star field
let starsReady = false;
const worldStars: { x: number; y: number; s: number; b: number }[] = [];
function ensureStars(): void {
  if (starsReady) return;
  starsReady = true;
  for (let i = 0; i < 200; i++) {
    worldStars.push({
      x: Math.random() * WORLD_W,
      y: Math.random() * WORLD_H,
      s: 0.5 + Math.random() * 1.5,
      b: 0.04 + Math.random() * 0.12,
    });
  }
}

export function addDeathEffect(x: number, y: number, color: string): void {
  const particles: DeathEffect['particles'] = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const speed = 60 + Math.random() * 100;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
  }
  deathEffects.push({ x, y, age: 0, color, particles });
}

export function addSpawnEffect(x: number, y: number, color: string): void {
  spawnEffects.push({ x, y, age: 0, color });
}

export function updateEffects(dt: number): void {
  for (let i = deathEffects.length - 1; i >= 0; i--) {
    const e = deathEffects[i];
    e.age += dt;
    for (const p of e.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.95; p.vy *= 0.95;
    }
    if (e.age >= 1.0) deathEffects.splice(i, 1);
  }
  for (let i = spawnEffects.length - 1; i >= 0; i--) {
    spawnEffects[i].age += dt;
    if (spawnEffects[i].age >= 0.5) spawnEffects.splice(i, 1);
  }
}

export function renderBackground(ctx: CanvasRenderingContext2D, camera: Camera): void {
  const sw = camera.screenW;
  const sh = camera.screenH;
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, sw, sh);

  // Star field
  ensureStars();
  for (const star of worldStars) {
    const sp = camera.worldToScreen(star.x, star.y);
    if (sp.x < -2 || sp.x > sw + 2 || sp.y < -2 || sp.y > sh + 2) continue;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, star.s, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${star.b})`;
    ctx.fill();
  }

  // Grid
  const gridSize = 80;
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;

  const startX = -(camera.x % gridSize) - gridSize + sw / 2 - (Math.floor(sw / 2 / gridSize) + 1) * gridSize;
  const startY = -(camera.y % gridSize) - gridSize + sh / 2 - (Math.floor(sh / 2 / gridSize) + 1) * gridSize;

  ctx.beginPath();
  for (let x = startX; x < sw + gridSize; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, sh);
  }
  for (let y = startY; y < sh + gridSize; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(sw, y);
  }
  ctx.stroke();
}

export function renderWorldBoundary(ctx: CanvasRenderingContext2D, camera: Camera): void {
  const tl = camera.worldToScreen(0, 0);
  const br = camera.worldToScreen(WORLD_W, WORLD_H);
  const w = br.x - tl.x;
  const h = br.y - tl.y;

  // Outer glow
  ctx.strokeStyle = 'rgba(255, 80, 80, 0.12)';
  ctx.lineWidth = 10;
  ctx.strokeRect(tl.x, tl.y, w, h);

  // Sharp boundary
  ctx.strokeStyle = 'rgba(255, 80, 80, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 5]);
  ctx.strokeRect(tl.x, tl.y, w, h);
  ctx.setLineDash([]);

  // Dim area outside boundary
  ctx.fillStyle = 'rgba(255, 0, 0, 0.04)';
  ctx.fillRect(0, 0, camera.screenW, tl.y);
  ctx.fillRect(0, br.y, camera.screenW, camera.screenH - br.y);
  ctx.fillRect(0, tl.y, tl.x, h);
  ctx.fillRect(br.x, tl.y, camera.screenW - br.x, h);
}

export function renderBit(ctx: CanvasRenderingContext2D, bit: Bit, camera: Camera): void {
  const s = camera.worldToScreen(bit.position.x, bit.position.y);

  // Skip if off screen
  if (s.x < -10 || s.x > camera.screenW + 10 || s.y < -10 || s.y > camera.screenH + 10) return;

  const pulseSize = 3 + Math.sin(bit.age * 4 + bit.id) * 0.8;

  // Glow (skip near edges for performance)
  const em = 60;
  if (s.x > em && s.x < camera.screenW - em && s.y > em && s.y < camera.screenH - em) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, pulseSize + 3, 0, Math.PI * 2);
    ctx.fillStyle = bit.color + '30';
    ctx.fill();
  }

  // Core
  ctx.beginPath();
  ctx.arc(s.x, s.y, pulseSize, 0, Math.PI * 2);
  ctx.fillStyle = bit.color;
  ctx.fill();

  // Sparkle
  if (bit.scattered) {
    const fade = Math.max(0, 1 - bit.age / bit.lifetime);
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.arc(s.x, s.y, pulseSize + 1, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export function renderPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  camera: Camera,
  time: number,
  aimDir?: Vec2,
  hideSpike?: boolean,
): void {
  if (!player.alive) return;

  const s = camera.worldToScreen(player.position.x, player.position.y);
  const r = player.radius;

  // Skip if off screen
  if (s.x < -r * 2 || s.x > camera.screenW + r * 2 || s.y < -r * 2 || s.y > camera.screenH + r * 2) return;

  // Trail tracking
  let trail = playerTrails.get(player.id);
  if (!trail) { trail = []; playerTrails.set(player.id, trail); }
  const spd = Math.sqrt(player.velocity.x ** 2 + player.velocity.y ** 2);
  if (spd > 80) {
    trail.push({ x: player.position.x, y: player.position.y });
    if (trail.length > 8) trail.shift();
  } else if (trail.length > 0) {
    trail.shift();
  }

  // Draw trail
  for (let i = 0; i < trail.length; i++) {
    const t = i / trail.length;
    const ts = camera.worldToScreen(trail[i].x, trail[i].y);
    ctx.beginPath();
    ctx.arc(ts.x, ts.y, r * t * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = player.color + Math.round(t * 60).toString(16).padStart(2, '0');
    ctx.fill();
  }

  // Bobbing animation
  const bob = Math.sin(time * 3) * 1.5;

  // Invulnerability flashing (stronger oscillation)
  if (player.isInvulnerable) {
    ctx.globalAlpha = 0.3 + Math.sin(time * 14) * 0.3;
  }

  ctx.save();
  ctx.translate(s.x, s.y + bob);

  // Glow (more pronounced)
  const gradient = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.2);
  gradient.addColorStop(0, player.color + '60');
  gradient.addColorStop(0.6, player.color + '20');
  gradient.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Spike (more prominent) — hidden for skull carrier
  if (!hideSpike) {
    const spikeLen = r * SPIKE_LENGTH_FACTOR * 1.3;
    const spikeBaseW = r * 0.45;
    const rot = player.rotation;
    ctx.save();
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(r + spikeLen, 0);
    ctx.lineTo(r - 4, spikeBaseW);
    ctx.lineTo(r - 4, -spikeBaseW);
    ctx.closePath();
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // Body circle
  const bodyGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
  bodyGrad.addColorStop(0, lightenColor(player.color, 50));
  bodyGrad.addColorStop(1, player.color);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Eyes (larger, rounder, more visible)
  const eyeLookDir = aimDir && (aimDir.x !== 0 || aimDir.y !== 0)
    ? Math.atan2(aimDir.y, aimDir.x)
    : player.rotation;
  const eyeOffset = r * 0.3;
  const eyeR = r * 0.24;
  const pupilR = eyeR * 0.5;
  const pupilOffset = eyeR * 0.3;

  for (const side of [-1, 1]) {
    const eyeAngle = eyeLookDir + side * 0.5;
    const ex = Math.cos(eyeAngle) * eyeOffset;
    const ey = Math.sin(eyeAngle) * eyeOffset;

    // Eye white
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Pupil
    const px = ex + Math.cos(eyeLookDir) * pupilOffset;
    const py = ey + Math.sin(eyeLookDir) * pupilOffset;
    ctx.beginPath();
    ctx.arc(px, py, pupilR, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();

    // Eye highlight
    ctx.beginPath();
    ctx.arc(ex - pupilR * 0.3, ey - pupilR * 0.3, pupilR * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

export function renderAimIndicator(
  ctx: CanvasRenderingContext2D,
  player: Player,
  aimState: AimState,
  camera: Camera,
): void {
  if (!aimState.aiming || !player.alive) return;

  const s = camera.worldToScreen(player.position.x, player.position.y);
  const dir = aimState.direction;
  const power = aimState.power;
  const lineLen = 40 + power * 120;
  const color = player.color;

  ctx.save();
  ctx.translate(s.x, s.y);

  // Glowing ready circle
  const pulseR = player.radius + 4 + Math.sin(Date.now() * 0.008) * 3;
  ctx.beginPath();
  ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
  ctx.strokeStyle = color + '80';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Dotted aim line in player color
  ctx.setLineDash([6, 4]);
  const lineAlpha = Math.round((0.5 + power * 0.4) * 255).toString(16).padStart(2, '0');
  ctx.strokeStyle = color + lineAlpha;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(dir.x * lineLen, dir.y * lineLen);
  ctx.stroke();
  ctx.setLineDash([]);

  // Filled arrowhead
  const tipX = dir.x * lineLen;
  const tipY = dir.y * lineLen;
  const angle = Math.atan2(dir.y, dir.x);
  const headLen = 10 + power * 4;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - Math.cos(angle - 0.4) * headLen, tipY - Math.sin(angle - 0.4) * headLen);
  ctx.lineTo(tipX - Math.cos(angle + 0.4) * headLen, tipY - Math.sin(angle + 0.4) * headLen);
  ctx.closePath();
  ctx.fillStyle = color + 'CC';
  ctx.fill();

  // Power arc
  ctx.beginPath();
  ctx.arc(0, 0, player.radius + 6 + power * 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * power);
  const arcAlpha = Math.round((0.3 + power * 0.5) * 255).toString(16).padStart(2, '0');
  ctx.strokeStyle = color + arcAlpha;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

export function renderEffects(ctx: CanvasRenderingContext2D, camera: Camera): void {
  // Death effects (expanding ring + particles)
  for (const e of deathEffects) {
    const t = e.age / 1.0;
    const s = camera.worldToScreen(e.x, e.y);
    const ringR = 20 + t * 80;
    const ringAlpha = Math.round((1 - t) * 180).toString(16).padStart(2, '0');
    ctx.beginPath();
    ctx.arc(s.x, s.y, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = e.color + ringAlpha;
    ctx.lineWidth = 3 * (1 - t);
    ctx.stroke();
    for (const p of e.particles) {
      const ps = camera.worldToScreen(p.x, p.y);
      const pAlpha = Math.round((1 - t) * 200).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, 2 + (1 - t) * 3, 0, Math.PI * 2);
      ctx.fillStyle = e.color + pAlpha;
      ctx.fill();
    }
  }
  // Spawn effects (converging ring)
  for (const e of spawnEffects) {
    const t = e.age / 0.5;
    const s = camera.worldToScreen(e.x, e.y);
    const ringR = 40 * (1 - t);
    const sAlpha = Math.round(t * 180).toString(16).padStart(2, '0');
    ctx.beginPath();
    ctx.arc(s.x, s.y, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = e.color + sAlpha;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export function renderTouchFeedback(ctx: CanvasRenderingContext2D, rings: TouchRing[]): void {
  for (const ring of rings) {
    const t = ring.age / 0.4;
    const r = 10 + t * 30;
    const alpha = (1 - t) * 0.3;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: GameWorld,
  camera: Camera,
  time: number,
  localPlayerId: string,
  aimState: AimState,
): void {
  renderBackground(ctx, camera);

  // Mode-specific world elements (draw before boundary so zone is visible)
  const modeState = world.serializeModeState();
  renderModeWorld(ctx, modeState, camera, time);

  renderWorldBoundary(ctx, camera);

  // Bits
  for (const bit of world.bitsManager.bits) {
    renderBit(ctx, bit, camera);
  }

  // Players
  const activeIds = new Set<string>();
  for (const player of world.players.values()) {
    activeIds.add(player.id);
    const isLocal = player.id === localPlayerId;
    const lookDir = isLocal && aimState.aiming ? aimState.direction : undefined;

    // In skull mode, don't draw spike for carrier
    const isSkullCarrier = modeState.mode === 'skull' && modeState.skullCarrierId === player.id;
    renderPlayer(ctx, player, camera, time, lookDir, isSkullCarrier);
  }
  // Prune stale trails
  for (const id of playerTrails.keys()) {
    if (!activeIds.has(id)) playerTrails.delete(id);
  }

  // Aim indicator for local player
  const local = world.players.get(localPlayerId);
  if (local) {
    renderAimIndicator(ctx, local, aimState, camera);
  }

  // Effects
  renderEffects(ctx, camera);
}

export function renderClientModeElements(
  ctx: CanvasRenderingContext2D,
  modeState: SerializedModeState,
  camera: Camera,
  time: number,
): void {
  renderModeWorld(ctx, modeState, camera, time);
}

function renderModeWorld(
  ctx: CanvasRenderingContext2D,
  modeState: SerializedModeState,
  camera: Camera,
  time: number,
): void {
  if (modeState.mode === 'last-standing' && modeState.zoneCenterX !== undefined && modeState.zoneRadius !== undefined) {
    renderZone(ctx, modeState, camera);
  }

  if (modeState.mode === 'skull' && modeState.skullX !== undefined && modeState.skullY !== undefined) {
    renderSkull(ctx, modeState, camera, time);
  }

  if (modeState.mode === 'koth' && modeState.hillCenterX !== undefined && modeState.hillCenterY !== undefined) {
    renderHill(ctx, modeState, camera, time);
  }
}

function renderZone(
  ctx: CanvasRenderingContext2D,
  modeState: SerializedModeState,
  camera: Camera,
): void {
  const cx = modeState.zoneCenterX!;
  const cy = modeState.zoneCenterY!;
  const radius = modeState.zoneRadius!;
  const s = camera.worldToScreen(cx, cy);

  // Draw the danger zone (outside the safe circle) as a red tint
  // First draw a full-screen red overlay, then cut out the safe circle
  ctx.save();
  ctx.fillStyle = 'rgba(255, 0, 0, 0.08)';
  ctx.fillRect(0, 0, camera.screenW, camera.screenH);

  // Clear the safe zone
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // Safe zone border
  ctx.save();
  ctx.beginPath();
  ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = modeState.warning ? 'rgba(255, 165, 0, 0.7)' : 'rgba(255, 80, 80, 0.4)';
  ctx.lineWidth = modeState.warning ? 3 : 2;
  ctx.setLineDash([8, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function renderSkull(
  ctx: CanvasRenderingContext2D,
  modeState: SerializedModeState,
  camera: Camera,
  time: number,
): void {
  // Don't draw skull on ground if someone is carrying it
  if (modeState.skullCarrierId) {
    // Draw golden aura around carrier (handled via player glow — draw skull icon above carrier position)
    const s = camera.worldToScreen(modeState.skullX!, modeState.skullY!);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '20px sans-serif';
    ctx.fillText('👑', s.x, s.y - 30);

    // Golden aura
    const auraR = 25 + Math.sin(time * 4) * 5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, auraR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Skull on ground
  const s = camera.worldToScreen(modeState.skullX!, modeState.skullY!);
  const pulse = 1 + Math.sin(time * 3) * 0.15;

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(pulse, pulse);

  // Glow
  const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, 30);
  gradient.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Skull emoji
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '24px sans-serif';
  ctx.fillText('💀', 0, 0);

  ctx.restore();
}

function renderHill(
  ctx: CanvasRenderingContext2D,
  modeState: SerializedModeState,
  camera: Camera,
  time: number,
): void {
  const cx = modeState.hillCenterX!;
  const cy = modeState.hillCenterY!;
  const radius = modeState.hillRadius ?? 150;
  const s = camera.worldToScreen(cx, cy);

  // Hill zone fill
  let fillColor = 'rgba(255, 255, 255, 0.05)';
  let strokeColor = 'rgba(255, 255, 255, 0.3)';

  if (modeState.contested) {
    const flash = Math.sin(time * 8) > 0;
    fillColor = flash ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)';
    strokeColor = 'rgba(255, 255, 255, 0.5)';
  } else if (modeState.controllingTeam === 'red') {
    fillColor = 'rgba(255, 71, 87, 0.1)';
    strokeColor = 'rgba(255, 71, 87, 0.5)';
  } else if (modeState.controllingTeam === 'blue') {
    fillColor = 'rgba(30, 144, 255, 0.1)';
    strokeColor = 'rgba(30, 144, 255, 0.5)';
  }

  ctx.save();

  // Fill
  ctx.beginPath();
  ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();

  // Border
  ctx.beginPath();
  ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Pulsing inner ring
  const innerR = radius * 0.3 + Math.sin(time * 2) * 10;
  ctx.beginPath();
  ctx.arc(s.x, s.y, innerR, 0, Math.PI * 2);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // "HILL" label
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('HILL', s.x, s.y);

  ctx.restore();
}

function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}
