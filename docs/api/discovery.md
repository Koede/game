# Recipe discovery by experiment

`src/game/discovery.ts` - pure rules, no content changes.

- `HIDDEN_RECIPES`: station + exact ingredient amounts + output + hint (append-only data; items must exist).
- `new RecipeBook()`: `experiment(station, attempt, source, into?)` returns `empty | nothing | close | known | discovered`.
  A full match (any order) consumes the inputs and gives the output; a close try (all but one right item, at most one
  stranger) costs nothing and unlocks that recipe's hint in `entries()`; `learn(id)` unlocks without trying.
- `entries()` feeds the book screen: found recipes in full, others `???` plus hint once hinted. `toJSON()` /
  `RecipeBook.fromJSON()` save it (unknown ids dropped).
- Wiring left for the UI: an "experiment" tab at the workbench/furnace screens that calls `experiment`, and a
  `RecipeBook` on the player save.
