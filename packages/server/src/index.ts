import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { Server, type Socket } from 'socket.io';
import { GameError, type Ack, type ClientToServer, type ServerToClient } from '@wolfgatti/shared';
import { config } from './config';
import { RoomManager, type Room } from './rooms';
import { schemas } from './schemas';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  // Keeps the room code out of Referer headers.
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

async function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
    return;
  }
  if (url.pathname === '/api/config') {
    res
      .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      .end(JSON.stringify({ passwordRequired: !!config.accessPassword }));
    return;
  }
  if (url.pathname === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': MIME['.txt'] }).end('User-agent: *\nDisallow: /r/\nDisallow: /api/\n');
    return;
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  let file = path.resolve(config.publicDir, `.${pathname}`);
  const relative = path.relative(config.publicDir, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(400).end();
    return;
  }
  let info = await stat(file).catch(() => null);
  const isAsset = path.extname(url.pathname) !== '';
  if (!info?.isFile()) {
    if (isAsset) {
      res.writeHead(404).end();
      return;
    }
    // SPA fallback: /r/CODE and friends are client-side routes.
    file = path.join(config.publicDir, 'index.html');
    info = await stat(file).catch(() => null);
    if (!info) {
      res.writeHead(404).end('client not built');
      return;
    }
  }
  const cache = url.pathname.startsWith('/assets/')
    ? 'public, max-age=31536000, immutable'
    : url.pathname.startsWith('/motifs/') || url.pathname.startsWith('/characters/') || url.pathname.startsWith('/card-backgrounds/')
      ? 'public, max-age=604800'
      : 'no-cache';
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': cache,
  });
  createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  if (req.url?.startsWith('/r/') || req.url?.startsWith('/api/')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  serveStatic(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
});

type SocketData = { code?: string; memberId?: string; ip: string };
const io = new Server<ClientToServer, ServerToClient, object, SocketData>(server, {
  maxHttpBufferSize: 32 * 1024,
  serveClient: false,
});
const rooms = new RoomManager();

// --- simple per-IP rate limits ---
const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}
setInterval(() => hits.clear(), 30 * 60_000).unref();

function broadcast(room: Room) {
  const sockets = io.sockets.adapter.rooms.get(room.code);
  if (!sockets) return;
  for (const id of sockets) {
    const s = io.sockets.sockets.get(id);
    if (s) s.emit('state', rooms.view(room, s.data.memberId ?? null));
  }
}

function fail(e: unknown): Extract<Ack, { ok: false }> {
  if (e instanceof Error && e.name === 'ZodError') return { ok: false, error: 'err.invalid' };
  if (e instanceof GameError) return { ok: false, error: e.code, params: e.params };
  console.error(e);
  return { ok: false, error: 'err.server' };
}

function attach(socket: Socket<ClientToServer, ServerToClient, object, SocketData>, room: Room, memberId: string) {
  detach(socket);
  socket.data.code = room.code;
  socket.data.memberId = memberId;
  socket.join(room.code);
  rooms.connected(memberId, 1);
  if (!rooms.isOnline(room.hostId) && room.players.filter((p) => rooms.isOnline(p.id)).length === 1) {
    rooms.passHost(room, room.hostId);
  }
}

function detach(socket: Socket<ClientToServer, ServerToClient, object, SocketData>) {
  const { code, memberId } = socket.data;
  if (!code || !memberId) return;
  socket.leave(code);
  rooms.connected(memberId, -1);
  socket.data.code = undefined;
  socket.data.memberId = undefined;
  const room = rooms.rooms.get(code);
  if (room) {
    if (room.hostId === memberId && !rooms.isOnline(memberId)) scheduleHostCheck(room, memberId);
    broadcast(room);
  }
}

/** The host role moves on if the host stays offline for a minute. */
function scheduleHostCheck(room: Room, hostId: string) {
  setTimeout(() => {
    if (room.hostId === hostId && !rooms.isOnline(hostId) && rooms.rooms.has(room.code)) {
      rooms.passHost(room, hostId);
      broadcast(room);
    }
  }, 60_000).unref();
}

