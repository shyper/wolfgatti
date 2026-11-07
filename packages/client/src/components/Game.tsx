import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HELPER_ROLE,
  RULES,
  type CardId,
  type GameView,
  type HelperId,
  type Placement,
  type RoomView,
  type ThemeSlot,
} from '@wolfgatti/shared';
import { play, type Sound } from '../sound';
import { api } from '../store';
import { Card, cardImage } from './Card';
import { openRules } from './Rules';
import { Sidebar } from './Sidebar';

type Mode = 'ask' | 'swapHand' | null;
type Dialog = 'swapThemes' | 'plusMinus' | null;

export function Game({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const g = room.game!;
  const role = g.you?.role ?? 'spectator';
  const [mode, setMode] = useState<Mode>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const isHost = room.hostId === room.youId;
  useTurnSounds(g);

  return (
    <div className="game">
      <main className="table">
        <Scoreboard g={g} canAbort={isHost && g.phase !== 'gameOver'} />
        {g.phase === 'gameOver' ? (
          <GameOver room={room} />
        ) : (
          <>
            <div className="phase-banner">
              <span className={`role-chip ${role}`}>{g.you ? t('game.youAre', { role: t(`role.${role}`) }) : t('game.watching')}</span>
              <span>{t(`game.phase.${g.phase}.${role}`)}</span>
              {g.phase !== 'reveal' && (
                <button type="button" className="ghost small help" onClick={() => openRules('example')}>
                  {t('game.howTo')}
                </button>
              )}
            </div>
            <Helpers g={g} onUse={(h) => (h === 'ask' || h === 'swapHand' ? setMode(h) : setDialog(h))} />
            {g.phase === 'request' && <Request g={g} />}
            {g.phase === 'submit' && <Submit g={g} mode={mode} setMode={setMode} />}
            {g.phase === 'sort' && <Sort g={g} mode={mode} setMode={setMode} />}
            {g.phase === 'reveal' && <Reveal g={g} room={room} />}
            {g.you && (g.phase === 'request' || (g.phase === 'submit' && role !== 'painter')) && (
              <section className="hand-section" aria-label={t('game.yourHand')}>
                {role !== 'painter' && <h3>{t('game.yourHandLater')}</h3>}
                <div className={`hand ${role !== 'painter' ? 'dim' : ''}`}>
                  {g.you.hand.map((c) => (
                    <Card key={c} id={c} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <Sidebar room={room} />
      {dialog === 'swapThemes' && <SwapThemesDialog onClose={() => setDialog(null)} />}
      {dialog === 'plusMinus' && <PlusMinusDialog g={g} onClose={() => setDialog(null)} />}
    </div>
  );
}

/**
 * Plays a chime when the game starts waiting for this player, and on round results / game end.
 * Keys only change on real transitions, so re-renders, ready toggles or reconnects stay silent.
 */
function useTurnSounds(g: GameView) {
  const role = g.you?.role;
  const myTurn =
    (g.phase === 'request' && role === 'director') ||
    (g.phase === 'submit' && role === 'painter') ||
    (g.phase === 'sort' && role === 'director');
  let event: { key: string; sound: Sound } | null = null;
  if (myTurn) event = { key: `${g.round}:${g.phase}`, sound: 'turn' };
  else if (g.phase === 'reveal') event = { key: `${g.round}:reveal`, sound: 'reveal' };
  else if (g.phase === 'gameOver') event = { key: 'gameOver', sound: g.won ? 'win' : 'lose' };

  const last = useRef<string | null | undefined>(undefined);
  const key = event?.key ?? null;
  useEffect(() => {
    // The first render (page load, reconnect) only records the state.
    if (last.current !== undefined && event && key !== last.current) play(event.sound);
    last.current = key;
  }, [key]);
}

function Scoreboard({ g, canAbort }: { g: GameView; canAbort: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="scoreboard">
      <span className="pill">{t('game.round', { round: g.round })}</span>
      <span className="pill team" title={t('end.needed')}>
        {t('game.team')} <strong>{g.teamScore}</strong>
        <small>/{RULES.winScore}</small>
      </span>
      <span className="pill wolfgatti">
        <img src={cardImage('wolfgatti')} alt="" />
        {t('game.wolfgatti')} <strong>{g.wolfgattiScore}</strong>
        <small>/{RULES.wolfgattiLimit}</small>
      </span>
      <span className="pill">
        {t('game.pile')} <strong>{g.pileCount}</strong>
      </span>
      {g.required !== null && g.phase !== 'gameOver' && (
        <span className="pill accent">{t('game.required', { count: g.required })}</span>
      )}
      {canAbort && (
        <button
          type="button"
          className="ghost small abort"
          onClick={() => window.confirm(t('end.abortConfirm')) && api.backToLobby()}
        >
          {t('end.abort')}
        </button>
      )}
    </div>
  );
}

function canUseHelper(g: GameView, h: HelperId): boolean {
  if (!g.you || g.helpers.find((x) => x.id === h)!.used) return false;
  if (HELPER_ROLE[h] !== g.you.role) return false;
  switch (h) {
    case 'swapThemes':
      return g.phase === 'request';
    case 'ask':
      return g.phase === 'sort';
    case 'plusMinus':
      return g.phase === 'submit' && !g.seats.some((s) => s.ready);
    case 'swapHand':
      return g.phase === 'submit' && !g.seats.find((s) => s.id === g.you!.id)?.ready;
  }
}

function Helpers({ g, onUse }: { g: GameView; onUse: (h: HelperId) => void }) {
  const { t } = useTranslation();
  return (
    <section className="helpers" aria-label={t('helper.title')}>
      {g.helpers.map((h) => {
        const usable = canUseHelper(g, h.id);
        const title = `${t(`helper.${h.id}.name`)} – ${h.used ? t('helper.used', { number: h.number }) : t(`helper.${h.id}.desc`)}`;
        return (
          <button
            key={h.id}
            type="button"
            className={`helper ${h.used ? 'used' : ''} ${usable ? 'usable' : ''}`}
            disabled={!usable}
            onClick={() => onUse(h.id)}
            title={title}
            aria-label={title}
          >
            <img src={cardImage(`helper-${h.id}${h.used ? '-back' : ''}`)} alt="" />
            <span>{t(`helper.${h.id}.name`)}</span>
          </button>
        );
      })}
    </section>
  );
}

function Themes({ g, children }: { g: GameView; children?: (slot: ThemeSlot) => React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="themes">
      {(['A', 'B'] as ThemeSlot[]).map((slot, i) => (
        <div key={slot} className={`theme theme-${slot}`}>
          <Plaque slot={slot} label={t(`game.theme${slot}`)} />
          <Card id={g.themes[i]} className="theme-card" />
          {children?.(slot)}
        </div>
      ))}
    </div>
  );
}

/** Brass museum plaque with the theme's colour dot. */
function Plaque({ slot, label, extra }: { slot: Placement; label: string; extra?: string }) {
  return (
    <h3 className="plaque">
      <span className={`slot-dot ${slot}`}>{slot === 'forgery' ? '✗' : slot}</span>
      {label}
      {extra && <span className="plaque-extra">{extra}</span>}
    </h3>
  );
}

function Request({ g }: { g: GameView }) {
  const { t } = useTranslation();
  const count = g.requestedCount;
  const isDirector = g.you?.role === 'director';
  return (
    <>
      <Themes g={g} />
      {isDirector && (
        <section className="panel center-text">
          <h3>{t('game.chooseCount')}</h3>
          <div className="count-picker">
            {Array.from({ length: RULES.requestMax - RULES.requestMin + 1 }, (_, i) => i + RULES.requestMin).map((n) => (
              <button key={n} type="button" className={n === count ? 'active' : 'secondary'} aria-pressed={n === count} onClick={() => api.action({ type: 'chooseRequired', count: n })}>
                {n}
              </button>
            ))}
          </div>
          <button type="button" className="big" onClick={() => api.action({ type: 'setRequired', count })}>
            {t('game.confirmCount', { count })}
          </button>
        </section>
      )}
    </>
  );
}

function Submit({ g, mode, setMode }: { g: GameView; mode: Mode; setMode: (m: Mode) => void }) {
  const { t } = useTranslation();
  const [swapPick, setSwapPick] = useState<CardId[]>([]);
  const me = g.you;
  const isPainter = me?.role === 'painter';
  const painters = g.seats.filter((s) => s.role === 'painter');
  const myReady = !!g.seats.find((s) => s.id === me?.id)?.ready;
  const total = painters.reduce((sum, s) => sum + (s.selectedCount ?? 0), 0);
  const swapCount = Math.min(RULES.swapHandCount, me?.hand.length ?? 0);
  const themeOf = (c: CardId) => me?.selection.find((s) => s.card === c)?.theme ?? null;

  if (!isPainter) {
    return (
      <>
        <Themes g={g} />
        <section className="panel center-text">
          <p>{t('game.phase.submit.director')}</p>
          <p className="muted">
            {painters.map((p) => `${p.name}: ${p.ready ? '✓' : '…'}`).join(' · ')}
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <section className="panel submit-bar">
        <div>
          <strong>{t('game.selectedTotal', { selected: total, required: g.required })}</strong>
          <div className="muted small">
            {painters.map((p) => `${p.name}: ${t('game.picks', { count: p.selectedCount ?? 0 })}${p.ready ? ' ✓' : ''}`).join(' · ')}
          </div>
        </div>
        {mode === 'swapHand' ? (
          <div className="row">
            <button
              type="button"
              disabled={swapPick.length !== swapCount}
              onClick={async () => {
                const res = await api.action({ type: 'swapHand', cards: swapPick });
                if (res.ok) {
                  setMode(null);
                  setSwapPick([]);
                }
              }}
            >
              {t('game.swapHandConfirm', { selected: swapPick.length, count: swapCount })}
            </button>
            <button type="button" className="ghost" onClick={() => (setMode(null), setSwapPick([]))}>
              {t('game.cancel')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={myReady ? 'secondary' : 'big'}
            disabled={!myReady && total !== g.required}
            onClick={() => api.action({ type: 'ready', ready: !myReady })}
          >
            {myReady ? t('game.notReady') : t('game.ready')}
          </button>
        )}
      </section>
      {mode === 'swapHand' && <div className="banner">{t('game.swapHandMode', { count: swapCount })}</div>}
      <Themes g={g} />
      <section className="hand-section" aria-label={t('game.yourHand')}>
        <div className="hand">
          {me!.hand.map((c) => {
            const theme = themeOf(c);
            if (mode === 'swapHand') {
              const picked = swapPick.includes(c);
              return (
                <Card
                  key={c}
                  id={c}
                  className={picked ? 'picked' : ''}
                  badge={picked ? '⇄' : undefined}
                  onClick={() =>
                    setSwapPick((p) => (picked ? p.filter((x) => x !== c) : p.length < swapCount ? [...p, c] : p))
                  }
                />
              );
            }
            return (
              <Card key={c} id={c} className={theme ? `selected sel-${theme}` : ''} badge={theme ?? undefined}>
                <div className="assignment-buttons" role="group" aria-label={t('game.cardAssignment', { card: c })}>
                  {(['A', 'B'] as ThemeSlot[]).map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      className={`slot slot-${slot} ${theme === slot ? 'active' : ''}`}
                      aria-label={t(`game.theme${slot}`)}
                      aria-pressed={theme === slot}
                      disabled={myReady}
                      onClick={() => api.action({ type: 'select', card: c, theme: theme === slot ? null : slot })}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </>
  );
}

const COLUMNS: (Placement | null)[] = [null, 'A', 'B', 'forgery'];

function Sort({ g, mode, setMode }: { g: GameView; mode: Mode; setMode: (m: Mode) => void }) {
  const { t } = useTranslation();
  const isDirector = g.you?.role === 'director';
  const nameOf = (id: string) => g.seats.find((s) => s.id === id)?.name ?? '?';
  const placed = g.board.filter((b) => b.placement).length;
  const forgeries = g.board.filter((b) => b.placement === 'forgery').length;
  const columnTitle = (p: Placement | null) =>
    p === null ? t('game.unsorted') : p === 'forgery' ? t('game.forgeries') : t(`game.theme${p}`);

  return (
    <>
      {mode === 'ask' && (
        <div className="banner">
          {t('game.askMode')}{' '}
          <button type="button" className="ghost small" onClick={() => setMode(null)}>
            {t('game.cancel')}
          </button>
        </div>
      )}
      {g.themeCounts && (
        <div className="banner">{t('game.themeCounts', g.themeCounts)}</div>
      )}
      <div className="sort-columns">
        {COLUMNS.map((col) => {
          const cards = g.board.filter((b) => b.placement === col);
          if (col === null && cards.length === 0) return null;
          return (
            <section key={col ?? 'none'} className={`sort-col col-${col ?? 'none'}`}>
              {(col === 'A' || col === 'B') && (
                <Card id={g.themes[col === 'A' ? 0 : 1]} className="theme-card small" />
              )}
              {col === null ? (
                <h3>
                  {columnTitle(col)} <span className="muted">({cards.length})</span>
                </h3>
              ) : (
                <Plaque
                  slot={col}
                  label={columnTitle(col)}
                  extra={`${cards.length}${col === 'forgery' ? `/${RULES.forgeries}` : ''}`}
                />
              )}
              <div className="sort-cards">
                {cards.map(({ card, placement }) => {
                  const ask = g.asks.find((a) => a.card === card);
                  return (
                    <Card
                      key={card}
                      id={card}
                      className={mode === 'ask' ? 'askable' : ''}
                      onClick={
                        mode === 'ask'
                          ? async () => {
                              const res = await api.action({ type: 'ask', card });
                              if (res.ok) setMode(null);
                            }
                          : undefined
                      }
                      badge={ask ? '?' : undefined}
                    >
                      {ask && (
                        <div className="ask-result">
                          {ask.answers.map((a) => (
                            <span key={a.playerId} className={a.yes ? 'yes' : 'no'}>
                              {t('game.askAnswer', { name: nameOf(a.playerId), answer: t(a.yes ? 'common.yes' : 'common.no') })}
                            </span>
                          ))}
                        </div>
                      )}
                      {isDirector && mode !== 'ask' && (
                        <div className="assignment-buttons" role="group" aria-label={t('game.cardAssignment', { card })}>
                          {(['A', 'B', 'forgery'] as Placement[]).map((p) => (
                            <button
                              key={p}
                              type="button"
                              className={`slot slot-${p} ${placement === p ? 'active' : ''}`}
                              title={columnTitle(p)}
                              aria-label={columnTitle(p)}
                              aria-pressed={placement === p}
                              onClick={() => api.action({ type: 'place', card, placement: placement === p ? null : p })}
                            >
                              {p === 'forgery' ? '✗' : p}
                            </button>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <section className="panel submit-bar">
        <strong>{t('game.sortStatus', { placed, total: g.board.length, forgeries })}</strong>
        {isDirector && (
          <button
            type="button"
            className="big"
            disabled={placed !== g.board.length || forgeries !== RULES.forgeries}
            onClick={() => api.action({ type: 'confirmSort' })}
          >
            {t('game.confirmSort')}
          </button>
        )}
      </section>
    </>
  );
}

function Reveal({ g, room }: { g: GameView; room: RoomView }) {
  const { t } = useTranslation();
  const r = g.reveal!;
  const nameOf = (id: string) => g.seats.find((s) => s.id === id)?.name ?? '?';
  const slotName = (p: Placement) => (p === 'forgery' ? t('game.forgeries') : t(`game.theme${p}`));
  return (
    <>
      <Themes g={g} />
      <section className={`panel reveal-summary ${r.perfect ? 'perfect' : ''}`}>
        <h2>{t('game.summary', { team: r.teamGain, wolfgatti: r.wolfgattiGain })}</h2>
        {r.perfect && <p className="ok">{t('game.perfect')}</p>}
        {r.recovered && <p>{t('game.recovered', { helper: t(`helper.${r.recovered}.name`) })}</p>}
        {!room.isSpectator && (
          <button type="button" className="big" onClick={() => api.action({ type: 'nextRound' })}>
            {r.gameEnds ? t('game.toResult') : t('game.nextRound')}
          </button>
        )}
      </section>
      <div className="reveal-grid">
        {r.entries.map((e) => (
          <div key={e.card} className={`reveal-entry outcome-${e.outcome}`}>
            <Card id={e.card} />
            <div className="reveal-text">
              <strong>{t(`game.outcome.${e.outcome}`)}</strong>
              <span>{e.owner ? t('game.by', { name: nameOf(e.owner) }) : t('game.forgeryBy')}</span>
              {e.intended && <span className="muted small">{t('game.intended', { theme: t(`game.theme${e.intended}`) })}</span>}
              <span className="muted small">→ {slotName(e.placed)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function GameOver({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const g = room.game!;
  return (
    <section className={`panel game-over ${g.won ? 'won' : 'lost'}`}>
      <img src={cardImage(g.won ? 'role-director' : 'wolfgatti')} alt="" />
      <div>
        <h1>{g.won ? t('end.won') : t('end.lost')}</h1>
        <p className="score">{t('end.score', { score: g.teamScore })}</p>
        <p className="rating">„{t(`rating.${g.rating}`)}“</p>
        <p className="muted">{g.endReason === 'pileEmpty' ? t('end.reasonPile') : t('end.reasonWolfgatti')}</p>
        {!g.won && <p className="muted">{t('end.needed')}</p>}
        {room.hostId === room.youId ? (
          <button type="button" className="big" onClick={() => api.backToLobby()}>
            {t('end.backToLobby')}
          </button>
        ) : (
          <p className="muted">{t('end.waitHost')}</p>
        )}
      </div>
    </section>
  );
}

function SwapThemesDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const swap = async (slots: ThemeSlot[]) => {
    await api.action({ type: 'swapThemes', slots });
    onClose();
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{t('helper.swapThemes.name')}</h2>
        <p>{t('helper.which')}</p>
        <div className="row">
          <button type="button" onClick={() => swap(['A'])}>
            {t('game.themeA')}
          </button>
          <button type="button" onClick={() => swap(['B'])}>
            {t('game.themeB')}
          </button>
          <button type="button" onClick={() => swap(['A', 'B'])}>
            {t('helper.both')}
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            {t('game.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlusMinusDialog({ g, onClose }: { g: GameView; onClose: () => void }) {
  const { t } = useTranslation();
  const adjust = async (delta: 1 | -1) => {
    await api.action({ type: 'adjustRequired', delta });
    onClose();
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{t('helper.plusMinus.name')}</h2>
        <p>{t('game.required', { count: g.required })}</p>
        <div className="row">
          <button type="button" disabled={(g.required ?? 0) <= RULES.adjustedMin} onClick={() => adjust(-1)}>
            {t('helper.minus')}
          </button>
          <button type="button" disabled={(g.required ?? 0) >= RULES.adjustedMax} onClick={() => adjust(1)}>
            {t('helper.plus')}
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            {t('game.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
