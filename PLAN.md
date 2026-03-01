# Spikio — Implementation Plan

## Status: ✅ COMPLETE

## Approach
Mobile-first .io game built with TypeScript + HTML5 Canvas + Vite. P2P networking via WebSocket relay. One player hosts (acts as authoritative server in-browser), others join via local network. Portrait mode, fullscreen, dynamic resolution.

## Tech Stack
- **Language:** TypeScript (strict)
- **Rendering:** HTML5 Canvas 2D
- **Bundler:** Vite
- **Networking:** WebSocket relay server (Node.js + ws)
- **Audio:** Web Audio API (procedural sounds)

## Architecture
```
src/
  main.ts          — Entry point, screen manager, game modes
  engine/
    game-loop.ts   — Fixed 60Hz timestep game loop
    canvas.ts      — Canvas setup, viewport, camera with shake
    input.ts       — Touch/mouse slingshot input, touch feedback
  game/
    types.ts       — Shared types, constants, Vec2 math
    world.ts       — Game world state manager
    player.ts      — Player entity (circle + spike)
    bits.ts        — Bit entities (arena + scattered)
    physics.ts     — Collisions, wall bounce
    combat.ts      — Hit detection, damage, invulnerability
  net/
    protocol.ts    — Message types for client↔host
    host.ts        — Host server logic (authoritative)
    client.ts      — Client prediction + interpolation
  ui/
    menu.ts        — Main menu (Host/Join/Solo), canvas-based
    hud.ts         — In-game HUD (score, leaderboard, minimap)
    renderer.ts    — All rendering (players, bits, effects, background)
  audio/
    sounds.ts      — Procedural sound effects (Web Audio API)
server/
  ws-server.ts     — WebSocket relay server for multiplayer
```

## Completed Tasks

### Phase 1: Foundation ✅
1. ✅ **project-setup** — Vite+TS project, HTML shell, fullscreen canvas
2. ✅ **game-loop** — Fixed 60Hz timestep game loop
3. ✅ **canvas-viewport** — Dynamic resolution, portrait mode, DPR scaling

### Phase 2: Core Game ✅
4. ✅ **player-entity** — Circle + spike + eyes, glow, bobbing animation
5. ✅ **touch-input** — Slingshot drag controls with aim indicator
6. ✅ **movement-physics** — Launch, friction, wall bounce, velocity cap
7. ✅ **bits-system** — Arena spawning, collection, scatter
8. ✅ **combat-system** — Spike hit, body bounce, invulnerability, respawn
9. ✅ **scoring-hud** — Score, leaderboard with colored dots, minimap

### Phase 3: Networking ✅
10. ✅ **net-protocol** — JSON message types for client↔host
11. ✅ **host-server** — In-browser authoritative server with bot AI
12. ✅ **signaling** — WebSocket relay server on port 3001
13. ✅ **client-prediction** — State interpolation, throttled input
14. ✅ **lobby-ui** — Host/Join/Solo menu, room code, player list

### Phase 4: Polish ✅
15. ✅ **audio-sfx** — Procedural sounds (collect, hit, launch, explode)
16. ✅ **visual-polish** — Star field, glow effects, death/spawn effects, trails, camera shake
17. ✅ **mobile-optimize** — Touch feedback, viewport meta, portrait layout, idle hints
18. ✅ **testing-fixes** — Build verification, bug fixes from code review
