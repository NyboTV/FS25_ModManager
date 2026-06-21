import { autoUpdater } from 'electron-updater';
import { UpdateInfo } from '../common/types';
import { logger } from './main';
import { ipcMain } from 'electron';

export class UpdateManager {
  private readonly currentVersion: string;
  private mainWindow: Electron.BrowserWindow | null = null;

  constructor(currentVersion: string) {
    this.currentVersion = currentVersion;
    
    // Konfiguration für GitHub Releases
    autoUpdater.logger = logger;
    autoUpdater.autoDownload = false; // Wir fragen den User erst
    
    // Events
    autoUpdater.on('checking-for-update', () => {
      logger.info('Suche nach Updates...');
    });
    
    autoUpdater.on('update-available', (info) => {
      logger.info(`Update verfügbar: ${info.version}`);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-available', {
          hasUpdate: true,
          currentVersion: this.currentVersion,
          latestVersion: info.version,
          releaseNotes: info.releaseNotes as string || 'Bugfixes und Verbesserungen.'
        });
      }
    });
    
    autoUpdater.on('update-not-available', (info) => {
      logger.info('Kein Update verfügbar.');
    });
    
    autoUpdater.on('error', (err) => {
      logger.error('Fehler beim Updater: ' + err);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-error', err.message || err.toString());
      }
    });
    
    autoUpdater.on('download-progress', (progressObj) => {
      let log_message = 'Download speed: ' + progressObj.bytesPerSecond;
      log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
      logger.debug(log_message);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-download-progress', {
          percent: progressObj.percent,
          speed: progressObj.bytesPerSecond
        });
      }
    });
    
    autoUpdater.on('update-downloaded', (info) => {
      logger.info('Update heruntergeladen!');
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-downloaded');
      }
    });

    // IPC Handler für User-Interaktionen
    ipcMain.handle('download-update', () => {
      logger.info('Starte Download des Updates...');
      autoUpdater.downloadUpdate();
    });

    ipcMain.handle('install-update', () => {
      logger.info('Beende App und installiere Update...');
      autoUpdater.quitAndInstall(false, true);
    });
  }

  public setWindow(window: Electron.BrowserWindow) {
    this.mainWindow = window;
  }

  /**
   * Prüft auf Updates
   */
  async checkForUpdates(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      logger.error('Fehler beim Prüfen auf Updates: ' + error);
    }
  }
}
