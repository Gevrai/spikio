import { GameLoop } from './engine/game-loop.ts';
import { CanvasManager } from './engine/canvas.ts';
import { InputManager } from './engine/input.ts';
import { GameWorld } from './game/world.ts';
import { renderWorld, renderBackground, renderWorldBoundary, renderPlayer, renderAimIndicator, renderEffects, renderTouchFeedback, addDeathEffect, addSpawnEffect, updateEffects, renderClientModeElements } from './ui/renderer.ts';
import { renderHUD } from './ui/hud.ts';
import { SoundManager } from './audio/sounds.ts';
import { vec2Dist, vec2Norm, vec2Sub } from './game/types.ts';
import type { Player } from './game/player.ts';
import type { Bit } from './game/bits.ts';
import type { AimState } from './game/types.ts';
import { GameHost } from './net/host.ts';
import { GameClient } from './net/client.ts';
import {
  createMenuState, renderMenu, getMenuButtons, hitTestButtons,
  showJoinInputs, hideJoinInputs, getJoinInputValues,
} from './ui/menu.ts';

// --- Setup ---
const canvasEl = document.getElementById('game') as HTMLCanvasElement;
const cm = new CanvasManager(canvasEl);
const sound = new SoundManager();

type GameMode = 'menu' | 'solo' | 'host' | 'client';
let mode: GameMode = 'menu';
let gameTime = 0;

// Input manager (created on demand since menu needs raw touch)
let input: InputManager | null = null;

// Menu
const menuState = createMenuState();

// Solo mode state
let soloWorld: GameWorld | null = null;
let soloLocalPlayer: Player | null = null;
const soloBotNames = ['Spike', 'Pointy', 'Zippy', 'Stabby', 'Pricky'];
const soloBotStates = new Map<string, { aimTimer: number }>();

// Host mode state
let gameHost: GameHost | null = null;

// Client mode state
let gameClient: GameClient | null = null;

// Sound tracking
const prevBitCounts = new Map<string, number>();
const prevAlive = new Map<string, boolean>();
let idleTime = 0;
let isFirstGame = true;

// --- Menu ---
function handleMenuClick(x: number, y: number): void {
  const buttons = getMenuButtons(menuState.screen, cm.logicalW, cm.logicalH);
  const action = hitTestButtons(buttons, x, y);
  if (!action) return;

  switch (action) {
    case 'solo-modes':
      menuState.playContext = 'solo';
      menuState.screen = 'mode-select';
      break;
    case 'host-modes':
      menuState.playContext = 'host';
      menuState.screen = 'mode-select';
      break;
    case 'mode-freeplay':
      menuState.selectedMode = 'freeplay';
      if (menuState.playContext === 'solo') startSolo();
      else showHostScreen();
      break;
    case 'mode-last-standing':
      menuState.selectedMode = 'last-standing';
      if (menuState.playContext === 'solo') startSolo();
      else showHostScreen();
      break;
    case 'mode-skull':
      menuState.selectedMode = 'skull';
      if (menuState.playContext === 'solo') startSolo();
      else showHostScreen();
      break;
    case 'mode-koth':
      menuState.selectedMode = 'koth';
      if (menuState.playContext === 'solo') startSolo();
      else showHostScreen();
      break;
    case 'join': showJoinScreen(); break;
    case 'start-host': startHostGame(); break;
    case 'connect': connectToHost(); break;
    case 'back': goBackToMain(); break;
  }
}

function showHostScreen(): void {
  menuState.screen = 'host';
  const hostName = 'Host';
  gameHost = new GameHost(hostName, menuState.selectedMode);
  menuState.roomCode = gameHost.roomCode;
  menuState.playerList = gameHost.playerList;

  gameHost.onPlayersChanged = () => {
    menuState.playerList = gameHost!.playerList;
  };

  gameHost.onConnected = () => {
    menuState.playerList = gameHost!.playerList;
  };

  gameHost.connect();
}

function showJoinScreen(): void {
  menuState.screen = 'join';
  menuState.joinStatus = '';
  showJoinInputs();
}

