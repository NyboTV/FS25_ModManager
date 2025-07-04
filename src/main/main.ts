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
import { UpdateManager } from './update-manager';

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
  
  // Prüfe auf Updates beim Start wenn aktiviert
  if (settings.autoCheckUpdates) {
    updateManager.checkForUpdates()
      .then(updateInfo => {
        if (updateInfo.hasUpdate) {
          mainWindow.webContents.send('update-available', updateInfo);
        }
      })
      .catch(error => logger.error('Fehler beim Prüfen auf Updates:', error));
  }

  // IPC Handler für neue Features
  ipcMain.handle('check-for-updates', async () => {
    return await updateManager.checkForUpdates();
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
      const mod = profile.mods.find((m: any) => m.id === modId);
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
      const mod = profile.mods.find((m: any) => m.id === modId);
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
      profile.mods = profile.mods.filter((m: any) => m.id !== modId);
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

