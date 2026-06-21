import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ModInfo } from '../common/types';

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
  private isMapping = false;

  constructor() {
    this.mappingFile = path.join(app.getPath('userData'), 'local-mapping.json');
    this.loadMapping();
  }

  private loadMapping() {
    if (fs.existsSync(this.mappingFile)) {
      try {
        this.mapping = JSON.parse(fs.readFileSync(this.mappingFile, 'utf-8'));
      } catch (err) {
        console.error('Fehler beim Laden von local-mapping.json:', err);
        this.mapping = {};
      }
    }
  }

  private saveMapping() {
    try {
      fs.writeFileSync(this.mappingFile, JSON.stringify(this.mapping, null, 2), 'utf-8');
    } catch (err) {
      console.error('Fehler beim Speichern von local-mapping.json:', err);
    }
  }

  public getMapping(fileName: string): LocalModMapping | undefined {
    return this.mapping[fileName];
  }

  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async checkUpdates(webContents: Electron.WebContents) {
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
            console.error(`Fehler beim Update-Check für ModId ${id}:`, e);
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
      console.error('Fehler beim Smart Update Check:', e);
    }
  }

  public async mapMods(mods: ModInfo[], webContents: Electron.WebContents) {
    if (this.isMapping) return;
    this.isMapping = true;

    try {
      await this.checkUpdates(webContents);

      const unknownMods = mods.filter(m => !this.mapping[m.fileName]);

      for (let i = 0; i < unknownMods.length; i++) {
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
            console.error(`Fehler bei Mod ${searchTitle}:`, err.message);
            retries++;
            if (retries < 2) {
              console.log('Warte 5 Sekunden wegen Netzwerkfehler...');
              await this.delay(5000);
            } else {
              // Netzwerkfehler bestehen weiterhin: NICHT ins Mapping eintragen,
              // damit es beim nächsten App-Start erneut versucht wird.
              console.log(`Überspringe ${searchTitle} für diese Sitzung wegen Netzwerkfehlern.`);
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
    if (this.isMapping) {
      console.log('Force-Update abgebrochen: isMapping ist bereits true.');
      return;
    }
    this.isMapping = true;

    try {
      const stringModIdsToCheck = modIdsToCheck.map(String);
      const validMappings = Object.entries(this.mapping).filter(([_, m]) => !m.failed && m.modId !== '!' && stringModIdsToCheck.includes(String(m.modId)));
      console.log(`Starte Force-Update für ${validMappings.length} Mods (von ${modIdsToCheck.length} übergebenen IDs)`);
      
      if (validMappings.length === 0) {
        // Show an empty toast briefly so user knows it finished
        webContents.send('modhub-mapping-progress', { 
          status: 'checking_updates',
          current: 0, 
          total: 0,
          modName: 'Keine ModHub-Mods gefunden'
        });
        setTimeout(() => webContents.send('modhub-mapping-complete'), 2000);
        return;
      }
      
      for (let i = 0; i < validMappings.length; i++) {
        const [fileName, mappingData] = validMappings[i];
        
        webContents.send('modhub-mapping-progress', { 
          status: 'checking_updates',
          current: i + 1, 
          total: validMappings.length,
          modName: mappingData.title || fileName
        });

        try {
          const detailRes = await axios.get(`${BASE_URL}/mod.php?mod_id=${mappingData.modId}&title=fs2025`, { timeout: 10000 });
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

          if (version) {
            this.mapping[fileName].version = version;
            if (released) this.mapping[fileName].released = released;
            if (size) this.mapping[fileName].size = size;
          }

          await this.delay(500);
        } catch(e: any) {
          console.error(`Fehler beim Force-Update-Check für ModId ${mappingData.modId}:`, e.message);
          await this.delay(5000); // Wait on network error
        }
      }
      
      this.saveMapping();
      webContents.send('modhub-mapping-complete');
    } finally {
      this.isMapping = false;
    }
  }
}

export const modHubService = new ModHubService();
