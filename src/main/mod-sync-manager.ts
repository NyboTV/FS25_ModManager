import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { decodeHtmlEntities } from '../common/utils';
import { logger } from './main';
import { parseModsFromHtmlCheerio } from './mod-html-parser';

export class ModSyncManager {
  private appDataPath: string;
  private activeSyncAbortController: AbortController | null = null;
  private skipCurrentDownload: boolean = false;
  private skipReason: 'skip' | 'local' | null = null;
  private currentDownloadRequest: http.ClientRequest | null = null;

  constructor(appDataPath: string) {
    this.appDataPath = appDataPath;
    this.setupIpcHandlers();
  }

  private async fetchHtml(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          return reject(new Error('Status Code: ' + res.statusCode));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
  }

  private async fetchDedicatedServerModData(url: string): Promise<Map<string, { hash: string, version: string }>> {
    const modDataMap = new Map<string, { hash: string, version: string }>();
    try {
      logger.info('Lade Dedicated Server Stats von: ' + url);
      const client = url.startsWith('https') ? https : http;
      const xmlData = await new Promise<string>((resolve, reject) => {
        client.get(url, (res) => {
          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            return reject(new Error('Status Code: ' + res.statusCode));
          }
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
        }).on('error', reject);
      });

      const regex = /<Mod\s+([^>]+)>/gi;
      let match;
      while ((match = regex.exec(xmlData)) !== null) {
        const attrs = match[1];
        const nameMatch = attrs.match(/name="([^"]+)"/i);
        const hashMatch = attrs.match(/hash="([^"]+)"/i);
        const versionMatch = attrs.match(/version="([^"]*)"/i);
        
        if (nameMatch) {
           modDataMap.set(decodeHtmlEntities(nameMatch[1]) + '.zip', {
             hash: hashMatch ? hashMatch[1] : '',
             version: versionMatch ? decodeHtmlEntities(versionMatch[1]) : ''
           });
        }
      }
    } catch (e) {
      logger.error('Fehler beim Laden der Dedicated Server Stats XML:', e);
    }
    return modDataMap;
  }


  /**
   * Synchronisiert Mods zwischen Profil und Server
   */
  async syncProfile(profile: any, progressCallback?: (progress: any) => void): Promise<void> {
    try {
      logger.info(`Starte Mod-Synchronisation für Profil: ${profile.name}`);
      this.activeSyncAbortController = new AbortController();
      const serverMods = await this.fetchServerModList(profile.serverSyncUrl);
      logger.debug(`${serverMods.length} Mods vom Server erhalten`);
      const totalMods = serverMods.length;
      let completedMods = 0;
      const modsDirectory = profile.modFolderPath;
      if (!fs.existsSync(modsDirectory)) {
        fs.mkdirSync(modsDirectory, { recursive: true });
      }
      const failedMods: string[] = [];
      for (const serverMod of serverMods) {
        this.skipCurrentDownload = false;
        this.skipReason = null;
        
        if (this.activeSyncAbortController?.signal.aborted) {
          logger.info('Synchronisation wurde abgebrochen (vor Download)');
          throw new Error('Synchronisation abgebrochen');
        }
        if (progressCallback) {
          progressCallback({
            profileId: profile.id,
            currentMod: serverMod.fileName || serverMod.id,
            totalMods,
            completedMods,
            currentFileProgress: 0,
            status: 'downloading'
          });
        }
        const modFilePath = path.join(modsDirectory, serverMod.fileName);
        let skipDownload = false;
        // Suche nach fileName statt id!
        const existingMod = profile.mods.find((m: any) => m.fileName === serverMod.fileName);
        
        if (fs.existsSync(modFilePath) && !!existingMod) {
          const localVersion = (existingMod.version || '').trim();
          const serverVersion = (serverMod.version || '').trim();
          logger.debug(`Vergleich für ${serverMod.fileName}: localVersion='${localVersion}', serverVersion='${serverVersion}'`);
          // Wenn Version exakt übereinstimmt, Download überspringen
          if (
            serverVersion && localVersion && serverVersion === localVersion
          ) {
            skipDownload = true;
            logger.debug(`Mod ${serverMod.fileName} ist aktuell (Version: ${serverVersion}), Download wird übersprungen.`);
          } else if (!serverVersion) {
            // Wenn vom Server KEINE Version geliefert wird, aber Datei existiert: Download überspringen
            skipDownload = true;
            logger.debug(`Mod ${serverMod.fileName}: Keine Server-Versionsdaten, Datei existiert – Download wird übersprungen.`);
          }
        }
        
        if (!skipDownload) {
          let success = false;
          let lastError = null;
          for (let attempt = 1; attempt <= 3; attempt++) {
            if (this.activeSyncAbortController?.signal.aborted) {
              logger.info('Synchronisation wurde abgebrochen (vor Download-Versuch)');
              throw new Error('Synchronisation abgebrochen');
            }
            try {
              await this.downloadMod(serverMod, modsDirectory, (progress, speedMbPerSec, etaSeconds) => {
                if (this.activeSyncAbortController?.signal.aborted) {
                  logger.info('Synchronisation wurde abgebrochen (während Download-Progress)');
                  throw new Error('Synchronisation abgebrochen');
                }
                if (progressCallback) {
                  progressCallback({
                    profileId: profile.id,
                    currentMod: serverMod.fileName || serverMod.id,
                    totalMods,
                    completedMods,
                    currentFileProgress: progress,
                    speedMbPerSec,
                    etaSeconds,
                    status: 'downloading'
                  });
                }
              });
              success = true;
              break;
            } catch (error: any) {
              lastError = error;
              if (error.message === 'SKIPPED') {
                logger.info(`Download für ${serverMod.fileName} wurde übersprungen.`);
                success = true; // Wir behandeln es als Erfolg im Sinne der Schleife, damit es nicht als harter Fehler zählt
                break;
              }
              logger.warn(`Download-Versuch ${attempt} für ${serverMod.fileName} fehlgeschlagen: ${error}`);
              await new Promise(res => setTimeout(res, 1000)); // 1 Sekunde warten
            }
          }
          if (!success) {
            logger.error(`Mod ${serverMod.fileName} konnte nach 3 Versuchen nicht geladen werden!`);
            failedMods.push(serverMod.fileName);
            continue; // Mod überspringen
          }
          if (this.activeSyncAbortController?.signal.aborted) {
            logger.info('Synchronisation wurde während Download abgebrochen (nach Download)');
            throw new Error('Synchronisation abgebrochen');
          }
          if (progressCallback) {
            progressCallback({
              profileId: profile.id,
              currentMod: serverMod.fileName || serverMod.id,
              totalMods,
              completedMods,
              currentFileProgress: 100,
              status: 'saving'
            });
          }
          // Wenn es ein reiner Skip (ohne lokale Datei) war, füge ihn NICHT zu active mods hinzu
          // sondern behandle ihn als 'failed' (so wird er beim nächsten Mal wieder versucht)
          if (this.skipReason === 'skip') {
            failedMods.push(serverMod.fileName);
          } else {
            // Füge Mod zum Profil hinzu oder aktualisiere ihn (nur per fileName!)
            if (existingMod) {
              Object.assign(existingMod, serverMod);
              existingMod.isActive = true;
            } else {
              serverMod.isActive = true;
              profile.mods.push(serverMod);
            }
            // Speichere Profil nach jedem Mod sofort
            const profilePath = path.join(this.appDataPath, 'profiles', profile.id, 'profile.json');
            fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
            logger.debug(`Successfully downloaded and saved: ${JSON.stringify(serverMod, null, 2)}`);
            // Logge die HTML-Rohdaten des Mod-Blocks für Debug-Zwecke
            if (serverMod._rawHtml) {
              logger.debug(`Mod HTML Block:\n${serverMod._rawHtml}`);
              // _rawHtml NICHT ins Profil übernehmen
              delete serverMod._rawHtml;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        completedMods++;
      }
      // Echter Sync: Entferne lokale Mods, die nicht auf dem Server existieren
      const serverFileNames = serverMods.map(m => m.fileName);
      const orphanedMods = profile.mods.filter((m: any) => !serverFileNames.includes(m.fileName));
      
      for (const orphanedMod of orphanedMods) {
        try {
          const filePath = path.join(modsDirectory, orphanedMod.fileName);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.info(`Lokaler Mod gelöscht (nicht auf Server): ${orphanedMod.fileName}`);
          }
        } catch (err) {
          logger.warn(`Fehler beim Löschen des verwaisten Mods ${orphanedMod.fileName}: ${err}`);
        }
      }
      
      // Filtere die profilspezifische Liste auf nur noch die Mods, die auch auf dem Server sind
      profile.mods = profile.mods.filter((m: any) => serverFileNames.includes(m.fileName));
      
      // Speichere Profil final
      const finalProfilePath = path.join(this.appDataPath, 'profiles', profile.id, 'profile.json');
      fs.writeFileSync(finalProfilePath, JSON.stringify(profile, null, 2));
      if (progressCallback) {
        progressCallback({
          profileId: profile.id,
          currentMod: '',
          totalMods,
          completedMods,
          currentFileProgress: 100,
          status: 'completed',
          failedMods // an UI weitergeben
        });
      }
      logger.info(`Mod-Synchronisation abgeschlossen für Profil: ${profile.name}`);
      if (failedMods.length > 0) {
        logger.warn(`Fehlgeschlagene Mods (${failedMods.length}): ${failedMods.join(', ')}`);
      }
      this.activeSyncAbortController = null;
    } catch (error) {
      this.activeSyncAbortController = null;
      logger.error(`Fehler bei der Mod-Synchronisation: ${error}`);
      throw error;
    }
  }

  /**
   * Lädt die Mod-Liste vom Server
   */
  private async fetchServerModList(serverUrl: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const url = new URL(serverUrl);
      const request = (url.protocol === 'https:' ? https : http).get(serverUrl, (response) => {
        let data = '';
        
        // Debug: HTTP Status Code loggen
        logger.debug(`Server Response Status: ${response.statusCode}`);
        logger.debug(`Server Response Headers: ${JSON.stringify(response.headers)}`);
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {            
            // Prüfe, ob die Antwort leer ist
            if (!data.trim()) {
              reject(new Error('Leere Serverantwort erhalten'));
              return;
            }
            
            // Parse HTML für Mod-Informationen (statt JSON)
            const mods = this.parseModsFromHtml(data, serverUrl);
            logger.debug(`Parsed ${mods.length} mods from HTML`);
            
            resolve(mods);
          } catch (error) {
            logger.error(`HTML Parse Error: ${error instanceof Error ? error.message : String(error)}`);
            logger.error(`Raw Response Data: ${data}`);
            reject(new Error(`Fehler beim Parsen der HTML-Antwort: ${error instanceof Error ? error.message : String(error)}`));
          }
        });
      });
      
      request.on('error', (error) => {
        logger.error(`HTTP Request Error: ${error.message}`);
        reject(error);
      });
      
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('Server-Timeout'));
      });
    });
  }
  /**
   * Lädt einen Mod vom Server herunter
   */
  private async downloadMod(
    serverMod: any, 
    targetPath: string, 
    progressCallback?: (progress: number, speed?: number, eta?: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.activeSyncAbortController?.signal.aborted) {
        reject(new Error('Synchronisation abgebrochen'));
        return;
      }
      const filePath = path.join(targetPath, serverMod.fileName || `${serverMod.id}.zip`);
      const fileAlreadyExisted = fs.existsSync(filePath);
      let expectedSize = 0;
      let downloadCompleted = false;
      const file = fs.createWriteStream(filePath, { highWaterMark: 1024 * 1024 }); // 1MB Buffer für viel schnelleren Download
      const url = new URL(serverMod.downloadUrl);
      const request = (url.protocol === 'https:' ? https : http).get(serverMod.downloadUrl, (response) => {
        this.currentDownloadRequest = request;
        if (response.statusCode !== 200) {
          file.close();
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        expectedSize = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedSize = 0;
        const startTime = Date.now();
        let lastReportTime = startTime;
        
        response.on('data', (chunk) => {
          if (this.activeSyncAbortController?.signal.aborted) {
            file.close();
            request.destroy();
            setTimeout(() => {
              try {
                if (fs.existsSync(filePath)) {
                  const stats = fs.statSync(filePath);
                  if (!fileAlreadyExisted && expectedSize > 0 && stats.size < expectedSize) {
                    fs.unlinkSync(filePath);
                  }
                }
              } catch {}
            }, 100);
            reject(new Error('Synchronisation abgebrochen'));
            return;
          }
          
          if (this.skipCurrentDownload) {
            file.close();
            request.destroy();
            setTimeout(() => {
              try {
                if (fs.existsSync(filePath) && this.skipReason === 'skip') {
                  const stats = fs.statSync(filePath);
                  if (!fileAlreadyExisted) {
                    fs.unlinkSync(filePath);
                  }
                }
              } catch {}
            }, 100);
            reject(new Error('SKIPPED'));
            return;
          }
          
          downloadedSize += chunk.length;
          
          const now = Date.now();
          // Nur alle 250ms ein Update senden, um IPC nicht zu fluten
          if (progressCallback && expectedSize > 0 && (now - lastReportTime > 250 || downloadedSize === expectedSize)) {
            const elapsedSecs = (now - startTime) / 1000;
            const progress = (downloadedSize / expectedSize) * 100;
            
            let speedMbPerSec = 0;
            let etaSeconds = 0;
            
            if (elapsedSecs > 0) {
              const speedBytesPerSec = downloadedSize / elapsedSecs;
              speedMbPerSec = parseFloat((speedBytesPerSec / (1024 * 1024)).toFixed(2));
              
              const remainingBytes = expectedSize - downloadedSize;
              etaSeconds = Math.round(remainingBytes / speedBytesPerSec);
            }
            
            progressCallback(progress, speedMbPerSec, etaSeconds);
            lastReportTime = now;
          }
        });
        response.on('end', () => {
          downloadCompleted = true;
          file.end();
        });
        response.on('error', (error) => {
          file.close();
          setTimeout(() => {
            try {
              if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (!fileAlreadyExisted && expectedSize > 0 && stats.size < expectedSize) {
                  fs.unlinkSync(filePath);
                }
              }
            } catch {}
          }, 100);
          reject(error);
        });
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          this.currentDownloadRequest = null;
          resolve();
        });
        file.on('error', (error) => {
          setTimeout(() => {
            try {
              if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (!fileAlreadyExisted && expectedSize > 0 && stats.size < expectedSize) {
                  fs.unlinkSync(filePath);
                }
              }
            } catch {}
          }, 100);
          reject(error);
        });
      });
      request.on('error', (error) => {
        file.close();
        setTimeout(() => {
          try {
            if (fs.existsSync(filePath)) {
              const stats = fs.statSync(filePath);
              if (!fileAlreadyExisted && expectedSize > 0 && stats.size < expectedSize) {
                fs.unlinkSync(filePath);
              }
            }
          } catch {}
        }, 100);
        reject(new Error(`Request error: ${error.message}`));
      });
      request.setTimeout(120000, () => {
        request.destroy();
        file.close();
        setTimeout(() => {
          try {
            if (fs.existsSync(filePath)) {
              const stats = fs.statSync(filePath);
              if (!fileAlreadyExisted && expectedSize > 0 && stats.size < expectedSize) {
                fs.unlinkSync(filePath);
              }
            }
          } catch {}
        }, 100);
        reject(new Error('Download-Timeout (2 Minuten)'));
      });
      if (this.activeSyncAbortController) {
        this.activeSyncAbortController.signal.addEventListener('abort', () => {
          request.destroy();
          file.close();
          setTimeout(() => {
            try {
              if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (!fileAlreadyExisted && expectedSize > 0 && stats.size < expectedSize) {
                  fs.unlinkSync(filePath);
                }
              }
            } catch {}
          }, 100);
          reject(new Error('Synchronisation abgebrochen'));
        });
      }
    });
  }
  private setupIpcHandlers(): void {
      // Server-URL testen (FastDL Check)
      ipcMain.handle('check-fastdl-url', async (_, serverUrl) => {
        logger.debug(`Handler: check-fastdl-url aufgerufen für Server ${serverUrl}`);
        try {
          if (!serverUrl || (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://'))) {
            return { success: false, error: 'Ungültige URL. Muss mit http:// oder https:// beginnen.' };
          }
          const serverMods = await this.fetchServerModList(serverUrl);
          return { success: true, count: serverMods.length };
        } catch (error) {
          logger.error(`Fehler beim Prüfen der FastDL-URL ${serverUrl}:`, error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      });

      // Server Sync durchführen
      ipcMain.handle('sync-mods', async (_, profileId, serverUrl) => {
      console.log('🔥 sync-mods IPC handler called!');
      console.log('🔥 ProfileId:', profileId);
      console.log('🔥 ServerUrl:', serverUrl);
      
      logger.debug(`Handler: sync-mods aufgerufen für Profil ${profileId} mit Server ${serverUrl}`);
      try {
        // Validiere die Server-URL
        logger.debug(`Validiere Server-URL: ${serverUrl}`);
        if (!serverUrl) {
          logger.warn(`Ungültige Server-URL: ${serverUrl || 'leer'}`);
          return { 
            success: false, 
            error: 'Keine gültige Server-URL angegeben' 
          };
        }
        
        if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
          logger.warn(`Server-URL hat kein gültiges Protokoll: ${serverUrl}`);
          return { 
            success: false, 
            error: 'Server-URL muss mit http:// oder https:// beginnen' 
          };
        }
        
        // Lade das Profil aus dem neuen Verzeichnisformat
        logger.debug(`Lade Profildetails für ID: ${profileId}`);
        const profilePath = path.join(this.appDataPath, 'profiles', profileId, 'profile.json');
        if (!fs.existsSync(profilePath)) {
          logger.error(`Profil nicht gefunden: ${profilePath}`);
          return { 
            success: false, 
            error: 'Profil nicht gefunden' 
          };
        }
          const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        logger.debug(`Profil geladen: ${profileData.name} mit ${profileData.mods ? profileData.mods.length : 0} Mods`);
        
        // Stelle sicher, dass mods Array existiert
        if (!profileData.mods) {
          profileData.mods = [];
        }
        
        // Setze die Server-URL im Profil
        profileData.serverSyncUrl = serverUrl;
        
        // Verwende die neue syncProfile Methode
        await this.syncProfile(profileData);
        
        // Speichere das aktualisierte Profil
        fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
        
        logger.info(`Synchronisation erfolgreich abgeschlossen für Profil: ${profileData.name}`);
        return { 
          success: true, 
          stats: {
            new: profileData.mods.filter((m: any) => m.isFromServer).length,
            updated: 0,
            unchanged: 0,
            total: profileData.mods.length
          }
        };
        
      } catch (error) {
        logger.error('Fehler bei der Server-Synchronisation:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    // Synchronisation abbrechen
    ipcMain.handle('abort-sync', () => {
      logger.debug('Handler: abort-sync aufgerufen');
      this.abortSync();
      return { success: true };
    });

    // Aktuellen Mod überspringen
    ipcMain.handle('skip-current-mod', () => {
      logger.debug('Handler: skip-current-mod aufgerufen');
      this.skipCurrentDownload = true;
      this.skipReason = 'skip';
      if (this.currentDownloadRequest) {
        this.currentDownloadRequest.destroy(new Error('SKIPPED'));
      }
      return { success: true };
    });

    // Lokale Mod-Datei auswählen und überspringen
    ipcMain.handle('provide-local-mod', async (_, targetFileName, profileId) => {
      logger.debug('Handler: provide-local-mod aufgerufen');
      const { dialog } = window.require ? window.require('electron') : require('electron');
      const result = await dialog.showOpenDialog({
        title: 'Lokale Mod-Datei auswählen',
        filters: [{ name: 'Zip-Archive', extensions: ['zip'] }],
        properties: ['openFile']
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const sourcePath = result.filePaths[0];
        try {
          const profilePath = path.join(this.appDataPath, 'profiles', profileId, 'profile.json');
          if (fs.existsSync(profilePath)) {
             const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
             const destPath = path.join(profileData.modFolderPath, targetFileName);
             
             // Kopiere Datei synchron, um Race-Conditions zu vermeiden
             fs.copyFileSync(sourcePath, destPath);
             logger.info(`Lokale Mod-Datei erfolgreich kopiert nach ${destPath}`);
             
             this.skipCurrentDownload = true;
             this.skipReason = 'local';
             if (this.currentDownloadRequest) {
               this.currentDownloadRequest.destroy(new Error('SKIPPED'));
             }
             return { success: true };
          }
        } catch (error) {
          logger.error(`Fehler beim Kopieren der lokalen Mod-Datei: ${error}`);
          return { success: false, error: String(error) };
        }
      }
      return { success: false, error: 'Keine Datei ausgewählt' };
    });
  }

  /**
   * Bricht die aktuelle Synchronisation ab
   */
  abortSync(): void {
    if (this.activeSyncAbortController) {
      logger.info('Synchronisation wird abgebrochen...');
      this.activeSyncAbortController.abort();
    }
  }
  /**
   * Parst Download-Links und alle Mod-Details robust aus HTML
   */
  private parseModsFromHtml(html: string, serverUrl: string): any[] {
    // Neue Implementierung mit cheerio
    return parseModsFromHtmlCheerio(html, serverUrl);
  }
}
