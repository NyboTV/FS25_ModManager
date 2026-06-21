import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './main';
import { ModInfoExtractor } from './mod-info-extractor';
import { modHubService } from './modhub-service';

export class ProfileManager {
  private appDataPath: string;
  private modInfoExtractor: ModInfoExtractor;
  private static ipcHandlersRegistered = false;

  constructor(appDataPath: string, registerIpcHandlers: boolean = false) {
    this.appDataPath = appDataPath;
    this.modInfoExtractor = new ModInfoExtractor();
    if (registerIpcHandlers && !ProfileManager.ipcHandlersRegistered) {
      this.setupIpcHandlers();
      ProfileManager.ipcHandlersRegistered = true;
    }
  }

  private injectModHubData(profileData: any) {
    if (!profileData || !profileData.mods) return profileData;
    profileData.mods.forEach((mod: any) => {
      const mappingData = modHubService.getMapping(mod.fileName);
      if (mappingData && !mappingData.failed && mappingData.modId !== '!') {
        mod.modHubId = mappingData.modId;
        mod.modHubCategory = mappingData.category;
        mod.modHubVersion = mappingData.version;
        mod.modHubRating = mappingData.rating;
        mod.modHubVotes = mappingData.votes;
        mod.modHubSize = mappingData.size;
        mod.modHubReleased = mappingData.released;
        mod.modHubPlatform = mappingData.platform;
        mod.modHubManufacturer = mappingData.manufacturer;
      }
    });
    return profileData;
  }

