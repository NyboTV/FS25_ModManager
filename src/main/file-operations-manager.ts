import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
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
        this.copyDirectory(sourcePath, profileModsPath);
        
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

    // Mods aus dem Profil in den Spiel-Mods-Ordner kopieren
    ipcMain.handle('deploy-profile-mods', async (_, profileId: string, targetPath: string) => {
      logger.debug(`Handler: deploy-profile-mods aufgerufen für Profil ${profileId} mit Zielordner ${targetPath}`);
      try {
        const profileModsPath = path.join(this.appDataPath, 'profiles', profileId, 'mods');
        
        logger.info(`Deploye Mods vom Profil ${profileId} zum Zielordner ${targetPath}`);
          
        // Überprüfe, ob der Quellordner existiert
        if (!fs.existsSync(profileModsPath)) {
          logger.warn(`Kein Mods-Ordner für Profil ${profileId} gefunden: ${profileModsPath}`);
          return { 
            success: false, 
            error: 'Keine Mods in diesem Profil gefunden' 
          };
        }
        
        // Überprüfe, ob der Zielordner existiert
        if (!fs.existsSync(targetPath)) {
          logger.debug(`Zielordner existiert nicht, erstelle: ${targetPath}`);
          fs.mkdirSync(targetPath, { recursive: true });
        }
          
        // Lösche den Inhalt des Zielordners, um saubere Synchronisierung zu gewährleisten
        logger.debug(`Lösche bestehende Mods im Zielordner: ${targetPath}`);
        const entries = fs.readdirSync(targetPath);
        
        logger.debug(`${entries.length} Dateien/Ordner im Zielordner gefunden`);
        entries.forEach((entry) => {
          const entryPath = path.join(targetPath, entry);
          if (fs.lstatSync(entryPath).isDirectory()) {
            logger.debug(`Lösche Verzeichnis: ${entry}`);
            fs.rmdirSync(entryPath, { recursive: true });
          } else {
            logger.debug(`Lösche Datei: ${entry}`);
            fs.unlinkSync(entryPath);
          }
        });
          
        // Kopiere die Mods aus dem Profil in den Spiel-Mods-Ordner
        logger.info(`Kopiere Mods von ${profileModsPath} nach ${targetPath}`);
        this.copyDirectory(profileModsPath, targetPath);
        
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
  }

  // Funktion zum Kopieren eines Verzeichnisses und seiner Inhalte
  private copyDirectory(source: string, destination: string): void {
    logger.debug(`Kopiere Verzeichnis von: ${source} nach: ${destination}`);
    
    if (!fs.existsSync(destination)) {
      logger.debug(`Zielverzeichnis existiert nicht, erstelle: ${destination}`);
      fs.mkdirSync(destination, { recursive: true });
    }

    const entries = fs.readdirSync(source, { withFileTypes: true });
    entries.forEach((entry) => {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        logger.debug(`Kopiere Unterverzeichnis: ${entry.name}`);
        this.copyDirectory(srcPath, destPath);
      } else {
        logger.debug(`Kopiere Datei: ${entry.name}`);
        fs.copyFileSync(srcPath, destPath);
      }
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
      // Lade Profil
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
      fs.copyFileSync(modFilePath, targetPath);
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
