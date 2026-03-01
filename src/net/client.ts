import { PLAYER_COLORS, WORLD_W, WORLD_H } from '../game/types.ts';
import type { AimState } from '../game/types.ts';
import type { SerializedPlayer, SerializedBit, ServerMessage } from './protocol.ts';
import type { ClientMessage } from './protocol.ts';

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
  private ws: WebSocket | null = null;
  private _playerId: string | null = null;
  private _worldW = WORLD_W;
  private _worldH = WORLD_H;
  private _connected = false;
  private _welcomed = false;

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

  connect(wsUrl: string, roomCode: string, playerName: string): void {
    const url = `${wsUrl}?role=client&room=${roomCode.toUpperCase()}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this._connected = true;
      // Send join message
      const joinMsg: ClientMessage = { type: 'join', name: playerName };
      this.ws!.send(JSON.stringify(joinMsg));
      this.onConnected?.();
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as ServerMessage & { type: string; clientId?: string };
        this.handleMessage(msg);
      } catch { /* ignore */ }
    };

    this.ws.onclose = (ev) => {
      this._connected = false;
      this._welcomed = false;
      this.onDisconnect?.(ev.reason || 'Connection closed');
    };

    this.ws.onerror = () => {
      this.onError?.('Connection failed');
    };
  }

  private handleMessage(msg: ServerMessage & { type: string }): void {
    switch (msg.type) {
      case 'welcome': {
        if (msg.type !== 'welcome') break;
        const w = msg as ServerMessage & { type: 'welcome' };
        this._playerId = w.playerId;
        this._worldW = w.worldW;
        this._worldH = w.worldH;
        this._welcomed = true;
        this.onWelcome?.();
        break;
      }
      case 'state': {
        if (msg.type !== 'state') break;
        const s = msg as ServerMessage & { type: 'state' };
        this.applyState(s.players, s.bits);
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
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this._welcomed) return;

    const msg: ClientMessage = {
      type: 'input',
      aim: this.pendingLaunch && this.launchAim
        ? { aiming: true, angle: this.launchAim.angle, power: this.launchAim.power }
        : this.lastAim.aiming
          ? { aiming: true, angle: Math.atan2(this.lastAim.direction.y, this.lastAim.direction.x), power: this.lastAim.power }
          : null,
      launch: this.pendingLaunch,
    };

    this.ws.send(JSON.stringify(msg));
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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
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
