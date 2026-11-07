import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServer, Difficulty, GameAction, RoomView, ServerToClient } from '@wolfgatti/shared';
import { storage } from './storage';

export interface Toast {
  id: number;
  code: string;
  params?: Record<string, string | number>;
}

interface State {
  connected: boolean;
  everConnected: boolean;
  room: RoomView | null;
  toast: Toast | null;
  kicked: boolean;
}

let state: State = { connected: false, everConnected: false, room: null, toast: null, kicked: false };
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useStore(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

const socket: Socket<ServerToClient, ClientToServer> = io({ transports: ['websocket', 'polling'] });

/** Room the user is currently in; used to re-join automatically after a reconnect. */
let currentCode: string | null = null;

const tokenKey = (code: string) => `wolfgatti:token:${code}`;

socket.on('connect', () => {
  set({ connected: true, everConnected: true });
  if (currentCode) void api.join(currentCode);
});
socket.on('disconnect', () => set({ connected: false }));
socket.on('state', (room) => {
  if (room.code === currentCode) set({ room });
});
socket.on('kicked', () => {
  if (currentCode) storage.remove(tokenKey(currentCode));
  currentCode = null;
  set({ room: null, kicked: true });
});

let toastSeq = 0;
export function showError(code: string, params?: Record<string, string | number>) {
  const toast = { id: ++toastSeq, code, params };
  set({ toast });
  setTimeout(() => {
    if (state.toast?.id === toast.id) set({ toast: null });
  }, 4500);
}

type Events = keyof ClientToServer;

/** Emits with an acknowledgement; resolves to an error Ack on timeout. */
function emit<T extends object = object>(event: Events, ...args: unknown[]): Promise<Ack<T>> {
  return new Promise((resolve) => {
    if (!socket.connected) {
      resolve({ ok: false, error: 'err.connection' });
      return;
    }
    (socket.timeout(8000) as unknown as { emit: (...a: unknown[]) => void }).emit(
      event,
      ...args,
      (err: Error | null, res: Ack<T>) => resolve(err ? { ok: false, error: 'err.connection' } : res),
    );
  });
}

/** Like emit, but shows failures as a toast. */
async function run<T extends object = object>(event: Events, ...args: unknown[]): Promise<Ack<T>> {
  const res = await emit<T>(event, ...args);
  if (!res.ok) showError(res.error, res.params);
  return res;
}

export const api = {
  async create(name: string, password?: string) {
    const res = await run<{ code: string; token: string }>('room:create', { name, password });
    if (res.ok) {
      storage.set(tokenKey(res.code), res.token);
      currentCode = res.code;
    }
    return res;
  },

  hasToken(code: string) {
    return !!storage.get(tokenKey(code));
  },

  /** Joins with the stored token (reconnect) or as a new member with `name`. */
  async join(code: string, name?: string) {
    const token = storage.get(tokenKey(code)) ?? undefined;
    currentCode = code;
    const res = await emit<{ token: string }>('room:join', { code, name, token });
    if (res.ok) {
      storage.set(tokenKey(code), res.token);
    } else {
      if (res.error === 'err.roomNotFound') storage.remove(tokenKey(code));
      currentCode = null;
    }
    return res;
  },

  async leave() {
    if (currentCode) storage.remove(tokenKey(currentCode));
    currentCode = null;
    set({ room: null });
    await emit('room:leave');
  },

  clearKicked() {
    set({ kicked: false });
  },

  shuffle: () => run('lobby:shuffle'),
  difficulty: (difficulty: Difficulty) => run('lobby:difficulty', { difficulty }),
  move: (playerId: string, dir: -1 | 1) => run('lobby:move', { playerId, dir }),
  kick: (playerId: string) => run('lobby:kick', { playerId }),
  makeHost: (playerId: string) => run('lobby:makeHost', { playerId }),
  start: () => run('lobby:start'),
  claimSeat: (playerId: string) => run('lobby:claimSeat', { playerId }),
  action: (action: GameAction) => run('game:action', action),
  backToLobby: () => run('game:backToLobby'),
};
