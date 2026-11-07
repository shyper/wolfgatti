import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { LogEntry, RoomView } from '@wolfgatti/shared';
import { api } from '../store';
import { cardImage } from './Card';

export function Sidebar({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  return (
    <aside className="sidebar">
      <Players room={room} />
      <div className="panel">
        <h3>{t('sidebar.log')}</h3>
        <Log entries={room.game?.log ?? []} />
      </div>
    </aside>
  );
}

function Players({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const game = room.game!;
  const online = new Map(room.players.map((p) => [p.id, p.connected]));
  return (
    <div className="panel players">
      <h3>{t('sidebar.players')}</h3>
      <ul>
        {game.seats.map((s) => (
          <li key={s.id} className={s.id === room.youId ? 'me' : ''}>
            <img className="role-icon" src={cardImage(`role-${s.role}`)} alt="" />
            <div className="player-main">
              <div>
                <span className={`dot ${online.get(s.id) ? 'on' : 'off'}`} title={online.get(s.id) ? '' : t('sidebar.offline')} />
                <strong>{s.name}</strong>
                {s.id === room.youId && <em className="muted"> ({t('sidebar.you')})</em>}
                {s.id === room.hostId && <span className="tag">{t('sidebar.host')}</span>}
              </div>
              <div className="muted small">
                {t(`role.${s.role}`)} · {t('sidebar.cards', { count: s.handCount })}
                {s.ready !== null && (
                  <>
                    {' · '}
                    <span className={s.ready ? 'ok' : ''}>{s.ready ? `✓ ${t('game.readyMark')}` : t('game.choosing')}</span>
                  </>
                )}
                {s.selectedCount !== null && ` · ${t('game.picks', { count: s.selectedCount })}`}
              </div>
            </div>
            {room.isSpectator && !online.get(s.id) && (
              <button type="button" className="small" onClick={() => api.claimSeat(s.id)}>
                {t('sidebar.claimSeat')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {room.spectators.length > 0 && (
        <p className="muted small">
          {t('lobby.spectators')}: {room.spectators.map((s) => s.name).join(', ')}
        </p>
      )}
    </div>
  );
}

export function useLogText() {
  const { t } = useTranslation();
  return (e: LogEntry) => {
    const p: Record<string, string | number> = { ...e.params };
    if (typeof p.helper === 'string') p.helper = t(`helper.${p.helper}.name`);
    if (p.answer === 'yes' || p.answer === 'no') p.answer = t(`common.${p.answer}`);
    return t(e.code, p);
  };
}

function Log({ entries }: { entries: LogEntry[] }) {
  const text = useLogText();
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [entries.length]);
  return (
    <div className="log-list" ref={list}>
      {entries.map((e, i) => (
        <div key={i} className={e.code === 'log.roundStart' ? 'log-round' : ''}>
          {text(e)}
        </div>
      ))}
    </div>
  );
}
