/**
 * Break time — where agents go when their turn ends.
 *
 * Instead of wandering anywhere or sitting idle at their desk, idle agents
 * drift between hangouts: the break room, the party room, the water cooler and
 * the couches. Settled at one, they face it, linger, and now and then goof off:
 * a quip, or a little dance at the party. OfficeState drives this from update().
 */
import type { Character, PlacedFurniture } from './types.js';
import { CharacterState, Direction, TILE_SIZE } from './types.js';

export type HangoutKind = 'snack' | 'party' | 'cooler' | 'couch' | 'hoops' | 'forklift';

export interface HangoutSpot {
  col: number;
  row: number;
  facing: Direction;
  kind: HangoutKind;
  /** Centre of the object it's gathered round (world px) - where a shot is aimed */
  targetX: number;
  targetY: number;
}

/** Furniture idle agents gather around, and what kind of hangout it makes. */
const HANGOUT_FURNITURE: Record<string, HangoutKind> = {
  PARTY_TABLE: 'party',
  BALLOONS: 'party',
  GIFT_PILE: 'party',
  BREAK_TABLE: 'snack',
  KITCHEN_COUNTER: 'snack',
  FRIDGE: 'snack',
  VENDING_MACHINE: 'snack',
  PRETZEL_CART: 'snack',
  WATER_COOLER: 'cooler',
  OFFICE_COUCH: 'couch',
  BASKETBALL_HOOP: 'hoops',
  FORKLIFT: 'forklift',
};

export const GOOF_LINES: Record<HangoutKind, readonly string[]> = {
  snack: [
    'Just one more snack.',
    'Who keeps taking my yogurt?',
    'Coffee number four.',
    'Free pretzels!',
    "Shh, I'm on break.",
  ],
  party: ["Is it somebody's birthday?", 'Cake for breakfast!', 'Party in the annex!', 'Woo!'],
  cooler: ['Did you see the game?', 'Hydrating. Very important.', 'Heard any good gossip?'],
  couch: ['Five minute nap.', 'Is it Friday yet?', 'Just resting my eyes.'],
  hoops: [
    'Swish!',
    'Nothing but net!',
    'Air ball...',
    'Shooting hoops, back in five.',
    'Warehouse rules!',
  ],
  forklift: [
    'Beep beep beep!',
    'Coming through!',
    'Forklift certified. Mostly.',
    'Pallet delivered!',
  ],
};

/** How long an idle agent lingers at a hangout before drifting to another. */
export const HANGOUT_STAY_SEC: [number, number] = [20, 50];
/** Seconds between goof-offs while lingering. */
export const GOOF_EVERY_SEC: [number, number] = [10, 22];
export const AGENT_CHAT_SEC = 4;
export const DANCE_SEC = 3;
export const SHOT_SEC = 1.1;

