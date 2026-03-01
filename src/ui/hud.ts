import type { GameWorld } from '../game/world.ts';
import type { Player } from '../game/player.ts';
import { WORLD_W, WORLD_H } from '../game/types.ts';
import type { SerializedModeState } from '../game/modes/types.ts';

export function renderHUD(
  ctx: CanvasRenderingContext2D,
  localPlayer: Player | undefined,
  world: GameWorld,
  screenW: number,
  screenH: number,
  idleTime?: number,
  isFirstGame?: boolean,
): void {
  const modeState = world.serializeModeState();

  // Mode-specific HUD
  if (modeState.mode !== 'freeplay') {
    renderModeHUD(ctx, modeState, localPlayer, world, screenW, screenH);
  }

  // Score (larger, more prominent)
  if (localPlayer) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    if (modeState.mode === 'skull') {
      const myScore = Math.floor(modeState.scores?.[localPlayer.id] ?? 0);
      const scoreText = localPlayer.alive ? `${myScore}` : 'Respawning...';
      ctx.fillText(scoreText, screenW / 2, 14);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('SKULL TIME', screenW / 2, 54);
    } else {
      const scoreText = localPlayer.alive ? `${localPlayer.bitCount}` : (modeState.mode === 'last-standing' ? 'ELIMINATED' : 'Respawning...');
      ctx.fillText(scoreText, screenW / 2, 14);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('BITS', screenW / 2, 54);
    }
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

  // Winner overlay
  if (modeState.finished) {
    renderWinnerOverlay(ctx, modeState, localPlayer, screenW, screenH);
  }
}

function renderModeHUD(
  ctx: CanvasRenderingContext2D,
  modeState: SerializedModeState,
  localPlayer: Player | undefined,
  _world: GameWorld,
  screenW: number,
  screenH: number,
): void {
  ctx.save();

  // Timer (top-left)
  const totalSec = Math.floor(modeState.timer);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${min}:${sec.toString().padStart(2, '0')}`, 16, 16);

  if (modeState.mode === 'last-standing') {
    // Alive counter
    ctx.fillStyle = '#FF4757';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`ALIVE`, 16, 42);

    // Phase indicator
    const phase = (modeState.phase ?? 0) + 1;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Phase ${phase}/6`, 16, 62);

    // Zone warning
    if (modeState.warning) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 20px sans-serif';
      const flash = Math.sin(Date.now() * 0.01) > 0;
      ctx.fillStyle = flash ? '#FF4757' : '#FFA502';
      ctx.fillText('⚠ ZONE SHRINKING', screenW / 2, screenH * 0.15);
      ctx.restore();
    }

    // Check if local player is outside zone
    if (localPlayer && localPlayer.alive && modeState.zoneCenterX !== undefined && modeState.zoneRadius !== undefined) {
      const dx = localPlayer.position.x - modeState.zoneCenterX;
      const dy = localPlayer.position.y - (modeState.zoneCenterY ?? 0);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > modeState.zoneRadius) {
        // Red vignette effect
        const gradient = ctx.createRadialGradient(screenW / 2, screenH / 2, screenW * 0.3, screenW / 2, screenH / 2, screenW * 0.7);
        gradient.addColorStop(0, 'rgba(255,0,0,0)');
        gradient.addColorStop(1, 'rgba(255,0,0,0.3)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, screenW, screenH);

        ctx.textAlign = 'center';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#FF4757';
        ctx.fillText('OUTSIDE ZONE — LOSING BITS!', screenW / 2, screenH * 0.88);
      }
    }
  }

  if (modeState.mode === 'skull') {
    // Skull carrier indicator
    if (modeState.skullCarrierId) {
      ctx.fillStyle = '#FFA502';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      const carrierName = modeState.skullCarrierId === localPlayer?.id ? 'YOU' : modeState.skullCarrierId;
      ctx.fillText(`👑 ${carrierName}`, 16, 42);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Skull on ground', 16, 42);
    }
  }

  if (modeState.mode === 'koth') {
    // Team scores
    const redScore = Math.floor(modeState.teamScoresRed ?? 0);
    const blueScore = Math.floor(modeState.teamScoresBlue ?? 0);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 20px sans-serif';

    // Red score
    ctx.fillStyle = '#FF4757';
    ctx.fillText(`${redScore}`, screenW / 2 - 50, 76);

    // VS
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('vs', screenW / 2, 80);

    // Blue score
    ctx.fillStyle = '#1E90FF';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${blueScore}`, screenW / 2 + 50, 76);

    // Team label
    if (localPlayer && modeState.playerTeams) {
      const myTeam = modeState.playerTeams[localPlayer.id];
      if (myTeam) {
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = myTeam === 'red' ? '#FF4757' : '#1E90FF';
        ctx.fillText(`TEAM ${myTeam.toUpperCase()}`, screenW / 2, 100);
      }
    }

    // Contested indicator
    if (modeState.contested) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px sans-serif';
      const flash = Math.sin(Date.now() * 0.008) > 0;
      ctx.fillStyle = flash ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)';
      ctx.fillText('CONTESTED!', screenW / 2, screenH * 0.15);
      ctx.restore();
    }
  }

  ctx.restore();
}

function renderWinnerOverlay(
  ctx: CanvasRenderingContext2D,
  modeState: SerializedModeState,
  localPlayer: Player | undefined,
  screenW: number,
  screenH: number,
): void {
  ctx.save();

  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, screenW, screenH);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Winner text
  let winText = '';
  let isLocalWin = false;

  if (modeState.mode === 'koth') {
    const team = modeState.winnerTeam ?? 'red';
    winText = `${team.toUpperCase()} TEAM WINS!`;
    const myTeam = localPlayer && modeState.playerTeams ? modeState.playerTeams[localPlayer.id] : null;
    isLocalWin = myTeam === team;
  } else {
    const winnerId = modeState.winnerId;
    isLocalWin = winnerId === localPlayer?.id;
    winText = isLocalWin ? 'YOU WIN!' : `${winnerId ?? 'Unknown'} WINS!`;
  }

  ctx.font = `bold ${Math.min(48, screenW * 0.1)}px sans-serif`;
  ctx.fillStyle = isLocalWin ? '#FFD700' : '#FF4757';
  ctx.fillText(winText, screenW / 2, screenH * 0.4);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Tap to return to menu', screenW / 2, screenH * 0.55);

  ctx.restore();
}
