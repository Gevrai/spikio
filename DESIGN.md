# Spiky.io — Design Document

## Concept
Top-down .io game. Players are circles with a pointed tip. Movement works like a slingshot — pull back and release to launch (with nice pull back indicator). Hitting another player with your point scatters their bits. Collect bits to grow your score.

## Player
- Visual: circle with a triangular tip indicating facing direction. Triangle base is flush with the circle edge, and the point extends outward. The player should look sleek and dynamic, with a slight glow to make it visually appealing. Give them a bit of personality with subtle animations (e.g. slight bobbing or pulsing) to make them feel alive, and eyes that follow the direction they're facing, but looks the direction of future release when aim/dragging (reverse of dragging direction).
- State: position, velocity, rotation, bit count (score), alive/dead
- Starts with a small number of bits (5)

## Movement
- **Idle:** player is stationary (slight drift/friction to stop)
- **Aiming:** touch and drag backwards from the player — shows a direction line
- **Launched:** on release, player launches in the opposite direction of the drag vector. Speed is proportional to drag distance (capped)
- **Friction:** player gradually decelerates after launch

## Combat
- **Hit detection:** if a moving player's pointy end contacts another player's body, it's a hit
- **Billiard balls:** any other hits (body-to-body) cause players to bounce off each other like billiard balls, no bits lost
- **On hit:**
  - The victim loses a percentage of their bits (e.g. 50%, minimum of 10 bits)
  - Lost bits scatter outward from the victim in random directions as collectible pieces
  - Both players bounce apart
  - Brief invulnerability on the victim (~1s), but also cannot hit others during this time (flashing effect)
- **Elimination:** if a player reaches 0 bits, they completely explode into bits and respawn with a small number of bits after a short delay (e.g. 5 bits, 3s)

## Bits
- Small collectible dots on the arena
- Colorful, with a slight glow to make them stand out. They should look rewarding to collect.
- They pop and sparkle when collected, with a satisfying yet subtle 'bloop' sound effect.
- **Arena bits:** spawn randomly across the map at a steady rate, worth 1 each
- **Scattered bits:** come from hit players, worth 1 each, despawn after ~10s if uncollected
- **Collection:** player moves over a bit to collect it — no action needed

## Arena
- Fixed rectangular area with solid boundaries
- Players bounce off walls
- Constant number of arena bits maintained by server

## Scoring
- Score = current bit count
- Leaderboard shows top players in real-time

## Server authoritative, Client side prediction
- Server maintains true game state and resolves all actions
- Clients predict their own movement for smooth controls, but corrects based on server updates
- Clients should be able to react pretty fast to their own inputs and latency should be minimized for a responsive feel

## Hosting Peer-to-Peer games
- It should be possible for a person to 'host' a game on their own cellphone from the browser directly, and have other players join their game by sharing a local WAN IP.
- The server should be lightweight and able to run on a mobile device's browser without needing a separate backend infrastructure.
- The game should support up to 10 players in a single match, with smooth performance on mobile devices.
- Technology stack should be chosen to allow for easy deployment and low latency communication between peers

## Controls (Mobile)
- Touch the screen near your player, drag back, release to launch
- That's it — one gesture. No cooldown, no special abilities, just skillful aiming and timing.
