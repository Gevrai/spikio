# Spikio — Game Modes Design Document

> Synthesized from a multi-model design discussion (Claude, Gemini, GPT).

---

## Core Mechanic: Speed-from-Bits

**All modes share this new mechanic:**

- **Formula:** `speedMult = 1.0 + 2.0 * clamp(bitCount / 100, 0, 1)`
- **Range:** 1.0× at 0 bits → 3.0× at 100+ bits
- **Applies to:** MAX_SPEED cap and slingshot launch speed
- **Balance:** Bigger players are faster but have larger hitboxes and more to lose
- **Risk/Reward:** High bits = fast predator, but overshooting into hazards or being a larger target creates natural counterplay

---

## Mode Selection

The game supports multiple modes selectable from the menu:

| Mode | Type | Players | Duration |
|------|------|---------|----------|
| **Free Play** | FFA | 2-10 | Endless (current default) |
| **Last Standing** | FFA | 2-10 | 2-3 min |
| **Skull Keeper** | FFA/Teams | 2-10 | 2 min or first to 60pts |
| **King of the Hill** | Teams | 4-10 | 3 min or first to 100pts |

---

## Mode 1: Free Play (Current Default)

No changes to existing gameplay. Endless FFA with respawns. Score = current bit count.

---

## Mode 2: Last Standing (Battle Royale)

### Overview
Shrinking arena forces players into increasingly tight quarters. Last player alive wins. No respawns.

### Rules
- All players spawn with 10 bits at random positions
- **Safe zone** starts as full arena, shrinks in phases
- Players **outside** the safe zone lose bits over time (damage increases per phase)
- **No respawns** — when bits reach 0, player is eliminated
- Last player with bits > 0 wins
- If timer expires (3 min), highest bit count wins

### Zone Shrinking Schedule
| Phase | Time | Safe Zone | Damage Outside |
|-------|------|-----------|----------------|
| 1 | 0:00-0:30 | 100% | 0 (grace) |
| 2 | 0:30-1:00 | 80% | 2 bits/sec |
| 3 | 1:00-1:30 | 60% | 3 bits/sec |
| 4 | 1:30-2:00 | 40% | 5 bits/sec |
| 5 | 2:00-2:30 | 20% | 8 bits/sec |
| 6 | 2:30-3:00 | 10% | 15 bits/sec |

- Zone shrinks toward arena center
- 5-second warning before each shrink (visual + text)
- Zone boundary rendered as pulsing red circle

### Speed-from-Bits Interaction
- Fast players can reach safe zones quickly
- Large players are both predator and bigger target
- Anti-snowball: zone damage ignores speed — everyone is equally pressured

### UI
- Circular zone overlay on minimap (current + next)
- "ZONE SHRINKING IN 5s" warning text
- "ALIVE: N" counter
- Red vignette when outside zone
- Kill feed (elimination announcements)
- Winner announcement overlay

---

## Mode 3: Skull Keeper (Oddball)

### Overview
A "skull" spawns on the map. Hold it to score points over time, but you **cannot attack** while holding it. Other players hunt the carrier.

### Rules
- Skull spawns at arena center after 3-second countdown
- **Auto-pickup** on contact with skull
- **Carrier restrictions:**
  - Spike retracts (visual: no spike drawn, body collisions only cause bounce, no damage)
  - Speed capped at 1.5× regardless of bits (carrier is slower than chasers)
  - Visible to all: glowing golden aura + skull icon overhead
  - Pulsing indicator on minimap for all players
- **Scoring:** Carrier earns 1 point per second
- **On hit:** Skull drops at carrier's position, 1-second pickup immunity (prevents instant re-grab)
- **Win condition:** First to 60 points, or highest score when 2-minute timer expires

### Skull Drop & Respawn
- Dropped skull stays where it lands
- If skull goes out of bounds (wall bounce should prevent this), respawns at center
- If no one picks up skull for 10 seconds, it teleports to center with beacon effect

### Speed-from-Bits Interaction
- **Inverted incentive:** Small players make better carriers (harder to hit, closer to speed cap)
- Big players are ideal chasers (3x speed vs carrier's 1.5x cap)
- Strategy: Farm bits to become a fast hunter, or stay small to carry effectively

### UI
- Skull location arrow indicator (always visible, points to skull)
- Carrier: golden glow + skull icon + score ticker "+1/sec"
- Scoreboard: all player scores visible
- Timer at top

---

## Mode 4: King of the Hill

### Overview
Team-based zone control. Stand in the hill zone to score points for your team.

### Rules
- Players split into **Red** and **Blue** teams (auto-balanced)
- **Hill zone:** circular area (radius ~150px) at arena center
- Standing in the hill scores **1 point per second per player** in the zone
- **Contested:** If both teams have players in the hill, no one scores
- **Win condition:** First team to 100 points, or highest score at 3-minute timer

### Team Mechanics
- Team assignment: alternating join order (host picks, or auto-balance)
- **No friendly fire** (spike hits don't scatter teammate bits)
- Body collisions with teammates still apply (physics)
- Team colors override player colors: Red team = red tint, Blue team = blue tint

### Hill Visuals
- Pulsing circle on the ground
- Color changes: white (neutral/contested) → team color (controlled)
- Capture progress ring around hill border

### Speed-from-Bits Interaction
- Fast players can contest quickly but are bigger targets in the zone
- Zone favors positioning over raw speed
- Strategy: Defenders stay in zone, strikers farm bits outside and intercept enemies

### UI
- Team scores at top: "RED: 45 | BLUE: 32"
- Hill status indicator (who controls it)
- Team-colored player indicators
- Minimap with hill zone marked
- "CONTESTED!" flash when both teams present

---

## Implementation Notes

### Game Mode Infrastructure
- `GameMode` enum: `'freeplay' | 'last-standing' | 'skull' | 'koth'`
- `GameModeManager` class handles mode-specific logic (zone shrinking, skull state, hill scoring)
- Mode selection in menu (before solo/host start)
- Mode state serialized in network protocol for multiplayer
- Bots adapt behavior per mode

### Shared Types
```typescript
interface GameModeState {
  mode: GameMode;
  timer: number;
  // Last Standing
  zoneRadius?: number;
  zoneCenter?: Vec2;
  zoneDamage?: number;
  // Skull
  skullPosition?: Vec2;
  skullCarrierId?: string | null;
  skullScores?: Record<string, number>;
  // KotH
  hillCenter?: Vec2;
  hillRadius?: number;
  teamScores?: { red: number; blue: number };
  playerTeams?: Record<string, 'red' | 'blue'>;
}
```

### File Changes Required
1. `src/game/types.ts` — Add GameMode types, speed-from-bits constant
2. `src/game/player.ts` — Apply speed multiplier based on bits
3. `src/game/world.ts` — GameModeManager integration
4. `src/game/modes/` — New directory for mode implementations
5. `src/ui/menu.ts` — Mode selection UI
6. `src/ui/hud.ts` — Mode-specific HUD elements
7. `src/ui/renderer.ts` — Zone/skull/hill rendering
8. `src/net/protocol.ts` — Mode state in network messages
9. `src/net/host.ts` — Mode logic in authoritative host
10. `src/main.ts` — Mode selection flow, mode-aware update/render
