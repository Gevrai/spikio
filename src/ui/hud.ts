import type { GameWorld } from '../game/world.ts';
import type { Player } from '../game/player.ts';
import { WORLD_W, WORLD_H } from '../game/types.ts';

export function renderHUD(
  ctx: CanvasRenderingContext2D,
  localPlayer: Player | undefined,
  world: GameWorld,
  screenW: number,
  screenH: number,
  idleTime?: number,
  isFirstGame?: boolean,
): void {
  // Score (larger, more prominent)
  if (localPlayer) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const scoreText = localPlayer.alive ? `${localPlayer.bitCount}` : 'Respawning...';
    ctx.fillText(scoreText, screenW / 2, 14);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('BITS', screenW / 2, 54);
    ctx.restore();
  }

  // Leaderboard (bigger text, colored dots)
  const leaderboard = world.getLeaderboard().slice(0, 5);
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('LEADERBOARD', screenW - 16, 16);
  ctx.font = '15px sans-serif';
  for (let i = 0; i < leaderboard.length; i++) {
    const entry = leaderboard[i];
    const isLocal = localPlayer && entry.id === localPlayer.id;
    const player = world.players.get(entry.id);
    const rowY = 38 + i * 24;
    const name = entry.id.length > 10 ? entry.id.slice(0, 10) + '…' : entry.id;
    const text = `${i + 1}. ${name}  ${entry.score}`;
    // Colored dot
    if (player) {
      const tw = ctx.measureText(text).width;
      ctx.beginPath();
      ctx.arc(screenW - 16 - tw - 12, rowY + 7, 4, 0, Math.PI * 2);
      ctx.fillStyle = player.color;
      ctx.fill();
    }
    ctx.fillStyle = isLocal ? '#FFD700' : 'rgba(255,255,255,0.5)';
    ctx.fillText(text, screenW - 16, rowY);
  }
  ctx.restore();

  // Minimap (slightly larger for mobile)
  const mmSize = 120;
  const mmPad = 12;
  const mmX = screenW - mmSize - mmPad;
  const mmY = screenH - mmSize - mmPad;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.fillRect(mmX, mmY, mmSize, mmSize);
  ctx.strokeRect(mmX, mmY, mmSize, mmSize);

  for (const player of world.players.values()) {
    if (!player.alive) continue;
    const px = mmX + (player.position.x / WORLD_W) * mmSize;
    const py = mmY + (player.position.y / WORLD_H) * mmSize;
    const isLocal = localPlayer && player.id === localPlayer.id;
    ctx.beginPath();
    ctx.arc(px, py, isLocal ? 3 : 2, 0, Math.PI * 2);
    ctx.fillStyle = isLocal ? '#fff' : player.color;
    ctx.fill();
  }
  ctx.restore();

  // Drag-to-aim hint (first game only, idle > 3s)
  if (isFirstGame && idleTime !== undefined && idleTime > 3) {
    const hintAlpha = Math.min(1, (idleTime - 3) * 2) * (0.5 + Math.sin(Date.now() * 0.003) * 0.2);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '16px sans-serif';
    ctx.fillStyle = `rgba(255,255,255,${hintAlpha})`;
    ctx.fillText('↕ Drag to aim, release to launch', screenW / 2, screenH - 30);
    ctx.restore();
  }
}
