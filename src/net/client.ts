import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { PLAYER_COLORS, WORLD_W, WORLD_H } from '../game/types.ts';
import type { GameMode } from '../game/types.ts';
import type { AimState } from '../game/types.ts';
import type { SerializedPlayer, SerializedBit, ServerMessage } from './protocol.ts';
import type { ClientMessage } from './protocol.ts';
import type { SerializedModeState } from '../game/modes/types.ts';

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
        this.onWelcome?.();
        break;
      }
      case 'state': {
        this.applyState(msg.players, msg.bits);
        this._modeState = msg.modeState;
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

    // Update bits
    this.currentBits = bits.map(b => ({
      id: b.id,
      x: b.x,
      y: b.y,
      color: b.color,
      scattered: b.scattered,
    }));
  }

  update(dt: number): void {
    // Advance interpolation
    if (this.stateInterval > 0) {
      this.interpAlpha = Math.min(1, this.interpAlpha + dt / this.stateInterval);
    }

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
    return this.currentBits;
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