io.on('connection', (socket) => {
  const fwd = socket.handshake.headers['x-forwarded-for'];
  socket.data.ip = (config.trustProxy && typeof fwd === 'string' ? fwd.split(',')[0].trim() : socket.handshake.address) || '?';

  /** Wraps a handler: validates input, resolves the room, acks errors, broadcasts on success. */
  function inRoom<T>(schema: { parse: (v: unknown) => T } | null, fn: (room: Room, me: string, input: T) => void) {
    return (...args: unknown[]) => {
      const ack = (typeof args[args.length - 1] === 'function' ? args.pop() : () => {}) as (r: Ack) => void;
      try {
        const input = schema ? schema.parse(args[0]) : (undefined as T);
        const { code, memberId } = socket.data;
        if (!code || !memberId) throw new GameError('err.notInRoom');
        const room = rooms.get(code);
        fn(room, memberId, input);
        ack({ ok: true });
        broadcast(room);
      } catch (e) {
        ack(fail(e));
      }
    };
  }

  socket.on('room:create', (input, ack) => {
    try {
      if (limited(`create:${socket.data.ip}`, 10, 10 * 60_000)) throw new GameError('err.rateLimited');
      const { name, password } = schemas.create.parse(input);
      if (config.accessPassword && password !== config.accessPassword) throw new GameError('err.wrongPassword');
      const { room, member } = rooms.create(name);
      attach(socket, room, member.id);
      ack({ ok: true, code: room.code, token: member.token });
      broadcast(room);
    } catch (e) {
      ack(fail(e));
    }
  });

  socket.on('room:join', (input, ack) => {
    try {
      if (limited(`join:${socket.data.ip}`, 60, 60_000)) throw new GameError('err.rateLimited');
      const { code, name, token } = schemas.join.parse(input);
      const room = rooms.get(code);
      const member = rooms.join(room, token, name);
      attach(socket, room, member.id);
      ack({ ok: true, token: member.token });
      broadcast(room);
    } catch (e) {
      ack(fail(e));
    }
  });

  socket.on('room:leave', (ack) => {
    const { code, memberId } = socket.data;
    const room = code ? rooms.rooms.get(code) : undefined;
    detach(socket);
    if (room && memberId) {
      rooms.leave(room, memberId);
      broadcast(room);
    }
    ack({ ok: true });
  });

  socket.on('lobby:shuffle', inRoom(null, (room, me) => rooms.shufflePlayers(room, me)));
  socket.on('lobby:difficulty', inRoom(schemas.difficulty, (room, me, { difficulty }) => rooms.setDifficulty(room, me, difficulty)));
  socket.on(
    'lobby:move',
    inRoom(schemas.move, (room, me, { playerId, dir }) => rooms.move(room, me, playerId, dir)),
  );
  socket.on(
    'lobby:kick',
    inRoom(schemas.playerRef, (room, me, { playerId }) => {
      rooms.kick(room, me, playerId);
      for (const id of io.sockets.adapter.rooms.get(room.code) ?? []) {
        const s = io.sockets.sockets.get(id);
        if (s?.data.memberId === playerId) {
          s.emit('kicked');
          detach(s);
        }
      }
    }),
  );
  socket.on(
    'lobby:makeHost',
    inRoom(schemas.playerRef, (room, me, { playerId }) => rooms.makeHost(room, me, playerId)),
  );
  socket.on(
    'lobby:start',
    inRoom(null, (room, me) => rooms.start(room, me)),
  );
  socket.on(
    'lobby:claimSeat',
    inRoom(schemas.playerRef, (room, me, { playerId }) => {
      const seat = rooms.claimSeat(room, me, playerId);
      rooms.connected(me, -1);
      rooms.connected(seat.id, 1);
      socket.data.memberId = seat.id;
    }),
  );
  socket.on(
    'game:action',
    inRoom(schemas.action, (room, me, action) => rooms.act(room, me, action)),
  );
  socket.on(
    'game:backToLobby',
    inRoom(null, (room, me) => rooms.backToLobby(room, me)),
  );
  socket.on('disconnect', () => detach(socket));
});

rooms.load().then(() => {
  setInterval(() => rooms.sweep().catch(console.error), 5 * 60_000).unref();
  server.listen(config.port, () => {
    console.log(`Wolfgatti server on :${config.port} (static: ${config.publicDir})`);
  });
});

async function shutdown() {
  await rooms.flush().catch(console.error);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
