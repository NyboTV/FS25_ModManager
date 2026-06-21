import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import Store from 'electron-store';
import { Logger } from './logger';
import { WindowManager } from './window-manager';
import { ProfileManager } from './profile-manager';
import { SettingsManager } from './settings-manager';
import { ModSyncManager } from './mod-sync-manager';
import { FileOperationsManager } from './file-operations-manager';
import { GameLaunchManager } from './game-launch-manager';
import { ModDescManager } from './mod-desc-manager';
import { ModInfoExtractor } from './mod-info-extractor';
import { modHubService } from './modhub-service';
import { UpdateManager } from './update-manager';
import { LogAnalyzer } from './log-analyzer';
import { ModInfo, Profile, Settings } from '../common/types';
import { decodeHtmlEntities } from '../common/utils';

// Konfiguration des Speicherorts für Anwendungsdaten mit app.getPath
const appDataPath = path.join(app.getPath('documents'), 'FS_ModManager');


// Stelle sicher, dass das Verzeichnis existiert
if (!fs.existsSync(appDataPath)) {
  fs.mkdirSync(appDataPath, { recursive: true });
}

// Elektronenspeicher für Einstellungen
const store = new Store({
  cwd: appDataPath
});

// Aktuelle Version aus package.json laden
const packageJson = require('../../package.json');
const currentVersion = packageJson.version || '1.0.0';

// Manager-Instanzen
let windowManager: WindowManager;
let profileManager: ProfileManager;
let settingsManager: SettingsManager;
let modSyncManager: ModSyncManager;
let fileOperationsManager: FileOperationsManager;
let gameLaunchManager: GameLaunchManager;
let modDescManager: ModDescManager;
let updateManager: UpdateManager;
let logAnalyzer: LogAnalyzer;

// Logger-Instanz mit appDataPath erzeugen
export const logger = new Logger(appDataPath);

// Setze Anwendungsnamen
app.setName('FS25 Mod Manager');

// Logging-Status aus den Einstellungen laden
const settings = store.get('settings', {
  debugLogging: false,
  language: 'de',
  currentVersion: currentVersion,
  autoCheckUpdates: true
}) as { debugLogging: boolean; language: 'en' | 'de'; currentVersion: string; autoCheckUpdates: boolean };

logger.enableDebug(settings.debugLogging);
logger.info('FS25 Mod Manager wird gestartet');

import axios from 'axios';

