# Telegraph and radio (src/game/telegraph.ts)

Wire places together with telegraph poles, read the wire at a telegraph office, and in the Current Age skip the poles
with a powered radio mast. Content is the area `src/content/areas/telegraph.ts` (textures `src/render/textures/areas/telegraph.ts`).

## Blocks
| key | age | recipe (furnace) | role |
|---|---|---|---|
| telegraph_pole | Bronze | tier 2, 600 C: 2 oak_log, 2 copper_wire, 1 glass -> 4 | fence-shaped post; its line reaches every node within `TELEGRAPH_SPAN` (12) blocks. Stack poles for a taller post: only the top carries lines |
| telegraph_office | Bronze | tier 2, 800 C: 4 plank, 4 copper_wire, 2 bronze_plate | oriented desk; Use opens the Telegraph screen; front lamp lit (active bit) while it signals |
| radio_mast | Current | tier 4, 1200 C: 4 steel_plate, 2 copper_coil, 1 circuit | fence-shaped; on air while what touches it (a cable or device) is on a grid with at least `RADIO_MIN_W` (100) of generation + discharge, or charge in storage. Links every powered mast within `RADIO_RANGE` (160). The mast's draw is not billed to the grid yet |

## Networks
- Nodes are tracked from `block:changed` and saved as the world extra `telegraph` (`{ v: 1, nodes, log, warned, caravanDay }`); a chunk that loads drops saved nodes that are no longer there. Nodes in unloaded chunks stay on the line.
- Wired links are a spanning tree over pairs within the span (shortest first): it decides both the networks and the lines the renderer draws (`src/render/telegraphWires.ts`, sagging `LineSegments`, rebuilt when `Telegraph.version` changes). Radio links join networks but draw nothing.
- A network **reaches the town** when a member stands within `TOWN_REACH` (24) blocks of `NpcManager.at` (the camp or tavern origin).

## What the wire does
- **Storm warnings:** a network with an office hears the next storm on the seed's timetable `STORM_WIRE_S` (600 s) ahead, `RADIO_STORM_S` (1200 s) with a powered mast. One telegram per storm ("Storm due in about N min. Cover exposed wiring and raise a lightning rod."), which is the counterplay for the storm hazard in docs/api/disasters.md.
- **Town news:** a line that reaches the town gets a telegram on each caravan day. The screen shows the next caravan's day and what its carts will carry (`caravanStock(nextCaravanDay)`), and while it is in, **Order by wire** opens the caravan screen from the office.
- **Signals** (docs/api/mechanics.md, `Workshop.signals`): each office has a mode, picked on the screen. *Storm bell* (default) lights while a storm is due or overhead. *Sender* reads any lit signal cell touching the office. *Receiver* lights while any sender on its network is lit. A lit office seeds the signal layer at its own cell (`Workshop.signal`), so wire, lamps and bells touching it light.
- Telegrams are toasts prefixed `Telegram:`, also kept (last 8) in the screen's Telegrams list.

## Wiring
`GameState.telegraph` (ticked after the disasters; host = weather, clock, `npcs.at`, `sim.networkAt` round the mast, workshop signals, `caravanHere`).
Screen request `{ type: 'telegraph', x, y, z }` (`src/ui/screens/telegraph/telegraphScreen.ts`), opened from the app's `beforeUse`.
Debug: `window.__hw.telegraph(x?, y?, z?)` (nodes, lines, wire points, a node's view, storm and busy) and `window.__hw.skipToStorm(leadS)`.
Tests: `src/game/telegraph.test.ts`.
