# Hearthwatt roadmap tree

`roadmap.html` is the whole game as one collapsible, searchable tree: every block, item, machine, recipe, goal, research entry and aspect that exists,
each age and technology, magic as its own tree, every planned feature, and the links between systems. Open the file in any browser. It is also published
as a private artifact on claude.ai.

Four trunks: the six ages, 15 technologies, magic, and connections (the ten congruence threads, six integration journeys, system links and the 20 build units).
Every leaf is marked built, partial or planned.

## Regenerating

```
npm run roadmap      # dump.mjs reads the real registry, gen.mjs writes docs/roadmap/roadmap.html
```

- `scripts/roadmap/dump.mjs` bundles `src/core/registry`, `src/content/objectives` and `src/magic` and dumps blocks, items, recipes, machines, goals, research and aspects
  (everything BUILT comes from here, so it is always current).
- `scripts/roadmap/data-plan.mjs` holds what the registry cannot say: the technology branches, built behaviours, planned features, planned research entries and
  infusions, the cross-system links, the threads, journeys and units from `docs/build/SYSTEMS.md`. Edit it when a plan changes or a feature lands (change its status
  from `planned` to `partial` or move it into `BUILT`).
- `scripts/roadmap/gen.mjs` classifies every entry into its technology and writes the page from `scripts/roadmap/template.html`.

The page needs network access only for its web fonts and the flowchart renderer; everything else is inline.
