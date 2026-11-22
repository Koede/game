One file per area: `src/content/areas/<name>.ts`, default export `satisfies AreaContent` (see `../area.ts`). Data only.
After adding a block run `npm run ids:sync` and commit `src/content/blockIds.lock.json`.
Textures: `src/render/textures/areas/<name>.ts` default-exporting a `PainterSet`.