function goBackToMain(): void {
  if (gameHost) { gameHost.disconnect(); gameHost = null; }
  if (gameClient) { gameClient.disconnect(); gameClient = null; }
  hideJoinInputs();
  menuState.screen = 'main';
  menuState.roomCode = '';
  menuState.playerList = [];
  menuState.joinStatus = '';
}

function startSolo(): void {
  mode = 'solo';
  gameTime = 0;
  input = new InputManager(canvasEl);
  soloWorld = new GameWorld(menuState.selectedMode);
  soloLocalPlayer = soloWorld.addPlayer('You');

  soloBotStates.clear();
  for (const name of soloBotNames) {
    soloWorld.addPlayer(name);
    soloBotStates.set(name, { aimTimer: 1 + Math.random() * 2 });
  }

  prevBitCounts.clear();
  prevAlive.clear();
  for (const p of soloWorld.players.values()) {
    prevBitCounts.set(p.id, p.bitCount);
    prevAlive.set(p.id, p.alive);
  }
}

function startHostGame(): void {
  if (!gameHost || !gameHost.isConnected) return;
  mode = 'host';
  gameTime = 0;
  input = new InputManager(canvasEl);
  prevBitCounts.clear();
  prevAlive.clear();
}

function connectToHost(): void {
  const vals = getJoinInputValues();
  if (!vals.room || vals.room.length < 4) {
    menuState.joinStatus = 'Enter a 4-character room code';
    return;
  }

  if (gameClient) { gameClient.disconnect(); gameClient = null; }
  menuState.joinStatus = 'Connecting...';
  gameClient = new GameClient();

  gameClient.onConnected = () => {
    menuState.joinStatus = 'Connected, joining...';
  };

  gameClient.onWelcome = () => {
    menuState.joinStatus = 'Joined!';
    hideJoinInputs();
    mode = 'client';
    gameTime = 0;
    input = new InputManager(canvasEl);
  };

  gameClient.onDisconnect = (reason) => {
    if (mode === 'client') {
      mode = 'menu';
      menuState.screen = 'main';
      menuState.joinStatus = '';
    } else {
      menuState.joinStatus = `Disconnected: ${reason}`;
    }
    gameClient = null;
    input = null;
  };

  gameClient.onError = (msg) => {
    menuState.joinStatus = `Error: ${msg}`;
  };

  gameClient.connect(vals.room, vals.name);
}

function returnToMenu(): void {
  mode = 'menu';
  menuState.screen = 'main';
  menuState.joinStatus = '';
  hideJoinInputs();
  if (gameHost) { gameHost.disconnect(); gameHost = null; }
  if (gameClient) { gameClient.disconnect(); gameClient = null; }
  soloWorld = null;
  soloLocalPlayer = null;
  if (input) { input.destroy(); input = null; }
}

// --- Solo Bot AI ---
function findNearestBit(player: Player, bits: Bit[]): Bit | null {
  let best: Bit | null = null;
  let bestDist = Infinity;
  for (const bit of bits) {
    const d = vec2Dist(player.position, bit.position);
    if (d < bestDist) { bestDist = d; best = bit; }
  }
  return best;
}

function findNearestEnemy(player: Player, players: Player[]): Player | null {
  let best: Player | null = null;
  let bestDist = Infinity;
  for (const other of players) {
    if (other.id === player.id || !other.alive) continue;
    const d = vec2Dist(player.position, other.position);
    if (d < bestDist) { bestDist = d; best = other; }
  }
  return best;
}

