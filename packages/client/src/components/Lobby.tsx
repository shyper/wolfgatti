import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RULES, type RoomView } from '@wolfgatti/shared';
import { api } from '../store';

export function Lobby({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/r/${room.code}`;
  const isHost = room.hostId === room.youId;
  const host = room.players.find((p) => p.id === room.hostId);
  const n = room.players.length;
  const canStart = n >= RULES.minPlayers && n <= RULES.maxPlayers;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t('lobby.invite'), link);
    }
  }

  return (
    <main className="lobby">
      <section className="panel">
        <h2>{t('lobby.invite')}</h2>
        <div className="invite">
          <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label={t('lobby.invite')} />
          <button type="button" onClick={copy}>
            {copied ? t('lobby.copied') : t('lobby.copy')}
          </button>
          {'share' in navigator && (
            <button
              type="button"
              className="secondary"
              onClick={() => navigator.share({ title: 'Wolfgatti', url: link }).catch(() => {})}
            >
              {t('lobby.share')}
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>{t('lobby.players', { count: n })}</h2>
        <p className="muted small">{t('lobby.seatOrder')}</p>
        {isHost && (
          <button type="button" className="secondary shuffle-button" disabled={n < 2} onClick={() => api.shuffle()}>
            {t('lobby.shuffle')}
          </button>
        )}
        <ol className="lobby-players">
          {room.players.map((p, i) => (
            <li key={p.id}>
              <span className={`dot ${p.connected ? 'on' : 'off'}`} />
              <span className="name">
                {p.name}
                {p.id === room.youId && <em className="muted"> ({t('sidebar.you')})</em>}
                {p.id === room.hostId && <span className="tag">{t('sidebar.host')}</span>}
              </span>
              {isHost && (
                <span className="lobby-controls">
                  <button type="button" className="icon" disabled={i === 0} onClick={() => api.move(p.id, -1)} title={t('lobby.moveUp')}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon"
                    disabled={i === n - 1}
                    onClick={() => api.move(p.id, 1)}
                    title={t('lobby.moveDown')}
                  >
                    ↓
                  </button>
                  {p.id !== room.youId && (
                    <>
                      <button type="button" className="icon" disabled={!p.connected} onClick={() => api.makeHost(p.id)} title={t(p.connected ? 'lobby.makeHost' : 'err.playerOffline')}>
                        ♛
                      </button>
                      <button type="button" className="icon danger" onClick={() => api.kick(p.id)} title={t('lobby.kick')}>
                        ✕
                      </button>
                    </>
                  )}
                </span>
              )}
            </li>
          ))}
        </ol>
        {room.spectators.length > 0 && (
          <>
            <h3>{t('lobby.spectators')}</h3>
            <ul className="lobby-players">
              {room.spectators.map((p) => (
                <li key={p.id}>
                  <span className={`dot ${p.connected ? 'on' : 'off'}`} />
                  <span className="name">{p.name}</span>
                  {isHost && (
                    <span className="lobby-controls">
                      <button type="button" className="icon danger" onClick={() => api.kick(p.id)} title={t('lobby.kick')}>
                        ✕
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {room.isSpectator && <p className="muted">{t('lobby.spectatorNote')}</p>}
        {canStart && (
          <p className="muted small">
            {t('lobby.rolesPreview', { count: n, directors: RULES.directors[n], painters: n - RULES.directors[n] })}
          </p>
        )}
        <fieldset className="difficulty-picker" disabled={!isHost}>
          <legend>{t('lobby.difficulty')}</legend>
          {(['normal', 'easy'] as const).map((difficulty) => (
            <label key={difficulty}>
              <input
                type="radio"
                name="difficulty"
                value={difficulty}
                checked={room.difficulty === difficulty}
                onChange={() => api.difficulty(difficulty)}
              />
              <span><strong>{t(`lobby.difficulty_${difficulty}`)}</strong> — {t(`lobby.difficulty_${difficulty}_desc`)}</span>
            </label>
          ))}
        </fieldset>
        {isHost ? (
          <>
            <button type="button" className="big" disabled={!canStart} onClick={() => api.start()}>
              {t('lobby.start')}
            </button>
            {!canStart && <p className="muted small">{t('lobby.needPlayers', { count: n })}</p>}
          </>
        ) : (
          <p className="muted">{t('lobby.waitHost', { name: host?.name ?? '?' })}</p>
        )}
      </section>

    </main>
  );
}
