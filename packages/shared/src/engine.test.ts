import { describe, expect, it } from 'vitest';
import { applyAction, createGame, GameError, painters, roleOf } from './engine';
import { RULES } from './rules';
import type { GameAction, GameState, Placement, Rng } from './types';
import { viewFor } from './view';

function seeded(seed = 1): Rng {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = seeded(42);
const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
const act = (s: GameState, id: string, a: GameAction) => applyAction(s, id, a, rng);

function expectError(fn: () => void, code: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(GameError);
    expect((e as GameError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

function directorIds(s: GameState) {
  return s.seats.filter((_, i) => roleOf(s, i) === 'director').map((x) => x.id);
}

/** Plays the submit phase: the painters together play `count` cards, alternating themes. */
function submit(s: GameState, count: number) {
  act(s, directorIds(s)[0], { type: 'setRequired', count });
  const ps = painters(s);
  for (let k = 0; k < count; k++) {
    const p = ps[k % ps.length];
    const card = p.hand.find((c) => !s.submissions[p.id].some((x) => x.card === c))!;
    act(s, p.id, { type: 'select', card, theme: k % 2 === 0 ? 'A' : 'B' });
  }
  for (const p of ps) act(s, p.id, { type: 'ready', ready: true });
}

/** Sorts the board; `strategy` decides each card's placement from the hidden truth. */
function sort(s: GameState, strategy: (card: number, truth: Placement) => Placement) {
  const truth = new Map<number, Placement>();
  for (const subs of Object.values(s.submissions)) for (const x of subs) truth.set(x.card, x.theme);
  const d = directorIds(s)[0];
  for (const card of s.board) {
    act(s, d, { type: 'place', card, placement: strategy(card, truth.get(card) ?? 'forgery') });
  }
  act(s, d, { type: 'confirmSort' });
}

describe('setup', () => {
  it.each([3, 4, 5, 6, 7])('deals hands and roles for %i players', (n) => {
    const s = createGame(players(n), rng);
    const size = RULES.handSize[n];
    expect(s.seats.every((x) => x.hand.length === size)).toBe(true);
    expect(s.pile.length).toBe(RULES.pictureCount - n * size - 2);
    expect(directorIds(s)).toHaveLength(RULES.directors[n]);
    expect(s.phase).toBe('request');
    const all = [...s.pile, ...s.themes, ...s.seats.flatMap((x) => x.hand)];
    expect(new Set(all).size).toBe(RULES.pictureCount);
  });

  it('rejects too few or too many players', () => {
    expectError(() => createGame(players(2), rng), 'err.playerCount');
    expectError(() => createGame(players(8), rng), 'err.playerCount');
  });
});

describe('a round', () => {
  it('scores a perfect round and moves cards to the team pile', () => {
    const s = createGame(players(4), rng);
    submit(s, 3);
    expect(s.phase).toBe('sort');
    expect(s.board).toHaveLength(3 + RULES.forgeries);
    expect(painters(s).every((p) => p.hand.length === 9 - (p.id === painters(s)[0].id ? 2 : 1))).toBe(true);
    sort(s, (_, t) => t);
    expect(s.phase).toBe('reveal');
    expect(s.reveal!.perfect).toBe(true);
    expect(s.reveal!.teamGain).toBe(3);
    expect(s.teamPile).toHaveLength(3);
    expect(s.wolfgattiPile).toHaveLength(0);
  });

  it('counts accepted forgeries for Wolfgatti and discards wrong themes', () => {
    const s = createGame(players(4), rng);
    submit(s, 4);
    let swapped = 0;
    // Put two forgeries into theme A and reject two paintings instead; flip one theme.
    const truth = new Map<number, Placement>();
    for (const subs of Object.values(s.submissions)) for (const x of subs) truth.set(x.card, x.theme);
    const forgeries = s.board.filter((c) => !truth.has(c));
    const paintings = s.board.filter((c) => truth.has(c));
    sort(s, (card, t) => {
      if (card === forgeries[0] || card === forgeries[1]) return 'A';
      if (card === paintings[0] || card === paintings[1]) return 'forgery';
      if (card === paintings[2] && swapped++ === 0) return t === 'A' ? 'B' : 'A';
      return t;
    });
    const r = s.reveal!;
    expect(r.wolfgattiGain).toBe(2);
    expect(r.teamGain).toBe(1);
    expect(r.perfect).toBe(false);
    expect(r.entries.filter((e) => e.outcome === 'rejectedPainting')).toHaveLength(2);
    expect(r.entries.filter((e) => e.outcome === 'wrongTheme')).toHaveLength(1);
  });

  it('enforces the submit total and the sorting rules', () => {
    const s = createGame(players(4), rng);
    act(s, directorIds(s)[0], { type: 'setRequired', count: 2 });
    const p = painters(s)[0];
    expectError(() => act(s, p.id, { type: 'ready', ready: true }), 'err.totalMismatch');
    expectError(() => act(s, directorIds(s)[0], { type: 'select', card: p.hand[0], theme: 'A' }), 'err.notPainter');
    expectError(() => act(s, p.id, { type: 'select', card: 999, theme: 'A' }), 'err.notInHand');
    act(s, p.id, { type: 'select', card: p.hand[0], theme: 'A' });
    act(s, p.id, { type: 'select', card: p.hand[1], theme: 'B' });
    act(s, p.id, { type: 'ready', ready: true });
    // Changing a pick un-readies everyone.
    act(s, p.id, { type: 'select', card: p.hand[1], theme: 'A' });
    expect(s.ready[p.id]).toBe(false);
    for (const x of painters(s)) act(s, x.id, { type: 'ready', ready: true });
    expect(s.phase).toBe('sort');

    const d = directorIds(s)[0];
    expectError(() => act(s, d, { type: 'confirmSort' }), 'err.sortIncomplete');
    for (const card of s.board) act(s, d, { type: 'place', card, placement: 'A' });
    expectError(() => act(s, d, { type: 'confirmSort' }), 'err.forgeryCount');
    expectError(() => act(s, p.id, { type: 'place', card: s.board[0], placement: 'B' }), 'err.notDirector');
  });

  it('rejects requested counts outside 2–7', () => {
    const s = createGame(players(5), rng);
    const d = directorIds(s)[0];
    expectError(() => act(s, d, { type: 'setRequired', count: 1 }), 'err.invalidCount');
    expectError(() => act(s, d, { type: 'setRequired', count: 8 }), 'err.invalidCount');
  });
});

describe('helper cards', () => {
  it('swaps themes once and blocks a second use', () => {
    const s = createGame(players(4), rng);
    const d = directorIds(s)[0];
    const [a, b] = s.themes;
    act(s, d, { type: 'swapThemes', slots: ['A'] });
    expect(s.themes[0]).not.toBe(a);
    expect(s.themes[1]).toBe(b);
    expectError(() => act(s, d, { type: 'swapThemes', slots: ['B'] }), 'err.helperUsed');
  });

  it('recovers the helper whose number matches a perfect round', () => {
    const s = createGame(players(4), rng);
    act(s, directorIds(s)[0], { type: 'swapThemes', slots: ['A', 'B'] }); // number 3
    submit(s, 3);
    sort(s, (_, t) => t);
    expect(s.reveal!.recovered).toBe('swapThemes');
    expect(s.helpersUsed.swapThemes).toBe(false);
  });

  it('adjusts the count by one only before anyone is ready', () => {
    const s = createGame(players(4), rng);
    act(s, directorIds(s)[0], { type: 'setRequired', count: 4 });
    const [p, q] = painters(s);
    act(s, p.id, { type: 'adjustRequired', delta: 1 });
    expect(s.required).toBe(5);
    expectError(() => act(s, q.id, { type: 'adjustRequired', delta: -1 }), 'err.helperUsed');
  });

  it('swaps six hand cards and drops them from the selection', () => {
    const s = createGame(players(4), rng);
    act(s, directorIds(s)[0], { type: 'setRequired', count: 2 });
    const p = painters(s)[0];
    const out = p.hand.slice(0, 6);
    act(s, p.id, { type: 'select', card: out[0], theme: 'A' });
    act(s, p.id, { type: 'swapHand', cards: out });
    expect(p.hand).toHaveLength(9);
    expect(p.hand.some((c) => out.includes(c))).toBe(false);
    expect(s.submissions[p.id]).toHaveLength(0);
  });

  it('answers the ask helper per painter', () => {
    const s = createGame(players(4), rng);
    submit(s, 2);
    const own = s.submissions[painters(s)[0].id][0].card;
    act(s, directorIds(s)[0], { type: 'ask', card: own });
    expect(s.asks[0].answers.find((a) => a.playerId === painters(s)[0].id)!.yes).toBe(true);
    expect(s.asks[0].answers.filter((a) => a.yes)).toHaveLength(1);
  });
});

describe('round flow and game end', () => {
  it('rotates roles clockwise and refills hands', () => {
    const s = createGame(players(4), rng);
    const before = directorIds(s);
    submit(s, 3);
    sort(s, (_, t) => t);
    act(s, 'p0', { type: 'nextRound' });
    expect(s.round).toBe(2);
    expect(directorIds(s)).toEqual(['p1', 'p2']);
    expect(before).toEqual(['p0', 'p1']);
    expect(s.seats.every((x) => x.hand.length === 9)).toBe(true);
  });

  it('ends when Wolfgatti has six forgeries', () => {
    const s = createGame(players(4), rng);
    for (let round = 0; round < 2; round++) {
      submit(s, 4);
      // Accept every forgery, reject the paintings: 4 forgeries per round for Wolfgatti.
      sort(s, (_, t) => (t === 'forgery' ? 'A' : 'forgery'));
      act(s, 'p0', { type: 'nextRound' });
    }
    expect(s.wolfgattiPile).toHaveLength(8);
    expect(s.phase).toBe('gameOver');
    expect(s.endReason).toBe('wolfgatti');
    expect(viewFor(s, 'p0').won).toBe(false);
  });

  it('ends when the pile cannot supply another round', () => {
    const s = createGame(players(3), rng);
    let rounds = 0;
    while (s.phase !== 'gameOver' && rounds++ < 50) {
      submit(s, 7);
      sort(s, (_, t) => t);
      act(s, 'p0', { type: 'nextRound' });
    }
    expect(s.endReason).toBe('pileEmpty');
    expect(viewFor(s, 'p0').won).toBe(true);
  });
});

describe('player views', () => {
  it('never exposes hidden information', () => {
    const s = createGame(players(5), rng);
    act(s, directorIds(s)[0], { type: 'setRequired', count: 3 });
    const [p, q] = painters(s);
    act(s, p.id, { type: 'select', card: p.hand[0], theme: 'A' });

    const forDirector = viewFor(s, directorIds(s)[0]);
    expect(forDirector.seats.every((x) => x.selectedCount === null)).toBe(true);
    expect(forDirector.you!.selection).toEqual([]);
    expect(JSON.stringify(forDirector)).not.toContain('"hand":[' + p.hand[0]);

    const forPainter = viewFor(s, q.id);
    expect(forPainter.seats.find((x) => x.id === p.id)!.selectedCount).toBe(1);
    expect(forPainter.you!.selection).toEqual([]);
    expect(forPainter.you!.hand).toEqual(q.hand);
    for (const seat of forPainter.seats) expect(seat).not.toHaveProperty('hand');

    act(s, p.id, { type: 'select', card: p.hand[1], theme: 'B' });
    act(s, q.id, { type: 'select', card: q.hand[0], theme: 'B' });
    for (const x of painters(s)) act(s, x.id, { type: 'ready', ready: true });
    const sorting = viewFor(s, directorIds(s)[0]);
    const text = JSON.stringify(sorting);
    expect(sorting.board).toHaveLength(7);
    expect(text).not.toContain('forger');
    expect(text).not.toContain('owner');
    expect(sorting.reveal).toBeNull();

    const spectator = viewFor(s, null);
    expect(spectator.you).toBeNull();
  });
});


describe('shared request selection', () => {
  it('synchronizes both directors without starting submissions and resets next round', () => {
    const s = createGame(players(4), rng);
    const [a, b] = directorIds(s);
    act(s, a, { type: 'chooseRequired', count: 6 });
    expect(viewFor(s, b).requestedCount).toBe(6);
    expect(s.phase).toBe('request');
    expect(s.required).toBeNull();
    act(s, b, { type: 'chooseRequired', count: 4 });
    expect(viewFor(s, a).requestedCount).toBe(4);
    submit(s, 4);
    sort(s, (_, truth) => truth);
    act(s, a, { type: 'nextRound' });
    expect(s.requestedCount).toBe(3);
  });

  it('rejects painters, invalid counts and changes after confirmation without mutation', () => {
    const s = createGame(players(4), rng);
    const d = directorIds(s)[0];
    const before = structuredClone(s);
    expectError(() => act(s, painters(s)[0].id, { type: 'chooseRequired', count: 6 }), 'err.notDirector');
    for (const count of [1, 8, 2.5, NaN]) {
      expectError(() => act(s, d, { type: 'chooseRequired', count }), 'err.invalidCount');
    }
    expect(s).toEqual(before);
    act(s, d, { type: 'setRequired', count: 3 });
    expectError(() => act(s, d, { type: 'chooseRequired', count: 6 }), 'err.wrongPhase');
  });
});

describe('difficulty hints', () => {
  it('shows only aggregate theme totals during sorting in easy mode', () => {
    const s = createGame(players(4), rng, 'easy');
    expect(viewFor(s, 'p0').themeCounts).toBeNull();
    act(s, 'p0', { type: 'setRequired', count: 3 });
    const p = painters(s)[0];
    for (let i = 0; i < 3; i++) act(s, p.id, { type: 'select', card: p.hand[i], theme: 'A' });
    expect(viewFor(s, 'p0').themeCounts).toBeNull();
    for (const painter of painters(s)) act(s, painter.id, { type: 'ready', ready: true });
    for (const id of ['p0', 'p1', p.id, null]) {
      const view = viewFor(s, id);
      expect(view.themeCounts).toEqual({ A: 3, B: 0 });
      expect(view.board.every((card) => Object.keys(card).sort().join() === 'card,placement')).toBe(true);
      expect(view.reveal).toBeNull();
    }
    sort(s, (_, truth) => truth);
    expect(viewFor(s, 'p0').themeCounts).toBeNull();
    act(s, 'p0', { type: 'nextRound' });
    expect(s.difficulty).toBe('easy');
    expect(viewFor(s, 'p0').themeCounts).toBeNull();
  });

  it('keeps totals hidden in normal mode, including older saved games', () => {
    const s = createGame(players(4), rng);
    submit(s, 3);
    expect(viewFor(s, 'p0').themeCounts).toBeNull();
    delete (s as Partial<GameState>).difficulty;
    delete (s as Partial<GameState>).requestedCount;
    expect(viewFor(s, 'p0').difficulty).toBe('normal');
    expect(viewFor(s, 'p0').requestedCount).toBe(3);
    expect(viewFor(s, 'p0').themeCounts).toBeNull();
  });
});
