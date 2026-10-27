/** Phrases app copy never uses. Matched case-insensitively on word boundaries. */
export const BANNED_WORDS: string[] = [
  'good food',
  'bad food',
  'junk',
  'cheat',
  'guilt',
  'guilty',
  'naughty',
  'sinful',
  'burn off',
  'walk off',
  'work off',
  'earn',
  'deserve',
  'clean eating',
  'detox',
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PATTERNS = BANNED_WORDS.map((phrase) => ({
  phrase,
  re: new RegExp(`\\b${escape(phrase).replace(/ /g, '\\s+')}\\b`, 'i'),
}));

/** Banned phrases found in `text`. Empty when the text is fine. */
export function violatesTone(text: string): string[] {
  return PATTERNS.filter((p) => p.re.test(text)).map((p) => p.phrase);
}
