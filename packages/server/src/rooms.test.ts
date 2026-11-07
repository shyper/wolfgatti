import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomManager } from './rooms';

beforeEach(() => {
  // Exercise room behavior without scheduling snapshot writes.
  vi.spyOn(RoomManager.prototype, 'touch').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function setup() {
  const rooms = new RoomManager();
  const { room, member: host } = rooms.create('Host');
  const b = rooms.join(room, undefined, 'B');
  const c = rooms.join(room, undefined, 'C');
  for (const p of room.players) rooms.connected(p.id, 1);
  return { rooms, room, host, b, c };
}

describe('lobby settings', () => {
  it('shuffles only in the lobby as host and broadcasts the same seats to everyone', () => {
    const { rooms, room, host, b } = setup();
    const seats = [...room.players];
    expect(() => rooms.shufflePlayers(room, b.id)).toThrow('err.notHost');
    rooms.shufflePlayers(room, host.id);
    expect(new Set(room.players)).toEqual(new Set(seats));
    expect(room.hostId).toBe(host.id);
    expect(rooms.view(room, host.id).players).toEqual(rooms.view(room, b.id).players);
    rooms.start(room, host.id);
    expect(room.game!.seats.map((s) => s.id)).toEqual(room.players.map((s) => s.id));
    expect(() => rooms.shufflePlayers(room, host.id)).toThrow('err.gameRunning');
  });

  it('shares difficulty, applies it to the game and restricts changes to the lobby host', () => {
    const { rooms, room, host, b } = setup();
    expect(room.difficulty).toBe('normal');
    expect(() => rooms.setDifficulty(room, b.id, 'easy')).toThrow('err.notHost');
    rooms.setDifficulty(room, host.id, 'easy');
    expect(rooms.view(room, b.id).difficulty).toBe('easy');
    rooms.start(room, host.id);
    expect(room.game!.difficulty).toBe('easy');
    expect(() => rooms.setDifficulty(room, host.id, 'normal')).toThrow('err.gameRunning');
    rooms.backToLobby(room, host.id);
    expect(room.difficulty).toBe('easy');
    expect(rooms.view(room, b.id)).not.toHaveProperty('chat');
  });
});

describe('host transfer', () => {
  it('passes host to an online player and rejects returning it to the offline former host', () => {
    const { rooms, room, host, b } = setup();
    rooms.start(room, host.id);
    rooms.connected(host.id, -1);
    rooms.leave(room, host.id);
    expect(room.hostId).toBe(b.id);
    expect(() => rooms.makeHost(room, b.id, host.id)).toThrow('err.playerOffline');
    expect(room.hostId).toBe(b.id);
    rooms.connected(host.id, 1);
    rooms.makeHost(room, b.id, host.id);
    expect(room.hostId).toBe(host.id);
  });

  it('never selects an offline successor and accepts a later online successor', () => {
    const { rooms, room, host, b, c } = setup();
    for (const p of room.players) rooms.connected(p.id, -1);
    rooms.passHost(room, host.id);
    expect(room.hostId).toBe(host.id);
    rooms.connected(c.id, 1);
    rooms.passHost(room, host.id);
    expect(room.hostId).toBe(c.id);
    expect(() => rooms.makeHost(room, b.id, c.id)).toThrow('err.notHost');
  });
});
