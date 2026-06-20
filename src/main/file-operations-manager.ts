import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { logger } from './main';

export class FileOperationsManager {
  private appDataPath: string;
  private mainWindow: BrowserWindow | null;

  constructor(appDataPath: string, getMainWindow: () => BrowserWindow | null) {
    this.appDataPath = appDataPath;
    this.mainWindow = null;
    this.getMainWindow = getMainWindow;
    this.setupIpcHandlers();
  }

  private getMainWindow: () => BrowserWindow | null;

  private setupIpcHandlers(): void {
    // Öffne Datei-/Ordnerdialog
    ipcMain.handle('open-folder-dialog', async () => {
      logger.debug('Handler: open-folder-dialog aufgerufen');
      const win = this.getMainWindow();
      if (!win) {
        logger.error('open-folder-dialog: Kein gültiges Fenster gefunden!');
        return null;
      }
      const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory']
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        logger.debug(`Ordner ausgewählt: ${result.filePaths[0]}`);
        return result.filePaths[0];
      }
      logger.debug('Ordnerauswahl abgebrochen');
      return null;
    });

    // Öffne Dateiauswahldialog (für die EXE-Auswahl)
    ipcMain.handle('open-file-dialog', async () => {
      logger.debug('Handler: open-file-dialog aufgerufen');
      const result = await dialog.showOpenDialog(this.getMainWindow()!, {
        properties: ['openFile'],
        filters: [
          { name: 'Executable Files', extensions: ['exe'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        title: 'Wählen Sie die Farming Simulator 25 EXE-Datei aus'
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        logger.debug(`Datei ausgewählt: ${result.filePaths[0]}`);
        return result.filePaths[0];
      }
      logger.debug('Dateiauswahl abgebrochen');
      return null;
    });

    // Mods in Profil-spezifisches Verzeichnis kopieren
    ipcMain.handle('import-mods-to-profile', async (_, profileId: string, sourcePath: string) => {
      logger.debug(`Handler: import-mods-to-profile aufgerufen für Profil ${profileId} mit Quellpfad ${sourcePath}`);
      try {
        const profileModsPath = path.join(this.appDataPath, 'profiles', profileId, 'mods');
        
        // Stelle sicher, dass das Verzeichnis existiert
        if (!fs.existsSync(profileModsPath)) {
          logger.debug(`Mods-Verzeichnis für Profil ${profileId} existiert nicht, erstelle: ${profileModsPath}`);
          fs.mkdirSync(profileModsPath, { recursive: true });
        }
          
        // Kopiere Mods vom Quellverzeichnis
        logger.info(`Importiere Mods aus ${sourcePath} in das Profil ${profileId}`);
        await this.copyDirectoryThrottled(sourcePath, profileModsPath);
        
        // Mods scannen und Dateiliste zurückgeben
        const modFiles = this.scanModDirectory(profileModsPath);
        
        logger.info(`${modFiles.length} Mods erfolgreich in das Profil ${profileId} importiert`);
        logger.debug(`Importierte Mods: ${modFiles.map(m => m.name).join(', ')}`);
        
        return { 
          success: true,
          modFiles,
          message: 'Mods erfolgreich importiert' 
        };
      } catch (error) {
        logger.error(`Fehler beim Importieren der Mods für Profil ${profileId}`, error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    // Ausgewählte (gedroppte) Mod-Dateien ins Profil importieren
    ipcMain.handle('import-dropped-mods', async (_, profileId: string, filePaths: string[]) => {
      logger.debug(`Handler: import-dropped-mods aufgerufen für Profil ${profileId} mit ${filePaths.length} Dateien`);
      try {
        const profileModsPath = path.join(this.appDataPath, 'profiles', profileId, 'mods');
        
        if (!fs.existsSync(profileModsPath)) {
          fs.mkdirSync(profileModsPath, { recursive: true });
        }
          
        let importedCount = 0;
        for (const filePath of filePaths) {
          if (!filePath.toLowerCase().endsWith('.zip')) continue;
          
          const fileName = path.basename(filePath);
          const targetPath = path.join(profileModsPath, fileName);
          
          if (!fs.existsSync(targetPath)) {
            // copyFileThrottled verwenden oder direkt kopieren
            await this.copyFileThrottled(filePath, targetPath, 0);
            importedCount++;
          }
        }
        
        const modFiles = this.scanModDirectory(profileModsPath);
        
        logger.info(`${importedCount} gedroppte Mods erfolgreich ins Profil importiert`);
        return { 
          success: true,
          modFiles,
          importedCount,
          message: `${importedCount} Mods erfolgreich importiert` 
        };
      } catch (error) {
        logger.error(`Fehler beim Importieren gedroppter Mods für Profil ${profileId}`, error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    // Mods aus dem Profil in den Spiel-Mods-Ordner kopieren
    ipcMain.handle('deploy-profile-mods', async (event, profileId: string, targetPath: string) => {
      logger.debug(`Handler: deploy-profile-mods aufgerufen für Profil ${profileId} mit Zielordner ${targetPath}`);
      try {
        const profileJsonPath = path.join(this.appDataPath, 'profiles', profileId, 'profile.json');
        if (!fs.existsSync(profileJsonPath)) {
          return { success: false, error: 'Profil nicht gefunden' };
        }
        
        const profileData = JSON.parse(fs.readFileSync(profileJsonPath, 'utf8'));
        const profileModsPath = profileData.modFolderPath;
        
        logger.info(`Deploye Mods vom Profil ${profileId} (${profileModsPath}) zum Zielordner ${targetPath}`);
          
        // Überprüfe, ob der Quellordner existiert, falls nicht, erstelle ihn
        if (!fs.existsSync(profileModsPath)) {
          logger.info(`Erstelle fehlenden Mods-Ordner für Profil ${profileId}: ${profileModsPath}`);
          fs.mkdirSync(profileModsPath, { recursive: true });
        }
        
        if (!fs.existsSync(targetPath)) {
          logger.debug(`Zielordner existiert nicht, erstelle: ${targetPath}`);
          fs.mkdirSync(targetPath, { recursive: true });
        }
          
        // --- SMART SYNC LOGIC ---
        logger.info(`Starte Smart-Sync von ${profileModsPath} nach ${targetPath}`);
        
        const sourceEntries = fs.existsSync(profileModsPath) ? fs.readdirSync(profileModsPath, { withFileTypes: true }) : [];
        const destEntries = fs.existsSync(targetPath) ? fs.readdirSync(targetPath, { withFileTypes: true }) : [];
        
        const sourceFiles = sourceEntries.filter(e => e.isFile()).map(e => e.name);
        
        // 1. Lösche Dateien/Ordner im Ziel, die nicht im Profil existieren
        let deletedCount = 0;
        for (const destEntry of destEntries) {
          const destPathFull = path.join(targetPath, destEntry.name);
          if (destEntry.isDirectory()) {
            // FS25 ModManager Profile unterstützen keine Verzeichnisse (unzipped mods), also löschen
            fs.rmSync(destPathFull, { recursive: true, force: true });
            logger.debug(`Smart-Sync: Gelöschtes Verzeichnis: ${destEntry.name}`);
            deletedCount++;
          } else if (!sourceFiles.includes(destEntry.name)) {
            fs.unlinkSync(destPathFull);
            logger.debug(`Smart-Sync: Gelöscht (nicht im Profil): ${destEntry.name}`);
            deletedCount++;
          }
        }
        
        const destFilesAfterDeletion = fs.existsSync(targetPath) 
          ? fs.readdirSync(targetPath, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name)
          : [];

        // 2. Ermittle, welche Dateien kopiert werden müssen
        const filesToCopy: string[] = [];
        for (const srcFile of sourceFiles) {
          const srcFilePath = path.join(profileModsPath, srcFile);
          const destFilePath = path.join(targetPath, srcFile);
          
          if (!destFilesAfterDeletion.includes(srcFile)) {
            filesToCopy.push(srcFile);
          } else {
            const srcStats = fs.statSync(srcFilePath);
            const destStats = fs.statSync(destFilePath);
            if (srcStats.size !== destStats.size) {
              filesToCopy.push(srcFile);
            }
          }
        }
        
        logger.info(`Smart-Sync: ${deletedCount} gelöscht, ${filesToCopy.length} zu kopieren. (${sourceFiles.length - filesToCopy.length} identisch)`);
        
        // Sende initiales Progress-Event
        if (event && event.sender) {
          event.sender.send('deploy-progress', {
            current: 0,
            total: filesToCopy.length,
            message: filesToCopy.length > 0 ? `Bereite Kopieren vor... (0/${filesToCopy.length})` : 'Alle Mods sind bereits aktuell!'
          });
        }
        
        // 3. Kopiere die benötigten Dateien mit Fortschritt
        for (let i = 0; i < filesToCopy.length; i++) {
          const file = filesToCopy[i];
          const srcFilePath = path.join(profileModsPath, file);
          const destFilePath = path.join(targetPath, file);
          
          if (event && event.sender) {
            event.sender.send('deploy-progress', {
              current: i + 1,
              total: filesToCopy.length,
              message: `Kopiere Mod ${i + 1} von ${filesToCopy.length}: ${file}`
            });
          }
          
          logger.debug(`Smart-Sync: Kopiere ${file}...`);
          // Nutze 0ms Verzögerung für volle NVMe-Geschwindigkeit ohne die UI zu blockieren (dank Backpressure)
          await this.copyFileThrottled(srcFilePath, destFilePath, 0);
        }
        
        logger.info(`Mods für Profil ${profileId} erfolgreich ins Spielverzeichnis kopiert`);
        return { 
          success: true, 
          message: 'Mods erfolgreich ins Spiel kopiert' 
        };
      } catch (error) {
        logger.error(`Fehler beim Deployen der Mods für Profil ${profileId}`, error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    // Prüfe auf im Spiel aktualisierte Mods
    ipcMain.handle('check-in-game-mod-updates', async (_, profileId: string, gameModFolder: string) => {
      logger.debug(`Handler: check-in-game-mod-updates aufgerufen für Profil ${profileId}`);
      try {
        const profileModsPath = path.join(this.appDataPath, 'profiles', profileId, 'mods');
        
        if (!fs.existsSync(profileModsPath) || !fs.existsSync(gameModFolder)) {
          return { success: true, hasChanges: false, changes: [] };
        }
        
        const sourceEntries = fs.readdirSync(profileModsPath, { withFileTypes: true });
        const destEntries = fs.readdirSync(gameModFolder, { withFileTypes: true });
        
        const sourceFiles = sourceEntries.filter(e => e.isFile()).map(e => e.name);
        const destFiles = destEntries.filter(e => e.isFile()).map(e => e.name);
        
        const changes: string[] = [];
        
        for (const destFile of destFiles) {
          if (!destFile.endsWith('.zip')) continue; // Nur Zip-Mods prüfen
          
          if (!sourceFiles.includes(destFile)) {
            changes.push(destFile); // Neu im Spiel
          } else {
            const srcStats = fs.statSync(path.join(profileModsPath, destFile));
            const destStats = fs.statSync(path.join(gameModFolder, destFile));
            if (srcStats.size !== destStats.size) {
              changes.push(destFile); // Geändert im Spiel
            }
          }
        }
        
        return { 
          success: true, 
          hasChanges: changes.length > 0, 
          changes,
          profileId 
        };
      } catch (error) {
        logger.error(`Fehler bei check-in-game-mod-updates`, error);
        return { success: false, error: String(error) };
      }
    });

    // Importiere im Spiel aktualisierte Mods zurück ins Profil
    ipcMain.handle('import-in-game-updates', async (_, profileId: string, gameModFolder: string, changesToImport: string[]) => {
      logger.debug(`Handler: import-in-game-updates aufgerufen für Profil ${profileId}`);
      try {
        const profileModsPath = path.join(this.appDataPath, 'profiles', profileId, 'mods');
        
        if (!fs.existsSync(profileModsPath)) {
          fs.mkdirSync(profileModsPath, { recursive: true });
        }
        
        for (const file of changesToImport) {
          const gameFilePath = path.join(gameModFolder, file);
          const profileFilePath = path.join(profileModsPath, file);
          
          if (fs.existsSync(gameFilePath)) {
            logger.debug(`Importiere Update für ${file} zurück ins Profil...`);
            await this.copyFileThrottled(gameFilePath, profileFilePath, 0);
          }
        }
        
        // Scan Profil erneut, um die neuen Mods zu erfassen
        const modFiles = this.scanModDirectory(profileModsPath);
        
        return { success: true, modFiles };
      } catch (error) {
        logger.error(`Fehler bei import-in-game-updates`, error);
        return { success: false, error: String(error) };
      }
    });

    // Mod über URL (z.B. ModHub) herunterladen und hinzufügen
    ipcMain.handle('add-mod-from-url', async (_, profileId: string, urlStr: string) => {
      logger.info(`Handler: add-mod-from-url aufgerufen für Profil ${profileId} mit URL ${urlStr}`);
      try {
        const url = new URL(urlStr);
        let downloadUrl = urlStr;

        // Wenn es eine Farming Simulator ModHub URL ist, parsen wir sie, um den echten Download-Link zu finden
        if (url.hostname.includes('farming-simulator.com') && url.pathname.includes('mod.php')) {
          logger.info(`ModHub URL erkannt, suche echten Download-Link...`);
          const html = await new Promise<string>((resolve, reject) => {
            https.get(urlStr, (res) => {
              let data = '';
              res.on('data', (c) => data += c);
              res.on('end', () => resolve(data));
              res.on('error', reject);
            }).on('error', reject);
          });

          // Suche nach dem Download-Button-Link (zip-Datei auf CDN)
          const match = html.match(/<a[^>]*href=["']([^"']+\.zip)["'][^>]*>/i);
          if (match && match[1]) {
            downloadUrl = match[1];
            logger.info(`Download-URL gefunden: ${downloadUrl}`);
          } else {
            throw new Error('Konnte keinen Mod-Download-Link auf der angegebenen Seite finden.');
          }
        } else if (!urlStr.toLowerCase().endsWith('.zip')) {
           throw new Error('Bitte einen direkten Link zu einer .zip Datei oder eine Farming Simulator ModHub Seite angeben.');
        }

        const fileName = path.basename(new URL(downloadUrl).pathname);
        if (!fileName.endsWith('.zip')) {
           throw new Error('Die gefundene Datei ist keine .zip Datei.');
        }

        const targetPath = path.join(this.appDataPath, 'profiles', profileId, 'mods', fileName);
        
        // Verzeichnis sicherstellen
        const profileModsPath = path.join(this.appDataPath, 'profiles', profileId, 'mods');
        if (!fs.existsSync(profileModsPath)) {
          fs.mkdirSync(profileModsPath, { recursive: true });
        }

        logger.info(`Starte Download von ${downloadUrl} nach ${targetPath}`);
        
        await new Promise<void>((resolve, reject) => {
          const client = downloadUrl.startsWith('https') ? https : http;
          client.get(downloadUrl, (res) => {
            if (res.statusCode !== 200) {
              reject(new Error(`Download fehlgeschlagen mit Status: ${res.statusCode}`));
              return;
            }
            
            const writeStream = fs.createWriteStream(targetPath);
            res.pipe(writeStream);
            
            writeStream.on('finish', () => {
              writeStream.close();
              resolve();
            });
            writeStream.on('error', (err) => {
              fs.unlink(targetPath, () => {});
              reject(err);
            });
          }).on('error', reject);
        });

        // Nach dem Download: Profil aktualisieren
        const ProfileManager = require('./profile-manager').ProfileManager;
        const profileManager = new ProfileManager(this.appDataPath, false);
        const profile = await profileManager.getProfile(profileId);
        if (profile) {
          profile.modFolderPath = profileModsPath;
          await this.refreshProfileModsFromFolder(profile);
          await profileManager.saveProfile(profile);
          logger.info(`Mod-Ordner und profile.json synchronisiert nach URL Download.`);
        }

        return { success: true, message: 'Mod erfolgreich heruntergeladen und hinzugefügt' };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Fehler beim Herunterladen der Mod per URL: ${errorMessage}`);
        return { success: false, error: errorMessage };
      }
    });
  }

  // Funktion zum Kopieren eines Verzeichnisses und seiner Inhalte
  private async copyDirectoryThrottled(source: string, destination: string): Promise<void> {
    logger.debug(`Kopiere Verzeichnis (gedrosselt) von: ${source} nach: ${destination}`);
    
    if (!fs.existsSync(destination)) {
      logger.debug(`Zielverzeichnis existiert nicht, erstelle: ${destination}`);
      fs.mkdirSync(destination, { recursive: true });
    }

    const entries = fs.readdirSync(source, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        logger.debug(`Kopiere Unterverzeichnis: ${entry.name}`);
        await this.copyDirectoryThrottled(srcPath, destPath);
      } else {
        logger.debug(`Kopiere Datei: ${entry.name}`);
        await this.copyFileThrottled(srcPath, destPath);
      }
    }
  }

  private async copyFileThrottled(source: string, destination: string, throttleDelayMs: number = 10): Promise<void> {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(source, { highWaterMark: 1024 * 512 }); // 512 KB Chunks
      const writeStream = fs.createWriteStream(destination);
      
      let errorOccurred = false;
      const handleError = (err: any) => {
        if (errorOccurred) return;
        errorOccurred = true;
        readStream.destroy();
        writeStream.destroy();
        reject(err);
      };

      readStream.on('error', handleError);
      writeStream.on('error', handleError);
      writeStream.on('finish', () => {
        if (!errorOccurred) resolve();
      });

      readStream.on('data', async (chunk) => {
        readStream.pause();
        
        const canContinue = writeStream.write(chunk);
        
        const resumeReading = async () => {
          if (throttleDelayMs > 0) {
            await new Promise(r => setTimeout(r, throttleDelayMs));
          }
          readStream.resume();
        };

        if (!canContinue) {
          writeStream.once('drain', resumeReading);
        } else {
          await resumeReading();
        }
      });

      readStream.on('end', () => {
        writeStream.end();
      });
    });
  }

  // Scannen eines Mod-Verzeichnisses und Sammeln aller gefundenen Mod-Dateien
  private scanModDirectory(dirPath: string) {
    logger.debug(`Scanne Mod-Verzeichnis: ${dirPath}`);
    const modFiles: Array<{
      id: string;
      name: string;
      filePath: string;
      fileSize: number;
      lastModified: string;
      isActive: boolean;
      isFromServer: boolean;
    }> = [];
    
    const traverseDirectory = (currentPath: string) => {
      logger.debug(`Durchsuche Verzeichnis: ${currentPath}`);
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      
      entries.forEach((entry) => {
        const entryPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          traverseDirectory(entryPath);
        } else if (entry.isFile() && (entry.name.endsWith('.zip') || entry.name.endsWith('.ms2'))) {
          logger.debug(`Mod-Datei gefunden: ${entry.name}`);
          const stats = fs.statSync(entryPath);
          
          modFiles.push({
            id: `mod_${Date.now()}_${modFiles.length}`,
            name: entry.name.replace(/\.(zip|ms2)$/, ''),
            filePath: entryPath,
            fileSize: stats.size,
            lastModified: stats.mtime.toISOString(),
            isActive: true,
            isFromServer: false
          });
        }
      });
    };
      
    traverseDirectory(dirPath);
    logger.info(`${modFiles.length} Mod-Dateien im Verzeichnis ${dirPath} gefunden`);
    return modFiles;
  }

  /**
   * Fügt eine Mod-Datei zu einem Profil hinzu
   */
  async addModToProfile(profileId: string, modFilePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info(`Füge Mod hinzu: ${modFilePath} zu Profil ${profileId}`);
      if (!fs.existsSync(modFilePath)) {
        throw new Error('Mod-Datei nicht gefunden');
      }
      // Überprüfe Dateierweiterung
      const fileExtension = path.extname(modFilePath).toLowerCase();
      if (!['.zip', '.ms2'].includes(fileExtension)) {
        throw new Error('Ungültiges Mod-Dateiformat. Nur .zip und .ms2 Dateien werden unterstützt.');
      }
      // Lade Profil direkt über Dateisystem oder eine saubere Instanz
      const ProfileManager = require('./profile-manager').ProfileManager;
      const profileManager = new ProfileManager(this.appDataPath, false);
      const profile = await profileManager.getProfile(profileId);
      if (!profile) {
        throw new Error('Profil nicht gefunden');
      }
      // Erstelle Profil-Mod-Ordner falls er nicht existiert
      if (!fs.existsSync(profile.modFolderPath)) {
        fs.mkdirSync(profile.modFolderPath, { recursive: true });
      }
      // Kopiere Mod-Datei in Profil-Ordner (immer, auch wenn schon vorhanden)
      const fileName = path.basename(modFilePath);
      // Zielpfad IMMER aus appDataPath + profiles + profileId + mods berechnen
      const targetPath = path.join(this.appDataPath, 'profiles', profileId, 'mods', fileName);
      await this.copyFileThrottled(modFilePath, targetPath);
      logger.info(`Mod-Datei kopiert nach: ${targetPath}`);
      // Mod-Liste komplett neu aus Ordner generieren
      profile.modFolderPath = path.join(this.appDataPath, 'profiles', profileId, 'mods');
      await this.refreshProfileModsFromFolder(profile);
      await profileManager.saveProfile(profile);
      logger.info(`Mod-Ordner und profile.json synchronisiert.`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Fehler beim Hinzufügen der Mod: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Aktualisiert die Mod-Liste in profile.json anhand des aktuellen Inhalts des Profil-Mod-Ordners
   * Ergänzt nur neue Mods, ersetzt nie die gesamte Liste. Entfernt nur Mods, deren Datei nicht mehr existiert.
   */
  async refreshProfileModsFromFolder(profile: any): Promise<void> {
    const modsDir = path.join(profile.modFolderPath);
    if (!fs.existsSync(modsDir)) {
      profile.mods = [];
      return;
    }
    const modFiles = fs.readdirSync(modsDir).filter(f => f.endsWith('.zip') || f.endsWith('.ms2'));
    // Entferne Mods aus der Liste, deren Datei nicht mehr existiert
    profile.mods = (profile.mods || []).filter((mod: any) => modFiles.includes(mod.fileName));
    for (const file of modFiles) {
      const filePath = path.join(modsDir, file);
      const stats = fs.statSync(filePath);
      // ModDesc aus ZIP extrahieren (für Name, Version, Author)
      let name = file.replace(/\.(zip|ms2)$/i, '');
      let version = '';
      let author = '';
      const { ModDescManager } = require('./mod-desc-manager');
      const modDescManager = new ModDescManager();
      const modDescData = await modDescManager.extractModDescFromZip(filePath);
      if (modDescData) {
        name = modDescData.title?.de || modDescData.title?.en || name;
        version = modDescData.version || '';
        author = modDescData.author || '';
      }
      // Format fileSize als String (MB)
      const fileSizeMB = stats.size / (1024 * 1024);
      const fileSizeStr = fileSizeMB >= 1 ? `${fileSizeMB.toFixed(2)} MB` : `${(stats.size / 1024).toFixed(2)} KB`;
      // Prüfe, ob Mod schon in der Liste ist
      const existing = (profile.mods || []).find((m: any) => m.fileName === file);
      if (existing) {
        // Felder aktualisieren, aber Zusatzinfos (z.B. downloadUrl) beibehalten
        existing.name = name;
        existing.version = version;
        existing.author = author;
        existing.fileSize = fileSizeStr;
      } else {
        profile.mods.push({
          name,
          version,
          author,
          fileName: file,
          fileSize: fileSizeStr,
          modHub: '',
          isActive: true,
          downloadUrl: '',
          detailUrl: ''
        });
      }
    }
  }
}
