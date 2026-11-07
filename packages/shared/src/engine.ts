import { HELPER_ROLE, RULES } from './rules';
import type {
  CardId,
  Difficulty,
  GameAction,
  GameState,
  HelperId,
  Placement,
  RevealEntry,
  Rng,
  Role,
  Seat,
  ThemeSlot,
} from './types';

/** Rule violation; `code` is an i18n key, the client translates it. */
export class GameError extends Error {
  constructor(
    public code: string,
    public params?: Record<string, string | number>,
  ) {
    super(code);
  }
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function roleOf(state: GameState, seatIndex: number): Role {
  const n = state.seats.length;
  const pos = (((seatIndex - state.roleOffset) % n) + n) % n;
  return pos < RULES.directors[n] ? 'director' : 'painter';
}

export function seatIndexOf(state: GameState, playerId: string): number {
  return state.seats.findIndex((s) => s.id === playerId);
}

export function painters(state: GameState): Seat[] {
  return state.seats.filter((_, i) => roleOf(state, i) === 'painter');
}

export function handSize(state: GameState): number {
  return RULES.handSize[state.seats.length];
}

export function teamScore(state: GameState): number {
  return state.teamPile.length;
}

export function createGame(players: { id: string; name: string }[], rng: Rng, difficulty: Difficulty = 'normal'): GameState {
  const n = players.length;
  if (n < RULES.minPlayers || n > RULES.maxPlayers) {
    throw new GameError('err.playerCount', { min: RULES.minPlayers, max: RULES.maxPlayers });
  }
  const deck = shuffle(
    Array.from({ length: RULES.pictureCount }, (_, i) => i + 1),
    rng,
  );
  const size = RULES.handSize[n];
  const seats: Seat[] = players.map((p) => ({ id: p.id, name: p.name, hand: deck.splice(0, size) }));
  const state: GameState = {
    difficulty,
    requestedCount: 3,
    seats,
    roleOffset: 0,
    round: 0,
    phase: 'request',
    pile: deck,
    themes: [0, 0],
    required: null,
    adjusted: false,
    submissions: {},
    ready: {},
    board: [],
    forgeries: [],
    placements: {},
    asks: [],
    helpersUsed: { swapThemes: false, swapHand: false, plusMinus: false, ask: false },
    teamPile: [],
    wolfgattiPile: [],
    discardCount: 0,
    reveal: null,
    endReason: null,
    log: [],
  };
  startRound(state);
  return state;
}

function draw(state: GameState, count: number): CardId[] {
  return state.pile.splice(0, count);
}

function log(state: GameState, code: string, params?: Record<string, string | number>) {
  state.log.push({ code, params });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}

function startRound(state: GameState) {
  state.round++;
  state.phase = 'request';
  state.requestedCount = 3;
  state.themes = draw(state, RULES.themes) as [CardId, CardId];
  state.required = null;
  state.adjusted = false;
  state.submissions = {};
  state.ready = {};
  for (const p of painters(state)) {
    state.submissions[p.id] = [];
    state.ready[p.id] = false;
  }
  state.board = [];
  state.forgeries = [];
  state.placements = {};
  state.asks = [];
  state.reveal = null;
  log(state, 'log.roundStart', { round: state.round });
}

function requireRole(state: GameState, playerId: string, role: Role): Seat {
  const idx = seatIndexOf(state, playerId);
  if (idx < 0) throw new GameError('err.notSeated');
  if (roleOf(state, idx) !== role) throw new GameError(role === 'director' ? 'err.notDirector' : 'err.notPainter');
  return state.seats[idx];
}

function requirePhase(state: GameState, phase: GameState['phase']) {
  if (state.phase !== phase) throw new GameError('err.wrongPhase');
}

function useHelper(state: GameState, helper: HelperId, playerId: string) {
  if (state.helpersUsed[helper]) throw new GameError('err.helperUsed');
  requireRole(state, playerId, HELPER_ROLE[helper]);
  state.helpersUsed[helper] = true;
}

/** Cards that must stay in the pile so Wolfgatti can still forge this round. */
function reserve(state: GameState): number {
  return state.phase === 'request' || state.phase === 'submit' ? RULES.forgeries : 0;
}

function selectedTotal(state: GameState): number {
  return Object.values(state.submissions).reduce((sum, s) => sum + s.length, 0);
}

function nameOf(state: GameState, playerId: string): string {
  return state.seats.find((s) => s.id === playerId)?.name ?? '?';
}

/**
 * Applies one player action. Every check runs before the first mutation,
 * so a thrown GameError leaves the state untouched.
 */
export function applyAction(state: GameState, playerId: string, action: GameAction, rng: Rng): void {
  switch (action.type) {
    case 'swapThemes': {
      requirePhase(state, 'request');
      const slots = [...new Set(action.slots)];
      if (slots.length < 1 || slots.some((s) => s !== 'A' && s !== 'B')) throw new GameError('err.invalid');
      if (state.pile.length < slots.length + reserve(state)) throw new GameError('err.pileTooSmall');
      useHelper(state, 'swapThemes', playerId);
      for (const slot of slots) {
        const i = slot === 'A' ? 0 : 1;
        state.themes[i] = draw(state, 1)[0];
        state.discardCount++;
      }
      log(state, 'log.themesSwapped', { player: nameOf(state, playerId), count: slots.length });
      return;
    }

    case 'chooseRequired':
    case 'setRequired': {
      requirePhase(state, 'request');
      requireRole(state, playerId, 'director');
      const { count } = action;
      if (!Number.isInteger(count) || count < RULES.requestMin || count > RULES.requestMax) {
        throw new GameError('err.invalidCount', { min: RULES.requestMin, max: RULES.requestMax });
      }
      const available = painters(state).reduce((sum, p) => sum + p.hand.length, 0);
      if (count > available) throw new GameError('err.notEnoughCards', { available });
      state.requestedCount = count;
      if (action.type === 'chooseRequired') return;
      state.required = count;
      state.phase = 'submit';
      log(state, 'log.required', { player: nameOf(state, playerId), count });
      return;
    }

    case 'adjustRequired': {
      requirePhase(state, 'submit');
      if (action.delta !== 1 && action.delta !== -1) throw new GameError('err.invalid');
      if (Object.values(state.ready).some(Boolean)) throw new GameError('err.adjustTooLate');
      const from = state.required!;
      const to = from + action.delta;
      if (to < RULES.adjustedMin || to > RULES.adjustedMax) {
        throw new GameError('err.invalidCount', { min: RULES.adjustedMin, max: RULES.adjustedMax });
      }
      const available = painters(state).reduce((sum, p) => sum + p.hand.length, 0);
      if (to > available) throw new GameError('err.notEnoughCards', { available });
      useHelper(state, 'plusMinus', playerId);
      state.required = to;
      state.adjusted = true;
      log(state, 'log.adjusted', { player: nameOf(state, playerId), from, to });
      return;
    }

    case 'swapHand': {
      requirePhase(state, 'submit');
      const seat = requireRole(state, playerId, 'painter');
      if (state.ready[playerId]) throw new GameError('err.alreadyReady');
      const cards = [...new Set(action.cards)];
      const count = Math.min(RULES.swapHandCount, seat.hand.length);
      if (cards.length !== count) throw new GameError('err.swapCount', { count });
      if (cards.some((c) => !seat.hand.includes(c))) throw new GameError('err.notInHand');
      if (state.pile.length < count + reserve(state)) throw new GameError('err.pileTooSmall');
      useHelper(state, 'swapHand', playerId);
      seat.hand = seat.hand.filter((c) => !cards.includes(c)).concat(draw(state, count));
      state.submissions[playerId] = state.submissions[playerId].filter((s) => !cards.includes(s.card));
      state.discardCount += count;
      resetReady(state);
      log(state, 'log.handSwapped', { player: nameOf(state, playerId), count });
      return;
    }

    case 'select': {
      requirePhase(state, 'submit');
      const seat = requireRole(state, playerId, 'painter');
      if (!seat.hand.includes(action.card)) throw new GameError('err.notInHand');
      if (action.theme !== null && action.theme !== 'A' && action.theme !== 'B') throw new GameError('err.invalid');
      const mine = state.submissions[playerId].filter((s) => s.card !== action.card);
      if (action.theme) mine.push({ card: action.card, theme: action.theme });
      state.submissions[playerId] = mine;
      resetReady(state);
      return;
    }

    case 'ready': {
      requirePhase(state, 'submit');
      requireRole(state, playerId, 'painter');
      if (action.ready && selectedTotal(state) !== state.required) {
        throw new GameError('err.totalMismatch', { required: state.required!, selected: selectedTotal(state) });
      }
      state.ready[playerId] = !!action.ready;
      if (painters(state).every((p) => state.ready[p.id])) forge(state, rng);
      return;
    }

    case 'place': {
      requirePhase(state, 'sort');
      requireRole(state, playerId, 'director');
      if (!state.board.includes(action.card)) throw new GameError('err.notOnBoard');
      const p = action.placement;
      if (p !== null && p !== 'A' && p !== 'B' && p !== 'forgery') throw new GameError('err.invalid');
      if (p === null) delete state.placements[action.card];
      else state.placements[action.card] = p;
      return;
    }

    case 'ask': {
      requirePhase(state, 'sort');
      if (!state.board.includes(action.card)) throw new GameError('err.notOnBoard');
      useHelper(state, 'ask', playerId);
      const answers = painters(state).map((p) => ({
        playerId: p.id,
        yes: state.submissions[p.id].some((s) => s.card === action.card),
      }));
      state.asks.push({ card: action.card, answers });
      log(state, 'log.asked', {
        player: nameOf(state, playerId),
        card: action.card,
        answer: answers.some((a) => a.yes) ? 'yes' : 'no',
      });
      return;
    }

    case 'confirmSort': {
      requirePhase(state, 'sort');
      requireRole(state, playerId, 'director');
      const placed = state.board.filter((c) => state.placements[c]);
      if (placed.length !== state.board.length) throw new GameError('err.sortIncomplete');
      const rejected = state.board.filter((c) => state.placements[c] === 'forgery').length;
      if (rejected !== RULES.forgeries) throw new GameError('err.forgeryCount', { count: RULES.forgeries });
      log(state, 'log.sorted', { player: nameOf(state, playerId) });
      evaluate(state);
      return;
    }

    case 'nextRound': {
      requirePhase(state, 'reveal');
      if (seatIndexOf(state, playerId) < 0) throw new GameError('err.notSeated');
      finishRound(state);
      return;
    }

    default:
      throw new GameError('err.invalid');
  }
}

function resetReady(state: GameState) {
  for (const id of Object.keys(state.ready)) state.ready[id] = false;
}

function forge(state: GameState, rng: Rng) {
  const submitted = Object.values(state.submissions).flat();
  for (const p of painters(state)) {
    const cards = state.submissions[p.id].map((s) => s.card);
    p.hand = p.hand.filter((c) => !cards.includes(c));
  }
  state.forgeries = draw(state, RULES.forgeries);
  state.board = shuffle([...submitted.map((s) => s.card), ...state.forgeries], rng);
  state.placements = {};
  state.phase = 'sort';
  log(state, 'log.forged', { count: state.forgeries.length });
}

function evaluate(state: GameState) {
  const owners = new Map<CardId, { owner: string; theme: ThemeSlot }>();
  for (const [owner, subs] of Object.entries(state.submissions)) {
    for (const s of subs) owners.set(s.card, { owner, theme: s.theme });
  }
  const entries: RevealEntry[] = state.board.map((card) => {
    const placed = state.placements[card] as Placement;
    const own = owners.get(card);
    if (!own) {
      return {
        card,
        owner: null,
        intended: null,
        placed,
        outcome: placed === 'forgery' ? 'forgeryRejected' : 'forgeryAccepted',
      };
    }
    const outcome = placed === 'forgery' ? 'rejectedPainting' : placed === own.theme ? 'correct' : 'wrongTheme';
    return { card, owner: own.owner, intended: own.theme, placed, outcome };
  });

  let discarded = RULES.themes;
  for (const e of entries) {
    if (e.outcome === 'correct') state.teamPile.push(e.card);
    else if (e.outcome === 'forgeryAccepted') state.wolfgattiPile.push(e.card);
    else discarded++;
  }
  state.discardCount += discarded;

  const teamGain = entries.filter((e) => e.outcome === 'correct').length;
  const wolfgattiGain = entries.filter((e) => e.outcome === 'forgeryAccepted').length;
  const perfect = entries.every((e) => e.owner === null || e.outcome === 'correct');

  let recovered: HelperId | null = null;
  if (perfect) {
    const helper = (Object.keys(RULES.helperNumbers) as HelperId[]).find(
      (h) => RULES.helperNumbers[h] === state.required && state.helpersUsed[h],
    );
    if (helper) {
      state.helpersUsed[helper] = false;
      recovered = helper;
    }
  }

  state.reveal = {
    entries,
    teamGain,
    wolfgattiGain,
    perfect,
    recovered,
    gameEnds: state.wolfgattiPile.length >= RULES.wolfgattiLimit,
  };
  state.phase = 'reveal';
  log(state, 'log.result', { team: teamGain, wolfgatti: wolfgattiGain });
  if (recovered) log(state, 'log.recovered', { helper: recovered });
}

function finishRound(state: GameState) {
  if (state.wolfgattiPile.length >= RULES.wolfgattiLimit) {
    endGame(state, 'wolfgatti');
    return;
  }
  const size = handSize(state);
  for (const seat of state.seats) {
    if (seat.hand.length < size) seat.hand.push(...draw(state, size - seat.hand.length));
  }
  state.roleOffset++;
  // House rule: a round needs two themes plus four forgeries; otherwise the game ends.
  if (state.pile.length < RULES.themes + RULES.forgeries) {
    endGame(state, 'pileEmpty');
    return;
  }
  startRound(state);
}

function endGame(state: GameState, reason: 'wolfgatti' | 'pileEmpty') {
  state.phase = 'gameOver';
  state.endReason = reason;
  log(state, 'log.gameOver', { score: teamScore(state) });
}
