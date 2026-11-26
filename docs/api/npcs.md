# The starting tavern and its people (src/npcs, src/render/npcs)

> Second pass (the 'living tavern'): six people (Veyra the alchemist joined later, see the end), a quest board with coin bounties, Old Bram's shop, Gruk for hire, a wall clock, two tended fires, and about 540 hand-written phrases. The first-pass text below is still true for the base mechanics; this block lists what changed.
>
> - **People:** Mara (witch: magic advice from the notebook's next open entry), Rosa (barkeep: brewing goals), Orrin (artificer: the current progression goal's title and text, the tech ladder; gives a wrench), Gruk (orc smith, 1.35x big, hireable), Old Bram (hermit in the yard lean-to). Mara and Rosa are drawn as clearly feminine adult women (lashes, lips, earrings, hair volume, narrow waist over a flared skirt); Gruk is broad; sprites are 24 x 40 px, props their own size.
> - **Coin** is a counter on the NpcManager (saved), not an item. **Quest board** (a prop by the door): Use pays a coin bounty (`BOUNTIES`, one per progression goal, `8 + 6 x age`, +40 for furnace milestones) for every goal you have finished and not yet redeemed (you must come to the board) and lists the next three open bounties. **Old Bram**: Use with an item in hand sells the whole stack (`priceOf`: by category and age, tools +3 per tier, his mood 0.7-1.4); he never runs out of coin, and rarely says so (the running joke, 'Bet you wonder how I'm still a bum with all this coin.... Anyways...'). **Gruk for hire**: Use twice (offer, then accept within 10 s) for 40 coin to have him follow you and hit the nearest hostile near you for 8 minutes (`Companion`, 7 damage a second, leaves when you die).
> - **Scripts** (`src/npcs/scripts/*.ts`, `PhraseBank`: greet, idle, morning, evening, night, rare, farewell, hints by goal): witch, barkeep, orc, artificer, hermit; `LinePicker` draws by time of day, rarely a rare line, never one said in the last 14. Odd visits give the goal hint (once) or the specialist's advice, even visits give chatter.
> - **Clock and fires:** the wall clock is a prop sprite repainted each minute (dawn = 06:00; Use for a toast); the hall fireplace and Bram's fire are kept burning (`tendFire`, every 8 s). Tests: `src/npcs/npcs.test.ts`; e2e: `scripts/e2e-tavern.mjs`.

**Phase 1 of `docs/plans/just-you-and-orrin.md` (shipped): a new world opens at a camp, not in the tavern.** `camp.ts` finds a flat,
buildable patch near the spawn (`pickCampSite`: relief up to 1, else up to 3, else the spawn's own ground; never water or lava) and
`buildCamp` places Gruk's cart (a plank bed on log posts with log wheels), a lit campfire (a clay furnace in a stone ring, tended like the
hall's fire) and two bedrolls (`wool_bedding`). The camp is 9 x 5 with its floor at the origin, and the player starts at `CAMP_START`,
which is also the spawn point, so a respawn lands there. **Only Gruk lives in a new world** (`BUILDER_ID`, the builder who also gives
the wooden tools on first talk). He walks the camp's routines (`CAMP_ROUTINES`, camp-local). The others are not drawn, not ticked and
not talkable, and Orrin is a later newcomer. Old saves keep the tavern and all six people; `settle` (the debug helper
`window.__hw.settle()`, `NpcManager.settle`) builds the full tavern on the camp's origin and moves everyone in, and is what the tavern
tests and e2e use (`src/npcs/settledWorld.ts`).

**Who lives here** is `NpcManager.isPresent(id)`, saved as `present` (optional: old saves have everyone). `camp` (also optional) marks
a camp in place of the tavern, and `hasTavern` is `!camp`. While a person is absent: their routine and drawing are off, Use on them says
nothing (`speak` returns ''), their service menu is empty (`serviceMenu`), favours for them are not pinned (`FavourBoard.refresh` takes
a `canAsk`), gossip needs two present people, Rosa's bar does not sell or collect rent, the festival needs three present (and the
tavern), the trader does not visit without the tavern, and the jukebox and party button need the tavern. `advice(role)` for an absent
specialist gives the builder's general advice (the current goal, as the artificer gives it).

Originally (the first pass), every NEW world opened inside **the Hearth & Anvil tavern**, built round the spawn point, with three adult pixel-sprite NPCs:
**Mara** (hedge witch, violet hat and dress, gives a Field Notebook), **Rosa** (barkeep behind the bar, auburn ponytail, gives a
Hearth Stew) and **Gruk** (orc smith, green, tusked, gives a wooden pickaxe and axe). Use on one talks: the first time they give their
welcome gift; then each says a hint tied to the current goal once (`NpcDef.byGoal`, keyed by objective id), then rotating lines about the
artificer's road. Lines show as toasts (`Name, title: "..."`). Old worlds are not touched (no tavern, no people).

## Code
- `data.ts`: `NPCS` (id, name, title, sprite, tavern-local position, gift, `byGoal`, `lines`). Add a person there.
- `tavern.ts`: `layoutBlocks()` is the pure 13 x 9 x 5 layout (stone-brick footing, oak corners and beams, plank walls and roof, glass windows,
  door gap in the north wall, plank bar with stools, crate shelves, torches, a clay-furnace fireplace with brick chimney, workbench,
  two tables); `buildTavern(world, ox, oy, oz)` flattens a one-block margin, clears the air above and places it (source `'sim'`).
  `TAVERN_START` = [6, 1, 2]: the world spawn is put on that cell, so a respawn lands in the hall.
- `manager.ts`: `NpcManager` (owned by `GameState.npcs`, saved with `world.persist('npcs')`: origin, greeted, gifted, hints heard, `present`,
  `camp`). `startCamp` (a new world), `settle` (camp to tavern), `buildStart` (a full tavern, everyone present), `views()`, `raycast`
  (box 0.76 x 2.0, reach 3.4, no occlusion by blocks), `talk` (0.8 s cooldown so a held Use does not read the script), `speak`, `greet`
  (the welcome toast, once), `tick`.
- `GameState.create` calls `startInCamp()` (falls back to the old open-view start when no ground is loaded); the player faces south.
  `GameState.settleNpcs()` is the settle skip. `nav.ts` has a camp grid next to the tavern's (`camp` flag).
- `PlayerController` option `talk(ox, oy, oz, dx, dy, dz)`: Use on a person consumes the Use (like the collectors).
- `src/render/npcs/sprites.ts` draws the 24 x 40 sprites procedurally (`paintNpc`), `npcRenderer.ts` shows them as camera-facing `THREE.Sprite`s
  (nearest filtering, idle bob, dimmed with the sky: `clock.sunlight()`).

## Tests
`npx vitest run src/npcs` (layout, talk, gifts, save round trip, sprites, a new world opens in the hall) and `node scripts/e2e-tavern.mjs`
(desktop and phone portrait: opens in the tavern, uses each person and checks the gift and the toast; `HW_GPU=1` for the real GPU).

## Ideas for later
Shop/trade with Rosa, a quest board, recruiting Gruk as a smith at the Bronze Furnace, Mara teaching research entries, walking schedules and
night-time seating, more people in the structures session's outposts.

## Jukebox and dancing

A `jukebox` prop (tavern-local 8.5, 1, 1.6) toggles with Use. While on, `NpcManager.tick` plays `src/npcs/jukebox.ts`'s 48-beat tune (0.25 s a beat) as pitched `jukebox_note` sfx (positional, bass every 4th beat). `NpcView.dancing` is true for Mara, Rosa, Orrin and Bram (never Gruk) and `NpcView.danceS` is the seconds since the music started.

`src/npcs/choreo.ts` turns that into a 60-second choreography of 15 moves (bounce, sway, hip swing, shimmy, twirl, slide, jump, dip, step touch, pop, conga, wave, stomp, spin pop, finale) that loops seamlessly (`dancePose(id, danceS)` repeats exactly every 60 s, five loops of the tune). Each dancer starts at a different move and has their own size and hip swing. The pictures are the owner's blueprint art, never redrawn: `NpcRenderer` draws every person as a camera-facing plane cut into 12 rows and bends it (lean, S-curve), squashes, hops, slides and turns it by the pose. Props stay plain sprites. Saved as `juke` in the npcs snapshot.

## Art density

`loadNpcArt(manifest, scales)` brings every generated image to `SPRITE_PX` (96) rows per 2 blocks times the character's scale, so all characters have the same pixels per block (Gruk, scale 1.35, gets 130 rows).

## Expressions (talking faces)

Each person has `assets/npcs/<id>_faces.jpg`: six head-and-shoulders cells (neutral, happy, laughing, surprised, annoyed, sly). They are the owner's blueprint art with the changes written cell by cell: `assets/npcs/faces/cells.py` reads a face region as a grid of cells (the art's own block size) and lays a hand-written character grid over it (`.` keep, `~` re-fill the skin by smoothing from the untouched neighbours so the shading gradient continues, `^ v # 2` copy cells up or down to lift brows, stretch eyes or drop Gruk's whole jaw with his tusks and teeth, any other letter is a colour from that character's legend). `bram.py`, `orrin.py`, `gruk.py`, `mara.py` and `rosa.py` hold each person's grids and their notes on where the eyes, brows and mouth sit (Gruk's mouth is his teeth and tusks, Orrin's the sliver under his moustache). `build.py` crops and packs the sheets (`python assets/npcs/faces/build.py`, then `node scripts/npc-art.mjs`). `src/npcs/mood.ts` `faceOf(text)` reads a line's words and the dialogue box (`src/ui/hud/npcDialogue.ts`) shows that cell; with no sheet it falls back to the sprite crop or the code-drawn portrait.

