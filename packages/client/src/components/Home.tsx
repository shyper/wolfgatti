import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { navigate } from '../App';
import logo from '../assets/logo.svg';
import { storage } from '../storage';
import { api, useStore } from '../store';
import { cardImage } from './Card';
import { RulesContent } from './Rules';

export function Home() {
  const { t } = useTranslation();
  const { kicked } = useStore();
  const [name, setName] = useState(storage.get('wolfgatti:name') ?? '');
  const [password, setPassword] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((c) => setPasswordRequired(!!c.passwordRequired))
      .catch(() => {});
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    storage.set('wolfgatti:name', name.trim());
    const res = await api.create(name.trim(), passwordRequired ? password : undefined);
    setBusy(false);
    if (res.ok) navigate(`/r/${res.code}`);
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    // Accept a full invite link as well as a bare code.
    const c = code.trim().split('/').pop()?.toUpperCase();
    if (c) navigate(`/r/${c}`);
  }

  return (
    <main className="home">
      <section className="hero">
        <img src={cardImage('wolfgatti')} alt="" />
        <div>
          <h1>
            <img className="hero-logo" src={logo} alt={t('app.title')} />
          </h1>
          <p className="muted">{t('app.tagline')}</p>
          <p>{t('home.intro')}</p>
        </div>
      </section>
      {kicked && (
        <div className="banner warn" onClick={() => api.clearKicked()}>
          {t('app.kicked')}
        </div>
      )}
      <div className="home-forms">
        <form className="panel" onSubmit={create}>
          <h2>{t('home.createTitle')}</h2>
          <label>
            {t('home.yourName')}
            <input
              value={name}
              maxLength={24}
              placeholder={t('home.namePlaceholder')}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          {passwordRequired && (
            <label>
              {t('home.password')}
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
          )}
          <button type="submit" disabled={busy || !name.trim()}>
            {t('home.create')}
          </button>
        </form>
        <form className="panel" onSubmit={join}>
          <h2>{t('home.joinTitle')}</h2>
          <label>
            {t('home.codePlaceholder')}
            <input value={code} placeholder="K7QX4M2PZA" onChange={(e) => setCode(e.target.value)} required />
          </label>
          <button type="submit" className="secondary" disabled={!code.trim()}>
            {t('home.join')}
          </button>
        </form>
      </div>
      <section className="cast" aria-label={t('home.castTitle')}>
        <article className="cast-member">
          <img src={cardImage('role-painter')} alt="" loading="lazy" />
          <div><h2>{t('home.paintersTitle')}</h2><p>{t('home.paintersIntro')}</p></div>
        </article>
        <article className="cast-member">
          <img src={cardImage('role-director')} alt="" loading="lazy" />
          <div><h2>{t('home.curatorsTitle')}</h2><p>{t('home.curatorsIntro')}</p></div>
        </article>
      </section>
      <section className="panel home-rules">
        <RulesContent />
      </section>
    </main>
  );
}
