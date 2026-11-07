import type { Difficulty, GameAction } from './types';
import type { GameView } from './view';

export interface PlayerInfo {
  id: string;
  name: string;
  connected: boolean;
}

export interface RoomView {
  code: string;
  hostId: string;
  youId: string | null;
  isSpectator: boolean;
  players: PlayerInfo[]; // seat order
  spectators: PlayerInfo[];
  game: GameView | null;
  difficulty: Difficulty;
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string; params?: Record<string, string | number> };

export interface ClientToServer {
  'room:create': (p: { name: string; password?: string }, ack: (r: Ack<{ code: string; token: string }>) => void) => void;
  'room:join': (p: { code: string; name?: string; token?: string }, ack: (r: Ack<{ token: string }>) => void) => void;
  'room:leave': (ack: (r: Ack) => void) => void;
  'lobby:shuffle': (ack: (r: Ack) => void) => void;
  'lobby:difficulty': (p: { difficulty: Difficulty }, ack: (r: Ack) => void) => void;
  'lobby:move': (p: { playerId: string; dir: -1 | 1 }, ack: (r: Ack) => void) => void;
  'lobby:kick': (p: { playerId: string }, ack: (r: Ack) => void) => void;
  'lobby:makeHost': (p: { playerId: string }, ack: (r: Ack) => void) => void;
  'lobby:start': (ack: (r: Ack) => void) => void;
  'lobby:claimSeat': (p: { playerId: string }, ack: (r: Ack) => void) => void;
  'game:action': (p: GameAction, ack: (r: Ack) => void) => void;
  'game:backToLobby': (ack: (r: Ack) => void) => void;
}

export interface ServerToClient {
  state: (room: RoomView) => void;
  kicked: () => void;
}
