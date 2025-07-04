// Typdefinition direkt hier, nicht importieren!
export interface LanguageStrings {
  [key: string]: string;
}

import de from './lang/de';
import en from './lang/en';

const translations: { [lang: string]: LanguageStrings } = { en, de };

export function t(key: string, language: 'en' | 'de' = 'de'): string {
  const translation = translations[language]?.[key];
  if (translation) {
    return translation;
  }
  // Fallback auf Englisch
  const englishTranslation = translations.en?.[key];
  if (englishTranslation) {
    return englishTranslation;
  }
  // Fallback auf den Schlüssel selbst
  return key;
}

export function useTranslation(language: 'en' | 'de' = 'de') {
  return (key: string) => t(key, language);
}
