// Shown once on Home per entry. Keep the newest first and the lines short.
export interface ChangelogEntry {
  key: string;
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    key: '2026-10-30',
    title: "What's new",
    items: [
      'Daily reminder at a time you pick (Profile, Daily reminder)',
      'Measure: waist, hips and a private progress photo on Stats',
      'Share with a friend from Home with your own link',
      'Add to Home Screen for an instant, full-screen open',
      'Hindi and Punjabi under Profile, Display',
    ],
  },
];

export const LATEST_CHANGELOG = CHANGELOG[0] ?? null;
