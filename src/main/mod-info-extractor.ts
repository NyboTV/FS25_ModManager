const fs = require('fs');
const path = require('path');
const yauzl = require('yauzl');
const { logger } = require('./logger');

export class ModInfoExtractor {
  /**
   * Extrahiert Mod-Informationen aus einer ZIP-Datei
   * Ähnlich wie Giants Farming Simulator das macht
   */
  async extractModInfo(zipFilePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(zipFilePath)) {
        reject(new Error(`ZIP-Datei nicht gefunden: ${zipFilePath}`));
        return;
      }

      yauzl.open(zipFilePath, { lazyEntries: true }, (err: any, zipfile: any) => {
        if (err) {
          reject(err);
          return;
        }

        let modDescFound = false;
        let modInfo: any = {
          fileName: path.basename(zipFilePath),
          name: path.basename(zipFilePath, '.zip'),
          version: '1.0.0',
          author: 'Unknown',
          description: '',
          multiplayer: true,
          iconFilename: '',
          storeItems: [],
          error: null
        };

        zipfile.readEntry();

        zipfile.on('entry', (entry: any) => {
          // Suche nach modDesc.xml (kann in Unterordnern sein)
          if (entry.fileName.toLowerCase().endsWith('moddesc.xml')) {
            modDescFound = true;
            
            zipfile.openReadStream(entry, (err: any, readStream: any) => {
              if (err) {
                logger.error(`Fehler beim Lesen von modDesc.xml: ${err.message}`);
                zipfile.readEntry();
                return;
              }

              let xmlData = '';
              readStream.on('data', (chunk: any) => {
                xmlData += chunk;
              });

              readStream.on('end', () => {
                try {
                  // Parse XML ohne zusätzliche Library (einfacher RegEx-Parser)
                  const parsedInfo = this.parseModDescXml(xmlData);
                  modInfo = { ...modInfo, ...parsedInfo };
                  logger.debug(`ModDesc erfolgreich geparst für: ${modInfo.name}`);
                } catch (parseError) {
                  logger.error(`Fehler beim Parsen der modDesc.xml: ${parseError}`);
                  modInfo.error = parseError instanceof Error ? parseError.message : String(parseError);
                }
                
                zipfile.close();
                resolve(modInfo);
              });

              readStream.on('error', (readError: any) => {
                logger.error(`Stream-Fehler: ${readError.message}`);
                modInfo.error = readError.message;
                zipfile.close();
                resolve(modInfo);
              });
            });
          } else {
            // Weiter mit nächstem Eintrag
            zipfile.readEntry();
          }
        });

        zipfile.on('end', () => {
          if (!modDescFound) {
            logger.warn(`Keine modDesc.xml gefunden in: ${zipFilePath}`);
            modInfo.error = 'Keine modDesc.xml gefunden';
          }
          resolve(modInfo);
        });

        zipfile.on('error', (zipError: any) => {
          logger.error(`ZIP-Fehler: ${zipError.message}`);
          modInfo.error = zipError.message;
          resolve(modInfo);
        });
      });
    });
  }

  /**
   * Einfacher XML-Parser für modDesc.xml
   * Extrahiert die wichtigsten Informationen wie Giants FS das macht
   */
  private parseModDescXml(xmlData: string): any {
    const info: any = {};

    try {
      // Title/Name extrahieren
      const titleMatch = xmlData.match(/<title[^>]*>[\s]*<en[^>]*>([^<]+)<\/en>/i) ||
                        xmlData.match(/<title[^>]*>[\s]*<de[^>]*>([^<]+)<\/de>/i) ||
                        xmlData.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        info.name = titleMatch[1].trim();
      }

      // Version extrahieren
      const versionMatch = xmlData.match(/descVersion="([^"]+)"/i) ||
                          xmlData.match(/<version>([^<]+)<\/version>/i);
      if (versionMatch) {
        info.version = versionMatch[1].trim();
      }

      // Author extrahieren
      const authorMatch = xmlData.match(/<author>([^<]+)<\/author>/i);
      if (authorMatch) {
        info.author = authorMatch[1].trim();
      }

      // Description extrahieren
      const descMatch = xmlData.match(/<description[^>]*>[\s]*<en[^>]*>([^<]+)<\/en>/i) ||
                       xmlData.match(/<description[^>]*>[\s]*<de[^>]*>([^<]+)<\/de>/i) ||
                       xmlData.match(/<description[^>]*>([^<]+)<\/description>/i);
      if (descMatch) {
        info.description = descMatch[1].trim();
      }

      // Multiplayer Support
      const multiplayerMatch = xmlData.match(/multiplayer supported="([^"]+)"/i);
      if (multiplayerMatch) {
        info.multiplayer = multiplayerMatch[1].toLowerCase() === 'true';
      }

      // Icon Filename
      const iconMatch = xmlData.match(/iconFilename="([^"]+)"/i);
      if (iconMatch) {
        info.iconFilename = iconMatch[1].trim();
      }

      // Store Items (für Category-Anzeige)
      const storeItemMatches = xmlData.match(/<storeItem[^>]*>/gi);
      if (storeItemMatches) {
        info.storeItems = storeItemMatches.map((item: string) => {
          const categoryMatch = item.match(/categoryName="([^"]+)"/i);
          return categoryMatch ? categoryMatch[1] : 'Unknown';
        });
      }

      logger.debug(`XML geparst - Name: ${info.name}, Version: ${info.version}, Author: ${info.author}`);
      
    } catch (error) {
      logger.error(`Fehler beim XML-Parsing: ${error}`);
      throw error;
    }

    return info;
  }

  /**
   * Verarbeitet alle Mods in einem Ordner und extrahiert deren Informationen
   */
  async extractAllModsInfo(modsFolder: string): Promise<any[]> {
    const modInfos: any[] = [];

    try {
      if (!fs.existsSync(modsFolder)) {
        logger.warn(`Mods-Ordner existiert nicht: ${modsFolder}`);
        return modInfos;
      }

      const files = fs.readdirSync(modsFolder);
      const zipFiles = files.filter((file: string) => file.toLowerCase().endsWith('.zip'));

      logger.debug(`Verarbeite ${zipFiles.length} ZIP-Dateien in: ${modsFolder}`);

      for (const zipFile of zipFiles) {
        const zipPath = path.join(modsFolder, zipFile);
        try {
          const modInfo = await this.extractModInfo(zipPath);
          modInfos.push(modInfo);
        } catch (error) {
          logger.error(`Fehler beim Verarbeiten von ${zipFile}: ${error}`);
          // Füge trotzdem Basis-Info hinzu
          modInfos.push({
            fileName: zipFile,
            name: path.basename(zipFile, '.zip'),
            version: '1.0.0',
            author: 'Unknown',
            description: '',
            multiplayer: true,
            iconFilename: '',
            storeItems: [],
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      logger.info(`${modInfos.length} Mod-Informationen erfolgreich extrahiert`);
      
    } catch (error) {
      logger.error(`Fehler beim Verarbeiten des Mods-Ordners: ${error}`);
    }

    return modInfos;
  }
}