export function randomRange([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

type Footprint = (type: string) => { w: number; h: number } | null;

function facingToward(c: number, r: number, cx: number, cy: number): Direction {
  const dx = cx - c;
  const dy = cy - r;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? Direction.RIGHT : Direction.LEFT;
  return dy > 0 ? Direction.DOWN : Direction.UP;
}

/** Free tiles in the ring around every hangout object, facing it. */
export function buildHangouts(
  furniture: PlacedFurniture[],
  footprint: Footprint,
  isFree: (col: number, row: number) => boolean,
): HangoutSpot[] {
  const spots = new Map<string, HangoutSpot>();
  for (const item of furniture) {
    const kind = HANGOUT_FURNITURE[item.type];
    const size = kind ? footprint(item.type) : null;
    if (!kind || !size) continue;
    const c1 = item.col + size.w - 1;
    const r1 = item.row + size.h - 1;
    const cx = (item.col + c1) / 2;
    const cy = (item.row + r1) / 2;
    for (let r = item.row - 1; r <= r1 + 1; r++) {
      for (let c = item.col - 1; c <= c1 + 1; c++) {
        const inside = c >= item.col && c <= c1 && r >= item.row && r <= r1;
        const key = `${c},${r}`;
        if (inside || spots.has(key) || !isFree(c, r)) continue;
        spots.set(key, {
          col: c,
          row: r,
          facing: facingToward(c, r, cx, cy),
          kind,
          targetX: (cx + 0.5) * TILE_SIZE,
          targetY: item.row * TILE_SIZE + 6,
        });
      }
    }
  }
  return [...spots.values()];
}

export function say(ch: Character, text: string, duration = AGENT_CHAT_SEC): void {
  ch.say = { text, age: 0, duration };
}

export function startDance(ch: Character): void {
  ch.emote = { kind: 'dance', age: 0, duration: DANCE_SEC };
}

/** A quick excited hop (the boss starting an announcement). */
export function startHop(ch: Character): void {
  ch.emote = { kind: 'hop', age: 0, duration: 0.4 };
}

/** Shoot a basket: the ball arcs from the agent to the hoop (drawn by the renderer). */
export function startShot(ch: Character, spot: HangoutSpot): void {
  ch.emote = {
    kind: 'shoot',
    age: 0,
    duration: SHOT_SEC,
    targetX: spot.targetX,
    targetY: spot.targetY,
  };
}

/** Age chat and emotes; clear the ones that finished. */
export function advanceChatAndEmote(ch: Character, dt: number): void {
  if (ch.say) {
    ch.say.age += dt;
    if (ch.say.age >= ch.say.duration) ch.say = null;
  }
  if (ch.emote) {
    ch.emote.age += dt;
    if (ch.emote.age >= ch.emote.duration) ch.emote = null;
  }
}

/** One goof-off for an agent lingering at a hangout. */
export function goofOff(ch: Character, spot: HangoutSpot): void {
  if (spot.kind === 'party' && Math.random() < 0.6) startDance(ch);
  if (spot.kind === 'hoops') startShot(ch, spot);
  if (!ch.say && Math.random() < 0.6) say(ch, pick(GOOF_LINES[spot.kind]));
}

// ── Rendering helpers (canvas renderer + DOM overlay) ─────────────

const SPIN: Direction[] = [Direction.DOWN, Direction.LEFT, Direction.UP, Direction.RIGHT];

/** Vertical hop (sprite px, negative = up) while dancing, or the jump of a jump shot. */
export function emoteHop(ch: Character): number {
  const e = ch.emote;
  if (!e) return 0;
  if (e.kind === 'shoot' || e.kind === 'hop')
    return e.age < 0.35 ? -Math.round(Math.sin((e.age / 0.35) * Math.PI) * 4) : 0;
  return -Math.round(Math.abs(Math.sin(e.age * Math.PI * 3)) * 3);
}

/** Facing to draw while dancing: a little spin. Null otherwise. */
export function emoteFacing(ch: Character): Direction | null {
  if (ch.emote?.kind !== 'dance') return null;
  return SPIN[Math.floor(ch.emote.age * 5) % SPIN.length];
}

/** Where the ball is mid-shot (world px), or null when not shooting. */
export function shotBall(ch: Character): { x: number; y: number } | null {
  const e = ch.emote;
  if (e?.kind !== 'shoot' || e.targetX === undefined || e.targetY === undefined) return null;
  const flight = e.duration * 0.8;
  if (e.age > flight) {
    // Through the net: a short drop below the rim.
    const k = Math.min(1, (e.age - flight) / (e.duration - flight));
    return { x: e.targetX, y: e.targetY + k * NET_DROP_PX };
  }
  const t = e.age / flight;
  const sx = ch.x;
  const sy = ch.y - 26;
  return {
    x: sx + (e.targetX - sx) * t,
    y: sy + (e.targetY - sy) * t - Math.sin(t * Math.PI) * 22,
  };
}

/** How far the ball drops through the net after a shot (world px). */
const NET_DROP_PX = 12;

/** Where the ball is while dribbling (world px) at time `now` (seconds), or null. */
export function dribbleBall(ch: Character, now: number): { x: number; y: number } | null {
  if (!ch.dribbling || ch.emote || ch.state !== CharacterState.IDLE) return null;
  const side = ch.dir === Direction.LEFT ? -6 : ch.dir === Direction.UP ? 4 : 6;
  const bounce = Math.abs(Math.sin((now + ch.id * 0.37) * Math.PI * 1.6));
  return { x: ch.x + side, y: ch.y + 2 - bounce * 14 };
}

/** True when the agent is idle and standing still (eligible to settle at a hangout). */
export function isLoafing(ch: Character): boolean {
  return !ch.isActive && ch.state === CharacterState.IDLE && !ch.isSubagent && !ch.matrixEffect;
}
