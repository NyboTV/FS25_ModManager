import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';
import { Logger } from './logger';
import { WindowManager } from './window-manager';
import { ProfileManager } from './profile-manager';
import { SettingsManager } from './settings-manager';
import { ModSyncManager } from './sync/mod-sync-manager';
import { FileOperationsManager } from './file-operations-manager';
import { GameLaunchManager } from './game-launch-manager';
import { ModDescManager } from './mod-desc-manager';
import { UpdateManager } from './update-manager';
import { LogAnalyzer } from './log-analyzer';

// IPC Registrierungen importieren
import { setupProfileIpcHandlers } from './ipc/profile-ipc';
import { setupSyncIpcHandlers } from './ipc/sync-ipc';
import { setupGameIpcHandlers } from './ipc/game-ipc';

// Konfiguration des Speicherorts für Anwendungsdaten
export const appDataPath = path.join(app.getPath('documents'), 'FS_ModManager');

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
export const currentVersion = packageJson.version || '1.0.0';

// Logger-Instanz erzeugen
export const logger = new Logger(appDataPath);

// Manager-Instanzen
let windowManager: WindowManager;
export let profileManager: ProfileManager;
let settingsManager: SettingsManager;
let modSyncManager: ModSyncManager;
let fileOperationsManager: FileOperationsManager;
let gameLaunchManager: GameLaunchManager;
let modDescManager: ModDescManager;
let updateManager: UpdateManager;
let logAnalyzer: LogAnalyzer;

// Getters für die Module
export function getWindowManager() { return windowManager; }
export function getSettingsManager() { return settingsManager; }
export function getModSyncManager() { return modSyncManager; }
export function getFileOperationsManager() { return fileOperationsManager; }
export function getUpdateManager() { return updateManager; }

// Setze Anwendungsnamen
app.setName('FS Mod Manager');

// Logging-Status aus den Einstellungen laden
const settings = store.get('settings', {
  debugLogging: false,
  language: 'de',
  currentVersion: currentVersion,
  autoCheckUpdates: true,
  betaUpdates: false
}) as { debugLogging: boolean; language: 'en' | 'de' | 'fr'; currentVersion: string; autoCheckUpdates: boolean; betaUpdates: boolean };

logger.enableDebug(settings.debugLogging);
logger.info('FS Mod Manager wird gestartet');

// Electronapp wird initialisiert und bereit
app.on('ready', () => {
  logger.info('Elektron-App bereit, erstelle Hauptfenster');
  
  import('electron').then(({ session }) => {
    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: ['*://*.giants-software.com/*'] },
      (details, callback) => {
        details.requestHeaders['Referer'] = 'https://www.farming-simulator.com/';
        callback({ requestHeaders: details.requestHeaders });
      }
    );
  });
  
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
  if (settings.betaUpdates) {
    updateManager.setAllowPrerelease(true);
  }
  
  // Prüfe auf Updates beim Start wenn aktiviert
  if (settings.autoCheckUpdates) {
    updateManager.checkForUpdates();
  }

  // Setup modularisierte IPC Handlers
  setupProfileIpcHandlers();
  setupSyncIpcHandlers();
  setupGameIpcHandlers();
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

app.on('activate', () => {
  if (!windowManager.getMainWindow()) {
    windowManager.createWindow();
  }
});

