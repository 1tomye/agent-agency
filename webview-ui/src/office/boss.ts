/**
 * The boss — an always-in-the-office character who is not an agent.
 *
 * A well-meaning, attention-hungry regional manager: drops by agents' desks,
 * calls meetings, raids the break room, makes announcements nobody asked for,
 * celebrates when an agent finishes, and retreats to his office. Lines are
 * original, written in the voice of a sitcom boss; none are quotes from a show.
 *
 * Places come from the layout: his chair is the seat at the desk with the
 * "World's Best Boss" mug; the rest are free tiles around the conference
 * table, break room, windows, water cooler and the middle of the bullpen.
 * OfficeState owns the boss Character and calls updateBoss() every frame.
 */
import {
  TYPE_FRAME_DURATION_SEC,
  WALK_FRAME_DURATION_SEC,
  WALK_SPEED_PX_PER_SEC,
} from '../constants.js';
import type { Character, PlacedFurniture, Seat } from './types.js';
import { CharacterState, Direction, TILE_SIZE } from './types.js';

export const BOSS_ID = -2_000_000_000;

export type BossActivity =
  | 'office'
  | 'visit'
  | 'meeting'
  | 'snack'
  | 'announce'
  | 'window'
  | 'cooler'
  | 'congrats'
  | 'hoops'
  | 'party';

export interface BossSpot {
  col: number;
  row: number;
  facing: Direction;
}

export interface BossPlaces {
  /** His chair (a real seat, reserved so no agent takes it) */
  seat: (BossSpot & { uid: string }) | null;
  meeting: BossSpot[];
  snack: BossSpot[];
  announce: BossSpot[];
  window: BossSpot[];
  cooler: BossSpot[];
}

export interface BossBrain {
  activity: BossActivity;
  /** Seconds left at the activity once arrived */
  timer: number;
  arrived: boolean;
  target: BossSpot | null;
  /** How long this stay was planned to last (timer's starting value) */
  stay: number;
  /** Seconds until he chimes in again while lingering */
  nextLine: number;
  /** Agent whose finished turn he'll celebrate next */
  pendingCongrats: number | null;
  /** Seconds until his next move while lingering (a jump shot, a dance, a pace) */
  nextMove: number;
  /** Where a jump shot is aimed (the hoop), when goofing off on the court */
  shotTarget: { x: number; y: number } | null;
}

export const BOSS_LINES: Record<BossActivity, readonly string[]> = {
  office: [
    "Do not disturb. Unless it's fun.",
    'On hold with corporate. Again.',
    'Brainstorming. Big things coming.',
    'Updating my calendar of fun.',
    "I'm not napping. My eyes are resting their brains.",
    'This office runs on two things: paper and me.',
    'Writing my memoirs. Chapter one: Me.',
    'Should I get a second monitor? For my feelings?',
    'Emails answered: zero. Emails thought about: tons.',
    "Someone took my good pen. I'm not mad. I'm disappointed. And mad.",
  ],
  visit: [
    'How we doing, champ?',
    'Working hard, or hardly working?',
    'That code looks... busy. Love it.',
    'Quick question. Not urgent. Very urgent.',
    "You're doing great. I think.",
    'Got a sec? It will take ten minutes.',
    "Pretend I'm not here. Boss, but also buddy.",
    "Is that a bug or a feature? Don't tell me, I'll guess.",
    'I respect you. As a person. And as an employee. Mostly that.',
    'Mind if I hover? I learn by hovering.',
  ],
  meeting: [
    'Conference room, five minutes!',
    'Meeting time! Snacks were promised.',
    'Agenda item one: me.',
    'This meeting could have been a party.',
    "Let's synergize the... the thing. You know.",
    'No bad ideas in here. Except the bad ones.',
    "Who wants to lead? Kidding. I'll lead.",
    "Let's circle back. And then circle forward.",
  ],
  snack: [
    'Who brought cake?!',
    'Is this decaf? It tastes like decaf.',
    'The vending machine owes me a dollar.',
    'Break room is basically an idea room.',
    'Whose yogurt is this? Asking for me.',
    'I deserve this. Probably.',
    'Nobody saw me take two.',
    'Pretzel day is the best day of the year.',
  ],
  announce: [
    'Attention, everyone! ...that is all.',
    'Mandatory fun at three!',
    'Paper is the future. Write that down.',
    'Nobody tell corporate.',
    'I love this team. Group hug later.',
    'Casual Friday is now Casual Everyday. Except Monday.',
    'Reminder: my door is always open. It is broken, actually.',
    "Big news! ...I'll tell you later.",
    'Whoever fixed the printer: you are a hero.',
  ],
  window: [
    'What a view. The parking lot.',
    'Thinking big thoughts.',
    'Someday all of this will be... still a parking lot.',
  ],
  cooler: [
    'Water cooler talk! What did I miss?',
    'Hydration is leadership.',
    'I hear things. Water things.',
  ],
  congrats: [
    'Nailed it!',
    "Now THAT's teamwork!",
    'Promotion! ...not really.',
    'Gold star for you!',
    'I taught them that.',
    'Somebody get this person a trophy!',
  ],
  hoops: [
    'The boss is on the court!',
    'Swish! Did everyone see that?',
    'That counts. Boss rules.',
    'Pick-up game, anyone?',
    'Nothing but net. Mostly net.',
  ],
  party: [
    'Did somebody say party?',
    'I love a good office party.',
    'Who wants to see my dance?',
    "Cake! For me? You shouldn't have.",
  ],
};