  private setupIpcHandlers(): void {
    // Lade Profile
    ipcMain.handle('load-profiles', async () => {
      logger.debug('Handler: load-profiles aufgerufen');
      try {
        const profilesPath = path.join(this.appDataPath, 'profiles');
        if (!fs.existsSync(profilesPath)) {
          logger.info(`Profilverzeichnis existiert nicht, erstelle: ${profilesPath}`);
          fs.mkdirSync(profilesPath, { recursive: true });
          return [];
        }
        logger.debug(`Lese Profile aus: ${profilesPath}`);
        const dirs = fs.readdirSync(profilesPath)
          .filter(item => {
            const itemPath = path.join(profilesPath, item);
            return fs.statSync(itemPath).isDirectory();
          });
          
        const profiles = [];
        for (const dir of dirs) {
          const profileData = await this.getProfile(dir);
          if (profileData) {
            profiles.push(profileData);
          }
        }
          
        logger.info(`${profiles.length} Profile erfolgreich geladen`);
        return profiles;
      } catch (error) {
        logger.error('Fehler beim Laden der Profile', error);
        return [];
      }
    });

    // Speichere Profil
    ipcMain.handle('save-profile', (_, profile) => {
      logger.debug(`Handler: save-profile aufgerufen für Profil ${profile.id} (${profile.name})`);
      try {
        // Erstelle Verzeichnisstruktur für das Profil
        const profilesPath = path.join(this.appDataPath, 'profiles');
        const profileModsPath = path.join(profilesPath, profile.id, 'mods');
        
        if (!fs.existsSync(profilesPath)) {
          fs.mkdirSync(profilesPath, { recursive: true });
        }
        if (!fs.existsSync(profileModsPath)) {
          fs.mkdirSync(profileModsPath, { recursive: true });
        }
        // Speichere die Profildaten in profile.json im mods-Ordner (bleibt im Profilordner, nicht im mods-Ordner)
        const profilePath = path.join(profilesPath, profile.id, 'profile.json');
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
        logger.info(`Profil erfolgreich gespeichert: ${profile.name} (ID: ${profile.id}) in ${profilePath}`);
        return { success: true };
      } catch (error) {
        logger.error(`Fehler beim Speichern des Profils ${profile.name}`, error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Lösche Profil
    ipcMain.handle('delete-profile', (_, profileId) => {
      logger.debug(`Handler: delete-profile aufgerufen für Profil ${profileId}`);
      try {        // Lösche das Profilverzeichnis mit allen Dateien (inkl. profile.json und mods)
        const profileDirPath = path.join(this.appDataPath, 'profiles', profileId);
        if (fs.existsSync(profileDirPath)) {
          logger.debug(`Lösche Profilverzeichnis: ${profileDirPath}`);
          fs.rmdirSync(profileDirPath, { recursive: true });
        } else {
          logger.warn(`Profilverzeichnis nicht gefunden: ${profileDirPath}`);
        }
        
        logger.info(`Profil mit ID ${profileId} erfolgreich gelöscht`);
        return { success: true };
      } catch (error) {
        logger.error(`Fehler beim Löschen des Profils ${profileId}`, error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Erstelle neues Profil
    ipcMain.handle('create-profile', (_, profile) => {
      logger.debug(`Handler: create-profile aufgerufen für neues Profil: ${profile.name}`);
      try {
        // Generiere eine eindeutige ID falls keine vorhanden
        if (!profile.id) {
          profile.id = 'profile_' + Date.now();
        }

        // Extrahiere Quell-Ordner für Mods falls vorhanden
        const copyFromFolder = profile._copyFromModFolder;
        delete profile._copyFromModFolder;

        // Erstelle Verzeichnisstruktur für das Profil
        const profilesPath = path.join(this.appDataPath, 'profiles');
        const profileDirPath = path.join(profilesPath, profile.id);
        const profileModsPath = path.join(profileDirPath, 'mods');
        const targetModFolderPath = profile.modFolderPath || profileModsPath;

        if (!fs.existsSync(profilesPath)) {
          fs.mkdirSync(profilesPath, { recursive: true });
        }
        if (!fs.existsSync(profileDirPath)) {
          fs.mkdirSync(profileDirPath, { recursive: true });
        }
        if (!fs.existsSync(targetModFolderPath)) {
          fs.mkdirSync(targetModFolderPath, { recursive: true });
        }

        const modsArray = [];
        // Kopiere Mods falls ausgewählt
        if (copyFromFolder && fs.existsSync(copyFromFolder)) {
           logger.info(`Kopiere Mods von ${copyFromFolder} nach ${targetModFolderPath}`);
           const files = fs.readdirSync(copyFromFolder);
           for (const file of files) {
             if (file.endsWith('.zip') || file.endsWith('.ms2')) {
               const src = path.join(copyFromFolder, file);
               const dest = path.join(targetModFolderPath, file);
               try {
                 fs.copyFileSync(src, dest);
                 modsArray.push({
                   name: file.replace(/\.(zip|ms2)$/i, ''),
                   version: '',
                   author: '',
                   fileName: file,
                   fileSize: fs.statSync(src).size.toString(),
                   modHub: '',
                   isActive: true,
                   downloadUrl: '',
                   detailUrl: ''
                 });
               } catch(e) {
                 logger.error(`Fehler beim Kopieren von ${file}`, e);
               }
             }
           }
        }

        // Initialisiere Profildaten mit Standardwerten
        const newProfile = {
          id: profile.id,
          name: profile.name || 'Neues Profil',
          serverSyncUrl: profile.serverSyncUrl || '',
          version: profile.version || '1.0.0',
          isActive: true,
          createdAt: new Date().toISOString(),
          lastSyncDate: null,
          ...profile, // Überschreibe mit übergebenen Daten (enthält ggf. andere modFolderPath, was wir gleich überschreiben)
          modFolderPath: targetModFolderPath,
          mods: [...(profile.mods || []), ...modsArray]
        };
        // Speichere die Profildaten in profile.json im Profilordner
        const profilePath = path.join(profilesPath, profile.id, 'profile.json');
        fs.writeFileSync(profilePath, JSON.stringify(newProfile, null, 2));
        logger.info(`Neues Profil erfolgreich erstellt: ${newProfile.name} (ID: ${newProfile.id}) in ${profilePath}`);
        return { success: true, profile: newProfile };
      } catch (error) {
        logger.error(`Fehler beim Erstellen des neuen Profils ${profile.name}`, error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Aktualisiere existierendes Profil
    ipcMain.handle('update-profile', (_, profile) => {
      logger.debug(`Handler: update-profile aufgerufen für Profil ${profile.id} (${profile.name})`);
      try {
        // Prüfe ob Profil existiert
        const profilesPath = path.join(this.appDataPath, 'profiles');
        const profilePath = path.join(profilesPath, profile.id, 'profile.json');
        if (!fs.existsSync(profilePath)) {
          throw new Error(`Profil mit ID ${profile.id} nicht gefunden`);
        }
        // Stelle sicher, dass mods-Ordner existiert
        const targetModFolderPath = profile.modFolderPath || path.join(profilesPath, profile.id, 'mods');
        if (!fs.existsSync(targetModFolderPath)) {
          fs.mkdirSync(targetModFolderPath, { recursive: true });
        }
        // Aktualisiere Profildaten
        const updatedProfile = {
          ...profile,
          modFolderPath: targetModFolderPath, // Behalte den korrekten Pfad bei
          updatedAt: new Date().toISOString()
        };
        // Speichere die aktualisierten Profildaten
        fs.writeFileSync(profilePath, JSON.stringify(updatedProfile, null, 2));
        logger.info(`Profil erfolgreich aktualisiert: ${updatedProfile.name} (ID: ${updatedProfile.id})`);
        return { success: true, profile: updatedProfile };
      } catch (error) {
        logger.error(`Fehler beim Aktualisieren des Profils ${profile.name}`, error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Lade Mod-Informationen für ein Profil
    ipcMain.handle('load-profile-mods', async (_, profileId) => {
      logger.debug(`Handler: load-profile-mods aufgerufen für Profil ${profileId}`);
      try {
        const profile = await this.getProfile(profileId);
        if (!profile) return [];
        
        const profileModsPath = profile.modFolderPath || path.join(this.appDataPath, 'profiles', profileId, 'mods');
        
        if (!fs.existsSync(profileModsPath)) {
          logger.warn(`Mods-Ordner existiert nicht: ${profileModsPath}`);
          return [];
        }
        
        // Extrahiere Mod-Informationen aus allen ZIP-Dateien
        const modInfos = await this.modInfoExtractor.extractAllModsInfo(profileModsPath);
        
        logger.info(`${modInfos.length} Mod-Informationen für Profil ${profileId} geladen`);
        return modInfos;
      } catch (error) {
        logger.error(`Fehler beim Laden der Mod-Informationen für Profil ${profileId}:`, error);
        return [];
      }
    });

    // Re-scan complete profile and force metadata extraction
    ipcMain.handle('rescan-profile-mods', async (_, profileId) => {
      logger.debug(`Handler: rescan-profile-mods aufgerufen für Profil ${profileId}`);
      try {
        const result = await this.rescanProfileMods(profileId);
        return { success: true, profile: result };
      } catch (error) {
        logger.error(`Fehler im Handler rescan-profile-mods für ${profileId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
  }

  /**
   * Erstellt ein neues Profil
   */
  async createProfile(profileData: any): Promise<any> {
    const profileId = profileData.id || `profile_${Date.now()}`;
    const modsPath = path.join(this.appDataPath, 'profiles', profileId, 'mods');
    const profile = {
      id: profileId,
      name: profileData.name,
      version: '1.0.0',
      description: profileData.description,
      serverSyncUrl: profileData.serverSyncUrl,
      modFolderPath: modsPath,
      mods: [],
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    await this.saveProfile(profile);
    return profile;
  }
  /**
   * Lädt ein Profil anhand der ID
   */
  async getProfile(profileId: string): Promise<any | null> {
    try {
      const profilePath = path.join(this.appDataPath, 'profiles', profileId, 'profile.json');
      if (!fs.existsSync(profilePath)) {
        return null;
      }
      const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      // --- Mods-Liste beim Laden immer mit Ordner abgleichen ---
      const modsDir = profileData.modFolderPath || path.join(this.appDataPath, 'profiles', profileId, 'mods');
      let profileChanged = false;

      if (fs.existsSync(modsDir)) {
        const modFiles = fs.readdirSync(modsDir).filter(f => f.endsWith('.zip') || f.endsWith('.ms2'));
        
        // 1. Filtere alle Mods aus der JSON raus, deren Datei nicht mehr existiert
        const initialCount = (profileData.mods || []).length;
        profileData.mods = (profileData.mods || []).filter((mod: any) => 
          modFiles.includes(mod.fileName) || 
          mod.isDLC === true || 
          mod.fileName.toLowerCase().startsWith('pdlc_')
        );
        if (profileData.mods.length !== initialCount) {
          profileChanged = true;
          logger.info(`Startup Check: Verwaiste Mods aus profile.json für ${profileData.name} entfernt.`);
        }
        
        // 2. Abgleich mit dem physischen Ordner
        for (const file of modFiles) {
          let existingMod = profileData.mods.find((mod: any) => mod.fileName === file);
          const filePath = path.join(modsDir, file);
          
          if (!existingMod) {
            // Mod existiert im Ordner, fehlt aber in der JSON
            logger.info(`Startup Check: Neuer Mod ${file} gefunden. Lese modDesc.xml aus.`);
            let name = file.replace(/\.(zip|ms2)$/i, '');
            let version = '';
            let author = '';
            let modDescData: any = {};
            
            try {
              const info = await this.modInfoExtractor.extractModInfo(filePath);
              if (info) {
                name = info.name || name;
                version = info.version || '';
                author = info.author || '';
                modDescData = {
                  author: info.author,
                  version: info.version,
                  title: { de: info.name, en: info.name },
                  description: { de: info.description, en: info.description },
                  iconFilename: info.iconFilename,
                  multiplayerSupported: info.multiplayer,
                  category: info.category || 'Unknown'
                };
              }
            } catch (err) {
              logger.error(`Fehler beim Extrahieren der modDesc für ${file}:`, err);
            }
            
            let fileSizeStr = '';
            try {
              const stats = fs.statSync(filePath);
              const fileSizeMB = stats.size / (1024 * 1024);
              fileSizeStr = fileSizeMB >= 1 ? `${fileSizeMB.toFixed(2)} MB` : `${(stats.size / 1024).toFixed(2)} KB`;
            } catch (e) {}
            
            existingMod = {
              name,
              version,
              author,
              fileName: file,
              fileSize: fileSizeStr,
              modHub: '',
              isActive: true,
              downloadUrl: '',
              detailUrl: '',
              modDescData
            };
            profileData.mods.push(existingMod);
            profileChanged = true;
          } else {
            // Mod existiert bereits. Falls wichtige Daten (wie version, author, name) fehlen oder die Dateigröße abweicht, extrahieren wir sie neu.
            let needsUpdate = false;

            let fileSizeStr = '';
            try {
              const stats = fs.statSync(filePath);
              const fileSizeMB = stats.size / (1024 * 1024);
              fileSizeStr = fileSizeMB >= 1 ? `${fileSizeMB.toFixed(2)} MB` : `${(stats.size / 1024).toFixed(2)} KB`;
            } catch (e) {}

            const isSizeDifferent = fileSizeStr && existingMod.fileSize && existingMod.fileSize !== fileSizeStr;

            if (!existingMod.version || !existingMod.author || !existingMod.name || 
                (existingMod.name === file.replace(/\.(zip|ms2)$/i, '') && !existingMod.modDescData) ||
                isSizeDifferent) {
              logger.info(`Startup Check: Kern-Daten auslesen oder Dateigrößen-Änderung erkannt für ${file}.`);
              try {
                const info = await this.modInfoExtractor.extractModInfo(filePath);
                if (info) {
                  existingMod.name = info.name || existingMod.name;
                  existingMod.version = info.version || existingMod.version;
                  existingMod.author = info.author || existingMod.author;
                  existingMod.modDescData = {
                    author: info.author,
                    version: info.version,
                    title: { de: info.name, en: info.name },
                    description: { de: info.description, en: info.description },
                    iconFilename: info.iconFilename,
                    multiplayerSupported: info.multiplayer,
                    category: info.category || 'Unknown'
                  };
                  if (fileSizeStr) {
                    existingMod.fileSize = fileSizeStr;
                  }
                  needsUpdate = true;
                }
              } catch (err) {
                logger.error(`Fehler beim Nachextrahieren der modDesc für ${file}:`, err);
              }
            }
            
            if (!existingMod.fileSize && fileSizeStr) {
              existingMod.fileSize = fileSizeStr;
              needsUpdate = true;
            }
            
            if (needsUpdate) {
              profileChanged = true;
            }
          }
          
          // ModHub Mapping prüfen und modHubId im profile.json Mod-Objekt hinterlegen
          const mappingData = modHubService.getMapping(file);
          if (mappingData && !mappingData.failed && mappingData.modId !== '!') {
            if (existingMod.modHubId !== mappingData.modId) {
              existingMod.modHubId = mappingData.modId;
              profileChanged = true;
            }
          }
        }
      } else {
        if ((profileData.mods || []).length > 0) {
          profileData.mods = [];
          profileChanged = true;
        }
      }
      
      if (profileChanged) {
        fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2), 'utf8');
        logger.info(`profile.json erfolgreich repariert und gespeichert für Profil ${profileData.name}`);
      }
      
      return this.injectModHubData(profileData);
    } catch (error) {
      logger.error(`Fehler beim Laden des Profils ${profileId}:`, error);
      return null;
    }
  }

  /**
   * Rescans the mods folder, forces metadata reload, updates versions/metadata on all mods, and saves profile.json
   */
  async rescanProfileMods(profileId: string): Promise<any> {
    try {
      const profilePath = path.join(this.appDataPath, 'profiles', profileId, 'profile.json');
      if (!fs.existsSync(profilePath)) {
        throw new Error(`Profil mit ID ${profileId} nicht gefunden`);
      }
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

      const modsDir = profile.modFolderPath || path.join(this.appDataPath, 'profiles', profileId, 'mods');
      if (!fs.existsSync(modsDir)) {
        throw new Error(`Mod-Ordner existiert nicht: ${modsDir}`);
      }

      logger.info(`ReScan: Starte erzwungenen Mod-ReScan für Profil ${profile.name}`);
      const modFiles = fs.readdirSync(modsDir).filter(f => f.endsWith('.zip') || f.endsWith('.ms2'));

      // 1. Bereinige verwaiste Mods (außer DLCs)
      profile.mods = (profile.mods || []).filter((mod: any) => 
        modFiles.includes(mod.fileName) || 
        mod.isDLC === true || 
        mod.fileName.toLowerCase().startsWith('pdlc_')
      );

      // 2. Lese alle Dateien komplett neu ein und überschreibe Daten
      for (const file of modFiles) {
        const filePath = path.join(modsDir, file);
        let existingMod = profile.mods.find((mod: any) => mod.fileName === file);

        let name = file.replace(/\.(zip|ms2)$/i, '');
        let version = '';
        let author = '';
        let modDescData: any = {};

        try {
          const info = await this.modInfoExtractor.extractModInfo(filePath);
          if (info) {
            name = info.name || name;
            version = info.version || '';
            author = info.author || '';
            modDescData = {
              author: info.author,
              version: info.version,
              title: { de: info.name, en: info.name },
              description: { de: info.description, en: info.description },
              iconFilename: info.iconFilename,
              multiplayerSupported: info.multiplayer,
              category: info.category || 'Unknown'
            };
          }
        } catch (err) {
          logger.error(`Fehler beim Extrahieren der modDesc während ReScan für ${file}:`, err);
        }

        let fileSizeStr = '';
        try {
          const stats = fs.statSync(filePath);
          const fileSizeMB = stats.size / (1024 * 1024);
          fileSizeStr = fileSizeMB >= 1 ? `${fileSizeMB.toFixed(2)} MB` : `${(stats.size / 1024).toFixed(2)} KB`;
        } catch (e) {}

        if (existingMod) {
          existingMod.name = name;
          existingMod.version = version;
          existingMod.author = author;
          existingMod.fileSize = fileSizeStr;
          existingMod.modDescData = modDescData;
        } else {
          existingMod = {
            name,
            version,
            author,
            fileName: file,
            fileSize: fileSizeStr,
            modHub: '',
            isActive: true,
            downloadUrl: '',
            detailUrl: '',
            modDescData
          };
          profile.mods.push(existingMod);
        }

        // ModHub Mapping zuweisen falls vorhanden
        const mappingData = modHubService.getMapping(file);
        if (mappingData && !mappingData.failed && mappingData.modId !== '!') {
          existingMod.modHubId = mappingData.modId;
          existingMod.modHubVersion = mappingData.version;
        }
      }

      await this.saveProfile(profile);
      logger.info(`ReScan für Profil ${profile.name} erfolgreich gespeichert.`);
      return this.injectModHubData(profile);
    } catch (error) {
      logger.error(`Fehler beim erzwungenen ReScan für Profil ${profileId}:`, error);
      throw error;
    }
  }
  /**
   * Speichert ein Profil
   */
  async saveProfile(profile: any): Promise<void> {
    try {
      const profileDirPath = path.join(this.appDataPath, 'profiles', profile.id);
      if (!fs.existsSync(profileDirPath)) {
        fs.mkdirSync(profileDirPath, { recursive: true });
      }

      profile.lastModified = new Date().toISOString();
      const profilePath = path.join(profileDirPath, 'profile.json');
      fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf8');
      
      logger.info(`Profil ${profile.name} erfolgreich gespeichert`);
    } catch (error) {
      logger.error(`Fehler beim Speichern des Profils ${profile.name}:`, error);
      throw error;
    }
  }
  /**
   * Löscht ein Profil
   */
  async deleteProfile(profileId: string): Promise<void> {
    try {
      const profileDirPath = path.join(this.appDataPath, 'profiles', profileId);
      if (fs.existsSync(profileDirPath)) {
        fs.rmSync(profileDirPath, { recursive: true, force: true });
        logger.info(`Profil ${profileId} erfolgreich gelöscht`);
      }
    } catch (error) {
      logger.error(`Fehler beim Löschen des Profils ${profileId}:`, error);
      throw error;
    }
  }
  /**
   * Lädt alle Profile
   */
  async getAllProfiles(): Promise<any[]> {
    try {
      const profilesPath = path.join(this.appDataPath, 'profiles');
      if (!fs.existsSync(profilesPath)) {
        fs.mkdirSync(profilesPath, { recursive: true });
        return [];
      }
      
      const profiles = fs.readdirSync(profilesPath)
        .filter(item => {
          const itemPath = path.join(profilesPath, item);
          return fs.statSync(itemPath).isDirectory();
        })
        .map(dir => {
          const profilePath = path.join(profilesPath, dir, 'profile.json');
          if (fs.existsSync(profilePath)) {
            const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
            return this.injectModHubData(profileData);
          }
          return null;
        })
        .filter(profile => profile !== null);
        
      return profiles;
    } catch (error) {
      logger.error('Fehler beim Laden aller Profile:', error);
      return [];
    }
  }
}
