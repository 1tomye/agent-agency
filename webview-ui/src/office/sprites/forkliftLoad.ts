/**
 * What rides on the forklift's forks while it shuttles stock (office/breakTime.ts):
 * a little shrink-wrapped pallet of paper.
 */
import type { SpriteData } from '../types.js';

const PALETTE: Record<string, string> = {
  o: '#2a2624', // outline
  p: '#f4f4f0', // paper
  w: '#cfcfc8', // ream edges
  b: '#a8743f', // pallet boards
};

const ROWS = [
  'oooooooooo',
  'opppppppo.',
  'owwwwwwwo.',
  'opppppppo.',
  'owwwwwwwo.',
  'obbbbbbbo.',
  'oooooooooo',
];

export const FORKLIFT_LOAD_SPRITE: SpriteData = ROWS.map((row) =>
  [...row].map((c) => (c === '.' ? '' : PALETTE[c])),
);
