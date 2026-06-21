// Typdefinition direkt hier, nicht importieren!
export interface LanguageStrings {
  [key: string]: string;
}

import de from './lang/de';
import en from './lang/en';
import fr from './lang/fr';

const translations: { [lang: string]: LanguageStrings } = { en, de, fr };

export function t(key: string, language: 'en' | 'de' | 'fr' = 'en'): string {
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

export function useTranslation(language: 'en' | 'de' | 'fr' = 'en') {
  return (key: string) => t(key, language);
}
