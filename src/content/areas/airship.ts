/**
 * The airship (docs/api/airship.md): the late-age way to travel. A gas envelope over a superalloy gondola and a
 * combustion engine, forged at the Plasma Furnace (Atomic Age). It flies on Fuel Canisters and, from high up, spots
 * landmarks, ruins and named regions onto its sky chart. Optional for the furnace story, but its two goals sit early in
 * the Atomic Age so the player knows it is there.
 */
import type { AreaContent } from '../area';
import { amount, amounts } from '../amounts';

const ATOMIC = 4;

export default {
  items: [
    {
      key: 'airship', name: 'Airship', category: 'machine', age: ATOMIC, stack: 1,
      desc: 'A gas envelope over a superalloy gondola. Moor it on open ground, fuel it and climb aboard: Jump climbs, F sinks. From high up you spot far places.',
    },
  ],
  recipes: [
    {
      id: 'airship', station: 'furnace', kind: 'forge', minTier: 5, age: ATOMIC, minTempC: 2000,
      inputs: amounts('1 combustion_engine, 4 superalloy, 16 cloth, 8 cord, 4 aluminum_ingot, 1 circuit'), output: amount('airship'),
    },
  ],
  objectives: [
    {
      id: 'fly_airship', title: 'Take to the skies', age: ATOMIC, condition: { type: 'flag', flag: 'flew_airship' },
      text: 'Forge an Airship at the Plasma Furnace from a combustion engine, superalloy and a bolt of cloth. Moor it on open ground, feed it Fuel Canisters, climb aboard and hold Jump until the land opens out below you.',
    },
    {
      id: 'chart_lands', title: 'Chart new lands', age: ATOMIC, condition: { type: 'flag', flag: 'charted_lands' },
      text: 'Fly high and far: every landmark, ruin and region you see from the air goes on the sky chart. Spot six. R (or the course button) points the way to the next one.',
    },
  ],
  objectivesAfter: 'make_superalloy',
} satisfies AreaContent;
