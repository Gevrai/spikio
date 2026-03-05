import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { PLAYER_COLORS, WORLD_W, WORLD_H, SCATTER_LIFETIME } from '../game/types.ts';
import type { GameMode } from '../game/types.ts';
import type { AimState } from '../game/types.ts';
import type { SerializedPlayer, SerializedBit, SerializedScatteredBit, ServerMessage } from './protocol.ts';
import type { ClientMessage } from './protocol.ts';
import type { SerializedModeState } from '../game/modes/types.ts';
import { lcgRandom } from '../game/bits.ts';

const FRICTION = 0.98;

interface InterpolatedPlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  bitCount: number;
  alive: boolean;
  invulnerable: boolean;
  color: string;
  radius: number;
  // Previous state for interpolation
  prevX: number;
  prevY: number;
  prevRotation: number;
}

interface InterpolatedBit {
  id: number;
  x: number;
  y: number;
  color: string;
  scattered: boolean;
}

interface LocalScatteredBit {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  age: number;
  lifetime: number;
}

function playerRadius(bitCount: number): number {
  return 15 + Math.sqrt(bitCount) * 3;
}

export class GameClient {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private _playerId: string | null = null;
  private _worldW = WORLD_W;
  private _worldH = WORLD_H;
  private _connected = false;
  private _welcomed = false;
  private _gameMode: GameMode = 'freeplay';
  private _modeState: SerializedModeState | null = null;

  // State interpolation
  private currentPlayers: InterpolatedPlayer[] = [];
  private currentBits: InterpolatedBit[] = [];
  private localScattered: LocalScatteredBit[] = [];
  private lastStateTime = 0;
  private stateInterval = 1 / 20; // 50ms expected interval
  private interpAlpha = 0;

  // Input sending (throttled to 20Hz)
  private lastInputSend = 0;
  private pendingLaunch = false;
  private lastAim: AimState = { aiming: false, direction: { x: 0, y: 0 }, power: 0 };
  private launchAim: { angle: number; power: number } | null = null;

  onConnected: (() => void) | null = null;
  onWelcome: (() => void) | null = null;
  onDisconnect: ((reason: string) => void) | null = null;
  onError: ((msg: string) => void) | null = null;

  get playerId(): string | null { return this._playerId; }
  get worldW(): number { return this._worldW; }
  get worldH(): number { return this._worldH; }
  get connected(): boolean { return this._connected; }
  get welcomed(): boolean { return this._welcomed; }
  get gameMode(): GameMode { return this._gameMode; }
  get modeState(): SerializedModeState | null { return this._modeState; }

