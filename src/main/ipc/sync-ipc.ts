import { ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { profileManager, logger, getModSyncManager, getWindowManager, appDataPath } from '../main';

export function setupSyncIpcHandlers(): void {
  // FastDL/ModList URL validieren
  ipcMain.handle('check-fastdl-url', async (_, serverUrl) => {
    logger.debug(`Handler: check-fastdl-url aufgerufen für Server ${serverUrl}`);
    try {
      if (!serverUrl || (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://'))) {
        return { success: false, error: 'Ungültige URL. Muss mit http:// oder https:// beginnen.' };
      }
      const syncManager = getModSyncManager();
      const serverMods = await syncManager.fetchServerModList(serverUrl);
      return { success: true, count: serverMods.length };
    } catch (error) {
      logger.error(`Fehler beim Prüfen der FastDL-URL ${serverUrl}:`, error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Profil-Synchronisation starten
  ipcMain.handle('sync-profile', async (event, profileId: string) => {
    const profile = await profileManager.getProfile(profileId);
    logger.info('Syncing profile: ' + profileId);
    const syncManager = getModSyncManager();
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();

    if (profile && (profile.serverModListUrl || profile.serverSyncUrl || profile.serverWebStatsUrl)) {
      try {
        const sendProgress = (progress: any) => {
          if (mainWindow) {
            mainWindow.webContents.send('sync-progress', progress);
          }
        };

        await syncManager.syncProfile(profile, sendProgress);
        if (mainWindow) {
          mainWindow.webContents.send('sync-complete');
        }
        return { success: true };
      } catch (error) {
        if (mainWindow) {
          mainWindow.webContents.send('sync-error', error instanceof Error ? error.message : String(error));
        }
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
    return { success: false, error: 'Keine Server-URL konfiguriert' };
  });

  // Synchronisation abbrechen
  ipcMain.handle('abort-sync', () => {
    logger.debug('Handler: abort-sync aufgerufen');
    getModSyncManager().abortSync();
    return { success: true };
  });

  // Synchronisation pausieren
  ipcMain.handle('pause-sync', () => {
    logger.debug('Handler: pause-sync aufgerufen');
    getModSyncManager().pauseSync();
    return { success: true };
  });

  // Synchronisation fortsetzen
  ipcMain.handle('resume-sync', () => {
    logger.debug('Handler: resume-sync aufgerufen');
    getModSyncManager().resumeSync();
    return { success: true };
  });

  // Aktuellen Mod überspringen (reiner Skip)
  ipcMain.handle('skip-current-mod', () => {
    logger.debug('Handler: skip-current-mod aufgerufen');
    getModSyncManager().skipCurrentMod('skip');
    return { success: true };
  });

  // Lokale Datei auswählen und als Skip-Ersatz kopieren
  ipcMain.handle('provide-local-mod', async (_, targetFileName, profileId) => {
    logger.debug('Handler: provide-local-mod aufgerufen');
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();
    
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Lokale Mod-Datei auswählen',
      filters: [{ name: 'Zip-Archive', extensions: ['zip'] }],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const sourcePath = result.filePaths[0];
      try {
        const profilePath = path.join(appDataPath, 'profiles', profileId, 'profile.json');
        if (fs.existsSync(profilePath)) {
           const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
           const destPath = path.join(profileData.modFolderPath, targetFileName);
           
           fs.copyFileSync(sourcePath, destPath);
           logger.info(`Lokale Mod-Datei erfolgreich kopiert nach ${destPath}`);
           
           getModSyncManager().skipCurrentMod('local');
           return { success: true };
        }
      } catch (error) {
        logger.error(`Fehler beim Kopieren der lokalen Mod-Datei: ${error}`);
        return { success: false, error: String(error) };
      }
    }
    return { success: false, error: 'Keine Datei ausgewählt' };
  });

  // Bestimmte Mods des Profils zur Synchronisation zwingen (Bulk Action)
  ipcMain.handle('force-sync-mods', async (event, profileId: string, modIds: string[]) => {
    const profile = await profileManager.getProfile(profileId);
    const syncManager = getModSyncManager();
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();

    if (profile && (profile.serverModListUrl || profile.serverSyncUrl || profile.serverWebStatsUrl)) {
      try {
        const sendProgress = (progress: any) => {
          if (mainWindow) {
            mainWindow.webContents.send('sync-progress', progress);
          }
        };
        await syncManager.syncProfile(profile, sendProgress, modIds);
        return { success: true };
      } catch (error) {
        logger.error('Fehler bei force-sync-mods: ' + error);
        if (mainWindow) {
          mainWindow.webContents.send('sync-error', error instanceof Error ? error.message : String(error));
        }
        return { success: false, error: String(error) };
      }
    }
    return { success: false, error: 'Profil oder Server-URL nicht gefunden.' };
  });
}
