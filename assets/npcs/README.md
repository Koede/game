# NPC art drop-in (tavern people)

Put PNGs here, then run `node scripts/npc-art.mjs` (it rebuilds `src/render/npcs/artManifest.ts`) and rebuild the game. Anything missing
falls back to the code-drawn sprite or portrait, so you can add one character at a time.

| File | What | Notes |
|---|---|---|
| `mara.png` | full-body sprite, front view, standing | any size; the plain background is removed automatically (the colour in the four corners) |
| `mara_portrait.png` | dialogue portrait, head and shoulders | square works best; shown in the conversation box |
| `rosa.png`, `rosa_portrait.png` | barkeep | |
| `gruk.png`, `gruk_portrait.png` | orc smith (drawn big; the game scales him 1.35x) | |
| `orrin.png`, `orrin_portrait.png` | artificer | |
| `bram.png`, `bram_portrait.png` | hermit | |

Sprites are drawn 2 blocks tall (times the character's scale) and shown with nearest-neighbour filtering, so a clean 64-128 px tall
pixel-art image looks best. The cleanup trims the background, crops to the figure and keeps the pixels as they are.

## Prompts (Leonardo.ai, Pixel Art style, or any generator)

Use one style paragraph for all five so they match, then the character line. Ask for a PLAIN FLAT SINGLE-COLOUR background (light grey is
fine) so it can be cut out. Generate a few and keep the best; keep the same seed or the same "style paragraph" for consistency.

Style paragraph (sprites):
> Detailed anime-style pixel art character sprite, full body, standing straight, facing the viewer head-on (front view, symmetrical pose),
> single character centred on a plain flat light-grey background, clean dark outlines, hand-placed pixels, cel shading with three tones,
> no dithering, no text, no watermark, tall slim proportions, about 80 pixels tall.

Style paragraph (portraits):
> Pixel art dialogue portrait in the style of Stardew Valley character portraits, head and shoulders, facing the viewer, soft cel shading,
> coloured outlines, big expressive eyes, warm lighting, plain flat background, 64x64 pixel look, no text, no watermark.

Characters (add to the style paragraph):
- **Mara, hedge witch:** young adult woman, wide-brim dark violet witch hat with a gold band and a bent tip, long dark-violet hair in two
  braids, green eyes, rosy cheeks, fitted violet tunic with a brown belt and gold buckle, short plum cape with gold trim, short flared
  skirt, one white and one dark stocking, brown cuffed boots, a tall twisted wooden staff with a glowing green orb. Friendly, graceful.
- **Rosa, barkeep:** warm, cheerful adult woman, auburn hair in a high ponytail with a gold tie, brown eyes, freckles, cream blouse with
  puffed sleeves, red laced bodice, brown belt, cream apron over a full skirt, boots, holding a foaming wooden mug.
- **Gruk, orc smith:** big, broad-shouldered green-skinned orc man, black mohawk, small gold eyes, two white tusks, leather vest over a bare
  muscled chest, iron bracers, brown trousers, heavy boots, a smith's hammer on his shoulder. Gruff but kind.
- **Orrin, artificer:** friendly adult man, messy brown hair with brass goggles pushed up on his forehead, thick moustache, blue work coat
  with rolled sleeves, leather apron with tools in the pocket, big wrench in one hand, boots.
- **Bram, hermit:** old man in a patched olive-green hooded robe, long grey beard, bushy white eyebrows, rope belt, a bulging coin purse,
  a walking stick, worn boots. Amused, mischievous.

Keep the characters adult and tasteful.
