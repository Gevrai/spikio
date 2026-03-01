import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { networkInterfaces } from 'os';
import { parse } from 'url';

const PORT = 3001;

interface Room {
  code: string;
  host: WebSocket;
  clients: Map<string, WebSocket>;
  nextClientId: number;
}

const rooms = new Map<string, Room>();
const socketToRoom = new Map<WebSocket, { room: Room; role: 'host' | 'client'; clientId?: string }>();

function getLanIPs(): string[] {
  const ips: string[] = [];
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

const server = createServer((_req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify({ ips: getLanIPs() }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const params = parse(req.url ?? '', true).query;
  const role = params.role as string;
  const roomCode = (params.room as string)?.toUpperCase();

  if (!role || !roomCode) {
    ws.close(4000, 'Missing role or room');
    return;
  }

  if (role === 'host') {
    if (rooms.has(roomCode)) {
      ws.close(4001, 'Room already exists');
      return;
    }
    const room: Room = { code: roomCode, host: ws, clients: new Map(), nextClientId: 1 };
    rooms.set(roomCode, room);
    socketToRoom.set(ws, { room, role: 'host' });
    ws.send(JSON.stringify({ type: 'room-created', room: roomCode, ips: getLanIPs() }));
  } else if (role === 'client') {
    const room = rooms.get(roomCode);
    if (!room) {
      ws.close(4002, 'Room not found');
      return;
    }
    const clientId = `c${room.nextClientId++}`;
    room.clients.set(clientId, ws);
    socketToRoom.set(ws, { room, role: 'client', clientId });
    // Notify host that a new socket connected
    room.host.send(JSON.stringify({ type: 'client-connected', clientId }));
    ws.send(JSON.stringify({ type: 'connected', clientId }));
  } else {
    ws.close(4003, 'Invalid role');
    return;
  }

  ws.on('message', (data) => {
    const info = socketToRoom.get(ws);
    if (!info) return;
    const msg = data.toString();

    if (info.role === 'host') {
      // Check if message is targeted to a specific client
      try {
        const parsed = JSON.parse(msg);
        if (parsed._targetClientId) {
          const targetClient = info.room.clients.get(parsed._targetClientId);
          if (targetClient && targetClient.readyState === WebSocket.OPEN) {
            delete parsed._targetClientId;
            targetClient.send(JSON.stringify(parsed));
          }
          return;
        }
      } catch { /* not JSON or no target, broadcast */ }

      // Broadcast from host to all clients
      for (const client of info.room.clients.values()) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      }
    } else if (info.role === 'client') {
      // Forward client message to host, tagged with clientId
      if (info.room.host.readyState === WebSocket.OPEN) {
        try {
          const parsed = JSON.parse(msg);
          parsed._clientId = info.clientId;
          info.room.host.send(JSON.stringify(parsed));
        } catch {
          info.room.host.send(msg);
        }
      }
    }
  });

  ws.on('close', () => {
    const info = socketToRoom.get(ws);
    if (!info) return;
    socketToRoom.delete(ws);

    if (info.role === 'host') {
      // Close all clients in room
      for (const client of info.room.clients.values()) {
        client.close(4004, 'Host disconnected');
      }
      rooms.delete(info.room.code);
    } else if (info.role === 'client' && info.clientId) {
      info.room.clients.delete(info.clientId);
      // Notify host
      if (info.room.host.readyState === WebSocket.OPEN) {
        info.room.host.send(JSON.stringify({ type: 'client-disconnected', clientId: info.clientId }));
      }
    }
  });

  ws.on('error', () => {
    ws.close();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLanIPs();
  console.log(`WebSocket server running on port ${PORT}`);
  console.log(`LAN IPs: ${ips.join(', ') || 'none detected'}`);
});
