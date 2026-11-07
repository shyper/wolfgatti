/** Exercise a full three-player match against a running local Wolfgatti server. */
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const url = process.env.WOLFGATTI_TEST_URL ?? 'http://127.0.0.1:3300';
const clients = [];
async function client(name) {
  const item = { name, view: null, token: null, socket: io(url, { autoConnect: false, reconnection: false, transports: ['websocket'] }) };
  item.socket.on('state', (state) => { item.view = state; });
  clients.push(item);
  await new Promise((resolve, reject) => {
    item.socket.once('connect', resolve);
    item.socket.once('connect_error', reject);
    item.socket.connect();
  });
  return item;
}
async function emit(item, event, payload) {
  const response = await item.socket.timeout(5000).emitWithAck(event, ...(payload === undefined ? [] : [payload]));
  assert(response.ok, `${event}: ${response.error}`);
  return response;
}
async function wait(item, predicate) {
  if (item.view && predicate(item.view)) return item.view;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { item.socket.off('state', listener); reject(new Error(`State timeout for ${item.name}: ${item.view?.game?.phase} round ${item.view?.game?.round}; expected ${predicate}`)); }, 5000);
    function listener(view) {
      if (!predicate(view)) return;
      clearTimeout(timer);
      item.socket.off('state', listener);
      resolve(view);
    }
    item.socket.on('state', listener);
  });
}
const action = (item, payload) => emit(item, 'game:action', payload);
try {
  const players = await Promise.all(['Smoke Curator', 'Smoke Painter', 'Smoke Guest'].map(client));
  const host = players[0];
  const created = await emit(host, 'room:create', { name: host.name });
  host.token = created.token;
  for (const player of players.slice(1)) {
    player.token = (await emit(player, 'room:join', { code: created.code, name: player.name })).token;
  }
  await wait(host, (v) => v.players.length === 3);
  await emit(host, 'lobby:difficulty', { difficulty: 'easy' });
  await emit(host, 'lobby:start');
  for (const player of players) await wait(player, (v) => v.game?.phase === 'request');
  const spectator = await client('Smoke Spectator');
  await emit(spectator, 'room:join', { code: created.code, name: spectator.name });
  await wait(spectator, (v) => v.isSpectator && v.game?.phase === 'request');
  assert.equal(spectator.view.game.you, null);
  const forbidden = await spectator.socket.timeout(5000).emitWithAck('game:action', { type: 'chooseRequired', count: 2 });
  assert.equal(forbidden.ok, false);
  let rounds = 0;
  while (host.view.game.phase !== 'gameOver' && rounds < 40) {
    rounds++;
    console.log(`Exercising round ${rounds}.`);
    for (const player of players) await wait(player, (v) => v.game?.phase === 'request');
    const curator = players.find((p) => p.view.game.you.role === 'director');
    const painters = players.filter((p) => p.view.game.you.role === 'painter');
    assert.equal(painters.length, 1);
    await action(curator, { type: 'setRequired', count: 2 });
    const painter = painters[0];
    await wait(painter, (v) => v.game?.phase === 'submit');
    if (rounds === 1) {
      await action(painter, { type: 'swapHand', cards: painter.view.game.you.hand.slice(0, 6) });
      await wait(painter, (v) => v.game.helpers.find((h) => h.id === 'swapHand').used);
      const originalId = painter.view.youId;
      const hand = [...painter.view.game.you.hand];
      painter.socket.disconnect();
      painter.socket.connect();
      await new Promise((resolve, reject) => {
        if (painter.socket.connected) return resolve();
        painter.socket.once('connect', resolve);
        painter.socket.once('connect_error', reject);
      });
      await emit(painter, 'room:join', { code: created.code, token: painter.token });
      await wait(painter, (v) => v.youId === originalId && v.game?.phase === 'submit');
      assert.deepEqual(painter.view.game.you.hand, hand);
    }
    const selected = painter.view.game.you.hand.slice(0, 2);
    await action(painter, { type: 'select', card: selected[0], theme: 'A' });
    await action(painter, { type: 'select', card: selected[1], theme: 'B' });
    await wait(painter, (v) => v.game.you.selection.length === 2);
    await action(painter, { type: 'ready', ready: true });
    await wait(curator, (v) => v.game?.phase === 'sort');
    assert.deepEqual(curator.view.game.themeCounts, { A: 1, B: 1 });
    assert(!('forgeries' in curator.view.game));
    assert(!('submissions' in curator.view.game));
    assert(!('pile' in curator.view.game));
    assert(curator.view.game.seats.every((seat) => !('hand' in seat)));
    if (rounds === 1) await action(curator, { type: 'ask', card: curator.view.game.board[0].card });
    for (const [index, entry] of curator.view.game.board.entries()) {
      await action(curator, { type: 'place', card: entry.card, placement: index < 4 ? 'forgery' : 'A' });
    }
    await action(curator, { type: 'confirmSort' });
    await wait(host, (v) => v.game?.phase === 'reveal');
    assert.equal(host.view.game.reveal.entries.length, 6);
    await action(host, { type: 'nextRound' });
    await wait(host, (v) => ['request', 'gameOver'].includes(v.game?.phase));
  }
  assert.equal(host.view.game.phase, 'gameOver');
  assert.equal(typeof host.view.game.won, 'boolean');
  assert(host.view.game.rating);
  await emit(host, 'game:backToLobby');
  await wait(host, (v) => v.game === null);
  console.log(`Live smoke test passed: ${rounds} rounds, role rotation, helper actions, reconnect, spectator privacy, scoring and return to lobby.`);
} finally {
  for (const item of clients) item.socket.disconnect();
}