## Dance poses and after-images

`assets/npcs/<id>_dance.png` (Mara, Rosa, Orrin, Bram; Gruk does not dance) holds five frames: 0 standing, 1-4 poses. `assets/npcs/faces/poses.py` makes them from the blueprint with a dancing face (happy or laughing, eyes closed), cuts limbs, props, skirts and hair along hand-placed outlines and swings or shears them about their joints (Orrin's arms up, Rosa's cheers and flung arm, kicks, swinging skirts, braids and ponytail, Bram's staff, purse and jig); what a moved part uncovers is refilled from the torso's mirror side, the cloth it hung over, or background. `src/npcs/choreo.ts` `danceFrame(id, danceS)` picks the frame per beat (a pattern per move, looping with the minute), and `NpcRenderer` swaps the body's texture to the atlas while dancing, scaling it by the standing body's share of the cell (`npcDanceBodyFrac`). Two purple, fading after-images trail each dancer a beat behind (earlier pose and frame, drawn just behind the body).

## Routines and friendship
- `routines.ts`: `ROUTINES` (per person, a tavern-local spot for morning / day / evening / night, all free air over plank or dirt,
  checked by tests), `spotFor`, `walk`. The manager walks everyone toward the spot for the part of the day at `WALK_SPEED` (1.1 b/s);
  with the jukebox on the dancers walk to `DANCE_SPOTS` in front of it (Gruk stays), and the hired orc follows you.
- `friendship.ts`: trust 0..100 per person (`NpcManager.trustOf`), saved. Use with a `LIKES` item in hand gives one (a gift a day per
  person, +`GIFT_TRUST` 8; Old Bram still buys on a second gift). Tiers at `TIERS` (20, 50, 80) pay `REWARDS` once and open
  `FRIEND_LINES` (one visit in three). At trust 50 Gruk's hire fee is a quarter less (`hireCost()`).
- `nav.ts`: `walkable(x, z)` (floor and two free blocks, read from the layout), `nearestCell`, `findPath(from, to)` (BFS over cells,
  diagonals never cut a corner). The manager plans a route whenever a person's goal changes and walks it cell to cell, so they go
  round the bar through its end gaps and out to the yard through the back door instead of through walls.
- Old Bram sells back what you sold him (`shelf`, last six sales, saved): Use with an empty hand names the newest and its price (what he
  paid), a second Use within 10 s buys it back.

## The expanded tavern (tavern.ts)
- Upper floor (`TAVERN_H` 5 up to `TAVERN_TOP` 10): stair blocks on plank columns up the west wall (x = 1, five cells, z 5 -> 1, ending level with the
  upper floor; the floor above is opened over z 2-4 for head room) reach a walkway along z = 4. The hall ceiling is open over x 4-10, z 1-2 (the balcony
  overlooks the door, the dance floor and the front of the bar) behind a railing on the ledge at z = 3 and at x = 3. Doors at x 3 and 9 lead
  to two bedrooms (x 1-4 and 8-11, z 6-7) with wool pallets, chests and torches.
- Secret closet: a 1 x 2 x 2 closet inside a three-block wall between the bedrooms, sealed by two blocks of red brick in the wall
  facing the walkway (mine them out).
- Cellar (`BASEMENT_DEPTH` 4 below the hall floor): reached from the yard by a stairwell of four steps down along x = 11 (z 12 -> 9) and a
  doorway in the cellar's south wall. Casks, a bench, pillars and torches. A false wall of two brick blocks at x = 6 in the cellar's south wall
  hides a vault under the yard (crates, a table).
- Tests in `npcs.test.ts` (`the upper floor, the cellar and the secret rooms`) flood-fill the layout on foot (steps up one block, drops of
  two) to prove each room is reachable and the two secret rooms are sealed until their brick is mined. `scripts/e2e-tavern-rooms.mjs`
  takes screenshots of each.
## Tavern life (rooms, drinks, gossip, favours, sparring, upkeep, festival)

Seven small systems built on the tavern's people. Each is a pure module in `src/npcs/` with a unit test; `NpcManager` owns the state and saves it in the npcs snapshot (every field optional, old saves load).

### Services and rooms to rent
- `services.ts`: `ServiceMenu` is one person's list of paid offers (`Service`: `cost`, `pitch`, `accept`) over a narrow `TavernPort` (coin, trust, host, say, toast). Use on Rosa answers with her chatter then pitches the next open offer and opens a 10 s window; Use again inside it takes the offer; an unanswered pitch lapses and the next Use pitches the next offer. `NpcManager.serviceMenu()` / `servicePort(id)` let a UI or test buy by id (`menu.buy(id, port)`).
- `rooms.ts`: Rosa's bed. Offered in the evening and at night only: `ROOM_COST` 14 coin (10 once Rosa's trust is 20+, `roomCost`). Paying calls `NpcHost.sleepToDawn()` (the clock jumps to dawn and the `rested` flag fires), adds 1 trust, and shows three notes, one each from three different regulars (`NOTES`, `wakeNotes`).