function updateSoloBotAI(dt: number): void {
  if (!soloWorld) return;
  const allPlayers = [...soloWorld.players.values()];
  const modeState = soloWorld.serializeModeState();

  for (const name of soloBotNames) {
    const bot = soloWorld.players.get(name);
    if (!bot || !bot.alive) continue;
    const state = soloBotStates.get(name)!;
    state.aimTimer -= dt;
    if (state.aimTimer <= 0) {
      const enemy = findNearestEnemy(bot, allPlayers);
      const bit = findNearestBit(bot, soloWorld.bitsManager.bits);
      let target: { x: number; y: number } | null = null;

      if (modeState.mode === 'last-standing') {
        // Prioritize moving toward zone center if outside
        const cx = modeState.zoneCenterX ?? 1000;
        const cy = modeState.zoneCenterY ?? 1000;
        const dx = bot.position.x - cx;
        const dy = bot.position.y - cy;
        const distToCenter = Math.sqrt(dx * dx + dy * dy);
        const zoneR = modeState.zoneRadius ?? 1000;
        if (distToCenter > zoneR * 0.7) {
          target = { x: cx, y: cy };
        } else if (enemy && vec2Dist(bot.position, enemy.position) < 250 && Math.random() < 0.6) {
          target = { x: enemy.position.x, y: enemy.position.y };
        } else if (bit) {
          target = { x: bit.position.x, y: bit.position.y };
        }
      } else if (modeState.mode === 'skull') {
        // Chase skull if not carrier; flee if carrier
        const isCarrier = modeState.skullCarrierId === bot.id;
        if (isCarrier) {
          // Flee from nearest enemy
          if (enemy) {
            const fleeX = bot.position.x - (enemy.position.x - bot.position.x);
            const fleeY = bot.position.y - (enemy.position.y - bot.position.y);
            target = { x: fleeX, y: fleeY };
          }
        } else {
          // Go to skull
          if (modeState.skullX !== undefined && modeState.skullY !== undefined) {
            target = { x: modeState.skullX, y: modeState.skullY };
          }
        }
      } else if (modeState.mode === 'koth') {
        // Move toward hill
        const hx = modeState.hillCenterX ?? 1000;
        const hy = modeState.hillCenterY ?? 1000;
        const distToHill = vec2Dist(bot.position, { x: hx, y: hy });

        if (distToHill > (modeState.hillRadius ?? 150)) {
          target = { x: hx, y: hy };
        } else if (enemy && vec2Dist(bot.position, enemy.position) < 200 && Math.random() < 0.7) {
          // Fight enemies in the hill
          target = { x: enemy.position.x, y: enemy.position.y };
        }
      } else {
        // Free play behavior
        if (enemy && vec2Dist(bot.position, enemy.position) < 250 && Math.random() < 0.6) {
          target = { x: enemy.position.x, y: enemy.position.y };
        } else if (bit) {
          target = { x: bit.position.x, y: bit.position.y };
        }
      }

      if (target) {
        const dir = vec2Norm(vec2Sub(target, bot.position));
        bot.launch(dir.x, dir.y, 0.4 + Math.random() * 0.6);
      }
      state.aimTimer = 0.8 + Math.random() * 1.5;
    }
  }
}

// --- Sound Effects ---
function trackSounds(players: Iterable<{ id: string; bitCount: number; alive: boolean; position: { x: number; y: number }; color: string }>, localId: string): void {
  const currentIds = new Set<string>();
  for (const p of players) {
    currentIds.add(p.id);
    const prev = prevBitCounts.get(p.id) ?? p.bitCount;
    if (p.bitCount > prev) {
      if (p.id === localId) sound.playCollect();
    } else if (p.bitCount < prev && prev - p.bitCount >= 10) {
      sound.playHit();
      if (p.id === localId) cm.camera.shake(6);
    }
    prevBitCounts.set(p.id, p.bitCount);

    const wasAlive = prevAlive.get(p.id) ?? true;
    if (wasAlive && !p.alive) {
      sound.playExplode();
      addDeathEffect(p.position.x, p.position.y, p.color);
      if (p.id === localId) cm.camera.shake(10);
    }
    if (!wasAlive && p.alive) {
      addSpawnEffect(p.position.x, p.position.y, p.color);
    }
    prevAlive.set(p.id, p.alive);
  }
  // Prune removed players
  for (const id of prevBitCounts.keys()) {
    if (!currentIds.has(id)) { prevBitCounts.delete(id); prevAlive.delete(id); }
  }
}

