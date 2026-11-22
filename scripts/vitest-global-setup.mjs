// Runs once before vitest: makes sure the gitignored folder-registration indexes exist and are current.
import { generate } from './gen-indexes.mjs';
export default function setup() { generate(); }