### Drinks with effects
`drinks.ts`: `DRINKS` are three Rosa offers on the same menu: **warming ale** (6 coin, Well-Warmed 4 min), **bracing tea** (5 coin, Mending 2.5 min) and a **strong brew** (14 coin, Vigor and +1 flat strength for 2 min, two a day then she cuts you off). `NpcHost.grantBuff(buff, seconds)` applies them through the game's own `Buffs` (`wellWarmedS`, `grant`, `grantStrength`) and fires `buff:gained`. The day's tally is saved as `drinks` in the npcs snapshot.

### Overheard gossip
`gossip.ts`: five slots a day (`GOSSIP_SLOTS`, time of day 0 = dawn, each open for 0.05 of a day). In an open slot, if two regulars who suit the phase stand within 7.5 blocks of each other (on their routine spots) and the player is within 16 blocks of both, one of ten `EXCHANGES` starts (one the manager has not used in its last six when it can). Each line is a speech bubble over the speaker for 4.2 s with a 0.8 s gap; nothing blocks or asks anything. `NpcView.bubble` carries the text, `NpcManager.overheard()` the current speaker for tests, and `src/render/npcs/bubbles.ts` (`BubbleLayer`, owned by `NpcRenderer`) draws it as a camera-facing sprite. Saved as `gossip` (`last` slot key, `said` ids).

