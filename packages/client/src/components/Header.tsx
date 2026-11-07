import { useTranslation } from 'react-i18next';
import { navigate } from '../App';
import logo from '../assets/logo.svg';
import { LANGUAGES, setLanguage, type Language } from '../i18n';
import { setSoundEnabled, useSoundEnabled } from '../sound';
import { api, useStore } from '../store';
import { openRules, RulesHost } from './Rules';

export function Header() {
  const { t, i18n } = useTranslation();
  const { room } = useStore();
  const soundOn = useSoundEnabled();

  return (
    <header className="header">
      <a
        href="/"
        className="brand"
        onClick={(e) => {
          e.preventDefault();
          if (!room) navigate('/');
        }}
      >
        <img src={logo} alt={t('app.title')} />
      </a>
      <div className="header-actions">
        <div className="lang" role="group" aria-label={t('app.language')}>
          {LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              className={i18n.language === l ? 'active' : ''}
              onClick={() => setLanguage(l as Language)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ghost icon-toggle"
          onClick={() => setSoundEnabled(!soundOn)}
          title={t(soundOn ? 'app.soundOff' : 'app.soundOn')}
          aria-label={t(soundOn ? 'app.soundOff' : 'app.soundOn')}
          aria-pressed={soundOn}
        >
          {soundOn ? '🔔' : '🔕'}
        </button>
        <button type="button" className="ghost" onClick={() => openRules()}>
          {t('app.rules')}
        </button>
        {room && (
          <button
            type="button"
            className="ghost"
            onClick={async () => {
              await api.leave();
              navigate('/');
            }}
          >
            {t('app.leave')}
          </button>
        )}
      </div>
      <RulesHost />
    </header>
  );
}