// Electronapp wird initialisiert und bereit
app.on('ready', () => {
  logger.info('Elektron-App bereit, erstelle Hauptfenster');
  
  // Initialisiere alle Manager
  windowManager = new WindowManager(store);
  profileManager = new ProfileManager(appDataPath, true);
  settingsManager = new SettingsManager(store, appDataPath);
  modSyncManager = new ModSyncManager(appDataPath);
  fileOperationsManager = new FileOperationsManager(appDataPath, () => windowManager.getMainWindow());
  gameLaunchManager = new GameLaunchManager();
  modDescManager = new ModDescManager();
  updateManager = new UpdateManager(currentVersion);
  logAnalyzer = new LogAnalyzer(store);
  
  // Erstelle das Hauptfenster
  const mainWindow = windowManager.createWindow();

  // DevTools automatisch öffnen im Entwicklungsmodus
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Speichere Fenstergröße und -position beim Schließen
  mainWindow.on('close', () => {
    if (!mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', bounds);
    }
    store.set('isMaximized', mainWindow.isMaximized());
  });
  
  // UpdateManager initialisieren
  updateManager.setWindow(mainWindow);
  
  // Prüfe auf Updates beim Start wenn aktiviert
  if (settings.autoCheckUpdates) {
    updateManager.checkForUpdates();
  }
  // IPC Handler für neue Features
  ipcMain.handle('check-for-updates', async () => {
    return await updateManager.checkForUpdates();
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Hinzugefügt: Lokales ModHub-Mapping starten
  ipcMain.on('start-modhub-mapping', async (event, profileId) => {
    try {
      logger.info(`Starte lokales ModHub-Mapping für Profil ${profileId}`);
      
      const profilePath = path.join(app.getPath('documents'), 'FS_ModManager', 'profiles', profileId, 'mods');
      const extractor = new ModInfoExtractor();
      const mods = await extractor.extractAllModsInfo(profilePath);
      
      const webContents = windowManager.getMainWindow()?.webContents;
      if (webContents) {
        await modHubService.mapMods(mods, webContents);
      }
    } catch (error) {
      logger.error('Fehler beim ModHub-Mapping: ' + (error instanceof Error ? error.message : String(error)));
    }
  });

  ipcMain.on('force-modhub-updates', async (event, profileId) => {
    try {
      logger.info(`Starte manuelle Update-Prüfung über ModHub-IDs für Profil ${profileId}`);
      if (mainWindow) {
        const profile = await profileManager.getProfile(profileId);
        if (profile && profile.mods) {
          const modIds = profile.mods.map((m: any) => m.modHubId).filter((id: string | undefined) => id && id !== '!');
          await modHubService.forceCheckUpdates(mainWindow.webContents, modIds);
        }
      }
    } catch (error) {
      logger.error('Fehler bei force-modhub-updates: ' + (error instanceof Error ? error.message : String(error)));
    }
  });

  ipcMain.handle('fetch-server-stats', async (event, url: string) => {
    try {
      const axios = require('axios');
      const response = await axios.get(url, { timeout: 10000 });
      if (response.status === 200) {
        const content = response.data.toString();
        const nameMatch = content.match(/<Server[^>]*\bname="([^"]+)"/i);
        const gameMatch = content.match(/<Server[^>]*\bgame="([^"]+)"/i);
        const mapMatch = content.match(/<Server[^>]*\bmapName="([^"]+)"/i);
        const versionMatch = content.match(/<Server[^>]*\bversion="([^"]+)"/i);
        const capacityMatch = content.match(/<Slots[^>]*\bcapacity="(\d+)"/i);
        const numUsedMatch = content.match(/<Slots[^>]*\bnumUsed="(\d+)"/i);
        const moneyMatch = content.match(/<Server[^>]*\bmoney="(\d+)"/i);
        
        const serverName = nameMatch ? decodeHtmlEntities(nameMatch[1]) : 'Unknown';
        const game = gameMatch ? decodeHtmlEntities(gameMatch[1]) : 'Unknown';
        const mapName = mapMatch ? decodeHtmlEntities(mapMatch[1]) : 'Unknown';
        const version = versionMatch ? versionMatch[1] : 'Unknown';
        const capacity = capacityMatch ? parseInt(capacityMatch[1]) : 0;
        const money = moneyMatch ? parseInt(moneyMatch[1]) : 0;
        
        let playersOnline = 0;
        if (numUsedMatch) {
            playersOnline = parseInt(numUsedMatch[1]);
        } else {
            const slotsMatch = content.match(/<Player[^>]*\bisUsed="true"/gi);
            playersOnline = slotsMatch ? slotsMatch.length : 0;
        }
        
        return { success: true, stats: { serverName, game, mapName, version, capacity, playersOnline, money } };
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
    return { success: false };
  });

  ipcMain.handle('check-server-updates', async (event, profile: any) => {
    if (!profile || !profile.serverSyncUrl) return { success: false, updates: 0 };
    try {
      const axios = require('axios');
      const response = await axios.get(profile.serverSyncUrl, { timeout: 10000 });
      if (response.status === 200) {
        const content = response.data.toString();
        let updatesCount = 0;
        const modRegex = /<Mod[^>]+name="([^"]+)"[^>]+version="([^"]+)"/g;
        let match;
        while ((match = modRegex.exec(content)) !== null) {
            const modName = decodeHtmlEntities(match[1]);
            const serverVer = match[2];
            const localMod = profile.mods.find((m: any) => m.fileName === modName + '.zip');
            if (!localMod) {
                updatesCount++;
            } else if (localMod.modDescData?.version && localMod.modDescData.version !== serverVer) {
                updatesCount++;
            }
        }
        return { success: true, updates: updatesCount };
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
    return { success: false };
  });

  ipcMain.handle('select-folder', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle('select-file', async (event, options = {}) => {
    const { dialog } = require('electron');
    
    // Standard properties
    let properties = ['openFile'];
    
    // Erweitere properties basierend auf options
    if (options.properties) {
      properties = options.properties;
    }
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: properties,
      filters: options.filters || [
        { name: 'Executable Files', extensions: ['exe'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return result.canceled ? null : { filePaths: result.filePaths };
  });

  ipcMain.handle('toggle-mod', async (event, profileId: string, modId: string, isActive: boolean) => {
    const profile = await profileManager.getProfile(profileId);
    if (profile) {
      const mod = profile.mods.find((m: any) => m.fileName === modId);
      if (mod) {
        mod.isActive = isActive;
        await profileManager.saveProfile(profile);
        return true;
      }
    }
    return false;
  });

  ipcMain.handle('delete-mod', async (event, profileId: string, modId: string) => {
    const profile = await profileManager.getProfile(profileId);
    if (profile) {
      const mod = profile.mods.find((m: any) => m.fileName === modId);
      if (mod && mod.fileName) {
        // Datei im Mod-Ordner löschen
        const modFilePath = path.join(profile.modFolderPath, 'mods', mod.fileName);
        if (fs.existsSync(modFilePath)) {
          try {
            fs.unlinkSync(modFilePath);
          } catch (err) {
            logger.error(`Fehler beim Löschen der Mod-Datei: ${modFilePath}`, err);
          }
        }
      }
      profile.mods = profile.mods.filter((m: any) => m.fileName !== modId);
      await profileManager.saveProfile(profile);
      return true;
    }
    return false;
  });

  ipcMain.handle('sync-profile', async (event, profileId: string) => {
    const profile = await profileManager.getProfile(profileId);
    console.log('Syncing profile:', profileId);
    if (profile && profile.serverSyncUrl) {
      try {
        // Sende Progress-Updates
        const sendProgress = (progress: any) => {
          mainWindow.webContents.send('sync-progress', progress);
        };

        await modSyncManager.syncProfile(profile, sendProgress);
        mainWindow.webContents.send('sync-complete');
        return { success: true };
      } catch (error) {
        mainWindow.webContents.send('sync-error', error instanceof Error ? error.message : String(error));
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
    return { success: false, error: 'Keine Server-URL konfiguriert' };
  });

  ipcMain.handle('add-mod-to-profile', async (event, profileId: string, modFilePath: string) => {
    try {
      if (!fileOperationsManager) throw new Error('FileOperationsManager nicht initialisiert');
      return await fileOperationsManager.addModToProfile(profileId, modFilePath);
    } catch (error) {
      logger.error(`Fehler im add-mod-to-profile Handler: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
});

// Quit wenn alle Fenster geschlossen sind
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!windowManager.getMainWindow()) {
    windowManager.createWindow();
  }
});

