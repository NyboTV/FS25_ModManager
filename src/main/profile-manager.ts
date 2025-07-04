import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './main';
import { ModInfoExtractor } from './mod-info-extractor';

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

  private setupIpcHandlers(): void {
    // Lade Profile
    ipcMain.handle('load-profiles', () => {
      logger.debug('Handler: load-profiles aufgerufen');
      try {
        const profilesPath = path.join(this.appDataPath, 'profiles');
        if (!fs.existsSync(profilesPath)) {
          logger.info(`Profilverzeichnis existiert nicht, erstelle: ${profilesPath}`);
          fs.mkdirSync(profilesPath, { recursive: true });
          return [];
        }
          logger.debug(`Lese Profile aus: ${profilesPath}`);
        const profiles = fs.readdirSync(profilesPath)
          .filter(item => {
            const itemPath = path.join(profilesPath, item);
            return fs.statSync(itemPath).isDirectory();
          })
          .map(dir => {
            const profilePath = path.join(profilesPath, dir, 'profile.json');
            if (fs.existsSync(profilePath)) {
              const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
              return profileData;
            }
            return null;
          })
          .filter(profile => profile !== null);
          
        logger.info(`${profiles.length} Profile erfolgreich geladen`);
        logger.debug(`Geladene Profile: ${profiles.map(p => p.name).join(', ')}`);
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
        // Erstelle Verzeichnisstruktur für das Profil
        const profilesPath = path.join(this.appDataPath, 'profiles');
        const profileModsPath = path.join(profilesPath, profile.id, 'mods');
        if (!fs.existsSync(profilesPath)) {
          fs.mkdirSync(profilesPath, { recursive: true });
        }
        if (!fs.existsSync(profileModsPath)) {
          fs.mkdirSync(profileModsPath, { recursive: true });
        }
        // Initialisiere Profildaten mit Standardwerten
        const newProfile = {
          id: profile.id,
          name: profile.name || 'Neues Profil',
          modFolderPath: profileModsPath,
          serverSyncUrl: profile.serverSyncUrl || '',
          version: profile.version || '1.0.0',
          mods: [],
          isActive: true,
          createdAt: new Date().toISOString(),
          lastSyncDate: null,
          ...profile // Überschreibe mit übergebenen Daten
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
        const profileModsPath = path.join(profilesPath, profile.id, 'mods');
        if (!fs.existsSync(profileModsPath)) {
          fs.mkdirSync(profileModsPath, { recursive: true });
        }
        // Aktualisiere Profildaten
        const updatedProfile = {
          ...profile,
          modFolderPath: profileModsPath, // Immer auf mods-Ordner zeigen
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
        const profilesPath = path.join(this.appDataPath, 'profiles');
        const profileDirPath = path.join(profilesPath, profileId);
        const profileModsPath = path.join(profileDirPath, 'mods');
        
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
  }

  /**
   * Erstellt ein neues Profil
   */
  async createProfile(profileData: any): Promise<any> {
    const modsPath = path.join(this.appDataPath, 'profiles', profileData.id || `profile_${Date.now()}`, 'mods');
    const profile = {
      id: profileData.id || `profile_${Date.now()}`,
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
      const modsDir = path.join(this.appDataPath, 'profiles', profileId, 'mods');
      if (fs.existsSync(modsDir)) {
        const modFiles = fs.readdirSync(modsDir).filter(f => f.endsWith('.zip') || f.endsWith('.ms2'));
        // Filtere alle Mods aus der JSON raus, deren Datei nicht mehr existiert
        profileData.mods = (profileData.mods || []).filter((mod: any) => modFiles.includes(mod.fileName));
        // Optional: Mods aus dem Ordner, die noch nicht in der Liste sind, hinzufügen (z. B. nach manuellem Kopieren)
        for (const file of modFiles) {
          if (!profileData.mods.find((mod: any) => mod.fileName === file)) {
            // Minimaldaten, Details werden beim nächsten Import/Speichern ergänzt
            profileData.mods.push({
              name: file.replace(/\.(zip|ms2)$/i, ''),
              version: '',
              author: '',
              fileName: file,
              fileSize: '',
              modHub: '',
              isActive: true,
              downloadUrl: '',
              detailUrl: ''
            });
          }
        }
      } else {
        profileData.mods = [];
      }
      return profileData;
    } catch (error) {
      logger.error(`Fehler beim Laden des Profils ${profileId}:`, error);
      return null;
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
            return profileData;
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
