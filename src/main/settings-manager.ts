import { ipcMain } from 'electron';
import * as path from 'path';
import Store from 'electron-store';
import { logger } from './main';

export class SettingsManager {
  private store: Store;
  private appDataPath: string;

  constructor(store: Store, appDataPath: string) {
    this.store = store;
    this.appDataPath = appDataPath;
    this.setupIpcHandlers();
  }

  private setupIpcHandlers(): void {
    // Lade Einstellungen
    ipcMain.handle('load-settings', () => {
      logger.debug('Handler: load-settings aufgerufen');
      const settings: any = this.store.get('settings', {
        defaultModFolder: '',
        gamePath: '',
        theme: 'light',
        autoCheckUpdates: true,
        language: 'de',
        debugLogging: false
      });
        
      logger.enableDebug(settings.debugLogging as boolean);
      logger.debug('Einstellungen geladen');
      return settings;
    });

    // Speichere Einstellungen
    ipcMain.handle('save-settings', (_, settings: any) => {
      logger.debug('Handler: save-settings aufgerufen');
      this.store.set('settings', settings);
      
      // Debug-Logging-Status aktualisieren
      if (settings.debugLogging !== undefined) {
        logger.enableDebug(settings.debugLogging);
        logger.info(`Debug-Logging wurde auf ${settings.debugLogging ? 'aktiviert' : 'deaktiviert'} gesetzt`);
      }
      
      return { success: true };
    });

    // Toggle Debug Logging
    ipcMain.handle('toggle-debug-logging', (_, enabled) => {
      logger.info(`Debug-Logging wird ${enabled ? 'aktiviert' : 'deaktiviert'}`);
      logger.enableDebug(enabled);
      
      // Speichere den Logging-Status in den Einstellungen
      const settings = this.store.get('settings', {}) as any;
      settings.debugLogging = enabled;
      this.store.set('settings', settings);
      
      logger.debug('Debug-Logging-Status in Einstellungen gespeichert');
      return { success: true };
    });
  }
}