### Pinned favours
`favours.ts`: `FAVOURS` are ten small item requests from the regulars (bread and sugar for Rosa, coal and iron for Gruk, copper and glass for Orrin, vials for Mara, logs and sticks for Bram). `FavourBoard` keeps three pinned at a time on the quest board, each for `FAVOUR_DAYS` (3) days, and pins new ones when the day turns (a favour just done is not asked again for 3 days). They are separate from the progression bounties: Use the board with the item in hand and at least the asked count and it takes exactly that many and pays coin, trust with whoever asked (`raiseTrust` also pays any friendship tier reward newly reached), or both; short of the count the board says how many are needed. Use with an empty hand lists the pinned notes after the bounties. `NpcManager.pinnedFavours()`; saved as `favours`.

### Gruk sparring
`sparring.ts`: Gruk's second offer (his hire offer is made on odd visits, a bout on even ones; `NpcManager.serviceMenu('gruk')`). A bout costs `SPAR_COST` 12 coin (9 once Gruk's trust is 20+), three a day. Every bout trains `sparLevel` (0..5, reached at 3, 8, 15, 25 and 40 bouts; `NpcManager.sparSkill()`), which raises the win chance (`winChance`: 40% + 10% a level, at most 90%), improves the `LOOT` a win pays (coal and sticks early, iron and bronze ingots late) and lengthens the warm-up (`warmUpS`: a flat-strength buff through `NpcHost.grantBuff('strength', s)`, win or lose). Reaching a new level gives Gruk 2 trust. Saved as `spar` (`xp`, `day`, `today`).

