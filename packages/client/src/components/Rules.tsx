import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HELPERS, RULES } from '@wolfgatti/shared';
import { cardImage, Picture } from './Card';

type Section = 'rules' | 'example';
let opener: ((section: Section) => void) | null = null;

/** Opens the rules dialog from anywhere, optionally scrolled to the example. */
export function openRules(section: Section = 'rules') {
  opener?.(section);
}

// Worked example: themes "wreath" (74) and "elephant" (10).
const THEMES = [
  { card: 74, slot: 'A', key: 'themeA' },
  { card: 10, slot: 'B', key: 'themeB' },
] as const;

const HAND = [
  { card: 61, key: 'trophy', target: 'A', verdict: 'good' },
  { card: 3, key: 'nose', target: 'B', verdict: 'good' },
  { card: 68, key: 'truck', target: 'B', verdict: 'good' },
  { card: 134, key: 'italy', target: 'A', verdict: 'ok' },
  { card: 65, key: 'mousetrap', target: 'B', verdict: 'risky' },
  { card: 122, key: 'coffee', target: null, verdict: 'no' },
] as const;

const FORGERIES = [31, 144, 16, 50];

/** Mounted once (in the header); renders the dialog when opened. */
export function RulesHost() {
  const [section, setSection] = useState<Section | null>(null);
  useEffect(() => {
    opener = setSection;
    return () => {
      opener = null;
    };
  }, []);
  return section ? <Rules section={section} onClose={() => setSection(null)} /> : null;
}

function Rules({ section, onClose }: { section: Section; onClose: () => void }) {
  const { t } = useTranslation();
  const example = useRef<HTMLElement>(null);

  useEffect(() => {
    if (section === 'example') example.current?.scrollIntoView({ block: 'start' });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [section, onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal rules" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <RulesContent exampleRef={example} />
        <div className="row end">
          <button type="button" onClick={onClose}>
            {t('rules.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Quick rules plus the worked example; used in the dialog and on the start page. */
export function RulesContent({ exampleRef }: { exampleRef?: React.Ref<HTMLElement> }) {
  const { t } = useTranslation();
  return (
    <>
      <h2>{t('rules.title')}</h2>
      {['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map((p) => (
        <p key={p}>{t(`rules.${p}`)}</p>
      ))}

      <section ref={exampleRef} className="example">
        <h2>{t('example.title')}</h2>
        <p>{t('example.intro')}</p>

        <div className="example-themes">
          {THEMES.map((th) => (
            <figure key={th.slot} className={`example-theme theme-${th.slot}`}>
              <Picture id={th.card} />
              <figcaption>
                <strong>{t(`game.theme${th.slot}`)}</strong>
                <span>{t(`example.${th.key}`)}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <h3>{t('example.handTitle')}</h3>
        <ul className="example-hand">
          {HAND.map((h) => (
            <li key={h.key} className={`verdict-${h.verdict}`}>
              <Picture id={h.card} />
              <span className={`example-target ${h.target ? `slot-${h.target}` : ''}`}>{h.target ?? '–'}</span>
              <div>
                <strong>{t(`example.verdict.${h.verdict}`)}</strong>
                <span>{t(`example.hand.${h.key}`)}</span>
              </div>
            </li>
          ))}
        </ul>

        <h3>{t('example.museumTitle')}</h3>
        <div className="example-forgeries">
          {FORGERIES.map((c) => (
            <Picture key={c} id={c} />
          ))}
        </div>
        <p>{t('example.museumText')}</p>

        <h3>{t('example.tipsTitle')}</h3>
        <ul className="example-tips">
          {['tip1', 'tip2', 'tip3', 'tip4'].map((k) => (
            <li key={k}>{t(`example.${k}`)}</li>
          ))}
        </ul>
      </section>

      <section className="rules-helpers">
        <h2>{t('helper.title')}</h2>
        <p>{t('rules.helpers.usage')}</p>
        <dl className="helper-rules-list">
          {[...HELPERS].sort((a, b) => RULES.helperNumbers[a] - RULES.helperNumbers[b]).map((id) => (
            <div key={id}>
              <dt>{t(`helper.${id}.name`)} <span className="muted">({RULES.helperNumbers[id]})</span></dt>
              <dd>
                <img className="helper-rules-image" src={cardImage(`helper-${id}`)} alt={t(`helper.${id}.name`)} loading="lazy" />
                <span>{t(`rules.helpers.${id}`, { count: RULES.swapHandCount, min: RULES.adjustedMin, max: RULES.adjustedMax })}</span>
              </dd>
            </div>
          ))}
        </dl>
        <h3>{t('rules.helpers.recoveryTitle')}</h3>
        <p>{t('rules.helpers.recovery')}</p>
        <p>{t('rules.helpers.example', { count: RULES.helperNumbers.plusMinus, helper: t('helper.plusMinus.name') })}</p>
      </section>
    </>
  );
}
