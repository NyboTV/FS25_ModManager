import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';
import { ModDescData } from '../common/types';
import { logger } from './main';

export class ModDescManager {
  constructor() {}

  /**
   * Extrahiert ModDesc-Daten aus einer Zip-Datei
   */
  async extractModDescFromZip(zipPath: string): Promise<ModDescData | null> {
    try {
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
        // Suche nach modDesc.xml im Root-Verzeichnis
      const modDescEntry = entries.find((entry: any) => 
        entry.entryName === 'modDesc.xml' || 
        entry.entryName.endsWith('/modDesc.xml')
      );
      
      if (!modDescEntry) {
        logger.warn(`Keine modDesc.xml in ${zipPath} gefunden`);
        return null;
      }
      
      const xmlContent = modDescEntry.getData().toString('utf8');
      return await this.parseModDescXml(xmlContent);
    } catch (error) {
      logger.error(`Fehler beim Extrahieren der ModDesc aus ${zipPath}:`, error);
      return null;
    }
  }

  /**
   * Parst XML-Inhalt der modDesc.xml
   */
  private async parseModDescXml(xmlContent: string): Promise<ModDescData | null> {
    try {
      const result = await parseStringPromise(xmlContent);
      const modDesc = result.modDesc;
      
      if (!modDesc) {
        logger.warn('Ungültiges modDesc.xml Format');
        return null;
      }
      
      // Extrahiere Titel-Übersetzungen
      const titleTranslations: { [lang: string]: string } = {};
      if (modDesc.title && modDesc.title[0]) {
        const titleObj = modDesc.title[0];
        Object.keys(titleObj).forEach(lang => {
          if (titleObj[lang] && titleObj[lang][0]) {
            titleTranslations[lang] = titleObj[lang][0];
          }
        });
      }
      
      // Extrahiere Beschreibungs-Übersetzungen
      const descriptionTranslations: { [lang: string]: string } = {};
      if (modDesc.description && modDesc.description[0]) {
        const descObj = modDesc.description[0];
        Object.keys(descObj).forEach(lang => {
          if (descObj[lang] && descObj[lang][0]) {
            // Entferne CDATA-Wrapper falls vorhanden
            let desc = descObj[lang][0];
            if (typeof desc === 'string') {
              desc = desc.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '');
            }
            descriptionTranslations[lang] = desc;
          }
        });
      }
      
      const modDescData: ModDescData = {
        author: modDesc.author?.[0] || 'Unbekannt',
        version: modDesc.version?.[0] || '1.0.0',
        title: titleTranslations,
        description: descriptionTranslations,
        iconFilename: modDesc.iconFilename?.[0],
        multiplayerSupported: modDesc.multiplayer?.[0]?.$.supported === 'true'
      };
      
      return modDescData;
    } catch (error) {
      logger.error('Fehler beim Parsen der modDesc.xml:', error);
      return null;
    }
  }

  /**
   * Gibt den lokalisierten Titel zurück
   */
  getLocalizedTitle(modDescData: ModDescData, language: 'en' | 'de'): string {
    if (modDescData?.title && modDescData.title[language]) {
      return modDescData.title[language];
    }
    // Fallback auf Englisch
    if (modDescData?.title && modDescData.title['en']) {
      return modDescData.title['en'];
    }
    // Fallback auf den ersten verfügbaren Titel
    if (modDescData?.title) {
      const firstTitle = Object.values(modDescData.title)[0];
      return firstTitle || 'Unbenannt';
    }
    return 'Unbenannt';
  }

  /**
   * Gibt die lokalisierte Beschreibung zurück
   */
  getLocalizedDescription(modDescData: ModDescData, language: 'en' | 'de'): string {
    if (modDescData?.description && modDescData.description[language]) {
      return modDescData.description[language];
    }
    // Fallback auf Englisch
    if (modDescData?.description && modDescData.description['en']) {
      return modDescData.description['en'];
    }
    // Fallback auf die erste verfügbare Beschreibung
    if (modDescData?.description) {
      const firstDesc = Object.values(modDescData.description)[0];
      return firstDesc || 'Keine Beschreibung verfügbar';
    }
    return 'Keine Beschreibung verfügbar';
  }
}
