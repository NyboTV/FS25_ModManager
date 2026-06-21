import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { profileManager, logger, getModSyncManager } from '../main';
import { modHubService } from '../modhub-service';

// We get fileOperationsManager dynamically since it's initialized on app ready
import { getFileOperationsManager } from '../main';

let activeModsWatcher: fs.FSWatcher | null = null;
let watchTimeout: NodeJS.Timeout | null = null;

export function setupProfileIpcHandlers(): void {
  ipcMain.on('watch-profile-mods', async (event, profileId: string) => {
    if (activeModsWatcher) {
      try {
        activeModsWatcher.close();
      } catch (e) {}
      activeModsWatcher = null;
    }
    if (watchTimeout) {
      clearTimeout(watchTimeout);
      watchTimeout = null;
    }

    if (!profileId) return;

    try {
      const profile = await profileManager.getProfile(profileId);
      if (profile && profile.modFolderPath && fs.existsSync(profile.modFolderPath)) {
        logger.info(`Starte Dateisystem-Watcher für: ${profile.modFolderPath}`);
        activeModsWatcher = fs.watch(profile.modFolderPath, (eventType: string, filename: string | null) => {
          if (filename && (filename.endsWith('.zip') || filename.endsWith('.ms2') || filename === 'profile.json')) {
            // Ignoriere Watch-Events während aktiver Synchronisation, Mapping oder Downloads, da am Ende ohnehin neu geladen wird
            const syncManager = getModSyncManager();
            if (syncManager && syncManager.isSyncing()) return;
            if (modHubService && (modHubService.isMappingActive() || modHubService.hasActiveDownloads())) return;

            if (watchTimeout) clearTimeout(watchTimeout);
            watchTimeout = setTimeout(() => {
              logger.info(`Änderung im Mods-Ordner erkannt (${filename}). Trigger Reload.`);
              try {
                event.sender.send('profile-mods-changed');
              } catch (e) {
                // Sender could be destroyed if app closed
              }
            }, 1000); // Erhöht auf 1000ms Debounce
          }
        });
      }
    } catch (err) {
      logger.error('Fehler im watch-profile-mods Handler:', err);
    }
  });

  ipcMain.handle('toggle-mod', async (event, profileId: string, modId: string, isActive: boolean) => {
    try {
      const profile = await profileManager.getProfile(profileId);
      if (profile) {
        const mod = profile.mods.find((m: any) => m.fileName === modId);
        if (mod) {
          mod.isActive = isActive;
          await profileManager.saveProfile(profile);
          return { success: true };
        }
      }
      return { success: false, error: 'Profil oder Mod nicht gefunden' };
    } catch (error) {
      logger.error('Fehler bei toggle-mod: ' + error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('delete-mod', async (event, profileId: string, modId: string) => {
    try {
      const profile = await profileManager.getProfile(profileId);
      if (profile) {
        const mod = profile.mods.find((m: any) => m.fileName === modId);
        if (mod) {
          const modFilePath = path.join(profile.modFolderPath, mod.fileName);
          if (fs.existsSync(modFilePath)) {
            try {
              fs.unlinkSync(modFilePath);
            } catch (err) {
              logger.error(`Fehler beim physischen Löschen des Mods ${modFilePath}:`, err);
            }
          }
          profile.mods = profile.mods.filter((m: any) => m.fileName !== modId);
          await profileManager.saveProfile(profile);
          return { success: true };
        }
      }
      return { success: false, error: 'Profil oder Mod nicht gefunden' };
    } catch (error) {
      logger.error('Fehler bei delete-mod: ' + error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('toggle-mods-bulk', async (event, profileId: string, modIds: string[], isActive: boolean) => {
    const profile = await profileManager.getProfile(profileId);
    if (profile) {
      let changed = false;
      profile.mods.forEach((m: any) => {
        if (modIds.includes(m.fileName) && m.isActive !== isActive) {
          m.isActive = isActive;
          changed = true;
        }
      });
      if (changed) {
        await profileManager.saveProfile(profile);
        return true;
      }
    }
    return false;
  });

  ipcMain.handle('delete-mods-bulk', async (event, profileId: string, modIds: string[]) => {
    const profile = await profileManager.getProfile(profileId);
    if (profile) {
      const modFolderPath = profile.modFolderPath;
      let deletedCount = 0;
      
      modIds.forEach(modId => {
        const mod = profile.mods.find((m: any) => m.fileName === modId);
        if (mod && mod.fileName) {
          const modFilePath = path.join(modFolderPath, mod.fileName);
          if (fs.existsSync(modFilePath)) {
            try {
              fs.unlinkSync(modFilePath);
            } catch (err) {
              logger.error(`Fehler beim Löschen der Mod-Datei: ${modFilePath}`, err);
            }
          }
          deletedCount++;
        }
      });
      
      if (deletedCount > 0) {
        profile.mods = profile.mods.filter((m: any) => !modIds.includes(m.fileName));
        await profileManager.saveProfile(profile);
        return true;
      }
    }
    return false;
  });

  ipcMain.handle('add-mod-to-profile', async (event, profileId: string, modFilePath: string) => {
    try {
      const fileOperationsManager = getFileOperationsManager();
      if (!fileOperationsManager) throw new Error('FileOperationsManager nicht initialisiert');
      return await fileOperationsManager.addModToProfile(profileId, modFilePath);
    } catch (error) {
      logger.error(`Fehler im add-mod-to-profile Handler: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
