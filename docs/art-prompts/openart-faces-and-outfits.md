# OpenArt prompts: face sheets and outfits

Use each character's **day sprite** as the reference image in OpenArt (its image-guidance or reference slot). The files are in `assets/npcs/`:

| Character | Day sprite (reference) | Face sheet to match | Save outfits as |
| --- | --- | --- | --- |
| Mara | `mara.jpg` | `mara_faces.jpg` | `mara_sleep.jpg`, `mara_swim.jpg` |
| Rosa | `rosa.jpg` | `rosa_faces.jpg` | `rosa_sleep.jpg`, `rosa_swim.jpg` |
| Gruk | `gruk.jpg` | `gruk_faces.jpg` | `gruk_sleep.jpg`, `gruk_swim.jpg` |
| Orrin | `orrin.jpg` | `orrin_faces.jpg` | `orrin_sleep.jpg`, `orrin_swim.jpg` |
| Old Bram | `bram.jpg` | `bram_faces.jpg` | `bram_sleep.jpg`, `bram_swim.jpg` |
| Veyra | `veyra.jpg` | `veyra_faces.jpg` | `veyra_sleep.jpg`, `veyra_swim.jpg` |

## Shared style (add to every prompt)

> Pixel art full-body character sprite, front view, standing straight with arms relaxed, centred on a plain flat light-grey background, clean dark outlines, hand-placed pixels, cel shading with three to four tones, no dithering, no text, no watermark. Keep the exact face, hair, skin tone, eyes and body build of the reference character. Wholesome, tasteful, family-friendly, ordinary clothing coverage, natural proportions, nothing emphasised.

## Face sheets (`<id>_faces.jpg`)

The game reads six expressions left to right: neutral, happy, laughing, surprised, annoyed, sly. Ask for one strip of six heads, same size, same framing, on the plain grey background.

> Pixel art head-and-shoulders portrait sheet, six panels in one row, left to right: neutral, happy, laughing, surprised, annoyed, sly. Same head size, same framing and same plain flat light-grey background in every panel. Keep the exact face, hair, eyes, skin tone and any glasses or markings of the reference character in every panel; only the expression changes. Clean dark outlines, cel shading, no text, no watermark. Wholesome.

Then add the character line:
- **Mara:** long dark violet braids, green eyes, rosy cheeks, witch hat with a gold band in the top panel is optional (leave it out of the heads).
- **Rosa:** auburn high ponytail with a gold tie, brown eyes, freckles, warm smile.
- **Gruk:** green skin, black mohawk, small gold eyes, two white tusks.
- **Orrin:** messy brown hair, thick moustache, brass goggles pushed up on his forehead.
- **Bram:** long grey beard, bushy white eyebrows, kind face.
- **Veyra:** deep magenta-purple skin, long straight near-black navy hair with a fringe over one eye, small red eyes, round gold glasses on her face, pointed ears.

## Outfits (`<id>_sleep.jpg` and `<id>_swim.jpg`)

Add the shared style, then the outfit line.

**Mara, sleepwear:** a violet pyjama set with a small star pattern in gold, long sleeves, drawstring trousers with little gold stars, fluffy lilac slippers. Keep her witch hat hung on a peg out of frame and her long dark violet braids over her shoulders.

**Mara, swimwear:** a violet star-print bandeau bikini top, matching high-waisted bikini bottoms, a purple sarong tied low on the hip, flip-flops. Keep her long dark violet braids over her shoulders.

**Rosa, sleepwear:** a red quilted dressing gown tied at the waist over a cream nightgown with a lace hem, fluffy cream slippers. Keep her high ponytail with the gold band, her freckles and her warm brown eyes.

**Rosa, swimwear:** a red polka-dot halter bikini with regular-cut bottoms, a blue and white striped towel over one shoulder, sandals. Keep her high ponytail with the gold band and her freckles.

**Gruk, sleepwear:** big blue and white striped pyjama top and trousers, bare green feet in brown slippers. Keep his exact mohawk and tusks.

**Gruk, swimwear:** a full-length opaque hibiscus-print loincloth tied with a braided cord belt, bare-chested, goggles on his forehead, a towel over one shoulder, sandals. Keep his exact mohawk, tusks and green skin.

**Orrin, sleepwear:** a long blue and white striped nightshirt to the knee, bare feet in brown slippers. Keep his brown hair, moustache and brass goggles pushed up on his forehead.

**Orrin, swimwear:** loud leaf-print swim shorts, bare-chested, brass goggles on his forehead, a snorkel, a yellow rubber duck under one arm, flip-flops. Keep his brown hair, moustache and goggles.

**Bram, sleepwear:** a long patched olive-green night robe with a rope belt over a cream nightshirt, brown slippers, the hood down. Keep his full grey beard, bushy white eyebrows and kind face.

**Bram, swimwear:** a classic swim brief in a loud palm-tree and sunset print, bare-chested, a palm-leaf fan in one hand, sandals. Keep his full grey beard, bushy white eyebrows and face.

**Veyra, sleepwear:** a dark teal pyjama set with gold trim and a white robe tied at the waist, teal slippers. Keep her long straight near-black navy hair with the fringe over one eye, her red eyes, purple skin, and her round gold glasses on her face.

**Veyra, swimwear:** a teal and gold two-piece swimsuit with a gold ring on the bandeau top and slim high-leg bottoms, an open white lab-coat worn as a wrap, a skull charm on a gold belt and a belt of little vials. Keep her long straight near-black navy hair with the fringe over one eye, her red eyes and purple skin. Round gold sunglasses on top of her head, none on her face. Keep her body proportions exactly as in the reference.

## When you're done

Save each file with the name above into `assets/npcs/`, then tell me. I'll run `node scripts/npc-art.mjs`, check each against its day sprite, and send you the heads sheet and an outfit contact sheet before anything goes into the game.