  connect(roomCode: string, playerName: string): void {
    this.peer = new Peer();

    this.peer.on('open', () => {
      const hostId = 'spikio-' + roomCode.toLowerCase();
      const connection = this.peer!.connect(hostId);
      this.conn = connection;

      connection.on('open', () => {
        this._connected = true;
        const joinMsg: ClientMessage = { type: 'join', name: playerName };
        connection.send(joinMsg);
        this.onConnected?.();
      });

      connection.on('data', (data) => {
        this.handleMessage(data as ServerMessage);
      });

      connection.on('close', () => {
        this._connected = false;
        this._welcomed = false;
        this.conn = null;
        this.peer?.destroy();
        this.peer = null;
        this.onDisconnect?.('Connection closed');
      });

      connection.on('error', (err) => {
        this.onError?.(err.message);
      });
    });

    this.peer.on('error', (err) => {
      this.onError?.(err.message);
      this.disconnect();
    });
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'welcome': {
        this._playerId = msg.playerId;
        this._worldW = msg.worldW;
        this._worldH = msg.worldH;
        this._gameMode = msg.mode;
        this._welcomed = true;
        if (msg.scatteredBits) {
          this.applyScatteredSnapshot(msg.scatteredBits);
        }
        this.onWelcome?.();
        break;
      }
      case 'state': {
        this.applyState(msg.players, msg.bits);
        this._modeState = msg.modeState;
        break;
      }
      case 'scatter': {
        this.spawnLocalScatter(msg.x, msg.y, msg.count, msg.seed, msg.startId);
        break;
      }
      case 'scatter_remove': {
        const ids = new Set(msg.ids);
        this.localScattered = this.localScattered.filter(b => !ids.has(b.id));
        break;
      }
    }
  }

  private applyState(players: SerializedPlayer[], bits: SerializedBit[]): void {
    const now = performance.now() / 1000;
    if (this.lastStateTime > 0) {
      this.stateInterval = Math.min(0.2, now - this.lastStateTime);
    }
    this.lastStateTime = now;
    this.interpAlpha = 0;

    // Update players with interpolation data
    const newPlayers: InterpolatedPlayer[] = [];
    for (const sp of players) {
      const existing = this.currentPlayers.find(p => p.id === sp.id);
      newPlayers.push({
        id: sp.id,
        name: sp.name,
        x: sp.x,
        y: sp.y,
        vx: sp.vx,
        vy: sp.vy,
        rotation: sp.rotation,
        bitCount: sp.bitCount,
        alive: sp.alive,
        invulnerable: sp.invulnerable,
        color: PLAYER_COLORS[sp.color] ?? PLAYER_COLORS[0],
        radius: playerRadius(sp.bitCount),
        prevX: existing?.x ?? sp.x,
        prevY: existing?.y ?? sp.y,
        prevRotation: existing?.rotation ?? sp.rotation,
      });
    }
    this.currentPlayers = newPlayers;

    // Update bits (only arena bits from server; scattered handled locally)
    this.currentBits = bits.map(b => ({
      id: b.id,
      x: b.x,
      y: b.y,
      color: b.color,
      scattered: b.scattered,
    }));
  }

  private applyScatteredSnapshot(bits: SerializedScatteredBit[]): void {
    this.localScattered.length = 0;
    for (const b of bits) {
      this.localScattered.push({
        id: b.id,
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        color: b.color,
        age: b.age,
        lifetime: SCATTER_LIFETIME,
      });
    }
  }

  private spawnLocalScatter(px: number, py: number, count: number, seed: number, startId: number): void {
    const rng = lcgRandom(seed);
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const speed = 80 + rng() * 200;
      const colorIdx = Math.floor(rng() * PLAYER_COLORS.length);
      this.localScattered.push({
        id: startId + i,
        x: px + Math.cos(angle) * 5,
        y: py + Math.sin(angle) * 5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: PLAYER_COLORS[colorIdx],
        age: 0,
        lifetime: SCATTER_LIFETIME,
      });
    }
  }

  update(dt: number): void {
    // Advance interpolation
    if (this.stateInterval > 0) {
      this.interpAlpha = Math.min(1, this.interpAlpha + dt / this.stateInterval);
    }

    // Simulate local scattered bits
    let w = 0;
    for (let i = 0; i < this.localScattered.length; i++) {
      const b = this.localScattered[i];
      b.age += dt;
      if (b.age > b.lifetime) continue;
      const frictionDecay = Math.pow(FRICTION, dt * 60);
      b.vx *= frictionDecay;
      b.vy *= frictionDecay;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.x = Math.max(5, Math.min(WORLD_W - 5, b.x));
      b.y = Math.max(5, Math.min(WORLD_H - 5, b.y));
      this.localScattered[w++] = b;
    }
    this.localScattered.length = w;

    // Throttled input sending (20Hz)
    const now = performance.now() / 1000;
    if (now - this.lastInputSend >= 0.05) {
      this.sendInput();
      this.lastInputSend = now;
    }
  }

  setAim(aim: AimState): void {
    this.lastAim = aim;
  }

  triggerLaunch(direction: { x: number; y: number }, power: number): void {
    this.pendingLaunch = true;
    this.launchAim = {
      angle: Math.atan2(direction.y, direction.x),
      power,
    };
  }

  private sendInput(): void {
    if (!this.conn?.open || !this._welcomed) return;

    const msg: ClientMessage = {
      type: 'input',
      aim: this.pendingLaunch && this.launchAim
        ? { aiming: true, angle: this.launchAim.angle, power: this.launchAim.power }
        : this.lastAim.aiming
          ? { aiming: true, angle: Math.atan2(this.lastAim.direction.y, this.lastAim.direction.x), power: this.lastAim.power }
          : null,
      launch: this.pendingLaunch,
    };

    this.conn.send(msg);
    this.pendingLaunch = false;
    this.launchAim = null;
  }

  // Getters for rendering
  getPlayers(): InterpolatedPlayer[] {
    const alpha = this.interpAlpha;
    return this.currentPlayers.map(p => ({
      ...p,
      x: p.prevX + (p.x - p.prevX) * alpha,
      y: p.prevY + (p.y - p.prevY) * alpha,
      rotation: lerpAngle(p.prevRotation, p.rotation, alpha),
    }));
  }

  getBits(): InterpolatedBit[] {
    // Merge arena bits from server with locally simulated scattered bits
    const scattered: InterpolatedBit[] = this.localScattered.map(b => ({
      id: b.id, x: b.x, y: b.y, color: b.color, scattered: true,
    }));
    return this.currentBits.concat(scattered);
  }

  getLocalPlayer(): InterpolatedPlayer | undefined {
    if (!this._playerId) return undefined;
    const players = this.getPlayers();
    return players.find(p => p.id === this._playerId);
  }

  disconnect(): void {
    this.peer?.destroy();
    this.conn = null;
    this.peer = null;
    this._connected = false;
    this._welcomed = false;
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
