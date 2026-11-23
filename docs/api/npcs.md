# The starting tavern and its people (src/npcs, src/render/npcs)

> Second pass (the 'living tavern'): five people, a quest board with coin bounties, Old Bram's shop, Gruk for hire, a wall clock, two tended fires, and about 540 hand-written phrases. The first-pass text below is still true for the base mechanics; this block lists what changed.
>
> - **People:** Mara (witch: magic advice from the notebook's next open entry), Rosa (barkeep: brewing goals), Orrin (artificer: the current progression goal's title and text, the tech ladder; gives a wrench), Gruk (orc smith, 1.35x big, hireable), Old Bram (hermit in the yard lean-to). Mara and Rosa are drawn as clearly feminine adult women (lashes, lips, earrings, hair volume, narrow waist over a flared skirt); Gruk is broad; sprites are 24 x 40 px, props their own size.
> - **Coin** is a counter on the NpcManager (saved), not an item. **Quest board** (a prop by the door): Use pays a coin bounty (`BOUNTIES`, one per progression goal, `8 + 6 x age`, +40 for furnace milestones) for every goal you have finished and not yet redeemed (you must come to the board) and lists the next three open bounties. **Old Bram**: Use with an item in hand sells the whole stack (`priceOf`: by category and age, tools +3 per tier, his mood 0.7-1.4); he never runs out of coin, and rarely says so (the running joke, 'Bet you wonder how I'm still a bum with all this coin.... Anyways...'). **Gruk for hire**: Use twice (offer, then accept within 10 s) for 40 coin to have him follow you and hit the nearest hostile near you for 8 minutes (`Companion`, 7 damage a second, leaves when you die).
> - **Scripts** (`src/npcs/scripts/*.ts`, `PhraseBank`: greet, idle, morning, evening, night, rare, farewell, hints by goal): witch, barkeep, orc, artificer, hermit; `LinePicker` draws by time of day, rarely a rare line, never one said in the last 14. Odd visits give the goal hint (once) or the specialist's advice, even visits give chatter.
> - **Clock and fires:** the wall clock is a prop sprite repainted each minute (dawn = 06:00; Use for a toast); the hall fireplace and Bram's fire are kept burning (`tendFire`, every 8 s). Tests: `src/npcs/npcs.test.ts`; e2e: `scripts/e2e-tavern.mjs`.

Every NEW world opens inside **the Hearth & Anvil tavern**, built round the spawn point, with three adult pixel-sprite NPCs:
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
- `manager.ts`: `NpcManager` (owned by `GameState.npcs`, saved with `world.persist('npcs')`: tavern origin, greeted, gifted, hints heard).
  `buildStart`, `views()`, `raycast` (box 0.76 x 2.0, reach 3.4, no occlusion by blocks), `talk` (0.8 s cooldown so a held Use does not read the
  script), `speak`, `greet` (the welcome toast, once), `tick`.
- `GameState.create` calls `startInTavern()` (falls back to the old open-view start when the ground is not loaded); the player faces south.
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
