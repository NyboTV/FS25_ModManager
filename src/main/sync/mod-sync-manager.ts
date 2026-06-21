import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { logger } from '../main';
import { parseModsFromHtmlCheerio } from './mod-html-parser';
import { parseModsFromXml } from './mod-xml-parser';
import { ModDownloader } from './mod-downloader';

export class ModSyncManager {
  private appDataPath: string;
  private activeSyncAbortController: AbortController | null = null;
  private downloader: ModDownloader;
  private isPaused: boolean = false;

  constructor(appDataPath: string) {
    this.appDataPath = appDataPath;
    this.downloader = new ModDownloader();
  }

  isSyncing(): boolean {
    return this.activeSyncAbortController !== null;
  }

  pauseSync(): void {
    this.isPaused = true;
    this.downloader.pause();
  }

  resumeSync(): void {
    this.isPaused = false;
    this.downloader.resume();
  }

  /**
   * Synchronisiert Mods zwischen Profil und Server
   */
  async syncProfile(profile: any, progressCallback?: (progress: any) => void, forceModNames?: string[]): Promise<void> {
    try {
      logger.info(`Starte Mod-Synchronisation für Profil: ${profile.name}`);
      this.isPaused = false;
      this.activeSyncAbortController = new AbortController();
      const signal = this.activeSyncAbortController.signal;
      
      let fetchUrl = '';
      if (profile.serverModListUrl && profile.serverModListUrl.trim() !== '') {
        fetchUrl = profile.serverModListUrl.trim();
      } else if (profile.serverWebStatsUrl && profile.serverWebStatsUrl.trim() !== '') {
        fetchUrl = profile.serverWebStatsUrl.trim();
      } else {
        if (profile.serverSyncUrl && profile.serverSyncUrl.trim() !== '') {
          throw new Error("Für FastDL wird eine Mod-Liste oder Dedicated Server WebStats URL benötigt, um die Versionen abzugleichen.");
        } else {
          throw new Error("Keine Server-URL (Mod-Liste oder Dedicated Server WebStats-URL) konfiguriert.");
        }
      }

      if (progressCallback) {
        progressCallback({
          profileId: profile.id,
          currentMod: 'Verbinde mit Server...',
          totalMods: 0,
          completedMods: 0,
          currentFileProgress: 0,
          status: 'verifying'
        });
      }

      let serverMods;
      try {
        serverMods = await this.fetchServerModList(fetchUrl);
      } catch (error: any) {
        logger.error(`Fehler beim Laden der Server-Mod-Liste von ${fetchUrl}: ${error}`);
        if (fetchUrl === profile.serverWebStatsUrl) {
          throw new Error("Der Dedicated Server ist offline (XML konnte nicht geladen werden). Synchronisation abgebrochen.");
        } else {
          throw new Error(`Die Server-Mod-Liste konnte nicht geladen werden (${error.message || error}). Synchronisation abgebrochen.`);
        }
      }
      logger.debug(`${serverMods.length} Mods vom Server erhalten`);
      const totalServerMods = serverMods.length;
      const modsDirectory = profile.modFolderPath;
      if (!fs.existsSync(modsDirectory)) {
        fs.mkdirSync(modsDirectory, { recursive: true });
      }

      // Pre-compile list of mods to download
      const modsToDownload: any[] = [];
      for (const serverMod of serverMods) {
        // DLCs (pdlc_ prefix) werden niemals synchronisiert
        if (serverMod.fileName.toLowerCase().startsWith('pdlc_')) {
          logger.info(`Mod ${serverMod.fileName} ist ein DLC (pdlc_ Prefix) und wird nicht synchronisiert.`);
          
          // Wir registrieren den DLC im Profil, damit er dort gelistet ist
          const existingDlc = profile.mods.find((m: any) => m.fileName === serverMod.fileName);
          if (!existingDlc) {
            profile.mods.push({
              name: serverMod.name || serverMod.fileName.replace(/\.(zip|ms2)$/i, ''),
              version: serverMod.version || '',
              author: serverMod.author || '',
              fileName: serverMod.fileName,
              fileSize: '0 KB',
              isActive: true,
              isDLC: true,
              isFromServer: true
            });
            logger.info(`Sync Check: DLC ${serverMod.fileName} im Profil registriert.`);
          } else {
            let patched = false;
            if (!existingDlc.isDLC) {
              existingDlc.isDLC = true;
              patched = true;
            }
            if (!existingDlc.isActive) {
              existingDlc.isActive = true;
              patched = true;
            }
            if (serverMod.version && existingDlc.version !== serverMod.version) {
              existingDlc.version = serverMod.version;
              patched = true;
            }
            if (patched) {
              logger.info(`Sync Check: DLC ${serverMod.fileName} Details im Profil aktualisiert.`);
            }
          }
          continue;
        }

        const modFilePath = path.join(modsDirectory, serverMod.fileName);
        const existingMod = profile.mods.find((m: any) => m.fileName === serverMod.fileName);

        // Im Force Sync Modus überspringen wir alle Mods, die nicht markiert wurden
        if (forceModNames && !forceModNames.includes(serverMod.fileName)) {
          continue;
        }

        let needsDownload = true;
        if (forceModNames && forceModNames.includes(serverMod.fileName)) {
          needsDownload = true;
          logger.info(`Force Sync: Überspringe Versionscheck für ${serverMod.fileName}`);
        } else if (fs.existsSync(modFilePath) && !!existingMod) {
          const localVersion = (existingMod.version || '').trim();
          const serverVersion = (serverMod.version || '').trim();
          const normLocal = localVersion.replace(/[^0-9.]/g, '');
          const normServer = serverVersion.replace(/[^0-9.]/g, '');

          if (
            serverVersion && localVersion && (serverVersion === localVersion || (normServer && normServer === normLocal))
          ) {
            needsDownload = false;
            logger.debug(`Mod ${serverMod.fileName} ist aktuell (Version: ${serverVersion}), Download wird übersprungen.`);
          } else if (!serverVersion) {
            needsDownload = false;
            logger.debug(`Mod ${serverMod.fileName}: Keine Server-Versionsdaten, Datei existiert – Download wird übersprungen.`);
          }
        }

        if (needsDownload) {
          modsToDownload.push(serverMod);
        } else if (existingMod) {
          // Nachextrahieren/Nachpatchen der restlichen Infos, da der Download übersprungen wurde
          let patched = false;
          
          let finalDownloadUrl = serverMod.downloadUrl;
          let finalDownloadSource = 'modList';
          if (profile.serverSyncUrl && profile.serverSyncUrl.trim() !== '') {
            try {
              const fastDlUrl = new URL(profile.serverSyncUrl);
              const basePath = fastDlUrl.pathname.endsWith('/') ? fastDlUrl.pathname : fastDlUrl.pathname + '/';
              finalDownloadUrl = `${fastDlUrl.protocol}//${fastDlUrl.host}${basePath}${serverMod.fileName}`;
              finalDownloadSource = 'fastDL';
            } catch (e) {}
          }
          
          if (finalDownloadUrl && existingMod.downloadUrl !== finalDownloadUrl) {
            existingMod.downloadUrl = finalDownloadUrl;
            patched = true;
          }
          if (finalDownloadSource && existingMod.downloadSource !== finalDownloadSource) {
            existingMod.downloadSource = finalDownloadSource;
            patched = true;
          }
          if (serverMod.detailUrl && existingMod.detailUrl !== serverMod.detailUrl) {
            existingMod.detailUrl = serverMod.detailUrl;
            patched = true;
          }
          if (serverMod.hash && existingMod.hash !== serverMod.hash) {
            existingMod.hash = serverMod.hash;
            patched = true;
          }
          if (existingMod.isFromServer !== true) {
            existingMod.isFromServer = true;
            patched = true;
          }
          
          if (patched) {
            logger.info(`Sync Check: Details nachgepatcht für ${serverMod.fileName} (da Version identisch).`);
          }
        }
      }

      const totalMods = modsToDownload.length;
      let completedMods = 0;
      const failedMods: string[] = [];

      for (const serverMod of modsToDownload) {
        while (this.isPaused) {
          if (signal.aborted) {
            logger.info('Synchronisation wurde abgebrochen (während Pause)');
            throw new Error('Synchronisation abgebrochen');
          }
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        if (signal.aborted) {
          logger.info('Synchronisation wurde abgebrochen (vor Download)');
          throw new Error('Synchronisation abgebrochen');
        }

        // Nutze FastDL, falls vorhanden
        const originalDownloadUrl = serverMod.downloadUrl;
        if (profile.serverSyncUrl && profile.serverSyncUrl.trim() !== '') {
          try {
            const fastDlUrl = new URL(profile.serverSyncUrl);
            const basePath = fastDlUrl.pathname.endsWith('/') ? fastDlUrl.pathname : fastDlUrl.pathname + '/';
            serverMod.downloadUrl = `${fastDlUrl.protocol}//${fastDlUrl.host}${basePath}${serverMod.fileName}`;
            serverMod.downloadSource = 'fastDL';
          } catch (e) {
            logger.warn(`Ungültige FastDL URL: ${profile.serverSyncUrl}`);
          }
        } else {
          serverMod.downloadSource = 'modList';
        }

        if (progressCallback) {
          progressCallback({
            profileId: profile.id,
            currentMod: serverMod.fileName || serverMod.id,
            totalMods,
            completedMods,
            currentFileProgress: 0,
            status: this.isPaused ? 'paused' : 'downloading',
            downloadSource: serverMod.downloadSource,
            totalServerMods
          });
        }

        const existingMod = profile.mods.find((m: any) => m.fileName === serverMod.fileName);
        let success = false;
        let currentAttemptSource = serverMod.downloadSource;
        let currentDownloadUrl = serverMod.downloadUrl;

        for (let attempt = 1; attempt <= 3; attempt++) {
          if (signal.aborted) {
            logger.info('Synchronisation wurde abgebrochen (vor Download-Versuch)');
            throw new Error('Synchronisation abgebrochen');
          }
          try {
            await this.downloader.download(serverMod, modsDirectory, signal, (progress, speedMbPerSec, etaSeconds) => {
              if (signal.aborted) {
                throw new Error('Synchronisation abgebrochen');
              }
              if (progressCallback) {
                progressCallback({
                  profileId: profile.id,
                  currentMod: serverMod.fileName || serverMod.id,
                  totalMods,
                  completedMods,
                  currentFileProgress: progress,
                  speedMbPerSec: this.isPaused ? 0 : speedMbPerSec,
                  etaSeconds,
                  status: this.isPaused ? 'paused' : 'downloading',
                  downloadSource: currentAttemptSource,
                  totalServerMods
                });
              }
            });
            success = true;
            break;
          } catch (error: any) {
            if (error.message === 'SKIPPED') {
              logger.info(`Download für ${serverMod.fileName} wurde übersprungen.`);
              success = true;
              break;
            }
            logger.warn(`Download-Versuch ${attempt} für ${serverMod.fileName} über ${currentAttemptSource} fehlgeschlagen: ${error}`);
            await new Promise(res => setTimeout(res, 1000));
          }
        }

        // Fallback zur originalen Mod-Liste URL, falls FastDL fehlschlug
        if (!success && currentAttemptSource === 'fastDL' && originalDownloadUrl && originalDownloadUrl !== currentDownloadUrl) {
          logger.info(`FastDL Download fehlgeschlagen für ${serverMod.fileName}. Versuche Fallback zu Original-URL...`);
          serverMod.downloadUrl = originalDownloadUrl;
          serverMod.downloadSource = 'modList';
          currentAttemptSource = 'modList';
          currentDownloadUrl = originalDownloadUrl;

          for (let attempt = 1; attempt <= 3; attempt++) {
            if (signal.aborted) {
              logger.info('Synchronisation wurde abgebrochen (vor Fallback-Versuch)');
              throw new Error('Synchronisation abgebrochen');
            }
            try {
              await this.downloader.download(serverMod, modsDirectory, signal, (progress, speedMbPerSec, etaSeconds) => {
                if (signal.aborted) {
                  throw new Error('Synchronisation abgebrochen');
                }
                if (progressCallback) {
                  progressCallback({
                    profileId: profile.id,
                    currentMod: serverMod.fileName || serverMod.id,
                    totalMods,
                    completedMods,
                    currentFileProgress: progress,
                    speedMbPerSec: this.isPaused ? 0 : speedMbPerSec,
                    etaSeconds,
                    status: this.isPaused ? 'paused' : 'downloading',
                    downloadSource: currentAttemptSource,
                    totalServerMods
                  });
                }
              });
              success = true;
              break;
            } catch (error: any) {
              if (error.message === 'SKIPPED') {
                logger.info(`Download (Fallback) für ${serverMod.fileName} wurde übersprungen.`);
                success = true;
                break;
              }
              logger.warn(`Fallback-Versuch ${attempt} für ${serverMod.fileName} über ${currentAttemptSource} fehlgeschlagen: ${error}`);
              await new Promise(res => setTimeout(res, 1000));
            }
          }
        }

        if (!success) {
          logger.error(`Mod ${serverMod.fileName} konnte nach allen Versuchen nicht geladen werden!`);
          failedMods.push(serverMod.fileName);
          completedMods++;
          continue;
        }

        if (signal.aborted) {
          logger.info('Synchronisation wurde abgebrochen');
          throw new Error('Synchronisation abgebrochen');
        }
        if (progressCallback) {
          progressCallback({
            profileId: profile.id,
            currentMod: serverMod.fileName || serverMod.id,
            totalMods,
            completedMods,
            currentFileProgress: 100,
            status: 'saving',
            totalServerMods
          });
        }
        
        if (this.downloader.getSkipReason() === 'skip') {
          failedMods.push(serverMod.fileName);
        } else {
          // Füge Mod zum Profil hinzu oder aktualisiere ihn
          if (existingMod) {
            Object.assign(existingMod, serverMod);
            existingMod.isActive = true;
            if (existingMod.modHub === undefined) {
              existingMod.modHub = '';
            }
          } else {
            serverMod.isActive = true;
            if (serverMod.modHub === undefined) {
              serverMod.modHub = '';
            }
            profile.mods.push(serverMod);
          }
          // Speichere Profil nach jedem Mod sofort
          const profilePath = path.join(this.appDataPath, 'profiles', profile.id, 'profile.json');
          fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
          logger.debug(`Erfolgreich heruntergeladen und im Profil gespeichert: ${serverMod.fileName}`);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        completedMods++;
      }

      // Echter Sync: Entferne lokale Mods, die nicht auf dem Server existieren
      // ABER NUR WENN WIR SERVERMODS ERHALTEN HABEN (SAFEGUARD GEGEN DATENVERLUST!)
      let serverFileNames: string[] = [];
      if (!forceModNames && serverMods && serverMods.length > 0) {
        serverFileNames = serverMods.map(m => m.fileName);
        const orphanedMods = profile.mods.filter((m: any) => 
          !serverFileNames.includes(m.fileName) && 
          !m.fileName.toLowerCase().startsWith('pdlc_')
        );
      
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
      } else if (!forceModNames && (!serverMods || serverMods.length === 0)) {
        logger.warn('Mod-Synchronisation: Server-Modliste ist leer. Löschen lokaler Mods wird übersprungen (Datenverlust-Schutz).');
      }
      
      // Filtere die profilspezifische Liste auf nur noch die Mods, die auch auf dem Server sind
      if (!forceModNames && serverMods && serverMods.length > 0) {
        profile.mods = profile.mods.filter((m: any) => 
          serverFileNames.includes(m.fileName) || 
          m.fileName.toLowerCase().startsWith('pdlc_')
        );
      }
      
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
          failedMods,
          totalServerMods
        });
      }
      logger.info(`Mod-Synchronisation abgeschlossen für Profil: ${profile.name}`);
      this.activeSyncAbortController = null;
    } catch (error) {
      this.activeSyncAbortController = null;
      logger.error(`Fehler bei der Mod-Synchronisation: ${error}`);
      throw error;
    }
  }

  /**
   * Lädt die Mod-Liste vom Server (HTML oder XML)
   */
  async fetchServerModList(serverUrl: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(serverUrl);
        const client = url.protocol === 'https:' ? https : http;
        const request = client.get(serverUrl, (response) => {
          if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
            reject(new Error(`Server antwortete mit Status: ${response.statusCode}`));
            return;
          }

          const chunks: Buffer[] = [];
          response.on('data', (chunk) => {
            chunks.push(Buffer.from(chunk));
          });
          
          response.on('end', () => {
            try {            
              const buffer = Buffer.concat(chunks);
              const data = buffer.toString('utf8');
              if (!data.trim()) {
                reject(new Error('Leere Serverantwort erhalten'));
                return;
              }
              
              let mods: any[] = [];
              if (serverUrl.toLowerCase().includes('.xml') || serverUrl.toLowerCase().includes('dedicated-server-stats') || data.trim().startsWith('<?xml') || data.trim().startsWith('<dedicatedServer')) {
                mods = parseModsFromXml(data, serverUrl);
              } else {
                mods = parseModsFromHtmlCheerio(data, serverUrl);
              }
              
              resolve(mods);
            } catch (error) {
              reject(new Error(`Fehler beim Parsen der Server-Antwort: ${error instanceof Error ? error.message : String(error)}`));
            }
          });

          response.on('error', (err) => reject(err));
        });
        
        request.on('error', (error) => {
          reject(error);
        });
        
        request.setTimeout(30000, () => {
          request.destroy();
          reject(new Error('Server-Timeout'));
        });
      } catch (err) {
        reject(err);
      }
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
   * Überspringt den aktuellen Mod-Download
   */
  skipCurrentMod(reason: 'skip' | 'local'): void {
    this.downloader.skip(reason);
  }
}
