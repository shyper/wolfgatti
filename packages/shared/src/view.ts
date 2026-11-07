import { roleOf, seatIndexOf, teamScore } from './engine';
import { HELPERS, RULES, ratingFor, type Rating } from './rules';
import type {
  AskResult,
  CardId,
  Difficulty,
  GameState,
  HelperId,
  LogEntry,
  Phase,
  Placement,
  RevealSummary,
  Role,
  Submission,
} from './types';

export interface SeatView {
  id: string;
  name: string;
  role: Role;
  handCount: number;
  ready: boolean | null; // only painters in the submit phase
  selectedCount: number | null; // only shown to fellow painters
}

export interface GameView {
  difficulty: Difficulty;
  requestedCount: number;
  themeCounts: Record<'A' | 'B', number> | null;
  phase: Phase;
  round: number;
  seats: SeatView[];
  you: { id: string; role: Role; hand: CardId[]; selection: Submission[] } | null;
  themes: [CardId, CardId];
  required: number | null;
  adjusted: boolean;
  helpers: { id: HelperId; used: boolean; number: number }[];
  board: { card: CardId; placement: Placement | null }[];
  asks: AskResult[];
  reveal: RevealSummary | null;
  teamScore: number;
  wolfgattiScore: number;
  pileCount: number;
  discardCount: number;
  endReason: GameState['endReason'];
  rating: Rating | null;
  won: boolean | null;
  log: LogEntry[];
}

/**
 * Builds what one player may see. Hidden: the pile, other hands, other painters' picks,
 * and which board cards are forgeries (until the reveal).
 */
export function viewFor(state: GameState, playerId: string | null): GameView {
  const myIndex = playerId ? seatIndexOf(state, playerId) : -1;
  const myRole = myIndex >= 0 ? roleOf(state, myIndex) : null;
  const painterSeesPicks = myRole === 'painter' && state.phase === 'submit';
  const over = state.phase === 'gameOver';

  return {
    difficulty: state.difficulty ?? 'normal',
    requestedCount: state.requestedCount ?? 3,
    themeCounts: state.difficulty === 'easy' && state.phase === 'sort'
      ? Object.values(state.submissions).flat().reduce((counts, s) => {
          counts[s.theme]++;
          return counts;
        }, { A: 0, B: 0 })
      : null,
    phase: state.phase,
    round: state.round,
    seats: state.seats.map((s, i) => {
      const role = roleOf(state, i);
      const inSubmit = state.phase === 'submit' && role === 'painter';
      return {
        id: s.id,
        name: s.name,
        role,
        handCount: s.hand.length,
        ready: inSubmit ? !!state.ready[s.id] : null,
        selectedCount: inSubmit && painterSeesPicks ? (state.submissions[s.id]?.length ?? 0) : null,
      };
    }),
    you:
      myIndex >= 0
        ? {
            id: playerId!,
            role: myRole!,
            hand: [...state.seats[myIndex].hand],
            selection: myRole === 'painter' ? [...(state.submissions[playerId!] ?? [])] : [],
          }
        : null,
    themes: state.themes,
    required: state.required,
    adjusted: state.adjusted,
    helpers: HELPERS.map((id) => ({ id, used: state.helpersUsed[id], number: RULES.helperNumbers[id] })),
    board: state.board.map((card) => ({ card, placement: state.placements[card] ?? null })),
    asks: state.asks,
    reveal: state.phase === 'reveal' ? state.reveal : null,
    teamScore: teamScore(state),
    wolfgattiScore: state.wolfgattiPile.length,
    pileCount: state.pile.length,
    discardCount: state.discardCount,
    endReason: state.endReason,
    rating: over ? ratingFor(teamScore(state)) : null,
    won: over ? teamScore(state) >= RULES.winScore : null,
    log: state.log.slice(-60),
  };
}