/** Seconds spent at each activity once there: [min, max]. */
const STAY: Record<BossActivity, [number, number]> = {
  office: [25, 60],
  visit: [6, 10],
  meeting: [10, 18],
  snack: [8, 14],
  announce: [5, 8],
  window: [6, 12],
  cooler: [6, 10],
  congrats: [4, 6],
  hoops: [12, 20],
  party: [8, 14],
};

/** How likely each wander is (visits need agents; congrats come from events). */
const WEIGHTS: Array<[BossActivity, number]> = [
  ['office', 5], // he's at his desk more than anywhere else
  ['visit', 3],
  ['announce', 2],
  ['snack', 2],
  ['meeting', 1.5],
  ['window', 1],
  ['cooler', 1],
  ['hoops', 1.5], // the boss goofs off too
  ['party', 1.5],
];

/** Seconds between moves while lingering: [min, max]. */
export const BOSS_MOVE_SEC: [number, number] = [3, 6];

export const BOSS_CHAT_SEC = 5;
/** While lingering he chimes in every so often: [min, max] seconds. */
export const BOSS_CHIME_SEC: [number, number] = [9, 15];

export function randomRange([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Weighted next activity, never repeating the last one, skipping ones with nowhere to go. */
export function chooseActivity(
  last: BossActivity | null,
  available: (a: BossActivity) => boolean,
): BossActivity {
  const options = WEIGHTS.filter(([a]) => a !== last && available(a));
  if (options.length === 0) return 'office';
  let roll = Math.random() * options.reduce((sum, [, w]) => sum + w, 0);
  for (const [activity, weight] of options) {
    roll -= weight;
    if (roll <= 0) return activity;
  }
  return options[options.length - 1][0];
}

export function stayFor(activity: BossActivity): number {
  return randomRange(STAY[activity]);
}

export function newBrain(): BossBrain {
  return {
    activity: 'office',
    timer: stayFor('office') / 2,
    arrived: true,
    target: null,
    stay: 0,
    nextLine: 2,
    pendingCongrats: null,
    nextMove: 3,
    shotTarget: null,
  };
}

export function bossSay(ch: Character, text: string): void {
  ch.say = { text, age: 0, duration: BOSS_CHAT_SEC };
}

// ── Places ──────────────────────────────────────────────────────────

type Footprint = (type: string) => { w: number; h: number } | null;

function facingToward(c: number, r: number, cx: number, cy: number): Direction {
  const dx = cx - c;
  const dy = cy - r;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? Direction.RIGHT : Direction.LEFT;
  return dy > 0 ? Direction.DOWN : Direction.UP;
}

/** Free tiles around every piece of furniture of the given types, facing it. */
function around(
  furniture: PlacedFurniture[],
  types: readonly string[],
  footprint: Footprint,
  isFree: (c: number, r: number) => boolean,
): BossSpot[] {
  const spots: BossSpot[] = [];
  for (const item of furniture) {
    if (!types.includes(item.type)) continue;
    const size = footprint(item.type);
    if (!size) continue;
    const c1 = item.col + size.w - 1;
    const r1 = item.row + size.h - 1;
    const cx = (item.col + c1) / 2;
    const cy = (item.row + r1) / 2;
    for (let r = item.row - 1; r <= r1 + 1; r++) {
      for (let c = item.col - 1; c <= c1 + 1; c++) {
        const inside = c >= item.col && c <= c1 && r >= item.row && r <= r1;
        if (!inside && isFree(c, r))
          spots.push({ col: c, row: r, facing: facingToward(c, r, cx, cy) });
      }
    }
  }
  return spots;
}

export function buildBossPlaces(
  furniture: PlacedFurniture[],
  seats: Map<string, Seat>,
  footprint: Footprint,
  isFree: (c: number, r: number) => boolean,
  isWalkable: (c: number, r: number) => boolean,
): BossPlaces {
  // His chair: the seat closest to the "World's Best Boss" mug.
  const mug = furniture.find((f) => f.type === 'BEST_BOSS_MUG');
  let seat: BossPlaces['seat'] = null;
  if (mug) {
    let best = Infinity;
    for (const [uid, s] of seats) {
      const d = Math.abs(s.seatCol - mug.col) + Math.abs(s.seatRow - mug.row);
      if (d < best) {
        best = d;
        seat = { uid, col: s.seatCol, row: s.seatRow, facing: s.facingDir };
      }
    }
  }
  // Announcements: the free tile nearest the middle of the bullpen desks.
  const desks = furniture.filter((f) => f.type === 'OFFICE_DESK_FRONT');
  const announce: BossSpot[] = [];
  if (desks.length > 0) {
    const mx = desks.reduce((s, d) => s + d.col + 1, 0) / desks.length;
    const my = desks.reduce((s, d) => s + d.row + 1, 0) / desks.length;
    let best: BossSpot | null = null;
    let bestD = Infinity;
    for (let r = Math.floor(my) - 3; r <= Math.ceil(my) + 3; r++) {
      for (let c = Math.floor(mx) - 3; c <= Math.ceil(mx) + 3; c++) {
        const d = Math.abs(c - mx) + Math.abs(r - my);
        if (isFree(c, r) && d < bestD) {
          bestD = d;
          best = { col: c, row: r, facing: Direction.DOWN };
        }
      }
    }
    if (best) announce.push(best);
  }
  // Windows hang on the front wall: stand two rows below, looking up at them.
  const window = furniture
    .filter((f) => f.type === 'WINDOW_BLINDS')
    .map((f) => ({ col: f.col, row: f.row + 2, facing: Direction.UP }))
    .filter((s) => isWalkable(s.col, s.row) && isFree(s.col, s.row));
  return {
    seat,
    meeting: around(furniture, ['CONFERENCE_TABLE'], footprint, isFree),
    snack: around(
      furniture,
      ['BREAK_TABLE', 'KITCHEN_COUNTER', 'FRIDGE', 'VENDING_MACHINE', 'PRETZEL_CART'],
      footprint,
      isFree,
    ),
    announce,
    window,
    cooler: around(furniture, ['WATER_COOLER'], footprint, isFree),
  };
}

// ── Movement (the boss has his own small mover; agents use characters.ts) ──

function tileCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
}

/** Advance along ch.path. Returns true once the path is used up. */
export function stepBossWalk(ch: Character, dt: number): boolean {
  if (ch.path.length === 0) {
    const c = tileCenter(ch.tileCol, ch.tileRow);
    ch.x = c.x;
    ch.y = c.y;
    return true;
  }
  ch.state = CharacterState.WALK;
  ch.frameTimer += dt;
  if (ch.frameTimer >= WALK_FRAME_DURATION_SEC) {
    ch.frameTimer -= WALK_FRAME_DURATION_SEC;
    ch.frame = (ch.frame + 1) % 4;
  }
  const next = ch.path[0];
  const dc = next.col - ch.tileCol;
  const dr = next.row - ch.tileRow;
  ch.dir =
    dc > 0 ? Direction.RIGHT : dc < 0 ? Direction.LEFT : dr > 0 ? Direction.DOWN : Direction.UP;
  ch.moveProgress += (WALK_SPEED_PX_PER_SEC / TILE_SIZE) * dt;
  const from = tileCenter(ch.tileCol, ch.tileRow);
  const to = tileCenter(next.col, next.row);
  const t = Math.min(ch.moveProgress, 1);
  ch.x = from.x + (to.x - from.x) * t;
  ch.y = from.y + (to.y - from.y) * t;
  if (ch.moveProgress >= 1) {
    ch.tileCol = next.col;
    ch.tileRow = next.row;
    ch.x = to.x;
    ch.y = to.y;
    ch.path.shift();
    ch.moveProgress = 0;
  }
  return false;
}

/** Stand (or sit at his desk) and animate while staying put. */
export function holdPose(ch: Character, dt: number, seated: boolean): void {
  ch.state = seated ? CharacterState.TYPE : CharacterState.IDLE;
  ch.frameTimer += dt;
  if (seated && ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
    ch.frameTimer -= TYPE_FRAME_DURATION_SEC;
    ch.frame = (ch.frame + 1) % 2;
  }
  if (!seated) ch.frame = 0;
}
