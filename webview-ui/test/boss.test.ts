/**
 * The boss NPC (office/boss.ts) through OfficeState's game loop on a tiny office:
 * he starts at the desk with the World's Best Boss mug, keeps that chair for
 * himself, wanders between activities, and goes to congratulate an agent who
 * finishes a turn.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { afterEach, beforeAll, test, vi } from 'vitest';

import { agentPaletteCount } from '../../core/src/constants.js';
import { BOSS_LINES, chooseActivity } from '../src/office/boss.js';
import { OfficeState } from '../src/office/engine/officeState.js';
import { buildDynamicCatalog } from '../src/office/layout/furnitureCatalog.js';
import type { OfficeLayout } from '../src/office/types.js';
import { CharacterState, TileType } from '../src/office/types.js';

/** Sprites only need to exist for the catalog; transparent pixels will do. */
const sprite = (w: number, h: number) =>
  Array.from({ length: h }, () => new Array<string>(w).fill(''));

beforeAll(() => {
  const entry = (id: string, category: string, w: number, h: number, extra = {}) => ({
    id,
    label: id,
    category,
    width: 16 * w,
    height: 16 * h,
    footprintW: w,
    footprintH: h,
    isDesk: category === 'desks',
    ...extra,
  });
  const catalog = [
    entry('OFFICE_DESK_FRONT', 'desks', 3, 2, { backgroundTiles: 1 }),
    entry('CRT_PC_OFF', 'electronics', 1, 2, { backgroundTiles: 1, canPlaceOnSurfaces: true }),
    entry('OFFICE_CHAIR_BACK', 'chairs', 1, 1, { orientation: 'back' }),
    entry('BEST_BOSS_MUG', 'misc', 1, 1, { canPlaceOnSurfaces: true }),
    entry('CONFERENCE_TABLE', 'desks', 4, 2, { backgroundTiles: 1 }),
    entry('WATER_COOLER', 'decor', 1, 2, { backgroundTiles: 1 }),
    entry('BASKETBALL_HOOP', 'decor', 1, 3, { backgroundTiles: 2 }),
    entry('PARTY_TABLE', 'desks', 3, 2, { backgroundTiles: 1 }),
  ];
  buildDynamicCatalog({
    catalog,
    sprites: Object.fromEntries(catalog.map((c) => [c.id, sprite(c.footprintW, c.footprintH)])),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** 16x12 floor: the boss's desk (with the mug), two agent desks, a conference table, a cooler. */
function officeLayout(): OfficeLayout {
  const cols = 16;
  const rows = 12;
  return {
    version: 1,
    cols,
    rows,
    tiles: new Array<TileType>(cols * rows).fill(TileType.FLOOR_1),
    furniture: [
      { uid: 'boss-desk', type: 'OFFICE_DESK_FRONT', col: 11, row: 1 },
      { uid: 'boss-pc', type: 'CRT_PC_OFF', col: 12, row: 1 },
      { uid: 'mug', type: 'BEST_BOSS_MUG', col: 13, row: 1 },
      { uid: 'boss-chair', type: 'OFFICE_CHAIR_BACK', col: 12, row: 3 },
      { uid: 'desk-a', type: 'OFFICE_DESK_FRONT', col: 1, row: 1 },
      { uid: 'pc-a', type: 'CRT_PC_OFF', col: 2, row: 1 },
      { uid: 'chair-a', type: 'OFFICE_CHAIR_BACK', col: 2, row: 3 },
      { uid: 'desk-b', type: 'OFFICE_DESK_FRONT', col: 5, row: 1 },
      { uid: 'pc-b', type: 'CRT_PC_OFF', col: 6, row: 1 },
      { uid: 'chair-b', type: 'OFFICE_CHAIR_BACK', col: 6, row: 3 },
      { uid: 'table', type: 'CONFERENCE_TABLE', col: 5, row: 7 },
      { uid: 'cooler', type: 'WATER_COOLER', col: 13, row: 8 },
      { uid: 'hoop', type: 'BASKETBALL_HOOP', col: 14, row: 5 },
      { uid: 'party', type: 'PARTY_TABLE', col: 1, row: 7 },
    ],
  };
}

function run(os: OfficeState, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds; t += 0.1) {
    os.update(0.1);
    each?.();
  }
}

test('agents are never dressed in the boss sheet (the last one)', () => {
  assert.equal(agentPaletteCount(7), 6);
  assert.equal(agentPaletteCount(1), 1, 'a single sheet still dresses agents');
});

test('the boss starts at the desk with the mug, seated, and keeps that chair', () => {
  const os = new OfficeState(officeLayout());
  const boss = os.boss;
  assert.ok(boss, 'boss exists');
  assert.equal(boss.isBoss, true);
  assert.deepEqual([boss.tileCol, boss.tileRow], [12, 3]);
  assert.equal(boss.state, CharacterState.TYPE);
  assert.equal(os.characters.has(boss.id), false, 'not an agent');
  assert.ok(os.getCharacters().includes(boss), 'but drawn');

  os.addAgent(1, 0, 0, undefined, true);
  os.addAgent(2, 1, 0, undefined, true);
  os.addAgent(3, 2, 0, undefined, true);
  const seats = [1, 2, 3].map((id) => os.characters.get(id)!.seatId);
  assert.ok(!seats.includes(boss.seatId), 'no agent takes the boss chair');
});

test('a layout without a boss desk has no boss', () => {
  const layout = officeLayout();
  layout.furniture = layout.furniture.filter((f) => f.type !== 'BEST_BOSS_MUG');
  assert.equal(new OfficeState(layout).boss, null);
});

test('over time he wanders between activities and talks', () => {
  const os = new OfficeState(officeLayout());
  os.addAgent(1, 0, 0, undefined, true);
  const seen = new Set<string>();
  const lines = new Set<string>();
  run(os, 600, () => {
    seen.add(os.bossActivity ?? '');
    if (os.boss?.say) lines.add(os.boss.say.text);
  });
  assert.ok(seen.size >= 3, `visited ${[...seen].join(', ')}`);
  assert.ok(lines.size >= 3, 'says a few different things');
  const allLines = new Set(Object.values(BOSS_LINES).flat());
  assert.ok([...lines].every((l) => allLines.has(l)));
});

test('he congratulates an agent who finishes a turn', () => {
  const os = new OfficeState(officeLayout());
  os.addAgent(1, 0, 0, undefined, true);
  const agent = os.characters.get(1)!;
  os.setAgentActive(1, true);
  vi.spyOn(Math, 'random').mockReturnValue(0.1); // always in the mood to celebrate
  os.setAgentActive(1, false);
  vi.restoreAllMocks();
  run(os, 1);
  assert.equal(os.bossActivity, 'congrats');

  const seat = os.seats.get(agent.seatId!)!;
  let saidBeside = '';
  run(os, 30, () => {
    const boss = os.boss!;
    const said = boss.say?.text;
    const d = Math.abs(boss.tileCol - seat.seatCol) + Math.abs(boss.tileRow - seat.seatRow);
    if (said && BOSS_LINES.congrats.includes(said) && d === 1) saidBeside = said;
  });
  assert.ok(saidBeside, 'walked over and said something nice, right beside the agent');
});

test('chooseActivity never repeats itself and skips places he cannot go', () => {
  for (let i = 0; i < 50; i++) {
    const a = chooseActivity('snack', (x) => x !== 'meeting');
    assert.notEqual(a, 'snack');
    assert.notEqual(a, 'meeting');
  }
});

test('the boss goofs off too: jump shots on the court, dancing at the party', () => {
  const os = new OfficeState(officeLayout());
  os.addAgent(1, 0, 0, undefined, true);
  const activities = new Set<string>();
  const moves = new Set<string>();
  run(os, 1500, () => {
    activities.add(os.bossActivity ?? '');
    const kind = os.boss?.emote?.kind;
    if (kind) moves.add(kind);
  });
  assert.ok(activities.has('hoops') || activities.has('party'), [...activities].join(', '));
  assert.ok(moves.has('shoot') || moves.has('dance'), `moves: ${[...moves].join(', ')}`);
});

test('he paces while he holds a meeting or makes an announcement', () => {
  const os = new OfficeState(officeLayout());
  const boss = os.boss!;
  let paced = false;
  run(os, 1500, () => {
    const a = os.bossActivity;
    if ((a === 'meeting' || a === 'announce') && boss.path.length > 0 && boss.say) paced = true;
  });
  assert.ok(paced, 'took a pacing step mid-speech');
});
