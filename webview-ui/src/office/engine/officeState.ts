import {
  agentPaletteCount,
  NPC_RESERVED_CHARACTER_SHEETS,
} from '../../../../core/src/constants.js';
import { pickDiversePalette } from '../../../../core/src/paletteUtils.js';
import {
  AUTO_ON_FACING_DEPTH,
  AUTO_ON_SIDE_DEPTH,
  CHARACTER_HIT_HALF_WIDTH,
  CHARACTER_HIT_HEIGHT,
  CHARACTER_SITTING_OFFSET_PX,
  DISMISS_BUBBLE_FAST_FADE_SEC,
  FURNITURE_ANIM_INTERVAL_SEC,
  GREETER_ID,
  GREETER_TILE_MARGIN,
  INACTIVE_SEAT_TIMER_MIN_SEC,
  INACTIVE_SEAT_TIMER_RANGE_SEC,
  MAX_PET_ID_LENGTH,
  PET_HIT_HALF_WIDTH,
  PET_HIT_HEIGHT,
  WAITING_BUBBLE_DURATION_SEC,
} from '../../constants.js';
import type { BossActivity, BossBrain, BossPlaces, BossSpot } from '../boss.js';
import {
  BOSS_CHIME_SEC,
  BOSS_ID,
  BOSS_LINES,
  BOSS_MOVE_SEC,
  bossSay,
  buildBossPlaces,
  chooseActivity,
  holdPose,
  newBrain,
  pick,
  randomRange,
  stayFor,
  stepBossWalk,
} from '../boss.js';
import type { HangoutSpot } from '../breakTime.js';
import {
  advanceChatAndEmote,
  buildHangouts,
  GOOF_EVERY_SEC,
  GOOF_LINES,
  goofOff,
  HANGOUT_STAY_SEC,
  isLoafing,
  pick as pickOne,
  randomRange as randomBetween,
  say,
  startDance,
  startHop,
  startShot,
} from '../breakTime.js';
import { getAnimationFrames, getCatalogEntry, getOnStateType } from '../layout/furnitureCatalog.js';
import {
  createDefaultLayout,
  getBlockedTiles,
  layoutToFurnitureInstances,
  layoutToSeats,
  layoutToTileMap,
} from '../layout/layoutSerializer.js';
import { findPath, getWalkableTiles, isWalkable } from '../layout/tileMap.js';
import { getPetCount, getPetName } from '../sprites/petSpriteData.js';
import { getLoadedCharacterCount } from '../sprites/spriteData.js';
import type {
  Character,
  FurnitureInstance,
  OfficeLayout,
  Pet,
  PlacedFurniture,
  PlacedPet,
  Seat,
  TileType as TileTypeVal,
} from '../types.js';
import { CharacterState, Direction, PetState, TILE_SIZE, TileType } from '../types.js';
import { createCharacter, updateCharacter } from './characters.js';
import { advanceMatrixEffect, startMatrixEffect } from './matrixEffectState.js';
import { createPet, updatePet } from './petEntity.js';
import { anchorTile, closestFreeSeat } from './seatPlacement.js';

/** Internal helper: facing-tile coords for a seat. Returns null for invalid direction. */
function seatFacingOffset(direction: Direction): { dCol: number; dRow: number } {
  if (direction === Direction.RIGHT) return { dCol: 1, dRow: 0 };
  if (direction === Direction.LEFT) return { dCol: -1, dRow: 0 };
  if (direction === Direction.DOWN) return { dCol: 0, dRow: 1 };
  return { dCol: 0, dRow: -1 };
}

/** How long the forklift rests between shifts. */
const FORKLIFT_REST_SEC = 45;

export class OfficeState {
  layout: OfficeLayout;
  tileMap: TileTypeVal[][];
  seats: Map<string, Seat>;
  blockedTiles: Set<string>;
  furniture: FurnitureInstance[];
  walkableTiles: Array<{ col: number; row: number }>;
  characters: Map<number, Character> = new Map();
  pets: Pet[] = [];
  /** Accumulated time for furniture animation frame cycling */
  furnitureAnimTimer = 0;
  private _selectedAgentId: number | null = null;
  private readonly selectionListeners = new Set<(id: number | null) => void>();
  get selectedAgentId(): number | null {
    return this._selectedAgentId;
  }
  set selectedAgentId(id: number | null) {
    if (this._selectedAgentId === id) return;
    this._selectedAgentId = id;
    for (const listener of this.selectionListeners) listener(id);
  }
  /** Observe selectedAgentId changes. React (the card bars) subscribes so
   *  imperative canvas selection can drive card highlights — everything else
   *  about selection stays out of React state. Returns the unsubscribe. */
  subscribeSelection(listener: (id: number | null) => void): () => void {
    this.selectionListeners.add(listener);
    return () => this.selectionListeners.delete(listener);
  }
  cameraFollowId: number | null = null;
  hoveredAgentId: number | null = null;
  hoveredTile: { col: number; row: number } | null = null;
  /** Maps "parentId:toolId" → sub-agent character ID (negative) */
  subagentIdMap: Map<string, number> = new Map();
  /** Reverse lookup: sub-agent character ID → parent info */
  subagentMeta: Map<number, { parentAgentId: number; parentToolId: string }> = new Map();
  private nextSubagentId = -1;

  /**
   * directoryName → list of Area labels that Directory belongs to.
   * Populated by useExtensionMessages on `areaMappingsLoaded`. Consulted by
   * `findFreeSeat()` to bias new agents toward seats inside their Directory's Area.
   */
  areaMappings: Record<string, string[]> = {};

  /**
   * The first-run consent greeter, deliberately NOT in `characters`.
   *
   * `characters` means "agents": everything that iterates it — seat
   * assignment, palette diversity, the wander FSM, hit-testing, the seat
   * payload the webview persists — is asking an agent question the greeter has
   * no answer to. Holding it here instead of tagging it with a flag makes
   * every one of those loops correct by default, rather than correct as long
   * as each remembers an `isGreeter` guard. It is drawn because
   * `getCharacters()` appends it, and that is the only place it joins the
   * others.
   */
  greeter: Character | null = null;
  /** The boss NPC (office/boss.ts): always in the office when the layout has his
   *  desk (the one with the World's Best Boss mug). Not an agent - kept out of
   *  `characters` like the greeter; joins the draw list in getCharacters(). */
  boss: Character | null = null;
  private bossBrain: BossBrain | null = null;
  bossPlaces: BossPlaces = {
    seat: null,
    meeting: [],
    snack: [],
    announce: [],
    window: [],
    cooler: [],
  };
  private walkableSet = new Set<string>();
  /** Break time (office/breakTime.ts): where idle agents hang out */
  hangouts: HangoutSpot[] = [];
  private hangoutAt = new Map<string, HangoutSpot>();
  private hangoutTiles: Array<{ col: number; row: number }> = [];
  /** Someone has the basketball (dribbling or mid-shot), so it's not on the floor */
  private ballInPlay = false;
  /** Warehouse forklift shifts: where pallets are picked up / dropped off, and who's driving */
  forkliftRoute: {
    pickup: { col: number; row: number };
    drop: { col: number; row: number };
    park: { col: number; row: number };
  } | null = null;
  forkliftDriverId: number | null = null;
  /** Seconds before anyone can start another forklift shift (it rests between shifts) */
  private forkliftCooldown = 0;

  /** World-space point the camera drifts to while the greeter is up
   *  (the bubble overlay recomputes it every frame: the combined center of the
   *  character and its speech bubble). An explicit cameraFollowId outranks it. */
  greeterCameraTarget: { x: number; y: number } | null = null;
  /** Latched by a manual pan during the ask: the user took the camera, so the
   *  overlay's per-frame updates stop re-centering. Reset on spawn/despawn. */
  private greeterCameraCancelled = false;

  setAreaMappings(mappings: Record<string, string[]>): void {
    this.areaMappings = mappings;
  }

  constructor(layout?: OfficeLayout) {
    this.layout = layout || createDefaultLayout();
    this.tileMap = layoutToTileMap(this.layout);
    this.seats = layoutToSeats(this.layout.furniture);
    this.blockedTiles = getBlockedTiles(this.layout.furniture);
    this.furniture = layoutToFurnitureInstances(this.layout.furniture);
    this.walkableTiles = getWalkableTiles(this.tileMap, this.blockedTiles);
    this.rebuildBossPlaces();
    this.rebuildHangouts();
    // Pets are built last because they need walkableTiles populated for spawn.
    this.rebuildPetsFromLayout(this.layout);
  }

