# Auto-build assist

## Goal

Big builds should be fun on a phone: you design, the game does the repetitive placing. Never replaces building, only removes the tapping.

## What is fun

Sketching a wall or roof, seeing a ghost of it, and filling it as you walk along while spending real materials. Holding to place a row of
rafters instead of forty taps.

## What exists

Blueprints (logic exists, unwired), the fence and stairs and slope blocks that make building shapes, the inventory and crafting systems.

## Design

1. **Line and fill tools.** Hold the place button and drag a line, a rectangle or a wall; a ghost shows the result and the material cost.
2. **Blueprints.** Save a selection as a blueprint (a named item in the bag); place it as a ghost, rotate, confirm. Placing takes materials
   from your pack and leaves gaps where you lack them, shown in red.
3. **Smart orientation.** Stairs, slopes and fences pick their facing and joins from the line direction.
4. **Undo.** One undo for the last assisted placement (a short window).
5. **Phone input.** Two-finger drag to size a rectangle; a confirm and cancel pair at the screen edge.

## Phases

1. Line and rectangle fill with ghost and cost.
2. Orientation rules for stairs, slopes and fences.
3. Blueprint save, place and rotate.
4. Undo and phone gestures.

## Tests

Fill counts and costs match the ghost; no placement through solid blocks without confirmation; materials are conserved on undo; orientation
tests for stairs and fences; e2e on the phone layout.

## Risks

Creative-mode feel versus survival cost (gaps must be visible, never free); large placements stalling the frame (batch per tick);
protecting the player's builds from accidental replace.
