import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './locales/de.json';
import en from './locales/en.json';
import { storage } from './storage';

export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

function initialLanguage(): Language {
  const saved = storage.get('wolfgatti:lang');
  if (saved === 'de' || saved === 'en') return saved;
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
}

i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

document.documentElement.lang = i18n.language;

export function setLanguage(lang: Language) {
  i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
  storage.set('wolfgatti:lang', lang);
}

export default i18n;
