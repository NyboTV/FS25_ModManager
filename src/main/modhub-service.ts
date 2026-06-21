import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ModInfo } from '../common/types';
import { logger } from './main';

const BASE_URL = 'https://www.farming-simulator.com';

export interface LocalModMapping {
  modId: string;
  title: string;
  category: string;
  author: string;
  version: string;
  size?: string;
  released?: string;
  platform?: string;
  manufacturer?: string;
  rating?: string;
  votes?: string;
  failed?: boolean;
}

export class ModHubService {
  private mappingFile: string;
  private mapping: Record<string, LocalModMapping> = {};
  private appDataPath: string;
  private isMapping: boolean = false;
  private _cancelRequested: boolean = false;
  private mappingQueue: Array<{ profileId: string, profileName: string, mods: ModInfo[], webContents: Electron.WebContents }> = [];
  private activeDownloads: Map<string, AbortController> = new Map();
  private downloadQueue: Array<{ profileId: string, fileName: string, modId: string, webContents: Electron.WebContents, modDetail?: any }> = [];

  constructor() {
    this.appDataPath = path.join(app.getPath('userData'), 'FS25_ModManager_Data');
    if (!fs.existsSync(this.appDataPath)) {
      fs.mkdirSync(this.appDataPath, { recursive: true });
    }
    this.mappingFile = path.join(this.appDataPath, 'local-mapping.json');
    this.loadMapping();
  }

  public cancelMapping() {
    this._cancelRequested = true;
    this.mappingQueue = [];
  }

  private loadMapping() {
    if (fs.existsSync(this.mappingFile)) {
      try {
        this.mapping = JSON.parse(fs.readFileSync(this.mappingFile, 'utf-8'));
      } catch (err) {
        logger.error('Fehler beim Laden von local-mapping.json', err);
        this.mapping = {};
      }
    }
  }

  private saveMapping() {
    try {
      fs.writeFileSync(this.mappingFile, JSON.stringify(this.mapping, null, 2), 'utf-8');
    } catch (err) {
      logger.error('Fehler beim Speichern von local-mapping.json', err);
    }
  }

  public getMapping(fileName: string): LocalModMapping | undefined {
    return this.mapping[fileName];
  }

  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async checkUpdates(webContents: Electron.WebContents, limitToModIds?: string[], profileName: string = "Unbekanntes Profil") {
    const stateFile = path.join(app.getPath('userData'), 'modhub-sync-state.json');
    let state: { referenceModId?: string } = {};
    if (fs.existsSync(stateFile)) {
      try {
        state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      } catch(e) {}
    }

    try {
      const page0Res = await axios.get(`${BASE_URL}/mods.php?title=fs2025&page=0`, { timeout: 10000 });
      const $0 = cheerio.load(page0Res.data);
      const firstModHref = $0('.mod-item').first().find('a').attr('href');
      const match = firstModHref?.match(/mod_id=([0-9]+)/);
      const currentFirstModId = match ? match[1] : null;

      if (!currentFirstModId) return;

      if (!state.referenceModId) {
        state.referenceModId = currentFirstModId;
        fs.writeFileSync(stateFile, JSON.stringify(state));
        return;
      }

      if (currentFirstModId === state.referenceModId) {
        return; // Kein neuer Mod seit dem letzten Check!
      }

      let page = 0;
      let foundReference = false;
      const updatedModIds: string[] = [];

      while (!foundReference && page < 20) {
        if (this._cancelRequested) {
          logger.info("[ModHubService] Update-Check durch Benutzer abgebrochen.");
          break;
        }
        
        let pageHtml = page0Res.data;
        if (page > 0) {
          const pageRes = await axios.get(`${BASE_URL}/mods.php?title=fs2025&page=${page}`, { timeout: 10000 });
          pageHtml = pageRes.data;
        }

        const $ = cheerio.load(pageHtml);
        const items = $('.mod-item');
        if (items.length === 0) break;

        items.each((_, el) => {
          if (foundReference) return;
          const href = $(el).find('a').attr('href');
          const idMatch = href?.match(/mod_id=([0-9]+)/);
          if (idMatch) {
            const id = idMatch[1];
            if (id === state.referenceModId) {
              foundReference = true;
            } else {
              updatedModIds.push(id);
            }
          }
        });

        if (foundReference) break;
        page++;
        await this.delay(500);
      }

      // Prüfe, ob wir betroffene lokale Mods haben
      const localModIds = Object.values(this.mapping).filter(m => !m.failed && m.modId !== '!').map(m => m.modId);
      const relevantUpdatedModIds = updatedModIds.filter(id => localModIds.includes(id));

      if (relevantUpdatedModIds.length > 0) {
        for (const id of relevantUpdatedModIds) {
          try {
            const detailRes = await axios.get(`${BASE_URL}/mod.php?mod_id=${id}&title=fs2025`, { timeout: 10000 });
            const detail$ = cheerio.load(detailRes.data);
            
            let version = '';
            let released = '';
            let size = '';
            detail$('.table-row').each((_, el) => {
              const key = detail$(el).find('.table-cell').first().text().trim().toLowerCase();
              const val = detail$(el).find('.table-cell').last().text().trim();
              if (key.includes('version')) version = val;
              if (key.includes('released') || key.includes('datum')) released = val;
              if (key.includes('size') || key.includes('größe')) size = val;
            });

            // Finde den entsprechenden Dateinamen in der Map
            const fileName = Object.keys(this.mapping).find(k => this.mapping[k].modId === id);
            if (fileName && version) {
              this.mapping[fileName].version = version;
              if (released) this.mapping[fileName].released = released;
              if (size) this.mapping[fileName].size = size;
            }

            await this.delay(500);
          } catch(e) {
            logger.error(`Fehler beim Update-Check für ModId ${id}`, e);
          }
        }
        
        this.saveMapping();
        // Hier könnten wir auch ein IPC-Event an die UI schicken, dass sich Updates geändert haben
        webContents.send('modhub-mapping-complete');
      }

      // Speichere die neue Referenz für das nächste Mal
      state.referenceModId = currentFirstModId;
      fs.writeFileSync(stateFile, JSON.stringify(state));

    } catch(e) {
      logger.error(`[ModHubService] Globaler Fehler beim Update-Check`, e);
    }
  }