  /** Rebuild all derived state from a new layout. Reassigns existing characters.
   *  @param shift Optional pixel shift to apply when grid expands left/up */
  rebuildFromLayout(layout: OfficeLayout, shift?: { col: number; row: number }): void {
    this.layout = layout;
    this.tileMap = layoutToTileMap(layout);
    this.seats = layoutToSeats(layout.furniture);
    this.blockedTiles = getBlockedTiles(layout.furniture);
    this.rebuildFurnitureInstances();
    this.walkableTiles = getWalkableTiles(this.tileMap, this.blockedTiles);

    // Shift character positions when grid expands left/up
    if (shift && (shift.col !== 0 || shift.row !== 0)) {
      for (const ch of this.characters.values()) {
        ch.tileCol += shift.col;
        ch.tileRow += shift.row;
        ch.x += shift.col * TILE_SIZE;
        ch.y += shift.row * TILE_SIZE;
        // Clear path since tile coords changed
        ch.path = [];
        ch.moveProgress = 0;
      }
    }

    // Shift pet positions when grid expands left/up
    if (shift && (shift.col !== 0 || shift.row !== 0)) {
      for (const pet of this.pets) {
        pet.tileCol += shift.col;
        pet.tileRow += shift.row;
        pet.x += shift.col * TILE_SIZE;
        pet.y += shift.row * TILE_SIZE;
        pet.path = [];
        pet.moveProgress = 0;
      }
    }

    // Reassign characters to new seats, preserving existing assignments when possible
    for (const seat of this.seats.values()) {
      seat.assigned = false;
    }
    // The boss's chair comes off the market before agents are seated.
    this.rebuildBossPlaces();
    this.rebuildHangouts();

    // First pass: try to keep characters at their existing seats
    for (const ch of this.characters.values()) {
      if (ch.seatId && this.seats.has(ch.seatId)) {
        const seat = this.seats.get(ch.seatId)!;
        if (!seat.assigned) {
          seat.assigned = true;
          // Snap character to seat position
          ch.tileCol = seat.seatCol;
          ch.tileRow = seat.seatRow;
          const cx = seat.seatCol * TILE_SIZE + TILE_SIZE / 2;
          const cy = seat.seatRow * TILE_SIZE + TILE_SIZE / 2;
          ch.x = cx;
          ch.y = cy;
          ch.dir = seat.facingDir;
          continue;
        }
      }
      ch.seatId = null; // will be reassigned below
    }

    // Second pass: assign remaining characters to free seats
    for (const ch of this.characters.values()) {
      if (ch.seatId) continue;
      const seatId = this.findFreeSeat(ch.directoryName);
      if (seatId) {
        this.seats.get(seatId)!.assigned = true;
        ch.seatId = seatId;
        const seat = this.seats.get(seatId)!;
        ch.tileCol = seat.seatCol;
        ch.tileRow = seat.seatRow;
        ch.x = seat.seatCol * TILE_SIZE + TILE_SIZE / 2;
        ch.y = seat.seatRow * TILE_SIZE + TILE_SIZE / 2;
        ch.dir = seat.facingDir;
      }
    }

    // Relocate any characters that ended up outside bounds or on non-walkable tiles
    for (const ch of this.characters.values()) {
      if (ch.seatId) continue; // seated characters are fine
      if (
        ch.tileCol < 0 ||
        ch.tileCol >= layout.cols ||
        ch.tileRow < 0 ||
        ch.tileRow >= layout.rows
      ) {
        this.relocateCharacterToWalkable(ch);
      }
    }

    // Relocate any pets that ended up outside bounds or on non-walkable tiles
    for (const pet of this.pets) {
      if (
        pet.tileCol < 0 ||
        pet.tileCol >= layout.cols ||
        pet.tileRow < 0 ||
        pet.tileRow >= layout.rows ||
        !isWalkable(pet.tileCol, pet.tileRow, this.tileMap, this.blockedTiles)
      ) {
        if (this.walkableTiles.length > 0) {
          const spawn = this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)];
          pet.tileCol = spawn.col;
          pet.tileRow = spawn.row;
          pet.x = spawn.col * TILE_SIZE + TILE_SIZE / 2;
          pet.y = spawn.row * TILE_SIZE + TILE_SIZE / 2;
          pet.path = [];
          pet.moveProgress = 0;
          pet.state = PetState.IDLE;
          pet.frame = 0;
          pet.frameTimer = 0;
          pet.followTargetId = null;
        }
      }
    }

    // Reconcile pets against the layout roster (handles editor add/remove)
    this.rebuildPetsFromLayout(layout);
  }

  /** Move a character to a random walkable tile */
  private relocateCharacterToWalkable(ch: Character): void {
    if (this.walkableTiles.length === 0) return;
    const spawn = this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)];
    ch.tileCol = spawn.col;
    ch.tileRow = spawn.row;
    ch.x = spawn.col * TILE_SIZE + TILE_SIZE / 2;
    ch.y = spawn.row * TILE_SIZE + TILE_SIZE / 2;
    ch.path = [];
    ch.moveProgress = 0;
  }

  getLayout(): OfficeLayout {
    return this.layout;
  }

  /** Get the blocked-tile key for a character's own seat, or null */
  private ownSeatKey(ch: Character): string | null {
    if (!ch.seatId) return null;
    const seat = this.seats.get(ch.seatId);
    if (!seat) return null;
    return `${seat.seatCol},${seat.seatRow}`;
  }

  /** Temporarily unblock a character's own seat, run fn, then re-block */
  private withOwnSeatUnblocked<T>(ch: Character, fn: () => T): T {
    const key = this.ownSeatKey(ch);
    if (key) this.blockedTiles.delete(key);
    const result = fn();
    if (key) this.blockedTiles.add(key);
    return result;
  }

  /** Collect every tile occupied by electronics furniture (PCs, monitors, etc.). */
  private buildElectronicsTileSet(): Set<string> {
    const out = new Set<string>();
    for (const item of this.layout.furniture) {
      const entry = getCatalogEntry(item.type);
      if (!entry || entry.category !== 'electronics') continue;
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          out.add(`${item.col + dc},${item.row + dr}`);
        }
      }
    }
    return out;
  }

  /** Find the area label assigned to a seat's tile, or null. Public for e2e
   *  observability (getAgentSeats hook reads a seated agent's area). */
  seatZone(uid: string): string | null {
    const seat = this.seats.get(uid);
    if (!seat) return null;
    const tiles = this.layout.areaTiles;
    if (!tiles || tiles.length === 0) return null;
    const idx = seat.seatRow * this.layout.cols + seat.seatCol;
    if (idx < 0 || idx >= tiles.length) return null;
    return tiles[idx] ?? null;
  }

  /**
   * Does this seat face an electronics tile (PC, monitor)? Mirrors the
   * forward-and-flanking scan used by furniture auto-state.
   */
  private isSeatFacingElectronics(seat: Seat, electronicsTiles: Set<string>): boolean {
    const { dCol, dRow } = seatFacingOffset(seat.facingDir);
    for (let d = 1; d <= AUTO_ON_FACING_DEPTH; d++) {
      const tileCol = seat.seatCol + dCol * d;
      const tileRow = seat.seatRow + dRow * d;
      if (electronicsTiles.has(`${tileCol},${tileRow}`)) return true;
      if (dCol !== 0) {
        if (
          electronicsTiles.has(`${tileCol},${tileRow - 1}`) ||
          electronicsTiles.has(`${tileCol},${tileRow + 1}`)
        ) {
          return true;
        }
      } else if (
        electronicsTiles.has(`${tileCol - 1},${tileRow}`) ||
        electronicsTiles.has(`${tileCol + 1},${tileRow}`)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Random-pick a seat from a candidate list, biased toward seats that face an
   * electronics tile. Returns null when the candidate list is empty.
   */
  private pickFromSeats(seatUids: string[], electronicsTiles: Set<string>): string | null {
    if (seatUids.length === 0) return null;
    const pcSeats: string[] = [];
    const otherSeats: string[] = [];
    for (const uid of seatUids) {
      const seat = this.seats.get(uid);
      if (!seat) continue;
      if (this.isSeatFacingElectronics(seat, electronicsTiles)) {
        pcSeats.push(uid);
      } else {
        otherSeats.push(uid);
      }
    }
    if (pcSeats.length > 0) return pcSeats[Math.floor(Math.random() * pcSeats.length)];
    if (otherSeats.length > 0) return otherSeats[Math.floor(Math.random() * otherSeats.length)];
    return null;
  }

  /**
   * 3-stage seat picker for top-level agents.
   *
   *   Stage 1: If `directoryName` is given and `areaMappings[directoryName]` lists
   *            Area labels, prefer free seats whose tile is labeled with one
   *            of those areas.
   *   Stage 2: Prefer free seats whose tile has NO area label (unzoned).
   *   Stage 3: Any free seat.
   *
   * Each stage routes through `pickFromSeats` for the PC-bias rule. Returns
   * null only when every seat is already occupied. Passing `undefined`
   * preserves pre-Areas single-stage behavior (skips Stage 1; Stage 2 picks
   * unzoned seats from a layout without `areaTiles`, which is every seat).
   */
  private findFreeSeat(directoryName?: string): string | null {
    const electronicsTiles = this.buildElectronicsTileSet();
    const freeSeats: string[] = [];
    for (const [uid, seat] of this.seats) {
      if (!seat.assigned) freeSeats.push(uid);
    }
    if (freeSeats.length === 0) return null;

    const areaLabels = directoryName ? this.areaMappings[directoryName] : undefined;

    // Stage 1 — in-area seats for the Directory's mapped Area labels.
    if (areaLabels && areaLabels.length > 0) {
      const wanted = new Set(areaLabels);
      const inArea = freeSeats.filter((uid) => {
        const label = this.seatZone(uid);
        return label !== null && wanted.has(label);
      });
      const pick = this.pickFromSeats(inArea, electronicsTiles);
      if (pick) return pick;
    }

    // Stage 2 — unzoned seats (no area label, or layout has no areas at all).
    const unzoned = freeSeats.filter((uid) => this.seatZone(uid) === null);
    const pick2 = this.pickFromSeats(unzoned, electronicsTiles);
    if (pick2) return pick2;

    // Stage 3 — any free seat.
    return this.pickFromSeats(freeSeats, electronicsTiles);
  }

  /** Closest walkable tile to (col,row) not occupied by another character, or null. */
  private closestFreeWalkableTile(col: number, row: number): { col: number; row: number } | null {
    const occupied = new Set<string>();
    for (const ch of this.characters.values()) {
      occupied.add(`${ch.tileCol},${ch.tileRow}`);
    }
    let best: { col: number; row: number } | null = null;
    let bestDist = Infinity;
    for (const tile of this.walkableTiles) {
      if (occupied.has(`${tile.col},${tile.row}`)) continue;
      const d = Math.abs(tile.col - col) + Math.abs(tile.row - row);
      if (d < bestDist) {
        best = tile;
        bestDist = d;
      }
    }
    return best;
  }

  /**
   * Pick a diverse palette for a new agent based on currently active agents.
   * First 6 agents each get a unique skin (random order). Beyond 6, skins
   * repeat in balanced rounds with a random hue shift (≥45°).
   */
  private pickDiversePalette(): { palette: number; hueShift: number } {
    // Count how many non-sub-agents use each base palette (0-5)
    // The last sheet is the boss NPC's; agents are never dressed in it.
    const paletteCount = agentPaletteCount(getLoadedCharacterCount());
    const counts = new Array(paletteCount).fill(0) as number[];
    for (const ch of this.characters.values()) {
      if (ch.isSubagent) continue;
      if (ch.palette < paletteCount) counts[ch.palette]++;
    }
    return pickDiversePalette(paletteCount, counts);
  }

  addAgent(
    id: number,
    preferredPalette?: number,
    preferredHueShift?: number,
    preferredSeatId?: string,
    skipSpawnEffect?: boolean,
    directoryName?: string,
    nearAgentId?: number,
  ): void {
    if (this.characters.has(id)) return;

    let palette: number;
    let hueShift: number;
    if (preferredPalette !== undefined) {
      palette = preferredPalette;
      hueShift = preferredHueShift ?? 0;
    } else {
      const pick = this.pickDiversePalette();
      palette = pick.palette;
      hueShift = pick.hueShift;
    }

    // Try preferred seat first, then (for teammates) the seat closest to the
    // anchor agent, then any free seat. anchorTile resolves to the anchor's SEAT
    // (stable from creation) rather than its live tile, so a teammate placed while
    // the lead is still walking to its seat still clusters around the final seat.
    const anchor = nearAgentId !== undefined ? this.characters.get(nearAgentId) : undefined;
    const anchorAt = anchorTile(anchor, this.seats);
    let seatId: string | null = null;
    if (preferredSeatId && this.seats.has(preferredSeatId)) {
      const seat = this.seats.get(preferredSeatId)!;
      if (!seat.assigned) {
        seatId = preferredSeatId;
      }
    }
    if (!seatId && anchorAt) {
      seatId = closestFreeSeat(this.seats, anchorAt.col, anchorAt.row);
    }
    if (!seatId) {
      seatId = this.findFreeSeat(directoryName);
    }

    let ch: Character;
    if (seatId) {
      const seat = this.seats.get(seatId)!;
      seat.assigned = true;
      ch = createCharacter(id, palette, seatId, seat, hueShift);
    } else {
      // No seats — teammates spawn beside their anchor, others at a random walkable tile
      let spawn = anchorAt ? this.closestFreeWalkableTile(anchorAt.col, anchorAt.row) : null;
      if (!spawn) {
        spawn =
          this.walkableTiles.length > 0
            ? this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)]
            : { col: 1, row: 1 };
      }
      ch = createCharacter(id, palette, null, null, hueShift);
      ch.x = spawn.col * TILE_SIZE + TILE_SIZE / 2;
      ch.y = spawn.row * TILE_SIZE + TILE_SIZE / 2;
      ch.tileCol = spawn.col;
      ch.tileRow = spawn.row;
    }

    if (directoryName) {
      ch.directoryName = directoryName;
    }
    if (!skipSpawnEffect) {
      startMatrixEffect(ch, 'spawn');
    }
    this.characters.set(id, ch);
  }

  // ── Greeter ───────────────────────────────────────────────────
  // The Intro is diegetic: a char_0 character stands near the office's
  // bottom-left corner and "speaks" the tour through a DOM bubble
  // (IntroBubble). It is not an agent — see the `greeter` field.

  /** Spawn the greeter near the office's bottom-left corner: target tile
   *  GREETER_TILE_MARGIN in from the left and bottom edges, falling
   *  back to the closest walkable tile when the target is a seat, furniture,
   *  a wall, or VOID (seat tiles are in blockedTiles, so closestFreeWalkableTile
   *  covers every one of those). Idempotent; a remount mid-despawn (StrictMode)
   *  revives it. */
  spawnGreeter(): void {
    this.greeterCameraCancelled = false;
    if (this.greeter) {
      if (this.greeter.matrixEffect === 'despawn') startMatrixEffect(this.greeter, 'spawn');
      return;
    }
    const spawn = this.closestFreeWalkableTile(
      GREETER_TILE_MARGIN,
      this.layout.rows - 1 - GREETER_TILE_MARGIN,
    );
    if (!spawn) return; // no walkable tile — IntroBubble falls back to a fixed panel
    const ch = createCharacter(GREETER_ID, 0, null, null, 0);
    ch.isGreeter = true;
    ch.state = CharacterState.IDLE;
    ch.isActive = false;
    ch.dir = Direction.DOWN;
    ch.x = spawn.col * TILE_SIZE + TILE_SIZE / 2;
    ch.y = spawn.row * TILE_SIZE + TILE_SIZE / 2;
    ch.tileCol = spawn.col;
    ch.tileRow = spawn.row;
    startMatrixEffect(ch, 'spawn');
    this.greeter = ch;
  }

  /** Start the greeter's despawn effect and release the greeter camera. The
   *  character is dropped once the effect finishes (see update()).
   *  Idempotent — every close path (answer, Escape, hooksStatus) funnels here. */
  despawnGreeter(): void {
    this.greeterCameraTarget = null;
    this.greeterCameraCancelled = false;
    if (!this.greeter || this.greeter.matrixEffect === 'despawn') return;
    startMatrixEffect(this.greeter, 'despawn');
  }

  /** Per-frame update from the bubble overlay; ignored once the user panned. */
  setGreeterCameraTarget(p: { x: number; y: number }): void {
    if (!this.greeterCameraCancelled) this.greeterCameraTarget = p;
  }

  /** Manual pan during the ask: stop re-centering until the next spawn. */
  cancelGreeterCamera(): void {
    this.greeterCameraTarget = null;
    this.greeterCameraCancelled = true;
  }

  /** Every manual pan (mouse, wheel, touch) takes the camera back from both
   *  automatic drivers: character follow and the greeter's ask. */
  breakCameraFollow(): void {
    this.cameraFollowId = null;
    this.cancelGreeterCamera();
  }

  /** Select an agent's character and have the camera follow it — what a card
   *  tap does to the office. No-op for an agent with no character. */
  selectAndFollow(id: number): void {
    if (!this.characters.has(id)) return;
    this.selectedAgentId = id;
    this.cameraFollowId = id;
  }

  /** The agent that owns `id`'s terminal: a sub-agent's parent, else itself. */
  terminalOwnerOf(id: number): number {
    return this.subagentMeta.get(id)?.parentAgentId ?? id;
  }

  removeAgent(id: number): void {
    const ch = this.characters.get(id);
    if (!ch) return;
    if (ch.matrixEffect === 'despawn') return; // already despawning
    // Free seat and clear selection immediately
    if (ch.seatId) {
      const seat = this.seats.get(ch.seatId);
      if (seat) seat.assigned = false;
    }
    if (this.selectedAgentId === id) this.selectedAgentId = null;
    if (this.cameraFollowId === id) this.cameraFollowId = null;
    // Start despawn animation instead of immediate delete
    startMatrixEffect(ch, 'despawn');
    ch.bubbleType = null;
  }

  /** Find seat uid at a given tile position, or null */
  getSeatAtTile(col: number, row: number): string | null {
    for (const [uid, seat] of this.seats) {
      if (seat.seatCol === col && seat.seatRow === row) return uid;
    }
    return null;
  }

  /** Reassign an agent from their current seat to a new seat */
  reassignSeat(agentId: number, seatId: string): void {
    const ch = this.characters.get(agentId);
    if (!ch) return;
    // Unassign old seat
    if (ch.seatId) {
      const old = this.seats.get(ch.seatId);
      if (old) old.assigned = false;
    }
    // Assign new seat
    const seat = this.seats.get(seatId);
    if (!seat || seat.assigned) return;
    seat.assigned = true;
    ch.seatId = seatId;
    // Pathfind to new seat (unblock own seat tile for this query)
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, this.tileMap, this.blockedTiles),
    );
    if (path.length > 0) {
      ch.path = path;
      ch.moveProgress = 0;
      ch.state = CharacterState.WALK;
      ch.frame = 0;
      ch.frameTimer = 0;
    } else {
      // Already at seat or no path — sit down
      ch.state = CharacterState.TYPE;
      ch.dir = seat.facingDir;
      ch.frame = 0;
      ch.frameTimer = 0;
      if (!ch.isActive) {
        ch.seatTimer = INACTIVE_SEAT_TIMER_MIN_SEC + Math.random() * INACTIVE_SEAT_TIMER_RANGE_SEC;
      }
    }
  }

  /**
   * Move a just-linked teammate to the free seat closest to its lead, so teams
   * cluster. Only moves when that seat is strictly closer than the teammate's
   * current one — a teammate created as a plain external agent (seated by an
   * arbitrary findFreeSeat) and tagged as a teammate only after tag discovery
   * would otherwise keep its arbitrary seat, unlike an inline teammate seated
   * next to the lead at creation.
   */
  private reseatNextToLead(teammateId: number, leadId: number): void {
    const teammate = this.characters.get(teammateId);
    const lead = this.characters.get(leadId);
    if (!teammate || !lead) return;
    const anchorAt = anchorTile(lead, this.seats);
    if (!anchorAt) return;
    const target = closestFreeSeat(this.seats, anchorAt.col, anchorAt.row);
    if (!target || target === teammate.seatId) return;
    const targetSeat = this.seats.get(target)!;
    const targetDist =
      Math.abs(targetSeat.seatCol - anchorAt.col) + Math.abs(targetSeat.seatRow - anchorAt.row);
    const currentSeat = teammate.seatId ? this.seats.get(teammate.seatId) : undefined;
    const currentDist = currentSeat
      ? Math.abs(currentSeat.seatCol - anchorAt.col) + Math.abs(currentSeat.seatRow - anchorAt.row)
      : Infinity;
    if (targetDist < currentDist) {
      this.reassignSeat(teammateId, target);
    }
  }

  /** Send an agent back to their currently assigned seat */
  sendToSeat(agentId: number): void {
    const ch = this.characters.get(agentId);
    if (!ch || !ch.seatId) return;
    const seat = this.seats.get(ch.seatId);
    if (!seat) return;
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, this.tileMap, this.blockedTiles),
    );
    if (path.length > 0) {
      ch.path = path;
      ch.moveProgress = 0;
      ch.state = CharacterState.WALK;
      ch.frame = 0;
      ch.frameTimer = 0;
    } else {
      // Already at seat — sit down
      ch.state = CharacterState.TYPE;
      ch.dir = seat.facingDir;
      ch.frame = 0;
      ch.frameTimer = 0;
      if (!ch.isActive) {
        ch.seatTimer = INACTIVE_SEAT_TIMER_MIN_SEC + Math.random() * INACTIVE_SEAT_TIMER_RANGE_SEC;
      }
    }
  }

  /** Walk an agent to an arbitrary walkable tile (right-click command) */
  walkToTile(agentId: number, col: number, row: number): boolean {
    const ch = this.characters.get(agentId);
    if (!ch || ch.isSubagent) return false;
    if (!isWalkable(col, row, this.tileMap, this.blockedTiles)) {
      // Also allow walking to own seat tile (blocked for others but not self)
      const key = this.ownSeatKey(ch);
      if (!key || key !== `${col},${row}`) return false;
    }
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, col, row, this.tileMap, this.blockedTiles),
    );
    if (path.length === 0) return false;
    ch.path = path;
    ch.moveProgress = 0;
    ch.state = CharacterState.WALK;
    ch.frame = 0;
    ch.frameTimer = 0;
    return true;
  }

  /** Create a sub-agent character with the parent's palette. Returns the sub-agent ID. */
  addSubagent(parentAgentId: number, parentToolId: string): number {
    const key = `${parentAgentId}:${parentToolId}`;
    if (this.subagentIdMap.has(key)) return this.subagentIdMap.get(key)!;

    const id = this.nextSubagentId--;
    const parentCh = this.characters.get(parentAgentId);
    const palette = parentCh ? parentCh.palette : 0;
    const hueShift = parentCh ? parentCh.hueShift : 0;

    // Find the closest walkable tile to the parent, avoiding tiles occupied by other characters
    const parentCol = parentCh ? parentCh.tileCol : 0;
    const parentRow = parentCh ? parentCh.tileRow : 0;
    let spawn = { col: parentCol, row: parentRow };
    if (this.walkableTiles.length > 0) {
      spawn = this.closestFreeWalkableTile(parentCol, parentRow) ?? this.walkableTiles[0];
    }

    const ch = createCharacter(id, palette, null, null, hueShift);
    ch.x = spawn.col * TILE_SIZE + TILE_SIZE / 2;
    ch.y = spawn.row * TILE_SIZE + TILE_SIZE / 2;
    ch.tileCol = spawn.col;
    ch.tileRow = spawn.row;
    // Face the same direction as the parent agent
    if (parentCh) ch.dir = parentCh.dir;
    ch.isSubagent = true;
    ch.parentAgentId = parentAgentId;
    startMatrixEffect(ch, 'spawn');
    this.characters.set(id, ch);

    this.subagentIdMap.set(key, id);
    this.subagentMeta.set(id, { parentAgentId, parentToolId });
    return id;
  }

  /** Remove a specific sub-agent character and free its seat */
  removeSubagent(parentAgentId: number, parentToolId: string): void {
    const key = `${parentAgentId}:${parentToolId}`;
    const id = this.subagentIdMap.get(key);
    if (id === undefined) return;

    const ch = this.characters.get(id);
    if (ch) {
      if (ch.matrixEffect === 'despawn') {
        // Already despawning — just clean up maps
        this.subagentIdMap.delete(key);
        this.subagentMeta.delete(id);
        return;
      }
      if (ch.seatId) {
        const seat = this.seats.get(ch.seatId);
        if (seat) seat.assigned = false;
      }
      // Start despawn animation — keep character in map for rendering
      startMatrixEffect(ch, 'despawn');
      ch.bubbleType = null;
    }
    // Clean up tracking maps immediately so keys don't collide
    this.subagentIdMap.delete(key);
    this.subagentMeta.delete(id);
    if (this.selectedAgentId === id) this.selectedAgentId = null;
    if (this.cameraFollowId === id) this.cameraFollowId = null;
  }

  /** Remove all sub-agents belonging to a parent agent */
  removeAllSubagents(parentAgentId: number): void {
    const toRemove: string[] = [];
    for (const [key, id] of this.subagentIdMap) {
      const meta = this.subagentMeta.get(id);
      if (meta && meta.parentAgentId === parentAgentId) {
        const ch = this.characters.get(id);
        if (ch) {
          if (ch.matrixEffect === 'despawn') {
            // Already despawning — just clean up maps
            this.subagentMeta.delete(id);
            toRemove.push(key);
            continue;
          }
          if (ch.seatId) {
            const seat = this.seats.get(ch.seatId);
            if (seat) seat.assigned = false;
          }
          // Start despawn animation
          startMatrixEffect(ch, 'despawn');
          ch.bubbleType = null;
        }
        this.subagentMeta.delete(id);
        if (this.selectedAgentId === id) this.selectedAgentId = null;
        if (this.cameraFollowId === id) this.cameraFollowId = null;
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      this.subagentIdMap.delete(key);
    }
  }

  /** Look up the sub-agent character ID for a given parent+toolId, or null */
  getSubagentId(parentAgentId: number, parentToolId: string): number | null {
    return this.subagentIdMap.get(`${parentAgentId}:${parentToolId}`) ?? null;
  }

  setAgentActive(id: number, active: boolean): void {
    const ch = this.characters.get(id);
    if (ch) {
      // The boss likes to celebrate finished work (most of the time).
      if (!active && ch.isActive && !ch.isSubagent && this.bossBrain && Math.random() < 0.6) {
        this.bossBrain.pendingCongrats = id;
      }
      ch.isActive = active;
      if (!active) {
        // Sentinel -1: signals turn just ended, skip next seat rest timer.
        // Prevents the WALK handler from setting a 2-4 min rest on arrival.
        ch.seatTimer = -1;
        ch.path = [];
        ch.moveProgress = 0;
      }
      this.rebuildFurnitureInstances();
    }
  }

  /** Rebuild furniture instances with auto-state applied (active agents turn electronics ON) */
  private rebuildFurnitureInstances(): void {
    // Collect tiles where active agents face desks (and the boss, while he's at his)
    const autoOnTiles = new Set<string>();
    const workers = [...this.characters.values()];
    if (this.boss?.state === CharacterState.TYPE) workers.push(this.boss);
    for (const ch of workers) {
      if (!ch.isActive || !ch.seatId) continue;
      const seat = this.seats.get(ch.seatId);
      if (!seat) continue;
      // Find the desk tile(s) the agent faces from their seat
      const dCol =
        seat.facingDir === Direction.RIGHT ? 1 : seat.facingDir === Direction.LEFT ? -1 : 0;
      const dRow = seat.facingDir === Direction.DOWN ? 1 : seat.facingDir === Direction.UP ? -1 : 0;
      // Check tiles in the facing direction (desk could be 1-3 tiles deep)
      for (let d = 1; d <= AUTO_ON_FACING_DEPTH; d++) {
        const tileCol = seat.seatCol + dCol * d;
        const tileRow = seat.seatRow + dRow * d;
        autoOnTiles.add(`${tileCol},${tileRow}`);
      }
      // Also check tiles to the sides of the facing direction (desks can be wide)
      for (let d = 1; d <= AUTO_ON_SIDE_DEPTH; d++) {
        const baseCol = seat.seatCol + dCol * d;
        const baseRow = seat.seatRow + dRow * d;
        if (dCol !== 0) {
          // Facing left/right: check tiles above and below
          autoOnTiles.add(`${baseCol},${baseRow - 1}`);
          autoOnTiles.add(`${baseCol},${baseRow + 1}`);
        } else {
          // Facing up/down: check tiles left and right
          autoOnTiles.add(`${baseCol - 1},${baseRow}`);
          autoOnTiles.add(`${baseCol + 1},${baseRow}`);
        }
      }
    }

    // The basketball leaves the floor while someone has it, and the forklift leaves its
    // parking spot while someone drives it (office/breakTime.ts).
    const hidden = new Set<string>();
    if (this.ballInPlay) hidden.add('BASKETBALL');
    if (this.forkliftDriverId !== null) hidden.add('FORKLIFT');
    const placed =
      hidden.size > 0
        ? this.layout.furniture.filter((f) => !hidden.has(f.type))
        : this.layout.furniture;
    if (autoOnTiles.size === 0) {
      this.furniture = layoutToFurnitureInstances(placed);
      return;
    }

    // Build modified furniture list with auto-state and animation applied
    const animFrame = Math.floor(this.furnitureAnimTimer / FURNITURE_ANIM_INTERVAL_SEC);
    const modifiedFurniture: PlacedFurniture[] = placed.map((item) => {
      const entry = getCatalogEntry(item.type);
      if (!entry) return item;
      // Check if any tile of this furniture overlaps an auto-on tile
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          if (autoOnTiles.has(`${item.col + dc},${item.row + dr}`)) {
            let onType = getOnStateType(item.type);
            if (onType !== item.type) {
              // Check if the on-state type has animation frames
              const frames = getAnimationFrames(onType);
              if (frames && frames.length > 1) {
                const frameIdx = animFrame % frames.length;
                onType = frames[frameIdx];
              }
              return { ...item, type: onType };
            }
            return item;
          }
        }
      }
      return item;
    });

    this.furniture = layoutToFurnitureInstances(modifiedFurniture);
  }

  setAgentTool(id: number, tool: string | null): void {
    const ch = this.characters.get(id);
    if (ch) {
      ch.currentTool = tool;
    }
  }

  showPermissionBubble(id: number): void {
    const ch = this.characters.get(id);
    if (ch) {
      ch.bubbleType = 'permission';
      ch.bubbleTimer = 0;
    }
  }

  clearPermissionBubble(id: number): void {
    const ch = this.characters.get(id);
    if (ch && ch.bubbleType === 'permission') {
      ch.bubbleType = null;
      ch.bubbleTimer = 0;
    }
  }

  showWaitingBubble(id: number, awaitingInput = false): void {
    const ch = this.characters.get(id);
    if (ch) {
      ch.bubbleType = 'waiting';
      ch.waitingAwaitingInput = awaitingInput;
      ch.bubbleTimer = WAITING_BUBBLE_DURATION_SEC;
    }
  }

  /** Dismiss bubble on click — permission: instant, waiting: quick fade */
  dismissBubble(id: number): void {
    const ch = this.characters.get(id);
    if (!ch || !ch.bubbleType) return;
    if (ch.bubbleType === 'permission') {
      ch.bubbleType = null;
      ch.bubbleTimer = 0;
    } else if (ch.bubbleType === 'waiting') {
      // Trigger immediate fade (0.3s remaining)
      ch.bubbleTimer = Math.min(ch.bubbleTimer, DISMISS_BUBBLE_FAST_FADE_SEC);
    }
  }

  // ── Pets ──────────────────────────────────────────────────────

  /**
   * Add a pet to the live runtime. Spawns at a uniformly-random walkable tile.
   * Mirror in `this.layout.pets` so debounced saveLayout serialises the roster.
   * Bounds-checks petType against the loaded sprite count to defend against stale layouts.
   */
  addPet(placedPet: PlacedPet): void {
    // Defensive guards (upstream 5e6c0a0)
    if (
      typeof placedPet.id !== 'string' ||
      placedPet.id.length === 0 ||
      placedPet.id.length > MAX_PET_ID_LENGTH
    ) {
      return;
    }
    if (
      !Number.isInteger(placedPet.petType) ||
      placedPet.petType < 0 ||
      placedPet.petType >= getPetCount()
    ) {
      return;
    }
    if (this.pets.some((p) => p.id === placedPet.id)) return; // de-dupe
    if (this.walkableTiles.length === 0) return; // no spawn space — silently drop

    const spawn = this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)];
    const pet = createPet(placedPet.id, placedPet.petType, spawn.col, spawn.row);
    pet.name = getPetName(placedPet.petType);
    this.pets.push(pet);
    this.syncLayoutPets();
  }

  /** Remove a pet by id. Idempotent. */
  removePet(id: string): void {
    const before = this.pets.length;
    this.pets = this.pets.filter((p) => p.id !== id);
    if (this.pets.length !== before) {
      this.syncLayoutPets();
    }
  }

  /** Shallow snapshot for external consumers (renderer, hooks). */
  getPets(): Pet[] {
    return this.pets.slice();
  }

  /** Unique petType values currently placed. Used by the Pets toolbar to mark active rows. */
  getActivePetTypes(): number[] {
    const seen = new Set<number>();
    for (const p of this.pets) seen.add(p.petType);
    return Array.from(seen);
  }

  /**
   * Hit-test pets at a pixel world position. Sorts back-to-front (largest y wins on tie)
   * so the visually-frontmost pet receives the click.
   * Returns the pet id or null.
   */
  getPetAt(worldX: number, worldY: number): string | null {
    const ordered = this.pets.slice().sort((a, b) => b.y - a.y);
    for (const pet of ordered) {
      const left = pet.x - PET_HIT_HALF_WIDTH;
      const right = pet.x + PET_HIT_HALF_WIDTH;
      const top = pet.y - PET_HIT_HEIGHT;
      const bottom = pet.y;
      if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
        return pet.id;
      }
    }
    return null;
  }

  /** Show the heart bubble on a pet for WAITING_BUBBLE_DURATION_SEC. */
  showPetBubble(petId: string): void {
    const pet = this.pets.find((p) => p.id === petId);
    if (!pet) return;
    pet.bubbleType = 'heart';
    pet.bubbleTimer = WAITING_BUBBLE_DURATION_SEC;
  }

  /** Dismiss the heart bubble on click; collapses timer to a fast fade. */
  dismissPetBubble(petId: string): void {
    const pet = this.pets.find((p) => p.id === petId);
    if (!pet || !pet.bubbleType) return;
    pet.bubbleTimer = Math.min(pet.bubbleTimer, DISMISS_BUBBLE_FAST_FADE_SEC);
  }

  /**
   * Reconcile `this.pets` to match the layout's placed-pet roster.
   * - Pets in layout but not in runtime → spawn via addPet().
   * - Pets in runtime but not in layout → remove.
   * - Pets in both → keep existing runtime state (position, FSM).
   *
   * Called from constructor and rebuildFromLayout. Always runs AFTER walkableTiles
   * is populated.
   */
  private rebuildPetsFromLayout(layout: OfficeLayout): void {
    const placed = layout.pets ?? [];
    const placedIds = new Set(placed.map((p) => p.id));

    // 1. Remove pets no longer in layout
    this.pets = this.pets.filter((p) => placedIds.has(p.id));

    // 2. Add pets that exist in layout but not in runtime
    const existingIds = new Set(this.pets.map((p) => p.id));
    for (const p of placed) {
      if (existingIds.has(p.id)) continue;
      this.addPet(p); // pushes onto this.pets, calls syncLayoutPets()
    }
    // syncLayoutPets() inside addPet keeps this.layout.pets coherent; one final
    // sync handles the removal-only branch where addPet was never called.
    this.syncLayoutPets();
  }

  /**
   * Re-export the current pet roster into `this.layout.pets`. Called only from
   * mutating methods (addPet / removePet / rebuildPetsFromLayout) — NEVER from
   * getLayout(), which runs on every render frame.
   */
  private syncLayoutPets(): void {
    this.layout.pets = this.pets.map((p) => ({ id: p.id, petType: p.petType }));
  }

  setTeamInfo(
    id: number,
    teamName?: string,
    agentName?: string,
    isTeamLead?: boolean,
    leadAgentId?: number,
    teamUsesTmux?: boolean,
  ): void {
    const ch = this.characters.get(id);
    if (!ch) return;
    const wasUnlinked = ch.leadAgentId === undefined;
    ch.teamName = teamName;
    ch.agentName = agentName;
    ch.isTeamLead = isTeamLead;
    ch.leadAgentId = leadAgentId;
    if (teamUsesTmux !== undefined) {
      ch.teamUsesTmux = teamUsesTmux;
    }
    // A teammate is not a headless agent: clicking it focuses its lead's terminal.
    // Adopted sessions are marked headless at creation and only later discovered
    // to be teammates, so drop the mark once the link lands.
    if (leadAgentId !== undefined) {
      ch.isHeadless = false;
    }
    // A teammate discovered only after its plain external session was adopted is
    // linked here, not at creation, so it never went through the seat-next-to-lead
    // path addAgent runs for inline teammates. Cluster it now, once, on first link.
    if (wasUnlinked && leadAgentId !== undefined && !isTeamLead) {
      this.reseatNextToLead(id, leadAgentId);
    }
  }

  /** Mark an agent as headless (adopted, no terminal to focus). */
  setHeadless(id: number, headless: boolean): void {
    const ch = this.characters.get(id);
    if (!ch) return;
    ch.isHeadless = headless;
  }

  setAgentContext(id: number, contextTokens: number, maxContextTokens: number): void {
    const ch = this.characters.get(id);
    if (!ch) return;
    ch.contextTokens = contextTokens;
    ch.maxContextTokens = maxContextTokens;
  }

  update(dt: number): void {
    this.forkliftCooldown = Math.max(0, this.forkliftCooldown - dt);
    // One ball: picked up off the court floor while someone plays, back when they stop.
    const ballInPlay = this.getCharacters().some((c) => c.dribbling || c.emote?.kind === 'shoot');
    if (ballInPlay !== this.ballInPlay) {
      this.ballInPlay = ballInPlay;
      this.rebuildFurnitureInstances();
    }
    // Furniture animation cycling
    const prevFrame = Math.floor(this.furnitureAnimTimer / FURNITURE_ANIM_INTERVAL_SEC);
    this.furnitureAnimTimer += dt;
    const newFrame = Math.floor(this.furnitureAnimTimer / FURNITURE_ANIM_INTERVAL_SEC);
    if (newFrame !== prevFrame) {
      this.rebuildFurnitureInstances();
    }

    this.updateBoss(dt);

    // The greeter materializes and dematerializes like anyone else, but runs
    // no FSM — it stands where it spawned for as long as the ask is up.
    if (this.greeter && advanceMatrixEffect(this.greeter, dt) === 'despawned') {
      this.greeter = null;
    }

    const toDelete: number[] = [];
    for (const ch of this.characters.values()) {
      const effect = advanceMatrixEffect(ch, dt);
      if (effect !== 'none') {
        if (effect === 'despawned') toDelete.push(ch.id);
        continue; // skip normal FSM while the effect is (or just was) active
      }

      // Break time: idle agents drift between hangouts instead of anywhere at all,
      // and don't go back to rest at their desk.
      const hasHangouts = this.hangoutTiles.length > 0;
      const idleTargets = hasHangouts ? this.hangoutTiles : this.walkableTiles;
      if (hasHangouts) ch.restAtSeat = false;
      // Temporarily unblock own seat so character can pathfind to it
      this.withOwnSeatUnblocked(ch, () =>
        updateCharacter(ch, dt, idleTargets, this.seats, this.tileMap, this.blockedTiles),
      );
      this.updateBreakTime(ch, dt);
      this.updateForklift(ch, dt);

      // Tick bubble timer for waiting bubbles
      if (ch.bubbleType === 'waiting') {
        ch.bubbleTimer -= dt;
        if (ch.bubbleTimer <= 0) {
          ch.bubbleType = null;
          ch.bubbleTimer = 0;
        }
      }
    }
    // Remove characters that finished despawn
    for (const id of toDelete) {
      this.characters.delete(id);
    }

    // ── Pet FSM ────────────────────────────────────────────────
    for (const pet of this.pets) {
      updatePet(pet, dt, this.walkableTiles, this.characters, this.tileMap, this.blockedTiles);

      // Tick heart bubble timer (mirrors character waiting-bubble pattern)
      if (pet.bubbleType) {
        pet.bubbleTimer -= dt;
        if (pet.bubbleTimer <= 0) {
          pet.bubbleType = null;
          pet.bubbleTimer = 0;
        }
      }
    }
  }

  /** The `saveAgentSeats` payload: palette, hue and seat for every agent worth
   *  restoring. Sub-agents are excluded because they are derived state the
   *  runtime re-materializes, and the greeter never reaches here at all —
   *  it is not in `characters`. */
  getPersistableSeats(): Record<
    number,
    { palette: number; hueShift: number; seatId: string | null }
  > {
    const seats: Record<number, { palette: number; hueShift: number; seatId: string | null }> = {};
    for (const ch of this.characters.values()) {
      if (ch.isSubagent) continue;
      seats[ch.id] = { palette: ch.palette, hueShift: ch.hueShift, seatId: ch.seatId };
    }
    return seats;
  }

  // ── The boss (office/boss.ts) ────────────────────────────────

  /** Find the boss's places, reserve his chair, and make sure he's in the office. */
  // ── Break time (office/breakTime.ts) ──────────────────────────

  /** True for a tile drawn over by the wall right below it. */
  private hiddenByWall(col: number, row: number): boolean {
    return this.tileMap[row + 1]?.[col] === TileType.WALL;
  }

  private rebuildHangouts(): void {
    const seatTiles = new Set([...this.seats.values()].map((s) => `${s.seatCol},${s.seatRow}`));
    const isFree = (c: number, r: number) =>
      this.walkableSet.has(`${c},${r}`) && !seatTiles.has(`${c},${r}`) && !this.hiddenByWall(c, r);
    const footprint = (type: string) => {
      const entry = getCatalogEntry(type);
      return entry ? { w: entry.footprintW, h: entry.footprintH } : null;
    };
    this.hangouts = buildHangouts(this.layout.furniture, footprint, isFree);
    this.hangoutAt = new Map(this.hangouts.map((h) => [`${h.col},${h.row}`, h]));
    this.hangoutTiles = this.hangouts.map(({ col, row }) => ({ col, row }));
    this.forkliftRoute = this.buildForkliftRoute(footprint, isFree);
    if (!this.forkliftRoute) this.forkliftDriverId = null;
  }

  /** Pickup beside the paper pallets, drop-off by the stack of boxes farthest away,
   *  and a parking tile next to the forklift's home. Null if the layout lacks any. */
  private buildForkliftRoute(
    footprint: (type: string) => { w: number; h: number } | null,
    isFree: (c: number, r: number) => boolean,
  ): OfficeState['forkliftRoute'] {
    const ring = (type: string) =>
      this.layout.furniture
        .filter((f) => f.type === type)
        .flatMap((f) => {
          const size = footprint(f.type);
          if (!size) return [];
          const tiles: Array<{ col: number; row: number }> = [];
          for (let r = f.row - 1; r <= f.row + size.h; r++) {
            for (let c = f.col - 1; c <= f.col + size.w; c++) {
              const inside = c >= f.col && c < f.col + size.w && r >= f.row && r < f.row + size.h;
              if (!inside && isFree(c, r)) tiles.push({ col: c, row: r });
            }
          }
          return tiles;
        });
    const park = this.hangouts.find((h) => h.kind === 'forklift');
    const pickups = ring('PAPER_PALLET');
    const drops = ring('PAPER_BOXES');
    if (!park || pickups.length === 0 || drops.length === 0) return null;
    const pickup = pickups.reduce((best, t) =>
      Math.abs(t.col - park.col) + Math.abs(t.row - park.row) <
      Math.abs(best.col - park.col) + Math.abs(best.row - park.row)
        ? t
        : best,
    );
    const drop = drops.reduce((best, t) =>
      Math.abs(t.col - pickup.col) > Math.abs(best.col - pickup.col) ? t : best,
    );
    return { pickup, drop, park: { col: park.col, row: park.row } };
  }

  /** Hop on: start a forklift shift for an agent loafing at the forklift. */
  private startForkliftShift(ch: Character): void {
    if (!this.forkliftRoute || this.forkliftDriverId !== null || this.forkliftCooldown > 0) return;
    this.forkliftDriverId = ch.id;
    ch.driving = {
      phase: 'toPickup',
      loaded: false,
      trips: 2 + Math.floor(Math.random() * 3),
      timer: 0,
    };
    ch.dribbling = false;
    say(ch, pickOne(GOOF_LINES.forklift));
    this.driveTo(ch, this.forkliftRoute.pickup);
    this.rebuildFurnitureInstances();
  }

  private endForkliftShift(ch: Character): void {
    ch.driving = null;
    if (this.forkliftDriverId === ch.id) this.forkliftDriverId = null;
    this.forkliftCooldown = FORKLIFT_REST_SEC;
    ch.wanderTimer = randomBetween([4, 12]);
    ch.hangoutSettled = false;
    this.rebuildFurnitureInstances();
  }

  /** Path the driver somewhere; ends the shift if there's no way there. */
  private driveTo(ch: Character, target: { col: number; row: number }): void {
    if (ch.tileCol === target.col && ch.tileRow === target.row) return;
    const path = findPath(
      ch.tileCol,
      ch.tileRow,
      target.col,
      target.row,
      this.tileMap,
      this.blockedTiles,
    );
    if (path.length === 0) {
      this.endForkliftShift(ch);
      return;
    }
    ch.path = path;
    ch.moveProgress = 0;
    ch.state = CharacterState.WALK;
  }

  /** Shuttle pallets: pickup -> load -> drop-off -> unload, a few times, then park. */
  private updateForklift(ch: Character, dt: number): void {
    const shift = ch.driving;
    const route = this.forkliftRoute;
    if (!shift) return;
    if (ch.isActive || !route) {
      this.endForkliftShift(ch); // a new turn: hop off and get to work
      return;
    }
    ch.wanderTimer = Math.max(ch.wanderTimer, 60); // the shift decides where to go, not wandering
    if (ch.state === CharacterState.WALK) return;
    switch (shift.phase) {
      case 'toPickup':
        shift.phase = 'loading';
        shift.timer = 1.5;
        return;
      case 'loading':
        shift.timer -= dt;
        if (shift.timer > 0) return;
        shift.loaded = true;
        shift.phase = 'toDrop';
        if (Math.random() < 0.5) say(ch, pickOne(GOOF_LINES.forklift));
        this.driveTo(ch, route.drop);
        return;
      case 'toDrop':
        shift.phase = 'unloading';
        shift.timer = 1.5;
        return;
      case 'unloading':
        shift.timer -= dt;
        if (shift.timer > 0) return;
        shift.loaded = false;
        shift.trips -= 1;
        shift.phase = shift.trips > 0 ? 'toPickup' : 'parking';
        this.driveTo(ch, shift.trips > 0 ? route.pickup : route.park);
        return;
      case 'parking':
        this.endForkliftShift(ch);
        return;
    }
  }

  /** Idle agents settle in at a hangout, face it, linger, and goof off now and then. */
  private updateBreakTime(ch: Character, dt: number): void {
    advanceChatAndEmote(ch, dt);
    if (!isLoafing(ch)) {
      if (ch.state !== CharacterState.IDLE || ch.isActive) ch.hangoutSettled = false;
      ch.dribbling = false;
      return;
    }
    const spot = this.hangoutAt.get(`${ch.tileCol},${ch.tileRow}`);
    ch.dribbling = spot?.kind === 'hoops';
    if (!spot) return;
    if (!ch.emote) ch.dir = spot.facing;
    if (!ch.hangoutSettled) {
      ch.hangoutSettled = true;
      ch.wanderTimer = randomBetween(HANGOUT_STAY_SEC);
      ch.nextGoof = randomBetween([1, 4]);
    }
    if (spot.kind === 'forklift' && !ch.driving) {
      this.startForkliftShift(ch);
      return;
    }
    ch.nextGoof = (ch.nextGoof ?? 0) - dt;
    if (ch.nextGoof <= 0) {
      ch.nextGoof = randomBetween(GOOF_EVERY_SEC);
      goofOff(ch, spot);
    }
  }

  /** What the boss is up to (read-only; for tests and debugging). */
  get bossActivity(): BossActivity | null {
    return this.bossBrain?.activity ?? null;
  }

  private rebuildBossPlaces(): void {
    this.walkableSet = new Set(this.walkableTiles.map((t) => `${t.col},${t.row}`));
    const seatTiles = new Set([...this.seats.values()].map((s) => `${s.seatCol},${s.seatRow}`));
    const isWalkableTile = (c: number, r: number) => this.walkableSet.has(`${c},${r}`);
    // Skip tiles hidden behind a wall (walls draw two tiles tall over the tile above them).
    const isFree = (c: number, r: number) =>
      isWalkableTile(c, r) && !seatTiles.has(`${c},${r}`) && !this.hiddenByWall(c, r);
    const footprint = (type: string) => {
      const entry = getCatalogEntry(type);
      return entry ? { w: entry.footprintW, h: entry.footprintH } : null;
    };
    this.bossPlaces = buildBossPlaces(
      this.layout.furniture,
      this.seats,
      footprint,
      isFree,
      isWalkableTile,
    );
    const seat = this.bossPlaces.seat;
    if (!seat) {
      this.boss = null; // no boss desk in this layout
      this.bossBrain = null;
      return;
    }
    const s = this.seats.get(seat.uid);
    if (s) s.assigned = true;
    if (!this.boss) {
      const ch = createCharacter(BOSS_ID, 0, seat.uid, s ?? null, 0);
      ch.isBoss = true;
      ch.isActive = true;
      this.boss = ch;
    }
    // (Re)seat him: a layout edit may have moved his desk.
    const boss = this.boss;
    boss.seatId = seat.uid;
    boss.path = [];
    boss.moveProgress = 0;
    boss.tileCol = seat.col;
    boss.tileRow = seat.row;
    boss.x = seat.col * TILE_SIZE + TILE_SIZE / 2;
    boss.y = seat.row * TILE_SIZE + TILE_SIZE / 2;
    boss.dir = seat.facing;
    boss.state = CharacterState.TYPE;
    this.bossBrain = newBrain();
  }

  private updateBoss(dt: number): void {
    const ch = this.boss;
    const brain = this.bossBrain;
    if (!ch || !brain) return;
    if (advanceMatrixEffect(ch, dt) === 'running') return;
    // The last character sheet is his (agents are never dressed in it).
    ch.palette = Math.max(0, getLoadedCharacterCount() - NPC_RESERVED_CHARACTER_SHEETS);
    advanceChatAndEmote(ch, dt);

    // Pacing steps (meetings, announcements) walk off and back while still "arrived".
    if (brain.arrived && ch.path.length > 0) {
      if (!stepBossWalk(ch, dt)) return;
      if (brain.target) ch.dir = brain.target.facing;
    }

    if (!brain.arrived) {
      if (!stepBossWalk(ch, dt)) return;
      brain.arrived = true;
      brain.nextLine = randomRange(BOSS_CHIME_SEC);
      brain.stay = stayFor(brain.activity);
      brain.timer = brain.stay;
      if (brain.target) ch.dir = brain.target.facing;
      bossSay(ch, pick(BOSS_LINES[brain.activity]));
      brain.nextMove = randomRange(BOSS_MOVE_SEC);
      if (brain.activity === 'congrats' || brain.activity === 'party') startDance(ch);
      if (brain.activity === 'announce') startHop(ch);
      return;
    }

    ch.dribbling = brain.activity === 'hoops';
    const seat = this.bossPlaces.seat;
    const atDesk =
      brain.activity === 'office' && !!seat && ch.tileCol === seat.col && ch.tileRow === seat.row;
    holdPose(ch, dt, atDesk);
    if (atDesk && seat) ch.dir = seat.facing;
    this.bossMove(ch, brain, dt);

    brain.timer -= dt;
    // While lingering he chimes in every so often (not mid-announcement or mid-congrats).
    brain.nextLine -= dt;
    const chatty = brain.activity !== 'announce' && brain.activity !== 'congrats';
    if (chatty && brain.nextLine <= 0 && !ch.say) {
      brain.nextLine = randomRange(BOSS_CHIME_SEC);
      bossSay(ch, pick(BOSS_LINES[brain.activity]));
    }
    if (brain.pendingCongrats !== null && brain.activity !== 'congrats') {
      this.sendBoss('congrats');
      return;
    }
    if (brain.timer <= 0) {
      this.sendBoss(chooseActivity(brain.activity, (a) => this.bossTarget(a) !== null));
    }
  }

  /** Where the boss would go for an activity right now, or null if nowhere. */
  private bossTarget(activity: BossActivity): BossSpot | null {
    const places = this.bossPlaces;
    const occupied = new Set([...this.characters.values()].map((c) => `${c.tileCol},${c.tileRow}`));
    const free = (spots: BossSpot[]) => spots.filter((s) => !occupied.has(`${s.col},${s.row}`));
    switch (activity) {
      case 'office':
        return places.seat;
      case 'visit':
      case 'congrats': {
        const id = activity === 'congrats' ? this.bossBrain?.pendingCongrats : undefined;
        const agents = [...this.characters.values()].filter(
          (c) => !c.isSubagent && !c.matrixEffect && (id === undefined || c.id === id),
        );
        if (agents.length === 0) return null;
        const agent = pick(agents);
        return this.spotBeside(agent, occupied);
      }
      case 'hoops':
      case 'party': {
        // Same hangouts the agents goof off at (office/breakTime.ts).
        const options = this.hangouts.filter(
          (h) => h.kind === activity && !occupied.has(`${h.col},${h.row}`),
        );
        if (options.length === 0) return null;
        const spot = pick(options);
        if (this.bossBrain) this.bossBrain.shotTarget = { x: spot.targetX, y: spot.targetY };
        return spot;
      }
      default: {
        const options = free(places[activity]);
        return options.length > 0 ? pick(options) : null;
      }
    }
  }

  /** His moves while lingering: jump shots on the court, dancing at the party,
   *  pacing while he talks at meetings and announcements. */
  private bossMove(ch: Character, brain: BossBrain, dt: number): void {
    brain.nextMove -= dt;
    if (brain.nextMove > 0 || ch.emote || ch.path.length > 0) return;
    brain.nextMove = randomRange(BOSS_MOVE_SEC);
    const target = brain.target;
    switch (brain.activity) {
      case 'hoops':
        if (target && brain.shotTarget) {
          startShot(ch, {
            ...target,
            kind: 'hoops',
            targetX: brain.shotTarget.x,
            targetY: brain.shotTarget.y,
          });
        }
        return;
      case 'party':
        startDance(ch);
        return;
      case 'meeting':
      case 'announce': {
        // Pace: a step to a free neighbouring tile and straight back.
        if (!target) return;
        const seatTiles = new Set([...this.seats.values()].map((s) => `${s.seatCol},${s.seatRow}`));
        const steps = [
          { col: target.col - 1, row: target.row },
          { col: target.col + 1, row: target.row },
          { col: target.col, row: target.row + 1 },
        ].filter(
          (t) =>
            this.walkableSet.has(`${t.col},${t.row}`) &&
            !seatTiles.has(`${t.col},${t.row}`) &&
            !this.hiddenByWall(t.col, t.row),
        );
        if (steps.length === 0) return;
        const step = pick(steps);
        ch.path = [step, { col: target.col, row: target.row }];
        ch.moveProgress = 0;
        return;
      }
      default:
        return;
    }
  }

  /** A free tile next to an agent (not the desk side), facing them. */
  private spotBeside(agent: Character, occupied: Set<string>): BossSpot | null {
    const seat = agent.seatId ? this.seats.get(agent.seatId) : undefined;
    const ac = seat ? seat.seatCol : agent.tileCol;
    const ar = seat ? seat.seatRow : agent.tileRow;
    const options: BossSpot[] = [
      { col: ac - 1, row: ar, facing: Direction.RIGHT },
      { col: ac + 1, row: ar, facing: Direction.LEFT },
      { col: ac, row: ar + 1, facing: Direction.UP },
      { col: ac, row: ar - 1, facing: Direction.DOWN },
    ];
    const seatTiles = new Set([...this.seats.values()].map((s) => `${s.seatCol},${s.seatRow}`));
    const ok = options.filter(
      (o) =>
        this.walkableSet.has(`${o.col},${o.row}`) &&
        !seatTiles.has(`${o.col},${o.row}`) &&
        !occupied.has(`${o.col},${o.row}`),
    );
    return ok.length > 0 ? pick(ok) : null;
  }

  private sendBoss(activity: BossActivity): void {
    const ch = this.boss;
    const brain = this.bossBrain;
    if (!ch || !brain) return;
    const target = this.bossTarget(activity);
    brain.pendingCongrats = null;
    if (!target) {
      brain.timer = 5; // nowhere to go right now: linger and try again
      return;
    }
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, target.col, target.row, this.tileMap, this.blockedTiles),
    );
    const already = ch.tileCol === target.col && ch.tileRow === target.row;
    if (path.length === 0 && !already) {
      brain.timer = 5;
      return;
    }
    brain.activity = activity;
    brain.target = target;
    brain.arrived = false;
    ch.path = path;
    ch.moveProgress = 0;
    ch.frame = 0;
    ch.frameTimer = 0;
  }

  /** Everything the renderer draws: the agents plus, while the first-run ask
   *  is up, the consent greeter. This is the ONE place the greeter joins the
   *  agents — every other consumer reads `characters` and gets agents only. */
  getCharacters(): Character[] {
    const chars = Array.from(this.characters.values());
    if (this.greeter) chars.push(this.greeter);
    if (this.boss) chars.push(this.boss);
    return chars;
  }

  /** Get character at pixel position (for hit testing). Returns id or null.
   *  Agents only: clicks pass straight through the consent greeter, which is
   *  a prop, not something to select or follow. */
  getCharacterAt(worldX: number, worldY: number): number | null {
    const chars = Array.from(this.characters.values()).sort((a, b) => b.y - a.y);
    for (const ch of chars) {
      // Skip characters that are despawning
      if (ch.matrixEffect === 'despawn') continue;
      // Character sprite is 16x24, anchored bottom-center
      // Apply sitting offset to match visual position
      const sittingOffset = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
      const anchorY = ch.y + sittingOffset;
      const left = ch.x - CHARACTER_HIT_HALF_WIDTH;
      const right = ch.x + CHARACTER_HIT_HALF_WIDTH;
      const top = anchorY - CHARACTER_HIT_HEIGHT;
      const bottom = anchorY;
      if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
        return ch.id;
      }
    }
    return null;
  }
}
