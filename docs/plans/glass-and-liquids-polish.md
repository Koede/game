# Glassware and liquids: polish

## Goal

Finish the glassware and animated liquids work so the distillery looks and feels excellent from across the room.

## What is fun

Watching a column run: layers settle, vapour curls, bands light up the segments, condensate runs and drips. The apparatus is the toy.

## What exists

Glass shape and models (`src/world/glassModels.ts`, `src/world/meshGlass.ts`), shared liquid shader (`src/render/liquids/liquidBoxes.ts`),
distillery liquids (`src/render/distill/distillFx.ts`), brewing and essentia liquids, the separatory funnel.

## Known gaps

1. Phone e2e: tapping the still base sets 97 C instead of 130 C. Find out whether the thinner base model or the touch hold repeat causes it.
2. The cooling jacket water reads as a solid blue cube from a distance; give it a clear shell and a visible level line.
3. The crucible surface sits slightly above the rim in a boil (the slosh compensation).
4. Liquids inside the glass use box volumes; a curved flask belly reads as a block. Add stepped liquid layers that follow the model's profile.
5. The distillery tile overlay drawing may still sit awkwardly inside the new shapes; check each piece up close.
6. Glass tiles: add a gentle environment sheen so glass catches the sky (one extra column in the glass tile or a cheap shader term).
7. Sounds: bubbling while boiling, a trickle while liquid flows, a tap click on the funnel.
8. A recipe or guide page for the separatory funnel and what each module does, with the new models.

## Phases

1. Fix the phone still-base bug and the jacket.
2. Profile-following liquids and the crucible lip.
3. Glass sheen and the overlay check.
4. Sounds and the guide page.

## Tests

Still-base tap on the phone layout; liquid builders produce bodies inside each model's interior bounds; per-piece screenshots reviewed up
close on desktop and phone.

## Risks

Liquid body counts on a large rig (cap per rebuild, already 512); sheen must not break the translucent batch ordering.
