interface ChangelogSection {
  title: string;
  items: string[];
}

interface ChangelogContributor {
  name: string;
  url: string;
  description: string;
}

interface ChangelogEntry {
  version: string;
  sections: ChangelogSection[];
  contributors: ChangelogContributor[];
}

/** Extract "major.minor" from a semver string (e.g. "1.1.1" → "1.1") */
export function toMajorMinor(version: string): string {
  const parts = version.split('.');
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : version;
}

/** Project home (set once the repository is published; links hide while empty). */
export const CHANGELOG_REPO_URL = 'https://github.com/1tomye/agent-agency';

/** Community chat invite (links hide while empty). */
export const DISCORD_INVITE_URL = '';

export const changelogEntries: ChangelogEntry[] = [
  {
    version: '0.6',
    sections: [
      {
        title: 'Office life',
        items: [
          'Forklift shifts: an idle agent drives pallets across the warehouse, then parks',
          'One basketball: it leaves the court floor while someone dribbles or shoots',
          'Six desks in the bullpen, with a clear walkway to the kitchen',
        ],
      },
    ],
    contributors: [],
  },
  {
    version: '0.5',
    sections: [
      {
        title: 'The boss',
        items: [
          'An always-in-the-office boss: desk visits, meetings, announcements, break room raids',
          'He shoots hoops, dances at parties and congratulates agents who finish a turn',
          'Idle agents take breaks: break room, party room, water cooler, couch and the hoop',
        ],
      },
    ],
    contributors: [],
  },
  {
    version: '0.1',
    sections: [
      {
        title: 'Agent Agency',
        items: [
          'A pixel-art paper-company office: bullpen, glass-walled manager office, warehouse',
          'Original staff, furniture and office art; based on Pixel Agents 1.5.0 (MIT)',
        ],
      },
    ],
    contributors: [],
  },
];
