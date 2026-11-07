import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ZoomProvider } from './components/Card';
import { Header } from './components/Header';
import { Home } from './components/Home';
import { RoomPage } from './components/RoomPage';
import { useStore } from './store';

export function navigate(path: string) {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

export function App() {
  const path = usePath();
  const { t } = useTranslation();
  const { toast, connected, everConnected } = useStore();
  const code = path.match(/^\/r\/([A-Za-z0-9]{4,16})\/?$/)?.[1]?.toUpperCase();

  return (
    <ZoomProvider>
      <div className="app">
        <Header />
        {!connected && <div className="banner warn">{t(everConnected ? 'app.reconnecting' : 'app.connecting')}</div>}
        {code ? <RoomPage key={code} code={code} /> : <Home />}
        {toast && (
          <div className="toast" role="alert" key={toast.id}>
            {t(toast.code, toast.params)}
          </div>
        )}
      </div>
    </ZoomProvider>
  );
}
