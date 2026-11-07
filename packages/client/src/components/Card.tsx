import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import catalog from '../data/cards.json';
import artworkVersions from '../data/artwork-versions.json';

const cards = new Map(catalog.map((card) => [card.id, card]));
const backgroundPath = '/card-backgrounds/canvas-brushed-v1.webp';
const backgroundRevision = (artworkVersions as Record<string, string>)[backgroundPath];
const backgroundSrc = backgroundRevision ? `${backgroundPath}?v=${backgroundRevision}` : backgroundPath;
const cardSurfaceStyle = { '--card-background-image': `url("${backgroundSrc}")` } as CSSProperties;

/** Resolve only original Wolfgatti assets; picture IDs retain their stable deck positions. */
export function cardImage(name: string): string {
  let src: string;
  if (/^p\d{3}$/.test(name)) src = `/motifs/${name}.webp`;
  else if (name === 'wolfgatti') src = '/characters/wolf.webp';
  else if (name === 'role-director') src = '/characters/curator-peacock.webp';
  else if (name === 'role-painter') src = '/characters/painter-elephant.webp';
  else if (/^helper-(swapThemes|swapHand|plusMinus|ask)(-back)?$/.test(name)) src = `/cards/${name}.webp`;
  else src = `/cards/${name}.svg`;
  const revision = (artworkVersions as Record<string, string>)[src];
  return revision ? `${src}?v=${revision}` : src;
}

export const cardSrc = (id: number) => cardImage(`p${String(id).padStart(3, '0')}`);

export function cardName(id: number, language: string): string {
  const names = cards.get(id)?.name;
  return names ? names[language.startsWith('de') ? 'de' : 'en'] : String(id);
}

/** The decorative card surface is independent of the transparent illustration file. */
export function CardSurface({ src, alt = '', className = '' }: { src: string; alt?: string; className?: string }) {
  const kind = src.startsWith('/motifs/') ? 'motif' : src.startsWith('/characters/') ? 'character' : 'symbol';
  return (
    <span className={`card-art card-art--${kind} ${className}`} style={kind === 'symbol' ? undefined : cardSurfaceStyle}>
      <img src={src} alt={alt} loading="lazy" draggable={false} />
    </span>
  );
}

export function Picture({ id, className = '' }: { id: number; className?: string }) {
  const { i18n } = useTranslation();
  return <CardSurface src={cardSrc(id)} alt={cardName(id, i18n.language)} className={className} />;
}

type ZoomImage = { src: string; alt: string };
const ZoomContext = createContext<(image: ZoomImage | null) => void>(() => {});

export function ZoomProvider({ children }: { children: ReactNode }) {
  const [image, setImage] = useState<ZoomImage | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { t } = useTranslation();
  useEffect(() => {
    if (!image) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImage(null);
      if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [image]);
  return (
    <ZoomContext.Provider value={setImage}>
      {children}
      {image && (
        <div className="zoom" onClick={() => setImage(null)} role="dialog" aria-modal="true" aria-label={t('game.zoom')}>
          <button className="zoom-close" ref={closeRef} type="button" onClick={() => setImage(null)}>
            {t('rules.close')} ×
          </button>
          <CardSurface src={image.src} alt={image.alt} />
        </div>
      )}
    </ZoomContext.Provider>
  );
}

export const useZoom = () => useContext(ZoomContext);

interface CardProps {
  id?: number;
  src?: string;
  /** Replaces the default zoom action. */
  onClick?: () => void;
  className?: string;
  badge?: ReactNode;
  label?: string;
  children?: ReactNode;
}

export function Card({ id, src, onClick, className = '', badge, label, children }: CardProps) {
  const zoom = useZoom();
  const { t, i18n } = useTranslation();
  const image = src ?? (id ? cardSrc(id) : cardImage('back'));
  const alt = id ? cardName(id, i18n.language) : t('game.cardBack');
  return (
    <div className={`card ${className}`}>
      <button
        type="button"
        className="card-face"
        onClick={onClick ?? (() => zoom({ src: image, alt }))}
        aria-label={label ?? `${t('game.zoom')}: ${alt}`}
      >
        <CardSurface src={image} alt={alt} />
        {badge && <span className="card-badge">{badge}</span>}
      </button>
      {children && <div className="card-actions">{children}</div>}
    </div>
  );
}
