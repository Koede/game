/**
 * Which face a person pulls while saying a line (docs/api/npcs.md): the dialogue box reads the line's words and shows the matching cell of
 * their `<id>_faces` sheet (assets/npcs/faces, painted on the blueprint art). Pure text in, a cell index out; unmatched lines are neutral.
 */
export const FACES = ['neutral', 'happy', 'laughing', 'surprised', 'annoyed', 'sly'] as const;
export type Face = (typeof FACES)[number];

const RULES: ReadonlyArray<readonly [Face, RegExp]> = [
  ['laughing', /\b(ha ?ha|hah|hehe|ho ho|haw|laugh\w*|funny|joke\w*|hilarious)\b|bet you wonder/i],
  ['surprised', /\b(whoa|wow|huh|no way|incredible|amazing|astonish\w*|unexpected)\b|[?!]{2}|\b(what|really)\?/i],
  ['annoyed', /\b(ugh|hmph|nonsense|careless|fool\w*|stupid|idiot|waste of|wasting|enough of|annoy\w*|stop that|mess)\b|do not (break|waste|touch)|don't (break|waste|touch)/i],
  ['sly', /\b(heh|coins?|price|deal|bargain|trade|clever|secret|rumou?r|perhaps|wink|between us|sly|pays?|paid|owe|worth)\b/i],
  ['happy', /!|\b(welcome|thanks?|thank you|good|great|nice|friend|glad|well done|congratulations|lovely|delight\w*|cheers|on the house)\b/i],
];

/** The face for a line of dialogue (its index into the sheet). */
export function faceOf(text: string): number {
  for (const [face, re] of RULES) if (re.test(text)) return FACES.indexOf(face);
  return 0;
}
