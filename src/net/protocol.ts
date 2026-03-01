// Client → Host
export type ClientMessage =
  | { type: 'input'; aim: { aiming: boolean; angle: number; power: number } | null; launch: boolean; _clientId?: string }
  | { type: 'join'; name: string; _clientId?: string };

// Host → Client
export type ServerMessage =
  | { type: 'state'; players: SerializedPlayer[]; bits: SerializedBit[] }
  | { type: 'welcome'; playerId: string; worldW: number; worldH: number }
  | { type: 'player-joined'; id: string; name: string }
  | { type: 'player-left'; id: string };

export interface SerializedPlayer {
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
  color: number; // color index
}

export interface SerializedBit {
  id: number;
  x: number;
  y: number;
  color: string;
  scattered: boolean;
}

// Internal WS relay messages (not game protocol)
export interface RelayConnected {
  type: 'connected';
  clientId: string;
}

export interface RelayRoomCreated {
  type: 'room-created';
  room: string;
  ips: string[];
}

export interface RelayClientConnected {
  type: 'client-connected';
  clientId: string;
}

export interface RelayClientDisconnected {
  type: 'client-disconnected';
  clientId: string;
}
