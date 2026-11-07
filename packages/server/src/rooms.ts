import { randomBytes, randomInt } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  applyAction,
  createGame,
  GameError,
  RULES,
  viewFor,
  shuffle,
  type Difficulty,
  type GameAction,
  type GameState,
  type RoomView,
} from '@wolfgatti/shared';
import { config } from './config';

export interface Member {
  id: string;
  name: string;
  token: string;
}

export interface Room {
  code: string;
  hostId: string;
  players: Member[];
  spectators: Member[];
  game: GameState | null;
  difficulty: Difficulty;
  lastActive: number;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rng = () => randomInt(0, 2 ** 32) / 2 ** 32;

export class RoomError extends GameError {}

export class RoomManager {
  rooms = new Map<string, Room>();
  /** playerId → number of open sockets */
  private online = new Map<string, number>();
  private saveTimers = new Map<string, NodeJS.Timeout>();

  newCode(): string {
    let code: string;
    do {
      code = Array.from({ length: 10 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  create(name: string): { room: Room; member: Member } {
    const member = newMember(name);
    const room: Room = {
      code: this.newCode(),
      hostId: member.id,
      players: [member],
      spectators: [],
      game: null,
      difficulty: 'normal',
      lastActive: Date.now(),
    };
    this.rooms.set(room.code, room);
    this.touch(room);
    return { room, member };
  }

  get(code: string): Room {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('err.roomNotFound');
    return room;
  }

  /** Re-attaches by token, or adds a new player (lobby) or spectator (running game / full). */
  join(room: Room, token: string | undefined, name: string | undefined): Member {
    const known = token ? [...room.players, ...room.spectators].find((m) => m.token === token) : undefined;
    if (known) return known;
    if (!name) throw new RoomError('err.nameRequired');
    const member = newMember(name);
    if (!room.game && room.players.length < RULES.maxPlayers) room.players.push(member);
    else room.spectators.push(member);
    this.touch(room);
    return member;
  }

  leave(room: Room, memberId: string) {
    room.spectators = room.spectators.filter((m) => m.id !== memberId);
    // Seated players stay in a running game so their seat can be taken over.
    if (!room.game) room.players = room.players.filter((m) => m.id !== memberId);
    if (room.hostId === memberId) this.passHost(room, memberId);
    this.touch(room);
  }

  isPlayer(room: Room, id: string) {
    return room.players.some((m) => m.id === id);
  }

  requireHost(room: Room, id: string) {
    if (room.hostId !== id) throw new RoomError('err.notHost');
  }

  move(room: Room, by: string, playerId: string, dir: -1 | 1) {
    this.requireHost(room, by);
    if (room.game) throw new RoomError('err.gameRunning');
    const i = room.players.findIndex((m) => m.id === playerId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= room.players.length) return;
    [room.players[i], room.players[j]] = [room.players[j], room.players[i]];
    this.touch(room);
  }

  shufflePlayers(room: Room, by: string) {
    this.requireHost(room, by);
    if (room.game) throw new RoomError('err.gameRunning');
    room.players = shuffle(room.players, rng);
    this.touch(room);
  }

  setDifficulty(room: Room, by: string, difficulty: Difficulty) {
    this.requireHost(room, by);
    if (room.game) throw new RoomError('err.gameRunning');
    if (difficulty !== 'normal' && difficulty !== 'easy') throw new RoomError('err.invalid');
    room.difficulty = difficulty;
    this.touch(room);
  }

  kick(room: Room, by: string, playerId: string) {
    this.requireHost(room, by);
    if (playerId === by) throw new RoomError('err.invalid');
    if (room.game && this.isPlayer(room, playerId)) throw new RoomError('err.gameRunning');
    room.players = room.players.filter((m) => m.id !== playerId);
    room.spectators = room.spectators.filter((m) => m.id !== playerId);
    this.touch(room);
  }

  makeHost(room: Room, by: string, playerId: string) {
    this.requireHost(room, by);
    if (!this.isPlayer(room, playerId)) throw new RoomError('err.invalid');
    if (!this.isOnline(playerId)) throw new RoomError('err.playerOffline');
    room.hostId = playerId;
    this.touch(room);
  }

  start(room: Room, by: string) {
    this.requireHost(room, by);
    if (room.game) throw new RoomError('err.gameRunning');
    room.game = createGame(room.players, rng, room.difficulty);
    this.touch(room);
  }

  backToLobby(room: Room, by: string) {
    this.requireHost(room, by);
    room.game = null;
    // Spectators fill free seats for the next game.
    while (room.players.length < RULES.maxPlayers && room.spectators.length) room.players.push(room.spectators.shift()!);
    this.touch(room);
  }

  /** A spectator takes over the seat of a disconnected player in a running game. */
  claimSeat(room: Room, by: string, playerId: string) {
    const spectator = room.spectators.find((m) => m.id === by);
    const seat = room.players.find((m) => m.id === playerId);
    if (!spectator || !seat || !room.game) throw new RoomError('err.invalid');
    if (this.isOnline(seat.id)) throw new RoomError('err.seatTaken');
    seat.name = spectator.name;
    seat.token = spectator.token;
    const gameSeat = room.game.seats.find((s) => s.id === seat.id);
    if (gameSeat) gameSeat.name = spectator.name;
    room.spectators = room.spectators.filter((m) => m.id !== by);
    if (room.hostId === by) room.hostId = seat.id;
    this.touch(room);
    return seat;
  }

  act(room: Room, by: string, action: GameAction) {
    if (!room.game) throw new RoomError('err.noGame');
    if (!this.isPlayer(room, by)) throw new RoomError('err.notSeated');
    applyAction(room.game, by, action, rng);
    this.touch(room);
  }

  connected(id: string, delta: 1 | -1) {
    const n = (this.online.get(id) ?? 0) + delta;
    if (n <= 0) this.online.delete(id);
    else this.online.set(id, n);
  }

  isOnline(id: string) {
    return this.online.has(id);
  }

  /** Hands the host role to the next online player if the host is gone. */
  passHost(room: Room, leavingId: string) {
    const next = room.players.find((m) => m.id !== leavingId && this.isOnline(m.id));
    if (next) {
      room.hostId = next.id;
      this.touch(room);
    }
  }

  view(room: Room, memberId: string | null): RoomView {
    const info = (m: Member) => ({ id: m.id, name: m.name, connected: this.isOnline(m.id) });
    const seated = memberId !== null && this.isPlayer(room, memberId);
    return {
      code: room.code,
      hostId: room.hostId,
      youId: memberId,
      isSpectator: !seated,
      players: room.players.map(info),
      spectators: room.spectators.map(info),
      game: room.game ? viewFor(room.game, seated ? memberId : null) : null,
      difficulty: room.difficulty ?? 'normal',
    };
  }

  touch(room: Room) {
    room.lastActive = Date.now();
    this.scheduleSave(room);
  }

  // --- persistence: one JSON snapshot per room, so restarts keep running games ---

  private file(code: string) {
    return path.join(config.dataDir, 'rooms', `${code}.json`);
  }

  private scheduleSave(room: Room) {
    clearTimeout(this.saveTimers.get(room.code));
    this.saveTimers.set(
      room.code,
      setTimeout(() => {
        this.saveTimers.delete(room.code);
        if (!this.rooms.has(room.code)) return;
        writeFile(this.file(room.code), JSON.stringify(room)).catch((e) => console.error('save failed', e));
      }, 500),
    );
  }

  async load() {
    const dir = path.join(config.dataDir, 'rooms');
    await mkdir(dir, { recursive: true });
    for (const f of await readdir(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const room = JSON.parse(await readFile(path.join(dir, f), 'utf8')) as Room;
        room.difficulty ??= 'normal';
        if (room.game) {
          room.game.difficulty ??= room.difficulty;
          room.game.requestedCount ??= 3;
        }
        if (Date.now() - room.lastActive < config.roomTtlMs) this.rooms.set(room.code, room);
        else await rm(path.join(dir, f), { force: true });
      } catch (e) {
        console.error('could not load', f, e);
      }
    }
    console.log(`loaded ${this.rooms.size} room(s) from ${dir}`);
  }

  /** Removes rooms nobody is connected to after the TTL. */
  async sweep() {
    for (const room of this.rooms.values()) {
      const anyoneOnline = [...room.players, ...room.spectators].some((m) => this.isOnline(m.id));
      if (!anyoneOnline && Date.now() - room.lastActive > config.roomTtlMs) {
        this.rooms.delete(room.code);
        await rm(this.file(room.code), { force: true });
      }
    }
  }

  /** Writes all pending snapshots right away (used on shutdown). */
  async flush() {
    for (const [code, timer] of this.saveTimers) {
      clearTimeout(timer);
      const room = this.rooms.get(code);
      if (room) await writeFile(this.file(code), JSON.stringify(room));
    }
    this.saveTimers.clear();
  }
}

function newMember(name: string): Member {
  return { id: randomBytes(6).toString('hex'), name, token: randomBytes(24).toString('base64url') };
}
