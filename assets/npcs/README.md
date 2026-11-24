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
| `veyra.png`, `veyra_portrait.png` | dark elf alchemist (also `veyra_anim.png`, `veyra_dance.png`, `veyra_faces.jpg` like the others) | owner's reference: `docs/art-refs/veyra_pose_ref.png` |

Sprites are drawn 2 blocks tall (times the character's scale) and shown with nearest-neighbour filtering, so a clean 64-128 px tall
pixel-art image looks best. The cleanup trims the background, crops to the figure and keeps the pixels as they are.

## Prompts (Leonardo.ai, Pixel Art style, or any generator)

Use one style paragraph for all six so they match, then the character line. Ask for a PLAIN FLAT SINGLE-COLOUR background (light grey is
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
- **Veyra, alchemist (dark elf):** tall, slim adult woman (small head, long legs), DEEP MAGENTA-PURPLE skin (about #6a1a5a, shadows #3a0a35),
  long straight near-black navy hair (#12142a) falling past the shoulders with a long fringe over one eye, small glowing red eyes behind round
  gold glasses, long pointed ears, blue-grey lips. A long white lab coat (#e8e6ee, lilac shadows) with big pockets and a ragged hem over a
  deep teal (#2f6f6b) fitted outfit with gold (#d9b23a) trim and gold shoulder pieces, a bandolier of small vials of glowing lime liquid
  (#b8e04a), a tiny skull charm on a gold belt, white gloves, mismatched gold-toed ankle boots. Pose (from the reference): one hand on the hip with
  a small silver flask at it, the other arm raised and held out with a round flask of bright lime liquid and a swirl of pale mint vapour
  (#7fc9a0 / #a8dcc0) curling up from it; in her idle loop the vapour now and then forms a small skull (stylised alchemical fumes from a glass
  vapour tube, no smoking). Calm, dry, precise, a little vain about her work.

Keep the characters adult and tasteful.

## Style notes taken from the owner's reference images

What the references have in common, to put in every prompt (or to describe next to an uploaded reference):
- **Proportions:** slim, long-legged adults, small heads relative to the body (about 1 : 6 or 1 : 7), graceful, slightly exaggerated silhouettes; hair is a major shape (long, flowing, with volume and a few bright highlight strands, twin tails or braids that sweep out).
- **Faces:** a few pixels each, but large expressive eyes with a bright highlight, tiny nose, small mouth, rosy cheeks; a soft, friendly or calm expression.
- **Shading:** hard-edged cel shading in three to four tones per material, a thin dark outline in a darker shade of the surrounding colour (not pure black), rim light on the lit side, soft gradients only on skirts and capes.
- **Clothing:** layered and detailed: wide-brim witch hats with bows or bands, capes with trim, frilled skirts with a flare, belts, cuffed boots, stockings in mismatched colours, hoods; small gold or coloured accents; fabric that catches wind.
- **Props and mood:** a staff or a held object, a few floating sparkles or motes, a restrained palette of two or three hues per character.
- **Canvas:** front-facing and standing for the in-world sprite; a separate bust for the portrait.

In Leonardo.ai: open the image generator, use the **Image Guidance / Style Reference** (or "Content Reference") panel, upload your reference
images there, pick the Pixel Art model, and add the character line from above. The tools I have can only take text, so I cannot pass your
reference images to a generator myself; uploading them in the site is how they get used.
- **Veyra (alchemist):** a pale-mint vapour swirl rising from a raised hand is her signature; skin deep magenta-purple, hair near-black navy,
  red eyes. The coat is white and long with a ragged hem over teal and gold, so the silhouette reads as a tall white column against a
  purple figure. Hard-edged three or four tone cel shading, dark coloured outline, rim light on the left, a few floating green motes. Reference
  pose: `docs/art-refs/veyra_pose_ref.png` (the outfit there is bare; keep ours: coat, teal, gold, glasses, vial bandolier, skull charm).

## Outfits (sleepwear and swimwear)

`<id>_sleep.jpg` (worn from late evening to dawn) and `<id>_swim.jpg` (worn in the yard pool; hot Bloom middays the regulars cool off there) are
built by `python assets/npcs/faces/outfits.py`: a generated body in the new outfit with the ORIGINAL head pasted back (face, hair, hat, beard),
so faces never drift; the script asserts the head pixels are identical. Generated bodies live in `assets/npcs/faces/gen/`. Then `node scripts/npc-art.mjs`.
