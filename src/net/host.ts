import { GameWorld } from '../game/world.ts';
import { WORLD_W, WORLD_H, PLAYER_COLORS, vec2Dist, vec2Norm, vec2Sub } from '../game/types.ts';
import type { Player } from '../game/player.ts';
import type { Bit } from '../game/bits.ts';
import type {
  SerializedPlayer, SerializedBit, ClientMessage,
  ServerMessage, RelayRoomCreated, RelayClientConnected, RelayClientDisconnected,
} from './protocol.ts';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

interface RemotePlayer {
  clientId: string;
  playerId: string;
  name: string;
  pendingLaunch: { dirX: number; dirY: number; power: number } | null;
}

interface BotState {
  aimTimer: number;
}

export class GameHost {
  world: GameWorld;
  roomCode: string;
  lanIPs: string[] = [];

  private ws: WebSocket | null = null;
  private remotePlayers = new Map<string, RemotePlayer>();
  private hostPlayer: Player;
  private hostPlayerId: string;
  private botNames = ['Spike', 'Pointy', 'Zippy', 'Stabby', 'Pricky'];
  private botStates = new Map<string, BotState>();
  private tickCount = 0;
  private connected = false;
  private _playerList: { id: string; name: string }[] = [];

  onPlayersChanged: (() => void) | null = null;
  onConnected: (() => void) | null = null;
  onError: ((msg: string) => void) | null = null;

  constructor(hostName: string) {
    this.roomCode = generateRoomCode();
    this.world = new GameWorld();
    this.hostPlayerId = 'host-' + hostName;
    this.hostPlayer = this.world.addPlayer(this.hostPlayerId);

    // Add bots
    for (const name of this.botNames) {
      this.world.addPlayer(name);
      this.botStates.set(name, { aimTimer: 1 + Math.random() * 2 });
    }

    this.updatePlayerList();
  }

  get localPlayer(): Player {
    return this.hostPlayer;
  }

