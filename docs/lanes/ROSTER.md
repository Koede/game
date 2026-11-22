# Lane roster (session ids, for SendMessage between architects)

| Lane | Role | Session id | Branch |
|---|---|---|---|
| Coordinator | main session | `local_4bdc7aa5-0ceb-445b-9336-843dec94f1d4` | `ccr-3c8b169f-e78nk2` (main checkout `E:\Projects\game`) |
| Foundation | saves, ids, registration, lane tooling | `local_2070b517-8040-477a-81e1-0881ff431bb4` | `ccr-3c8b169f-e78nk2` (main checkout) |
| A | Steam and Bronze | `local_d8955f5f-ea2a-4586-bf35-8305b0837bdc` | `lane/a` |
| B | distillery | `local_dd8e1fe6-f348-4d73-8035-2b4cf2387cb9` | `lane/b` |
| C | workshop (Create-style) | `local_e81aaffc-7e88-4bc5-8afd-87366c84b22f` | `lane/c` |
| D | magic (Essentia and Research) | `local_817cc7ef-47e1-42aa-849a-3e65845ea250` | `lane/d` |
| E | food, farming, brewing, sugar | `local_4fd50b8d-4321-4de8-b75f-35aff6a46962` | `lane/e` |
| F | world, progression, art, audio | `local_25aa37e8-7094-4a81-a831-ad423509015b` | `lane/f` |
| U | phone UX, HUD, onboarding | `local_e79fec77-0aa6-4462-84ad-64795f62278c` | `lane/u` |

Branch names above are the intent; the app may add a prefix or suffix to the actual worktree branch: use `git branch --show-current` in your worktree.
Interlocks (who talks to whom): A<->C shared kinetic model; B<->C lubricant/arms/spouts; B<->A heat, pressure, engines; D<->C golems and cranks;
D<->B essentia in stills; E<->B spirits, potions, sugar; E<->D aspects of plants and creatures; F<->all new content keys, ages and Codex; U<->all HUD slots.