// --- Game Loop ---
function update(dt: number): void {
  if (mode === 'menu') {
    menuState.animTime += dt;
    return;
  }

  gameTime += dt;
  updateEffects(dt);
  if (input) input.updateTouchRings(dt);

  if (mode === 'solo') {
    if (!soloWorld || !soloLocalPlayer || !input) return;

    // Check if mode finished — return to menu on tap
    if (soloWorld.modeManager.state.finished) {
      const launch = input.consumeLaunch();
      if (launch) {
        returnToMenu();
        return;
      }
      soloWorld.update(dt); // Keep updating for effects
      trackSounds(soloWorld.players.values(), 'You');
      return;
    }

    const launch = input.consumeLaunch();
    if (launch && soloLocalPlayer.alive) {
      soloLocalPlayer.launch(launch.direction.x, launch.direction.y, launch.power);
      sound.playLaunch();
      idleTime = 0;
      isFirstGame = false;
    }
    updateSoloBotAI(dt);
    soloWorld.update(dt);
    trackSounds(soloWorld.players.values(), 'You');
    // Idle tracking
    if (soloLocalPlayer.alive && !soloLocalPlayer.isMoving && !input.aimState.aiming) {
      idleTime += dt;
    } else {
      idleTime = 0;
    }
  }

  if (mode === 'host') {
    if (!gameHost || !input) return;
    const launch = input.consumeLaunch();
    if (launch && gameHost.localPlayer.alive) {
      gameHost.localPlayer.launch(launch.direction.x, launch.direction.y, launch.power);
      sound.playLaunch();
    }
    gameHost.update(dt);
    trackSounds(gameHost.world.players.values(), gameHost.localPlayer.id);
  }

  if (mode === 'client') {
    if (!gameClient || !input) return;
    gameClient.setAim(input.aimState);
    const launch = input.consumeLaunch();
    if (launch) {
      gameClient.triggerLaunch(launch.direction, launch.power);
      sound.playLaunch();
    }
    gameClient.update(dt);
    // Track sounds/effects for client players
    const clientPlayers = gameClient.getPlayers().map(p => ({
      id: p.id, bitCount: p.bitCount, alive: p.alive,
      position: { x: p.x, y: p.y }, color: p.color,
    }));
    trackSounds(clientPlayers, gameClient.playerId ?? '');
  }
}

function render(ctx: CanvasRenderingContext2D, _alpha: number): void {
  ctx.clearRect(0, 0, cm.logicalW, cm.logicalH);

  if (mode === 'menu') {
    renderMenu(ctx, menuState, cm.logicalW, cm.logicalH);
    return;
  }

  if (mode === 'solo') {
    if (!soloWorld || !soloLocalPlayer || !input) return;
    cm.camera.follow(soloLocalPlayer.position);
    cm.camera.update(1 / 60);
    renderWorld(ctx, soloWorld, cm.camera, gameTime, 'You', input.aimState);
    renderHUD(ctx, soloLocalPlayer, soloWorld, cm.logicalW, cm.logicalH, idleTime, isFirstGame);
    if (input) renderTouchFeedback(ctx, input.touchRings);
    return;
  }

  if (mode === 'host') {
    if (!gameHost || !input) return;
    cm.camera.follow(gameHost.localPlayer.position);
    cm.camera.update(1 / 60);
    renderWorld(ctx, gameHost.world, cm.camera, gameTime, gameHost.localPlayer.id, input.aimState);
    renderHUD(ctx, gameHost.localPlayer, gameHost.world, cm.logicalW, cm.logicalH);
    if (input) renderTouchFeedback(ctx, input.touchRings);
    return;
  }

  if (mode === 'client') {
    if (!gameClient || !input) return;
    const localP = gameClient.getLocalPlayer();
    if (localP) {
      cm.camera.follow({ x: localP.x, y: localP.y });
    }
    cm.camera.update(1 / 60);
    renderClientWorld(ctx, gameClient, cm.camera, gameTime, input.aimState);
    renderClientHUD(ctx, gameClient, cm.logicalW, cm.logicalH);
    if (input) renderTouchFeedback(ctx, input.touchRings);
    return;
  }
}

