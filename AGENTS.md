# Spikio — Agent Setup Guide

This file documents the project setup and conventions so that any agent can quickly get productive.

## Project Setup
- **Runtime:** Node.js (LTS)
- **Package manager:** npm
- **Bundler:** Vite
- **Language:** TypeScript (strict mode)
- **Entry point:** `src/main.ts`
- **Dev server:** `npm run dev` (Vite dev server, default port 5173, bound to 0.0.0.0)
- **Build:** `npm run build` (outputs to `dist/`)

## Directory Structure
```
src/
  main.ts          — App entry, screen management, game modes (solo/host/client)
  engine/          — Game loop, canvas, input
  game/            — Game entities and logic
  net/             — Networking (PeerJS P2P multiplayer)
    protocol.ts    — Shared message types
    host.ts        — GameHost (authoritative game in host browser)
    client.ts      — GameClient (receives state, sends input)
  ui/              — Menu, HUD, renderer
    menu.ts        — Canvas-based menu system
  audio/           — Sound effects
```

## Key Conventions
- All rendering uses HTML5 Canvas 2D (no DOM manipulation for game elements)
- Mobile-first: portrait mode, touch controls, fullscreen
- Game world has fixed dimensions; camera follows local player
- Host player runs authoritative game server in-browser
- Clients connect via PeerJS (WebRTC P2P) for multiplayer

## Development Commands
```bash
npm install        # Install dependencies
npm run dev        # Start Vite dev server (bound to 0.0.0.0 for LAN access)
npm run build      # Production build
```

## Multiplayer Architecture
- **PeerJS P2P**: No server needed. Host creates a PeerJS peer with ID `spikio-{roomCode}`, clients connect directly via WebRTC DataChannel. PeerJS cloud handles signaling/STUN.
- **Host browser** runs the authoritative GameWorld at 60Hz, broadcasts state at 20Hz.
- **Client browser** sends input at 20Hz, interpolates between received states.
- Room codes are 4-character alphanumeric strings.
- Deployed to GitHub Pages — zero server infrastructure required.

## Validation
- **Always run `npm run build` after making changes** to verify there are no TypeScript or build errors before considering work complete.

## Important Notes
- Canvas scales to device pixel ratio for crisp rendering
- Touch input is the primary control method
- The game must work on mobile browsers (Chrome/Safari)
- PeerJS enables serverless P2P multiplayer via WebRTC
- Game is deployable to GitHub Pages with no backend
- All changes affecting setup (new deps, config changes, new scripts) MUST be documented here
