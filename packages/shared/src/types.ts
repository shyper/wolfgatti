export type CardId = number; // 1..168, image /motifs/p001.webp …
export type Role = 'director' | 'painter';
export type ThemeSlot = 'A' | 'B';
export type Placement = ThemeSlot | 'forgery';
export type HelperId = 'swapThemes' | 'swapHand' | 'plusMinus' | 'ask';
export type Difficulty = 'normal' | 'easy';
export type Phase = 'request' | 'submit' | 'sort' | 'reveal' | 'gameOver';
export type Rng = () => number;

export interface LogEntry {
  code: string;
  params?: Record<string, string | number>;
}

export interface Seat {
  id: string;
  name: string;
  hand: CardId[];
}

export interface Submission {
  card: CardId;
  theme: ThemeSlot;
}

export interface AskResult {
  card: CardId;
  answers: { playerId: string; yes: boolean }[];
}

export type Outcome = 'correct' | 'wrongTheme' | 'rejectedPainting' | 'forgeryAccepted' | 'forgeryRejected';

export interface RevealEntry {
  card: CardId;
  owner: string | null; // player id, null = Wolfgatti forgery
  intended: ThemeSlot | null;
  placed: Placement;
  outcome: Outcome;
}

export interface RevealSummary {
  entries: RevealEntry[];
  teamGain: number;
  wolfgattiGain: number;
  perfect: boolean;
  recovered: HelperId | null;
  gameEnds: boolean;
}

export interface GameState {
  difficulty: Difficulty;
  requestedCount: number;
  seats: Seat[]; // clockwise seat order
  roleOffset: number;
  round: number;
  phase: Phase;
  pile: CardId[];
  themes: [CardId, CardId];
  required: number | null;
  adjusted: boolean;
  submissions: Record<string, Submission[]>;
  ready: Record<string, boolean>;
  board: CardId[];
  forgeries: CardId[];
  placements: Record<string, Placement>;
  asks: AskResult[];
  helpersUsed: Record<HelperId, boolean>;
  teamPile: CardId[];
  wolfgattiPile: CardId[];
  discardCount: number;
  reveal: RevealSummary | null;
  endReason: 'wolfgatti' | 'pileEmpty' | null;
  log: LogEntry[];
}

export type GameAction =
  | { type: 'chooseRequired'; count: number }
  | { type: 'swapThemes'; slots: ThemeSlot[] }
  | { type: 'setRequired'; count: number }
  | { type: 'adjustRequired'; delta: 1 | -1 }
  | { type: 'swapHand'; cards: CardId[] }
  | { type: 'select'; card: CardId; theme: ThemeSlot | null }
  | { type: 'ready'; ready: boolean }
  | { type: 'place'; card: CardId; placement: Placement | null }
  | { type: 'ask'; card: CardId }
  | { type: 'confirmSort' }
  | { type: 'nextRound' };
