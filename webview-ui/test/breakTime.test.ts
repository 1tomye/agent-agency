/**
 * Break time (office/breakTime.ts): idle agents hang out in the break room or at
 * the warehouse hoop instead of resting at their desk, and goof off there.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { beforeAll, test } from 'vitest';

import { buildHangouts, dribbleBall, shotBall, startShot } from '../src/office/breakTime.js';
import { createCharacter } from '../src/office/engine/characters.js';
import { OfficeState } from '../src/office/engine/officeState.js';
import { buildDynamicCatalog } from '../src/office/layout/furnitureCatalog.js';
import type { OfficeLayout } from '../src/office/types.js';
import { CharacterState, Direction, TileType } from '../src/office/types.js';

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
    entry('BREAK_TABLE', 'desks', 2, 2, { backgroundTiles: 1 }),
    entry('BASKETBALL_HOOP', 'decor', 1, 3, { backgroundTiles: 2 }),
    entry('BASKETBALL', 'decor', 1, 1, { backgroundTiles: 1 }),
    entry('FORKLIFT', 'decor', 2, 2, { backgroundTiles: 1 }),
    entry('PAPER_PALLET', 'decor', 2, 2, { backgroundTiles: 1 }),
    entry('PAPER_BOXES', 'storage', 1, 2, { backgroundTiles: 1 }),
  ];
  buildDynamicCatalog({
    catalog,
    sprites: Object.fromEntries(catalog.map((c) => [c.id, sprite(c.footprintW, c.footprintH)])),
  });
});

const footprint = (type: string) =>
  ({ BREAK_TABLE: { w: 2, h: 2 }, BASKETBALL_HOOP: { w: 1, h: 3 } })[type] ?? null;

test('hangouts ring the break table and the hoop; the hoop is for shooting', () => {
  const spots = buildHangouts(
    [
      { uid: 't', type: 'BREAK_TABLE', col: 2, row: 2 },
      { uid: 'h', type: 'BASKETBALL_HOOP', col: 10, row: 2 },
      { uid: 'x', type: 'OFFICE_DESK_FRONT', col: 5, row: 8 },
    ],
    footprint,
    () => true,
  );
  assert.equal(spots.filter((s) => s.kind === 'snack').length, 12);
  const hoops = spots.filter((s) => s.kind === 'hoops');
  assert.equal(hoops.length, 12);
  const west = hoops.find((s) => s.col === 9 && s.row === 3);
  assert.equal(west?.facing, Direction.RIGHT);
});

test('a jump shot arcs from the agent toward the rim', () => {
  const ch = createCharacter(1, 0, null, null);
  ch.x = 40;
  ch.y = 60;
  startShot(ch, {
    col: 0,
    row: 0,
    facing: Direction.RIGHT,
    kind: 'hoops',
    targetX: 120,
    targetY: 20,
  });
  const start = shotBall(ch)!;
  ch.emote!.age = ch.emote!.duration * 0.4;
  const mid = shotBall(ch)!;
  ch.emote!.age = ch.emote!.duration * 0.8;
  const end = shotBall(ch)!;
  assert.ok(start.x < mid.x && mid.x < end.x, 'travels toward the hoop');
  assert.ok(mid.y < Math.min(start.y, end.y), 'arcs up over the straight line');
  assert.deepEqual([Math.round(end.x), Math.round(end.y)], [120, 20], 'lands at the rim');
});

test('after the rim the ball drops through the net', () => {
  const ch = createCharacter(2, 0, null, null);
  ch.x = 40;
  ch.y = 60;
  startShot(ch, {
    col: 0,
    row: 0,
    facing: Direction.RIGHT,
    kind: 'hoops',
    targetX: 120,
    targetY: 20,
  });
  ch.emote!.age = ch.emote!.duration * 0.99;
  const ball = shotBall(ch)!;
  assert.equal(ball.x, 120);
  assert.ok(ball.y > 20, 'below the rim');
});

test('a player at the hoop dribbles between hand and floor', () => {
  const ch = createCharacter(3, 0, null, null);
  ch.x = 40;
  ch.y = 60;
  ch.state = CharacterState.IDLE;
  assert.equal(dribbleBall(ch, 0), null, 'no ball unless dribbling');
  ch.dribbling = true;
  const heights = Array.from({ length: 40 }, (_, i) => dribbleBall(ch, i * 0.05)!.y);
  assert.ok(Math.max(...heights) >= 60, 'hits the floor');
  assert.ok(Math.min(...heights) <= 50, 'comes back up to the hand');
  ch.emote = { kind: 'shoot', age: 0, duration: 1 };
  assert.equal(dribbleBall(ch, 0), null, 'not while shooting');
});

/** 14x10 floor: two desks, a break table, a hoop. */
function officeLayout(): OfficeLayout {
  const cols = 14;
  const rows = 10;
  return {
    version: 1,
    cols,
    rows,
    tiles: new Array<TileType>(cols * rows).fill(TileType.FLOOR_1),
    furniture: [
      { uid: 'desk', type: 'OFFICE_DESK_FRONT', col: 1, row: 1 },
      { uid: 'pc', type: 'CRT_PC_OFF', col: 2, row: 1 },
      { uid: 'chair', type: 'OFFICE_CHAIR_BACK', col: 2, row: 3 },
      { uid: 'table', type: 'BREAK_TABLE', col: 8, row: 2 },
      { uid: 'hoop', type: 'BASKETBALL_HOOP', col: 11, row: 5 },
      { uid: 'ball', type: 'BASKETBALL', col: 9, row: 8 },
    ],
  };
}

