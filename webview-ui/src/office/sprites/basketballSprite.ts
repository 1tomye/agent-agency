/**
 * The warehouse basketball (office/breakTime.ts): a 7x7 ball with seams, drawn
 * while it's dribbled or in flight to the hoop.
 */
import type { SpriteData } from '../types.js';

const PALETTE: Record<string, string> = {
  o: '#3a1e10', // outline
  a: '#e0782a', // leather
  h: '#f5a45e', // highlight
  b: '#2a1408', // seams
};

const ROWS = ['.ooooo.', 'ohabaao', 'oaabaao', 'obbbbbo', 'oaabaao', 'oaabaao', '.ooooo.'];

export const BASKETBALL_SPRITE: SpriteData = ROWS.map((row) =>
  [...row].map((c) => (c === '.' ? '' : PALETTE[c])),
);