### Tavern upkeep
`upkeep.ts`: hand Rosa food or a brew (Use with it in hand; a liked item is still the day's first gift, after that it goes on the bar) and she stocks it (`Upkeep.add`, up to `STOCK_MAX` 40 units; `stockValue` prices food by hunger and buff time, brews by buff time, anything else 0). While the tavern is open (not at night) she sells one unit every `SELL_EVERY_S` (20 s) at `MARKUP` 1.5 x its value into her till; a turned day (sleeping, or time away) sells `OVERNIGHT_SALES` more and adds `ROOM_RENT` 4 coin for every guest room beyond the first. Rosa keeps the books (`till`, `earned`, `sold`, `built`). Her menu pitches "collect the till" (`till`) and, when the bar has earned enough, the next upgrade (`upgrade`, paid from the till first, then your purse): **a stage** (120 coin, bar has earned 40; sells a third faster; helps the festival dance), **a second** (90, earned 30) and **a third guest room** (160, earned 90; each pays rent). Upgrades are flags (no blocks are placed yet). `NpcManager.barStock()`, `till()`, `upgrades()`; saved as `upkeep`.

### Seasonal festival
`festival.ts`: a season is `SEASON_DAYS` (8) days (`SEASONS`: Thaw, Bloom, Harvest, Frost; `seasonOf(day)`); the last day of each is a festival day, and from dusk to dawn (`festivalOn`) the jukebox plays and the dancers dance (the manager switches it on and off, never touching one the player had already started; a toast opens and closes the night). Rosa's menu then offers three contests, each once per festival: **dance** (just step up), **cooking** (hold a dish, one is taken) and **brewing** (hold a tea or coffee, one is taken). Four regulars judge each (`JUDGES`; `judgeScore` 1..10 from a base by dish quality or dance, +2 when it is on that judge's `LIKES` list, +1 or 2 for friendship, +1 for a built stage at the dance, plus a little luck). Totals out of 40 pay `medalFor`: gold (30+, 40 coin, +3 trust with every judge), silver (22+, 20 coin, +2), bronze (14+, 8 coin, +1), or thanks (+1 trust). `NpcManager.festivalNow()` and `festivalRecord()`; saved as `festival` (`entered` by festival day, medals, `juke`).

## Veyra, the alchemist (sixth person)

A dark elf distiller in the hall (`id veyra`, role and sprite `alchemist`, home `[4,1,2]`, night by the stairs `[2,1,1]`, dances at `[4,1,3]`). Welcome gift: 3 glass vials and 2 glass beakers. Odd visits give her advice (`alchemyAdvice` in `src/npcs/alchemy.ts`: the next rung of the glass distillery ladder from what the pack holds: syrup, wash, low wines, spirit, tincture, clear tincture, essence/elixir) or a goal hint; Use again takes the tonic she pitches (`TONICS` in drinks.ts: a swift tonic and a mending draught, three a day each). She likes glassware, charcoal, sulfur and tinctures (friendship.ts), has two favours, four gossip pairs (Mara, Rosa, Orrin, Gruk), a wake-up note and a dance style. Phrase bank `scripts/alchemist.ts`. Art: owner references in `docs/art-refs/`; drop `veyra.png`, `veyra_portrait.png`, `veyra_anim.png`, `veyra_dance.png`, `veyra_faces.jpg` in `assets/npcs/` and run `node scripts/npc-art.mjs`; until then the code-drawn sprite and portrait are used. Not done: the vapour-skull idle animation.
