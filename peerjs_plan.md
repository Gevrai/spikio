# Plan: Migrate to PeerJS P2P + GitHub Pages Deployment

## Context
Spikio currently requires a WebSocket relay server (`server/ws-server.ts`) for multiplayer. This prevents static hosting. We'll replace it with PeerJS (WebRTC P2P) so the game can be deployed to GitHub Pages with zero server infrastructure. Host browser creates a PeerJS peer, clients connect directly via WebRTC DataChannel. PeerJS's free cloud handles signaling/STUN automatically.

## Steps

### 1. Update dependencies
- `npm install peerjs && npm uninstall ws @types/ws concurrently tsx`
- Clean up `package.json` scripts: remove `server`, `dev:all`

### 2. Update `src/net/protocol.ts`
- Remove relay-specific types: `RelayConnected`, `RelayRoomCreated`, `RelayClientConnected`, `RelayClientDisconnected`
- Remove `_clientId` field from `ClientMessage` (PeerJS connections are per-client)

### 3. Rewrite `src/net/host.ts`
- Replace WebSocket with PeerJS `Peer` + `Map<string, DataConnection>`
- Peer ID = `'spikio-' + roomCode.toLowerCase()`
- `connect()` takes no args — creates Peer, listens for incoming connections
- `broadcast()` iterates all DataConnections
- `sendToClient()` looks up connection by ID
- Remove `lanIPs` property entirely
- Handle `peer.on('connection')` for new clients, `conn.on('data')` for messages

### 4. Rewrite `src/net/client.ts`
- Replace WebSocket with PeerJS `Peer` + `DataConnection`
- `connect(roomCode, playerName)` — no IP/URL needed
- Creates anonymous Peer, connects to `'spikio-' + roomCode.toLowerCase()`
- Sends/receives via `conn.send()` / `conn.on('data')`

### 5. Update `src/main.ts`
- `showHostScreen()`: remove WS URL construction, call `gameHost.connect()` with no args, remove LAN IP polling
- `connectToHost()`: remove IP from input values, call `gameClient.connect(room, name)`
- `goBackToMain()`: remove `lanIPs` references

### 6. Update `src/ui/menu.ts`
- Remove `lanIPs` from `MenuState`
- `showJoinInputs()`: remove IP input field entirely
- `getJoinInputValues()`: return `{ room, name }` only
- `renderHostScreen()`: remove LAN IP display section
- Update join screen instruction text

### 7. Delete `server/` directory

### 8. Create `vite.config.ts`
```ts
import { defineConfig } from 'vite';
export default defineConfig({ base: '/spikio/' });
```

### 9. Create `.github/workflows/deploy.yml`
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```
*Requires enabling GitHub Pages → Source: "GitHub Actions" in repo settings.*

### 10. Update `AGENTS.md`
- Remove all WebSocket relay server references
- Remove `server/` from directory structure
- Document PeerJS P2P architecture
- Remove `npm run server` / `npm run dev:all`
- Add GitHub Pages deployment notes

## Verification
1. `npm run build` — no TypeScript or build errors
2. `npm run dev` — start local dev server
3. Open two browser tabs, host a game in one, join with room code in other
4. Verify gameplay works (input, state sync, bots)
5. Push to GitHub, verify Pages deployment succeeds
