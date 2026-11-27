# Guided first hour

`src/game/firstHour.ts` joins the main goals (`content/objectives.ts`) and the camp goals (`game/campGoals.ts`) into one path:
meet Gruk, gather wood through to eating a cooked meal (`eat_food`), with *sleep a night* after *Warm yourself* and *fill a bounty*
after the first meal. `firstHourStep(facts)` returns the current step (or null when done / no longer relevant).

- The HUD goal plate shows it as "First hour: step N of M"; a camp step opens the Town page when tapped.
- The camp chip hides while it would repeat a guided camp goal; it returns for the later camp goals (lodge, newcomers).
- "What next?" follows the step (camp steps point at the camp); it pulses after 75 s on one step (`NUDGE_IDLE_S`).
- No new saved state: everything is read from the tracker and the camp. Worlds with no camp track get the main goals only.
