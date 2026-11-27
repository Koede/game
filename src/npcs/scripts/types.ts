/** A person's phrase bank (docs/api/npcs.md): every list is a pool; the dialogue picker draws from it without repeating lately. */
export interface PhraseBank {
  /** Said when the player first walks up in a visit. */
  greet: readonly string[];
  /** Said any time. */
  idle: readonly string[];
  morning: readonly string[];
  evening: readonly string[];
  night: readonly string[];
  /** Rare lines, drawn about one time in twelve. */
  rare: readonly string[];
  farewell: readonly string[];
  /** By current goal id: said once. */
  hints: Readonly<Record<string, string>>;
}