// Client rendering: uses serialized data instead of GameWorld
function renderClientWorld(
  ctx: CanvasRenderingContext2D,
  client: GameClient,
  camera: import('./engine/canvas.ts').Camera,
  time: number,
  aimState: AimState,
): void {
  renderBackground(ctx, camera);

  // Mode-specific world elements
  const modeState = client.modeState;
  if (modeState) {
    renderClientModeElements(ctx, modeState, camera, time);
  }

  renderWorldBoundary(ctx, camera);

  // Bits (batched by color)
  {
    const clientBits = client.getBits();
    const sw = camera.screenW;
    const sh = camera.screenH;
    const colorBuckets = new Map<string, { sx: number; sy: number; ps: number }[]>();
    const glowBuckets = new Map<string, { sx: number; sy: number; ps: number }[]>();
    for (const b of clientBits) {
      const s = camera.worldToScreen(b.x, b.y);
      if (s.x < -10 || s.x > sw + 10 || s.y < -10 || s.y > sh + 10) continue;
      const ps = 3 + Math.sin(time * 4 + b.id) * 0.8;
      const d = { sx: s.x, sy: s.y, ps };
      let cb = colorBuckets.get(b.color);
      if (!cb) { cb = []; colorBuckets.set(b.color, cb); }
      cb.push(d);
      const em = 60;
      if (s.x > em && s.x < sw - em && s.y > em && s.y < sh - em) {
        let gb = glowBuckets.get(b.color);
        if (!gb) { gb = []; glowBuckets.set(b.color, gb); }
        gb.push(d);
      }
    }
    ctx.globalAlpha = 0.19;
    for (const [color, bucket] of glowBuckets) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const d of bucket) { ctx.moveTo(d.sx + d.ps + 3, d.sy); ctx.arc(d.sx, d.sy, d.ps + 3, 0, Math.PI * 2); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const [color, bucket] of colorBuckets) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const d of bucket) { ctx.moveTo(d.sx + d.ps, d.sy); ctx.arc(d.sx, d.sy, d.ps, 0, Math.PI * 2); }
      ctx.fill();
    }
  }

  // Players
  const players = client.getPlayers();
  const localId = client.playerId;
  for (const p of players) {
    if (!p.alive) continue;
    // Create a lightweight player-like object for the renderer
    const fakePlayer = {
      id: p.id,
      position: { x: p.x, y: p.y },
      velocity: { x: p.vx, y: p.vy },
      rotation: p.rotation,
      bitCount: p.bitCount,
      radius: p.radius,
      alive: p.alive,
      color: p.color,
      isInvulnerable: p.invulnerable,
      isMoving: Math.sqrt(p.vx * p.vx + p.vy * p.vy) > 5,
    } as unknown as Player;

    const isLocal = p.id === localId;
    const lookDir = isLocal && aimState.aiming ? aimState.direction : undefined;
    const isSkullCarrier = modeState?.mode === 'skull' && modeState.skullCarrierId === p.id;
    renderPlayer(ctx, fakePlayer, camera, time, lookDir, isSkullCarrier);

    if (isLocal) {
      renderAimIndicator(ctx, fakePlayer, aimState, camera);
    }
  }

  // Effects
  renderEffects(ctx, camera);
}

