import { ipcMain, app, dialog } from 'electron';
import axios from 'axios';
import { 
  profileManager, 
  logger, 
  getWindowManager, 
  getUpdateManager, 
  currentVersion 
} from '../main';
import { modHubService } from '../modhub-service';
import { ModInfoExtractor } from '../mod-info-extractor';
import { decodeHtmlEntities } from '../../common/utils';

export function setupGameIpcHandlers(): void {
  // Update-Abfragen
  ipcMain.handle('check-for-updates', async () => {
    return await getUpdateManager().checkForUpdates();
  });

  ipcMain.handle('set-beta-updates', async (event, allow: boolean) => {
    getUpdateManager().setAllowPrerelease(allow);
    return true;
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Renderer Logging
  ipcMain.on('renderer-log', (event, level, ...args) => {
    const message = `[Frontend] ${args.join(' ')}`;
    switch(level) {
      case 'info': logger.info(message); break;
      case 'warn': logger.warn(message); break;
      case 'error': logger.error(message); break;
      default: logger.debug(message);
    }
  });

  // ModHub Mapping
  ipcMain.on('start-modhub-mapping', async (event, profileId) => {
    try {
      logger.info(`Starte lokales ModHub-Mapping für Profil ${profileId}`);
      
      const profile = await profileManager.getProfile(profileId);
      if (!profile) return;
        
      const profilePath = profile.modFolderPath;
      const extractor = new ModInfoExtractor();
      const mods = await extractor.extractAllModsInfo(profilePath);
      
      if (profile && profile.mods) {
        mods.forEach(m => {
          const profileMod = profile.mods.find((pm: any) => pm.fileName === m.fileName);
          if (profileMod) {
            m.modHub = profileMod.modHub;
            logger.debug(`[ModHub Injection] ${m.fileName} hat modHub='${m.modHub}' aus Profil. (isActive: ${profileMod.isActive})`);
          } else {
            logger.debug(`[ModHub Injection] ${m.fileName} wurde NICHT im Profil gefunden.`);
          }
        });
      } else {
        logger.warn(`[ModHub Injection] Profil oder profile.mods ist leer! profileId=${profileId}`);
      }
      
      const windowManager = getWindowManager();
      const webContents = windowManager.getMainWindow()?.webContents;
      if (webContents) {
        await modHubService.mapMods(profileId, profile.name, mods, webContents);
      }
    } catch (error) {
      logger.error('Fehler beim ModHub-Mapping: ' + (error instanceof Error ? error.message : String(error)));
    }
  });

  ipcMain.on('cancel-modhub-mapping', () => {
    modHubService.cancelMapping();
  });

  ipcMain.on('download-modhub-mod', async (event, profileId, fileName, modId, modDetail) => {
    try {
      await modHubService.downloadMod(profileId, fileName, modId, event.sender, modDetail);
    } catch (err) {
      logger.error('Fehler beim Download des ModHub Mods', err);
    }
  });

  ipcMain.on('cancel-mod-download', (event, modId) => {
    modHubService.cancelDownload(modId);
  });

  ipcMain.on('force-modhub-updates', async (event, profileId) => {
    try {
      logger.info(`Starte manuelle Update-Prüfung über ModHub-IDs für Profil ${profileId}`);
      const windowManager = getWindowManager();
      const mainWindow = windowManager.getMainWindow();
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

  // Dedicated Server Stats & Updates
  ipcMain.handle('fetch-server-stats', async (event, url: string) => {
    try {
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
    if (!profile || !profile.serverWebStatsUrl) return { success: false, count: 0 };
    try {
      const response = await axios.get(profile.serverWebStatsUrl, { timeout: 10000 });
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
        return { success: true, count: updatesCount };
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
    return { success: false };
  });

  // Dialogauswahlen
  ipcMain.handle('select-folder', async () => {
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('select-file', async (event, options = {}) => {
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();
    
    let properties = ['openFile'];
    if (options.properties) {
      properties = options.properties;
    }
    
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: properties as any,
      filters: options.filters || [
        { name: 'Executable Files', extensions: ['exe'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return result.canceled ? null : result;
  });
}