  get playerList(): { id: string; name: string }[] {
    return this._playerList;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  connect(wsUrl: string): void {
    const url = `${wsUrl}?role=host&room=${this.roomCode}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected = true;
      this.onConnected?.();
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        this.handleMessage(msg);
      } catch { /* ignore parse errors */ }
    };

    this.ws.onclose = () => {
      this.connected = false;
    };

    this.ws.onerror = () => {
      this.onError?.('WebSocket connection failed');
    };
  }

  private handleMessage(msg: ClientMessage | RelayRoomCreated | RelayClientConnected | RelayClientDisconnected): void {
    if (msg.type === 'room-created') {
      const relay = msg as RelayRoomCreated;
      this.lanIPs = relay.ips;
      return;
    }

    if (msg.type === 'client-connected') {
      // Client socket connected, wait for join message
      return;
    }

    if (msg.type === 'client-disconnected') {
      const relay = msg as RelayClientDisconnected;
      this.removeRemotePlayer(relay.clientId);
      return;
    }

    const clientMsg = msg as ClientMessage & { _clientId?: string };
    const clientId = clientMsg._clientId;
    if (!clientId) return;

    if (clientMsg.type === 'join') {
      this.addRemotePlayer(clientId, clientMsg.name);
      return;
    }

    if (clientMsg.type === 'input') {
      const remote = this.remotePlayers.get(clientId);
      if (!remote) return;

      if (clientMsg.launch && clientMsg.aim) {
        const angle = clientMsg.aim.angle;
        remote.pendingLaunch = {
          dirX: Math.cos(angle),
          dirY: Math.sin(angle),
          power: clientMsg.aim.power,
        };
      }
    }
  }

  private addRemotePlayer(clientId: string, name: string): void {
    const playerId = `remote-${clientId}-${name}`;
    this.world.addPlayer(playerId);

    const remote: RemotePlayer = { clientId, playerId, name, pendingLaunch: null };
    this.remotePlayers.set(clientId, remote);

    // Send welcome
    const welcome: ServerMessage = {
      type: 'welcome',
      playerId,
      worldW: WORLD_W,
      worldH: WORLD_H,
    };
    this.sendToClient(clientId, welcome);

    // Broadcast player joined
    const joined: ServerMessage = { type: 'player-joined', id: playerId, name };
    this.broadcast(joined);

    // Remove a bot if we have remote players
    this.adjustBots();
    this.updatePlayerList();
  }

  private removeRemotePlayer(clientId: string): void {
    const remote = this.remotePlayers.get(clientId);
    if (!remote) return;

    this.world.removePlayer(remote.playerId);
    this.remotePlayers.delete(clientId);

    const left: ServerMessage = { type: 'player-left', id: remote.playerId };
    this.broadcast(left);

    this.adjustBots();
    this.updatePlayerList();
  }

  private adjustBots(): void {
    const totalReal = 1 + this.remotePlayers.size; // host + remotes
    const desiredBots = Math.max(0, 6 - totalReal);

    // Remove excess bots
    const currentBots = this.botNames.filter(n => this.world.players.has(n));
    while (currentBots.length > desiredBots) {
      const name = currentBots.pop()!;
      this.world.removePlayer(name);
      this.botStates.delete(name);
    }

    // Add bots if needed
    for (const name of this.botNames) {
      if (this.world.players.has(name)) continue;
      const activeBots = this.botNames.filter(n => this.world.players.has(n)).length;
      if (activeBots >= desiredBots) break;
      this.world.addPlayer(name);
      this.botStates.set(name, { aimTimer: 1 + Math.random() * 2 });
    }
  }

  private updatePlayerList(): void {
    this._playerList = [
      { id: this.hostPlayerId, name: this.hostPlayerId.replace('host-', '') },
      ...[...this.remotePlayers.values()].map(r => ({ id: r.playerId, name: r.name })),
    ];
    this.onPlayersChanged?.();
  }

  update(dt: number): void {
    // Apply remote player inputs
    for (const remote of this.remotePlayers.values()) {
      const player = this.world.players.get(remote.playerId);
      if (!player || !player.alive) continue;
      if (remote.pendingLaunch) {
        player.launch(remote.pendingLaunch.dirX, remote.pendingLaunch.dirY, remote.pendingLaunch.power);
        remote.pendingLaunch = null;
      }
    }

    // Bot AI
    this.updateBotAI(dt);

    // World tick
    this.world.update(dt);

    // Broadcast state at 20Hz (every 3rd tick at 60Hz)
    this.tickCount++;
    if (this.tickCount % 3 === 0) {
      this.broadcastState();
    }
  }

  private updateBotAI(dt: number): void {
    const allPlayers = [...this.world.players.values()];
    for (const [name, state] of this.botStates) {
      const bot = this.world.players.get(name);
      if (!bot || !bot.alive) continue;

      state.aimTimer -= dt;
      if (state.aimTimer <= 0) {
        let target: { x: number; y: number } | null = null;

        // Try targeting nearest enemy
        const enemy = this.findNearest(bot, allPlayers);
        const bit = this.findNearestBit(bot, this.world.bitsManager.bits);

        if (enemy && vec2Dist(bot.position, enemy.position) < 250 && Math.random() < 0.6) {
          target = { x: enemy.position.x, y: enemy.position.y };
        } else if (bit) {
          target = { x: bit.position.x, y: bit.position.y };
        }

        if (target) {
          const dir = vec2Norm(vec2Sub(target, bot.position));
          bot.launch(dir.x, dir.y, 0.4 + Math.random() * 0.6);
        }

        state.aimTimer = 0.8 + Math.random() * 1.5;
      }
    }
  }

  private findNearest(player: Player, players: Player[]): Player | null {
    let best: Player | null = null;
    let bestDist = Infinity;
    for (const other of players) {
      if (other.id === player.id || !other.alive) continue;
      const d = vec2Dist(player.position, other.position);
      if (d < bestDist) { bestDist = d; best = other; }
    }
    return best;
  }

  private findNearestBit(player: Player, bits: Bit[]): Bit | null {
    let best: Bit | null = null;
    let bestDist = Infinity;
    for (const bit of bits) {
      const d = vec2Dist(player.position, bit.position);
      if (d < bestDist) { bestDist = d; best = bit; }
    }
    return best;
  }

  private serializePlayers(): SerializedPlayer[] {
    const result: SerializedPlayer[] = [];
    for (const p of this.world.players.values()) {
      result.push({
        id: p.id,
        name: this.getPlayerName(p.id),
        x: Math.round(p.position.x * 10) / 10,
        y: Math.round(p.position.y * 10) / 10,
        vx: Math.round(p.velocity.x * 10) / 10,
        vy: Math.round(p.velocity.y * 10) / 10,
        rotation: Math.round(p.rotation * 100) / 100,
        bitCount: p.bitCount,
        alive: p.alive,
        invulnerable: p.isInvulnerable,
        color: PLAYER_COLORS.indexOf(p.color),
      });
    }
    return result;
  }

  private serializeBits(): SerializedBit[] {
    return this.world.bitsManager.bits.map(b => ({
      id: b.id,
      x: Math.round(b.position.x),
      y: Math.round(b.position.y),
      color: b.color,
      scattered: b.scattered,
    }));
  }

  private getPlayerName(id: string): string {
    if (id === this.hostPlayerId) return this.hostPlayerId.replace('host-', '');
    for (const r of this.remotePlayers.values()) {
      if (r.playerId === id) return r.name;
    }
    return id; // bot name
  }

  private broadcastState(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg: ServerMessage = {
      type: 'state',
      players: this.serializePlayers(),
      bits: this.serializeBits(),
    };
    this.broadcast(msg);
  }

  private broadcast(msg: ServerMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  private sendToClient(clientId: string, msg: ServerMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const envelope = { ...msg, _targetClientId: clientId };
    this.ws.send(JSON.stringify(envelope));
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}