  public async downloadMod(profileId: string, fileName: string, modId: string, webContents: Electron.WebContents, modDetail?: any) {
    // Wenn bereits in der Queue oder aktiv, abbrechen
    if (this.activeDownloads.has(modId) || this.downloadQueue.some(t => t.modId === modId)) {
      return;
    }

    this.downloadQueue.push({ profileId, fileName, modId, webContents, modDetail });
    webContents.send('mod-update-progress', { modId, fileName, status: 'queued', percent: 0 });
    this.processDownloadQueue();
  }

  private async processDownloadQueue() {
    if (this.activeDownloads.size >= 3 || this.downloadQueue.length === 0) return;

    const task = this.downloadQueue.shift();
    if (task) {
      this.executeDownload(task.profileId, task.fileName, task.modId, task.webContents, task.modDetail);
      this.processDownloadQueue(); // Check if we can start more
    }
  }

  private async executeDownload(profileId: string, fileName: string, modId: string, webContents: Electron.WebContents, modDetail?: any) {
    try {
      // 1. Get profile
      const { profileManager } = require('./main');
      const profile = await profileManager.getProfile(profileId);
      if (!profile) throw new Error("Profile not found");

      // Fallback to old URL structure if no direct CDN URL is provided
      const downloadUrl = modDetail?.url || `${BASE_URL}/mod.php?action=download&mod_id=${modId}`;

      logger.info(`[ModHubService] Starte Download für ${fileName} von ${downloadUrl}`);
      webContents.send('mod-update-progress', { modId, fileName, status: 'starting', percent: 0 });

      const abortController = new AbortController();
      this.activeDownloads.set(modId, abortController);

      const response = await axios({
        url: downloadUrl,
        method: 'GET',
        responseType: 'stream',
        timeout: 30000,
        signal: abortController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': BASE_URL + '/'
        }
      });

      // Echten Dateinamen aus Content-Disposition extrahieren
      let realFileName = fileName;
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          realFileName = filenameMatch[1];
        }
      } else {
        // Fallback: Versuche Dateinamen aus der URL zu extrahieren (z.B. bei direkten CDN Links)
        const urlMatch = downloadUrl.match(/\/([^\/?#]+\.zip)/i);
        if (urlMatch && urlMatch[1]) {
          realFileName = urlMatch[1];
        }
      }
      
      // Update targetPath
      const modFolderPath = profile.modFolderPath || path.join(app.getPath('userData'), 'FS25_ModManager_Data', 'profiles', profile.id, 'mods');
      const targetPath = path.join(modFolderPath, realFileName);

      const totalLength = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedLength = 0;

      const writer = fs.createWriteStream(targetPath);

      response.data.on('data', (chunk: Buffer) => {
        downloadedLength += chunk.length;
        if (totalLength > 0) {
          const percent = Math.round((downloadedLength / totalLength) * 100);
          // Limit IPC spam
          if (percent % 5 === 0) {
            webContents.send('mod-update-progress', { modId, fileName: realFileName, status: 'downloading', percent });
          }
        }
      });

        return new Promise((resolve, reject) => {
          writer.on('finish', async () => {
            // Speichere das Mapping direkt ab!
            if (modDetail) {
              this.mapping[realFileName] = {
                modId: modId,
                version: modDetail.version || '1.0.0.0',
                title: modDetail.title,
                rating: modDetail.rating || '',
                category: modDetail.category || 'Unknown',
                author: modDetail.author || 'Unknown'
              };
              this.saveMapping();
            }

            try {
              // Profil neu laden und Mod hinzufügen, damit die UI ihn sofort sieht
              const { profileManager } = require('./main');
              const currentProfile = await profileManager.getProfile(profileId);
              if (currentProfile) {
                await profileManager.saveProfile(currentProfile);
              }
            } catch (err) {
              logger.error("[ModHubService] Fehler beim Speichern des Profils nach Download", err);
            }
            
            this.activeDownloads.delete(modId);
            webContents.send('mod-update-complete', { modId, fileName: realFileName, success: true });
            this.processDownloadQueue();
            resolve(true);
          });
        writer.on('error', (err) => {
          this.activeDownloads.delete(modId);
          fs.unlink(targetPath, () => {});
          webContents.send('mod-update-complete', { modId, fileName: realFileName, success: false, error: err.message });
          this.processDownloadQueue();
          reject(err);
        });
        response.data.pipe(writer);
      });

    } catch (error: any) {
      this.activeDownloads.delete(modId);
      if (axios.isCancel(error)) {
        logger.info(`[ModHubService] Download für ${modId} wurde vom Benutzer abgebrochen.`);
        webContents.send('mod-update-complete', { modId, fileName: fileName, success: false, error: 'Abgebrochen' });
      } else {
        logger.error(`[ModHubService] Fehler beim Herunterladen von ${fileName}`, error);
        webContents.send('mod-update-complete', { modId, fileName, success: false, error: error.message });
      }
      this.processDownloadQueue();
    }
  }

  public cancelDownload(modId: string) {
    // Remove from queue if pending
    const queueIndex = this.downloadQueue.findIndex(t => t.modId === modId);
    if (queueIndex >= 0) {
      const task = this.downloadQueue[queueIndex];
      this.downloadQueue.splice(queueIndex, 1);
      task.webContents.send('mod-update-complete', { modId, fileName: task.fileName, success: false, error: 'Abgebrochen' });
      this.processDownloadQueue();
      return;
    }

    const controller = this.activeDownloads.get(modId);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(modId);
    }
  }


  public async mapMods(profileId: string, profileName: string, mods: ModInfo[], webContents: Electron.WebContents) {
    this.mappingQueue.push({ profileId, profileName, mods, webContents });
    this.processQueue();
  }

  private async processQueue() {
    if (this.isMapping || this.mappingQueue.length === 0) return;
    this.isMapping = true;
    this._cancelRequested = false;

    const task = this.mappingQueue.shift();
    if (!task) {
      this.isMapping = false;
      return;
    }
    const { mods, webContents, profileName } = task;

    try {
      await this.checkUpdates(webContents, undefined, profileName);

      if (this._cancelRequested) {
        return;
      }

      const unknownMods = mods.filter(m => {
        // Niemals Mappen, wenn der Server explizit "no" für diesen Mod gemeldet hat
        if (m.modHub === 'no' || m.modHub?.toLowerCase() === 'no') {
          logger.info(`[ModHubService] Überspringe Mod ${m.fileName} explizit (modHub='${m.modHub}')`);
          return false;
        }

        const mapped = this.mapping[m.fileName];
        if (!mapped) return true;
        
        return false;
      });
      
      logger.info(`[ModHubService] Nach Filter: ${unknownMods.length} Mods werden auf ModHub gesucht.`);

      for (let i = 0; i < unknownMods.length; i++) {
        if (this._cancelRequested) {
          logger.info("[ModHubService] Mapping durch Benutzer abgebrochen.");
          break;
        }

        const mod = unknownMods[i];
        const searchTitle = mod.modDescData?.title?.['en'] || mod.modDescData?.title?.['de'] || mod.name;

        // Sende Fortschritt an die UI
        webContents.send('modhub-mapping-progress', {
          current: i + 1,
          total: unknownMods.length,
          modName: searchTitle,
          status: 'searching'
        });

        let success = false;
        let retries = 0;

        while (retries < 2 && !success) {
          try {
            // 1. Suche nach dem Mod
            const searchUrl = `${BASE_URL}/mods.php?title=fs2025&searchMod=${encodeURIComponent(searchTitle)}`;
            const searchRes = await axios.get(searchUrl, { timeout: 10000 });
            const search$ = cheerio.load(searchRes.data);

            const modItems = search$('.mod-item');
            const possibleModIds: string[] = [];

            // Begrenze auf die ersten 3 Treffer
            modItems.slice(0, 3).each((_, el) => {
              const href = search$(el).find('a').attr('href');
              if (href) {
                const match = href.match(/mod_id=([0-9]+)/);
                if (match) {
                  possibleModIds.push(match[1]);
                }
              }
            });

            // Wenn keine Ergebnisse, markiere als fehlgeschlagen und breche ab
            if (possibleModIds.length === 0) {
              this.mapping[mod.fileName] = { modId: '!', failed: true, title: 'Unknown', category: 'Unknown', author: 'Unknown', version: '0.0.0.0' };
              success = true;
              break;
            }

            // 2. Prüfe die Treffer auf der Detailseite
            let matchFound = false;
            for (const modId of possibleModIds) {
              const detailUrl = `${BASE_URL}/mod.php?mod_id=${modId}&title=fs2025`;
              const detailRes = await axios.get(detailUrl, { timeout: 10000 });
              const detail$ = cheerio.load(detailRes.data);

              // Finde den ZIP-Link
              const downloadHref = detail$('.download-box a[href$=".zip"]').attr('href');
              let zipName = '';
              if (downloadHref) {
                const parts = downloadHref.split('/');
                zipName = parts[parts.length - 1];
              }

              if (zipName === mod.fileName) {
                // EXAKTER TREFFER!
                let author = 'Unknown';
                let category = 'Unknown';
                let version = '1.0.0.0';
                let size = '';
                let released = '';
                let platform = '';
                let manufacturer = '';

                detail$('.table-row').each((_, el) => {
                  const key = detail$(el).find('.table-cell').first().text().trim().toLowerCase();
                  const val = detail$(el).find('.table-cell').last().text().trim();
                  if (key.includes('author') || key.includes('autor')) author = val;
                  if (key.includes('category') || key.includes('kategorie')) category = val;
                  if (key.includes('version')) version = val;
                  if (key.includes('size') || key.includes('größe')) size = val;
                  if (key.includes('released') || key.includes('datum')) released = val;
                  if (key.includes('platform') || key.includes('plattform')) platform = val;
                  if (key.includes('manufacturer') || key.includes('hersteller')) manufacturer = val;
                });

                let rating = '';
                let votes = '';
                const ratingText = detail$('.mod-item__rating-num').first().text().trim();
                const ratingMatch = ratingText.match(/([\d.]+)\s*\(([\d]+)\)/);
                if (ratingMatch) {
                  rating = ratingMatch[1];
                  votes = ratingMatch[2];
                }

                // Titel extrahieren
                let modTitle = detail$('h2').first().text().trim();
                if (!modTitle) modTitle = detail$('h1').text().trim() || 'Unknown';

                this.mapping[mod.fileName] = {
                  modId,
                  title: modTitle,
                  category,
                  author,
                  version,
                  size,
                  released,
                  platform,
                  manufacturer,
                  rating,
                  votes,
                  failed: false
                };

                matchFound = true;
                success = true;
                break;
              }

              await this.delay(500); // 500ms Pause zwischen Detailseiten-Aufrufen
            }

            if (!matchFound) {
              // Kein exakter Treffer bei den Top 3
              this.mapping[mod.fileName] = { modId: '!', failed: true, title: 'Unknown', category: 'Unknown', author: 'Unknown', version: '0.0.0.0' };
              success = true;
            }

          } catch (err: any) {
            logger.error(`Fehler bei Mod ${searchTitle}`, err);
            retries++;
            if (retries < 2) {
              logger.info('Warte 5 Sekunden wegen Netzwerkfehler...');
              await this.delay(5000);
            } else {
              // Netzwerkfehler bestehen weiterhin: NICHT ins Mapping eintragen,
              // damit es beim nächsten App-Start erneut versucht wird.
              logger.info(`Überspringe ${searchTitle} für diese Sitzung wegen Netzwerkfehlern.`);
              success = true; // Beende die While-Schleife für diesen Mod
            }
          }
        }

        this.saveMapping();
        await this.delay(500); // 500ms Pause vor dem nächsten Mod
      }

      webContents.send('modhub-mapping-complete');
    } finally {
      this.isMapping = false;
    }
  }

  public async forceCheckUpdates(webContents: Electron.WebContents, modIdsToCheck: string[]) {
    await this.checkUpdates(webContents, modIdsToCheck, "Manuelles Update");
  }
}

export const modHubService = new ModHubService();