function run(os: OfficeState, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds; t += 0.1) {
    os.update(0.1);
    each?.();
  }
}

test('when a turn ends the agent heads for a hangout, not back to the desk', () => {
  const os = new OfficeState(officeLayout());
  os.addAgent(1, 0, 0, undefined, true);
  const ch = os.characters.get(1)!;
  os.setAgentActive(1, true);
  run(os, 5);
  os.setAgentActive(1, false);

  let settled = false;
  let goofed = false;
  run(os, 240, () => {
    if (ch.hangoutSettled) settled = true;
    if (ch.say || ch.emote) goofed = true;
    assert.notEqual(
      ch.state === CharacterState.TYPE && !ch.isActive && ch.tileCol === 2 && ch.tileRow === 3,
      true,
      'never sits back down at the desk while idle',
    );
  });
  assert.ok(settled, 'settled in at a hangout');
  assert.ok(goofed, 'goofed off at some point');
  assert.equal(ch.restAtSeat, false);
  const spot = os.hangouts.find((h) => h.col === ch.tileCol && h.row === ch.tileRow);
  if (spot && ch.state === CharacterState.IDLE && !ch.emote) assert.equal(ch.dir, spot.facing);
});

test('one ball: it leaves the floor while someone plays and comes back after', () => {
  const os = new OfficeState(officeLayout());
  os.addAgent(1, 0, 0, undefined, true);
  const ch = os.characters.get(1)!;
  os.update(0.1);
  const onFloor = os.furniture.length;
  ch.dribbling = true;
  os.update(0.1);
  assert.equal(os.furniture.length, onFloor - 1, 'picked up');
  ch.dribbling = false;
  ch.emote = null;
  os.update(0.1);
  assert.equal(os.furniture.length, onFloor, 'put back down');
});

/** 16x10 floor with a desk, the forklift, a pallet of paper and a stack of boxes. */
function warehouseLayout(): OfficeLayout {
  const cols = 16;
  const rows = 10;
  return {
    version: 1,
    cols,
    rows,
    tiles: new Array<TileType>(cols * rows).fill(TileType.FLOOR_1),
    furniture: [
      { uid: 'desk', type: 'OFFICE_DESK_FRONT', col: 1, row: 1 },
      { uid: 'pc', type: 'CRT_PC_OFF', col: 2, row: 1 },
      { uid: 'chair', type: 'OFFICE_CHAIR_BACK', col: 2, row: 3 },
      { uid: 'pallet', type: 'PAPER_PALLET', col: 2, row: 6 },
      { uid: 'forklift', type: 'FORKLIFT', col: 7, row: 6 },
      { uid: 'boxes', type: 'PAPER_BOXES', col: 13, row: 6 },
    ],
  };
}

function idleAt(os: OfficeState, id: number, col: number, row: number) {
  const ch = os.characters.get(id)!;
  os.setAgentActive(id, true);
  os.setAgentActive(id, false);
  ch.path = [];
  ch.state = CharacterState.IDLE;
  ch.tileCol = col;
  ch.tileRow = row;
  ch.x = col * 16 + 8;
  ch.y = row * 16 + 8;
  ch.wanderTimer = 100;
  return ch;
}

test('a loafer at the forklift drives a few pallets across the warehouse, then parks', () => {
  const os = new OfficeState(warehouseLayout());
  assert.ok(os.forkliftRoute, 'route found');
  os.addAgent(1, 0, 0, undefined, true);
  const parkedCount = os.furniture.length; // forklift in its spot
  const park = os.forkliftRoute!.park;
  const ch = idleAt(os, 1, park.col, park.row);
  os.update(0.1);
  assert.ok(ch.driving, 'hopped on');
  assert.equal(os.forkliftDriverId, 1);
  assert.equal(os.furniture.length, parkedCount - 1, 'the parked forklift is out on the floor');

  const phases = new Set<string>();
  let carried = false;
  for (let t = 0; t < 300 && ch.driving; t += 0.1) {
    os.update(0.1);
    if (ch.driving) phases.add(ch.driving.phase);
    if (ch.driving?.loaded) carried = true;
  }
  assert.ok(carried, 'carried a pallet');
  assert.ok(phases.has('toDrop') && phases.has('unloading'), [...phases].join(', '));
  assert.equal(ch.driving ?? null, null, 'shift over');
  assert.equal(os.forkliftDriverId, null);
  os.update(0.1);
  assert.equal(os.furniture.length, parkedCount, 'forklift back in its spot');
});

test('a new turn ends the forklift shift right away', () => {
  const os = new OfficeState(warehouseLayout());
  os.addAgent(1, 0, 0, undefined, true);
  const park = os.forkliftRoute!.park;
  const ch = idleAt(os, 1, park.col, park.row);
  os.update(0.1);
  os.update(0.1);
  assert.ok(ch.driving);
  os.setAgentActive(1, true);
  os.update(0.1);
  assert.equal(ch.driving ?? null, null);
  assert.equal(os.forkliftDriverId, null);
});
