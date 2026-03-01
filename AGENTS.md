# Spikio — Agent Setup Guide

This file documents the project setup and conventions so that any agent can quickly get productive.

## Project Setup
- **Runtime:** Node.js (LTS)
- **Package manager:** npm
- **Bundler:** Vite
- **Language:** TypeScript (strict mode)
- **Entry point:** `src/main.ts`
- **Dev server:** `npm run dev` (Vite dev server, default port 5173, bound to 0.0.0.0)
- **WebSocket server:** `npm run server` (standalone relay server on port 3001)
- **Build:** `npm run build` (outputs to `dist/`)

## Directory Structure
```
src/
  main.ts          — App entry, screen management, game modes (solo/host/client)
  engine/          — Game loop, canvas, input
  game/            — Game entities and logic
  net/             — Networking (WebSocket-based LAN multiplayer)
    protocol.ts    — Shared message types
    host.ts        — GameHost (authoritative game in host browser)
    client.ts      — GameClient (receives state, sends input)
  ui/              — Menu, HUD, renderer
    menu.ts        — Canvas-based menu system
  audio/           — Sound effects
server/
  ws-server.ts     — Standalone WebSocket relay server (room-based)
```

## Key Conventions
- All rendering uses HTML5 Canvas 2D (no DOM manipulation for game elements)
- Mobile-first: portrait mode, touch controls, fullscreen
- Game world has fixed dimensions; camera follows local player
- Host player runs authoritative game server in-browser
- Clients connect via WebSocket relay server for LAN multiplayer

## Development Commands
```bash
npm install        # Install dependencies
npm run dev        # Start Vite dev server (bound to 0.0.0.0 for LAN access)
npm run server     # Start WebSocket relay server on port 3001
npm run dev:all    # Start both Vite and WS server concurrently
npm run build      # Production build
```

## Multiplayer Architecture
- **WebSocket relay server** (`server/ws-server.ts`): Runs on port 3001, manages rooms. Host sends state → relay broadcasts to clients. Client sends input → relay forwards to host.
- **Host browser** runs the authoritative GameWorld at 60Hz, broadcasts state at 20Hz.
- **Client browser** sends input at 20Hz, interpolates between received states for smooth rendering.
- Room codes are 4-character alphanumeric strings.
- For LAN play, all devices must be on the same network. The host screen shows the LAN IP and room code.

## Important Notes
- Canvas scales to device pixel ratio for crisp rendering
- Touch input is the primary control method
- The game must work on mobile browsers (Chrome/Safari)
- WebSocket relay server is a separate Node.js process (not a Vite plugin)
- All changes affecting setup (new deps, config changes, new scripts) MUST be documented here
