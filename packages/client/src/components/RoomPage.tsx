import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { navigate } from '../App';
import { storage } from '../storage';
import { api, showError, useStore } from '../store';
import { Game } from './Game';
import { Lobby } from './Lobby';

type Status = 'init' | 'needName' | 'notFound' | 'joined';

export function RoomPage({ code }: { code: string }) {
  const { t } = useTranslation();
  const { room, connected, kicked } = useStore();
  const [status, setStatus] = useState<Status>('init');
  const [name, setName] = useState(storage.get('wolfgatti:name') ?? '');

  useEffect(() => {
    if (!connected || status !== 'init') return;
    if (room?.code === code) {
      setStatus('joined');
      return;
    }
    if (!api.hasToken(code)) {
      setStatus('needName');
      return;
    }
    api.join(code).then((res) => {
      if (res.ok) setStatus('joined');
      else setStatus(res.error === 'err.roomNotFound' ? 'notFound' : 'needName');
    });
  }, [code, connected, room, status]);

  useEffect(() => {
    if (kicked) navigate('/');
  }, [kicked]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    storage.set('wolfgatti:name', name.trim());
    const res = await api.join(code, name.trim());
    if (res.ok) setStatus('joined');
    else if (res.error === 'err.roomNotFound') setStatus('notFound');
    else showError(res.error, res.params);
  }

  if (status === 'notFound') {
    return (
      <main className="center">
        <div className="panel">
          <p>{t('join.notFound')}</p>
          <button type="button" onClick={() => navigate('/')}>
            {t('join.backHome')}
          </button>
        </div>
      </main>
    );
  }

  if (status === 'needName') {
    return (
      <main className="center">
        <form className="panel" onSubmit={submit}>
          <h2>{t('join.title', { code })}</h2>
          <label>
            {t('home.yourName')}
            <input
              value={name}
              maxLength={24}
              autoFocus
              placeholder={t('home.namePlaceholder')}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={!name.trim() || !connected}>
            {t('join.submit')}
          </button>
        </form>
      </main>
    );
  }

  if (!room || room.code !== code) return <main className="center muted">{t('app.connecting')}</main>;
  return room.game ? <Game room={room} /> : <Lobby room={room} />;
}