function renderClientHUD(
  ctx: CanvasRenderingContext2D,
  client: GameClient,
  screenW: number,
  screenH: number,
): void {
  const local = client.getLocalPlayer();
  const modeState = client.modeState;

  // Mode-specific HUD elements (timer, scores, etc.)
  if (modeState && modeState.mode !== 'freeplay') {
    ctx.save();
    const totalSec = Math.floor(modeState.timer);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${min}:${sec.toString().padStart(2, '0')}`, 16, 16);

    if (modeState.mode === 'koth') {
      const redScore = Math.floor(modeState.teamScoresRed ?? 0);
      const blueScore = Math.floor(modeState.teamScoresBlue ?? 0);
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#FF4757';
      ctx.fillText(`${redScore}`, screenW / 2 - 50, 76);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('vs', screenW / 2, 80);
      ctx.fillStyle = '#1E90FF';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`${blueScore}`, screenW / 2 + 50, 76);
    }

    if (modeState.mode === 'last-standing' && modeState.warning) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      const flash = Math.sin(Date.now() * 0.01) > 0;
      ctx.fillStyle = flash ? '#FF4757' : '#FFA502';
      ctx.fillText('⚠ ZONE SHRINKING', screenW / 2, screenH * 0.15);
    }

    // Winner overlay
    if (modeState.finished) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, screenW, screenH);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let winText = '';
      if (modeState.mode === 'koth') {
        winText = `${(modeState.winnerTeam ?? 'RED').toUpperCase()} TEAM WINS!`;
      } else {
        const isLocalWin = modeState.winnerId === client.playerId;
        winText = isLocalWin ? 'YOU WIN!' : `${modeState.winnerId ?? 'Unknown'} WINS!`;
      }
      ctx.font = `bold ${Math.min(48, screenW * 0.1)}px sans-serif`;
      ctx.fillStyle = '#FFD700';
      ctx.fillText(winText, screenW / 2, screenH * 0.4);
    }

    ctx.restore();
  }

  // Score (larger for mobile)
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const scoreText = local ? (local.alive ? `${local.bitCount}` : 'Respawning...') : '';
  ctx.fillText(scoreText, screenW / 2, 14);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('BITS', screenW / 2, 54);
  ctx.restore();

  // Leaderboard (bigger text, colored dots)
  const players = client.getPlayers()
    .filter(p => p.alive)
    .sort((a, b) => b.bitCount - a.bitCount)
    .slice(0, 5);

  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('LEADERBOARD', screenW - 16, 16);
  ctx.font = '15px sans-serif';
  for (let i = 0; i < players.length; i++) {
    const entry = players[i];
    const isLocal = entry.id === client.playerId;
    const rowY = 38 + i * 24;
    const name = entry.name.length > 10 ? entry.name.slice(0, 10) + '…' : entry.name;
    const text = `${i + 1}. ${name}  ${entry.bitCount}`;
    // Colored dot
    const tw = ctx.measureText(text).width;
    ctx.beginPath();
    ctx.arc(screenW - 16 - tw - 12, rowY + 7, 4, 0, Math.PI * 2);
    ctx.fillStyle = entry.color;
    ctx.fill();
    ctx.fillStyle = isLocal ? '#FFD700' : 'rgba(255,255,255,0.5)';
    ctx.fillText(text, screenW - 16, rowY);
  }
  ctx.restore();

  // Minimap (larger for mobile)
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

  const ww = client.worldW;
  const wh = client.worldH;
  for (const p of client.getPlayers()) {
    if (!p.alive) continue;
    const px = mmX + (p.x / ww) * mmSize;
    const py = mmY + (p.y / wh) * mmSize;
    const isLocal = p.id === client.playerId;
    ctx.beginPath();
    ctx.arc(px, py, isLocal ? 3 : 2, 0, Math.PI * 2);
    ctx.fillStyle = isLocal ? '#fff' : p.color;
    ctx.fill();
  }
  ctx.restore();
}

// --- Menu Input Handling ---
function onMenuPointerDown(e: MouseEvent | TouchEvent): void {
  if (mode !== 'menu') return;

  let x: number, y: number;
  if (typeof TouchEvent !== 'undefined' && e instanceof TouchEvent) {
    if (e.touches.length === 0) return;
    x = e.touches[0].clientX;
    y = e.touches[0].clientY;
  } else {
    x = (e as MouseEvent).clientX;
    y = (e as MouseEvent).clientY;
  }

  handleMenuClick(x, y);
}

canvasEl.addEventListener('mousedown', onMenuPointerDown);
canvasEl.addEventListener('touchstart', (e) => {
  if (mode === 'menu') {
    e.preventDefault();
    onMenuPointerDown(e);
  }
}, { passive: false });

// Prevent default touch behavior
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// --- Start ---
const loop = new GameLoop(cm.ctx, update, render);
loop.start();

// Expose returnToMenu for debugging
(window as unknown as Record<string, unknown>).returnToMenu = returnToMenu;
