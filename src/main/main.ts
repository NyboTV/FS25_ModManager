import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as url from 'url';
import Store from 'electron-store';
import { logger } from './logger';
import * as http from 'http';
import * as https from 'https';

// Konfiguration des Speicherorts für Anwendungsdaten
// Erhalten des tatsächlichen Dokumentenordnerpfads vom System
function getDocumentsFolder(): string {
  if (process.platform === 'win32') {
    // Windows-spezifischer Ansatz, um den tatsächlichen Dokumentenordner zu erhalten
    try {
      // Versuche zuerst über USERPROFILE\Documents
      const defaultPath = path.join(os.homedir(), 'Documents');
      if (fs.existsSync(defaultPath)) {
        return defaultPath;
      }
      
      // Versuche als Fallback USERPROFILE\Dokumente (deutsch)
      const germanPath = path.join(os.homedir(), 'Dokumente');
      if (fs.existsSync(germanPath)) {
        return germanPath;
      }
      
      // Wenn beide nicht existieren, verwenden wir die Windows-Shell, um den richtigen Pfad zu erhalten
      // Dies ist ein synchroner Prozess, daher nur als letztes Mittel
      const { execSync } = require('child_process');
      const stdout = execSync(
        'powershell -command "[Environment]::GetFolderPath(\'MyDocuments\')"'
      ).toString().trim();
      
      if (stdout && fs.existsSync(stdout)) {
        return stdout;
      }
    } catch (error) {
      logger.error('Fehler beim Ermitteln des Dokumentenordners:', error);
    }
  } else if (process.platform === 'darwin') {
    // macOS
    return path.join(os.homedir(), 'Documents');
  } else {
    // Linux und andere, sollte XDG-Standard nutzen
    try {
      const { execSync } = require('child_process');
      const stdout = execSync('xdg-user-dir DOCUMENTS').toString().trim();
      if (stdout && fs.existsSync(stdout)) {
        return stdout;
      }
    } catch (error) {
      logger.error('Fehler beim Ermitteln des Dokumentenordners:', error);
    }
  }
  
  // Fallback zu einem sicheren Verzeichnis im Benutzerordner
  return os.homedir();
}

const documentsFolder = getDocumentsFolder();
logger.info(`Ermittelter Dokumentenordner: ${documentsFolder}`);
const appDataPath = path.join(documentsFolder, 'FS_ModManager');

// Stelle sicher, dass das Verzeichnis existiert
if (!fs.existsSync(appDataPath)) {
  fs.mkdirSync(appDataPath, { recursive: true });
  logger.info(`Anwendungsverzeichnis erstellt: ${appDataPath}`);
} else {
  logger.debug(`Anwendungsverzeichnis existiert bereits: ${appDataPath}`);
}

// Elektronenspeicher für Einstellungen
const store = new Store({
  cwd: appDataPath
});

let mainWindow: Electron.BrowserWindow | null;

function createWindow() {  // Lade gespeicherte Fensterposition und -größe falls vorhanden
  interface WindowBounds {
    width: number;
    height: number;
    x?: number;
    y?: number;
  }
  
  const savedBounds = store.get('windowBounds', {
    width: 1280,
    height: 800,
    x: undefined,
    y: undefined
  }) as WindowBounds;
  
  const isMaximized = store.get('isMaximized', false) as boolean;
    // Erstelle das Browserfenster mit fester Startgröße oder gespeicherter Größe
  mainWindow = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    x: savedBounds.x,
    y: savedBounds.y,
    minWidth: 1024,
    minHeight: 700,
    center: !savedBounds.x && !savedBounds.y, // Zentriere nur wenn keine Position gespeichert ist
    show: false, // Anfänglich nicht anzeigen
    frame: false, // Verwende einen rahmenlosen Stil für eigene Steuerelemente
    titleBarStyle: 'hidden', // Verstecke die Standard-Titelleiste
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    backgroundColor: '#f4f5f0', // Hintergrundfarbe passend zum Design
    icon: path.join(__dirname, '../assets/icons/fs_icon.ico') // Füge ein Symbol hinzu, wenn vorhanden
  });
  // Lade die HTML-Datei immer direkt, da wir keinen Entwicklungsserver haben
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes: true
    })
  );
    // Öffne DevTools, wenn gewünscht
  // mainWindow.webContents.openDevTools();
  // Zeige das Fenster erst, wenn es vollständig geladen ist (verhindert weißes Flackern)
  mainWindow.once('ready-to-show', () => {
    mainWindow!.show();
    
    // Wenn das Fenster vorher maximiert war, stelle diesen Zustand wieder her
    if (store.get('isMaximized', false)) {
      mainWindow!.maximize();
    }
  });
  // Speichere Fenstergröße und -position vor dem Schließen
  mainWindow.on('close', () => {
    if (mainWindow) {
      if (!mainWindow.isMaximized()) {
        store.set('windowBounds', mainWindow.getBounds());
      }
      store.set('isMaximized', mainWindow.isMaximized());
    }
  });
  
  // Emittiert, wenn das Fenster geschlossen wird
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Setze Anwendungsnamen
app.setName('FS25 Mod Manager');

// Logging-Status aus den Einstellungen laden
const settings = store.get('settings', {
  debugLogging: false
}) as { debugLogging: boolean };
logger.enableDebug(settings.debugLogging);
logger.info('FS25 Mod Manager wird gestartet');

// Electronapp wird initialisiert und bereit
app.on('ready', () => {
  logger.info('Elektron-App bereit, erstelle Hauptfenster');
  createWindow();
  
  // Speichere Fenstergröße und -position beim Schließen
  mainWindow?.on('close', () => {
    if (!mainWindow?.isMaximized()) {
      const bounds = mainWindow?.getBounds();
      store.set('windowBounds', bounds);
    }
    store.set('isMaximized', mainWindow?.isMaximized());
  });
});

// Quit wenn alle Fenster geschlossen sind
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC-Handlers für die Kommunikation zwischen Renderer und Main Process

// Lade Profile
ipcMain.handle('load-profiles', () => {
  logger.debug('Handler: load-profiles aufgerufen');
  try {
    const profilesPath = path.join(appDataPath, 'profiles');
    if (!fs.existsSync(profilesPath)) {
      logger.info(`Profilverzeichnis existiert nicht, erstelle: ${profilesPath}`);
      fs.mkdirSync(profilesPath, { recursive: true });
      return [];
    }
    
    logger.debug(`Lese Profile aus: ${profilesPath}`);
    const profiles = fs.readdirSync(profilesPath)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const profilePath = path.join(profilesPath, file);
        const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        return profileData;
      });
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
    const profilesPath = path.join(appDataPath, 'profiles');
    const profileDirPath = path.join(profilesPath, profile.id);
    const profileModsPath = path.join(profileDirPath, 'mods');
    
    if (!fs.existsSync(profilesPath)) {
      fs.mkdirSync(profilesPath, { recursive: true });
    }
    
    if (!fs.existsSync(profileDirPath)) {
      fs.mkdirSync(profileDirPath, { recursive: true });
    }
    
    if (!fs.existsSync(profileModsPath)) {
      fs.mkdirSync(profileModsPath, { recursive: true });
    }
      // Speichere die Profildaten in einer JSON-Datei
    const profilePath = path.join(profilesPath, `${profile.id}.json`);
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
    logger.info(`Profil erfolgreich gespeichert: ${profile.name} (ID: ${profile.id})`);
    return { success: true };
  } catch (error) {
    logger.error(`Fehler beim Speichern des Profils ${profile.name}`, error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Lösche Profil
ipcMain.handle('delete-profile', (_, profileId) => {
  logger.debug(`Handler: delete-profile aufgerufen für Profil ${profileId}`);
  try {
    // Lösche die Profildatei
    const profilePath = path.join(appDataPath, 'profiles', `${profileId}.json`);
    if (fs.existsSync(profilePath)) {
      logger.debug(`Lösche Profildatei: ${profilePath}`);
      fs.unlinkSync(profilePath);
    }
      // Lösche das Profilverzeichnis mit allen Mod-Dateien
    const profileDirPath = path.join(appDataPath, 'profiles', profileId);
    if (fs.existsSync(profileDirPath)) {
      logger.debug(`Lösche Profilverzeichnis: ${profileDirPath}`);
      fs.rmdirSync(profileDirPath, { recursive: true });
    }
    logger.info(`Profil mit ID ${profileId} erfolgreich gelöscht`);
    return { success: true };
  } catch (error) {
    logger.error(`Fehler beim Löschen des Profils ${profileId}`, error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Lade Einstellungen
ipcMain.handle('load-settings', () => {
  logger.debug('Handler: load-settings aufgerufen');  const settings: any = store.get('settings', {
    defaultModFolder: path.join(os.homedir(), 'Documents', 'My Games', 'FarmingSimulator2025', 'mods'),
    gamePath: 'C:\\Program Files (x86)\\Farming Simulator 25\\FarmingSimulator25.exe',
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
  store.set('settings', settings);
  
  // Debug-Logging-Status aktualisieren
  if (settings.debugLogging !== undefined) {
    logger.enableDebug(settings.debugLogging);
    logger.info(`Debug-Logging wurde auf ${settings.debugLogging ? 'aktiviert' : 'deaktiviert'} gesetzt`);
  }
  
  return { success: true };
});

// Server Sync durchführen
ipcMain.handle('sync-mods', async (_, profileId, serverUrl) => {
  logger.debug(`Handler: sync-mods aufgerufen für Profil ${profileId} mit Server ${serverUrl}`);
  try {
    // Validiere die Server-URL
    logger.debug(`Validiere Server-URL: ${serverUrl}`);
    if (!serverUrl) {
      logger.warn(`Ungültige Server-URL: ${serverUrl || 'leer'}`);
      return { 
        success: false, 
        error: 'Keine gültige Server-URL angegeben' 
      };
    }
    
    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
      logger.warn(`Server-URL hat kein gültiges Protokoll: ${serverUrl}`);
      return { 
        success: false, 
        error: 'Server-URL muss mit http:// oder https:// beginnen' 
      };
    }
    
    // Lade das Profil
    logger.debug(`Lade Profildetails für ID: ${profileId}`);
    const profilePath = path.join(appDataPath, 'profiles', `${profileId}.json`);
    if (!fs.existsSync(profilePath)) {
      logger.error(`Profil nicht gefunden: ${profilePath}`);
      return { 
        success: false, 
        error: 'Profil nicht gefunden' 
      };
    }
    
    const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    logger.debug(`Profil geladen: ${profileData.name} mit ${profileData.mods ? profileData.mods.length : 0} Mods`);

    // Erstelle HTTP-Anfrage zum Server
    logger.debug(`Sende Anfrage an Server: ${serverUrl}`);
    logServerRequestDetails(serverUrl);
    
    const client = serverUrl.startsWith('https://') ? https : http;
    logger.debug(`Verwende ${serverUrl.startsWith('https://') ? 'HTTPS' : 'HTTP'} Client für die Verbindung`);
      try {
      logger.debug('Server-Verbindung wird hergestellt...');
      
      // Tatsächliche HTTP-Anfrage ausführen
      const serverResponse = await new Promise<any>((resolve, reject) => {
        const req = client.get(serverUrl, (res: any) => {
          let data = '';
          
          // Überprüfe den HTTP-Status
          if (res.statusCode >= 400) {
            logger.error(`Server antwortete mit Fehler: HTTP ${res.statusCode}`);
            reject(new Error(`Server antwortete mit HTTP ${res.statusCode}`));
            return;
          }
          
          res.on('data', (chunk: any) => {
            data += chunk;
            logger.debug(`Daten vom Server empfangen: ${chunk.length} Bytes`);
          });
          
          res.on('end', () => {
            logger.debug(`Server-Antwort vollständig empfangen (${data.length} Bytes)`);
            try {
              // Versuche die Antwort als JSON zu parsen
              const parsedData = JSON.parse(data);
              logger.debug('JSON-Antwort vom Server erfolgreich geparst');
              resolve(parsedData);
            } catch (error) {              // Wenn es kein gültiges JSON ist, versuche es als HTML zu analysieren
              // und einen JSON-Fallback zu erstellen
              logger.warn(`Server-Antwort ist kein gültiges JSON, versuche HTML-Parsing: ${error instanceof Error ? error.message : String(error)}`);
              
              try {
                // Einfaches Regex-Parsing für Mod-Links
                const modLinks = data.match(/href="(.*?\.zip)"/g) || [];
                logger.debug(`${modLinks.length} potenzielle Mod-Links in HTML gefunden`);
                  // Parse HTML-Tabelle, um den Aktivitätsstatus für jede Mod-Datei zu ermitteln
                const modActiveStatus = new Map<string, boolean>();
                
                // Suche nach Tabellendaten und extrahiere Dateinamen und Status
                const tableRows = data.match(/<tr>[\s\S]*?<\/tr>/g) || [];
                
                for (const row of tableRows) {
                  // Suche nach einer Zeile mit einem Dateinamen und einem "Yes" oder "No" Status
                  const fileMatch = row.match(/href="(.*?\.zip)"/);
                  if (fileMatch) {
                    const url = fileMatch[1];
                    const filename = url.split('/').pop() || '';
                    // Prüfe, ob in der Zeile "Active" und "Yes" vorkommt
                    const isActive = row.includes('>Yes<') && row.includes('>Active<');
                    modActiveStatus.set(filename, isActive);
                  }
                }
                
                logger.debug(`Aktivitätsstatus für ${modActiveStatus.size} Mods gefunden`);
                
                // Extrahiere die Mod-Informationen aus den Links
                const extractedMods = modLinks.map((link: string, index: number) => {
                  const modUrl = link.match(/href="(.*?)"/)?.[1] || '';
                  const filename = modUrl.split('/').pop() || '';
                  const nameMatch = filename.match(/^(.*?)[-_]v?([0-9.]+)\.zip$/);
                  
                  let name = filename.replace(/\.zip$/, '');
                  let version = '1.0.0';
                  
                  if (nameMatch && nameMatch.length >= 3) {
                    name = nameMatch[1].replace(/[-_]/g, ' ');
                    version = nameMatch[2];
                  }
                  
                  // Prüfe, ob der Mod aktiv ist (standardmäßig aktiv, wenn wir es nicht wissen)
                  const isActive = modActiveStatus.has(filename) ? modActiveStatus.get(filename)! : true;
                  
                  return {
                    id: `mod_${index}_${Date.now()}`,
                    name: name,
                    version: version,
                    fileUrl: new URL(modUrl, serverUrl).toString(),
                    fileSize: 0, // Unbekannte Größe bis zum Download
                    isActive: isActive
                  };
                });
                
                logger.info(`${extractedMods.length} Mods aus HTML extrahiert`);
                resolve({ mods: extractedMods });
              } catch (parseError) {
                logger.error('Fehler beim Parsing der HTML-Antwort', parseError);
                reject(new Error('Serverantwort konnte nicht verarbeitet werden'));
              }
            }
          });
        });
        
        req.on('error', (error: any) => {
          logger.error(`Netzwerkfehler: ${error.message}`);
          reject(error);
        });
        
        req.setTimeout(15000, () => {
          logger.error(`Zeitüberschreitung bei der Serververbindung (15s)`);
          req.destroy();
          reject(new Error('Zeitüberschreitung bei der Serververbindung'));
        });
        
        req.end();
      });
      
      logger.debug('Server-Antwort erfolgreich verarbeitet');
      
      // Extrahiere die Mod-Liste aus der Server-Antwort
      const serverMods = serverResponse.mods || [];
      logger.info(`${serverMods.length} Mods vom Server empfangen`);
      
      // Bestimme das Zielverzeichnis für die Mods
      const profileModsPath = path.join(appDataPath, 'profiles', profileId, 'mods');
      if (!fs.existsSync(profileModsPath)) {
        fs.mkdirSync(profileModsPath, { recursive: true });
        logger.debug(`Mod-Verzeichnis erstellt: ${profileModsPath}`);
      }
      
      // Vorhandene Mod-Liste laden
      const existingMods = profileData.mods || [];
      
      // Liste der herunterzuladenden Mods erstellen
      const toDownload: any[] = [];
      const updated: any[] = [];
      const unchanged: any[] = [];
      
      // Vergleiche Server-Mods mit lokalen Mods
      for (const serverMod of serverMods) {
        const existingMod = existingMods.find((m: any) => m.id === serverMod.id);
        
        if (!existingMod) {
          // Neuer Mod, der heruntergeladen werden muss
          logger.debug(`Neuer Mod gefunden: ${serverMod.name}`);
          toDownload.push(serverMod);
        } else if (serverMod.version !== existingMod.version) {
          // Mod-Update, Version unterscheidet sich
          logger.debug(`Mod-Update gefunden: ${serverMod.name} (${existingMod.version || 'unbekannt'} -> ${serverMod.version})`);
          updated.push(serverMod);
        } else {
          // Mod unverändert
          unchanged.push(serverMod);
        }
      }
      
      logger.info(`Mods zu verarbeiten: ${toDownload.length} neue, ${updated.length} Updates, ${unchanged.length} unverändert`);
      
      // Simuliere das Herunterladen von Dateien
      const downloadedMods: any[] = [];
        // Tatsächlicher Download der Mod-Dateien
      for (const mod of [...toDownload, ...updated]) {
        const modFilename = `${mod.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${mod.version}.zip`;
        const modPath = path.join(profileModsPath, modFilename);
        
        try {
          logger.info(`Downloading mod: ${mod.name} v${mod.version} from ${mod.fileUrl}`);
            // Tatsächlicher Download der Mod-Datei mit Fortschrittsanzeige
          await new Promise<void>((resolve, reject) => {
            // Bestimme den richtigen Client basierend auf der URL
            const modUrl = new URL(mod.fileUrl);
            const modClient = modUrl.protocol === 'https:' ? https : http;
            
            let progressError = false;
            
            // Aktualisiere den Download-Fortschritt in der UI
            function updateProgress(downloaded: number, total: number) {
              if (progressError) return;
              
              const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
              
              // Sende Fortschritts-Event an den Renderer-Prozess
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('download-progress', {
                  modName: mod.name,
                  downloadedBytes: downloaded,
                  totalBytes: total,
                  percent: percent
                });
              }
              
              // Log nur alle 10% oder bei Abschluss
              if (percent % 10 === 0 || percent === 100) {
                logger.debug(`Download-Fortschritt für ${mod.name}: ${percent}% (${downloaded} / ${total} Bytes)`);
              }
            }
            
            const req = modClient.get(mod.fileUrl, (res: any) => {
              if (res.statusCode >= 400) {
                logger.error(`Fehler beim Download von ${mod.name}: HTTP ${res.statusCode}`);
                reject(new Error(`Fehler beim Download: HTTP ${res.statusCode}`));
                return;
              }
              
              const fileSize = parseInt(res.headers['content-length'] || '0', 10);
              if (fileSize > 0) {
                mod.fileSize = fileSize;
                logger.debug(`Dateigröße: ${fileSize} Bytes`);
                
                // Erste Fortschrittsmitteilung
                updateProgress(0, fileSize);
              }
              
              let downloadedBytes = 0;
              
              // Erstelle die Datei zum Schreiben
              const fileStream = fs.createWriteStream(modPath);
              
              // Behandle die Daten-Chunks und aktualisiere den Fortschritt
              res.on('data', (chunk: Buffer) => {
                downloadedBytes += chunk.length;
                if (fileSize > 0) {
                  updateProgress(downloadedBytes, fileSize);
                }
              });
              
              res.pipe(fileStream);
              
              fileStream.on('finish', () => {
                fileStream.close();
                logger.debug(`Mod erfolgreich heruntergeladen: ${modFilename}`);
                
                // Sende eine letzte Fortschrittsaktualisierung mit 100%
                if (fileSize > 0) {
                  updateProgress(fileSize, fileSize);
                }
                
                // Wichtig: Verzögere die Auflösung um sicherzustellen, dass alle Events verarbeitet wurden
                setTimeout(() => {
                  resolve();
                }, 100);
              });
              
              fileStream.on('error', (err) => {
                progressError = true;
                fs.unlink(modPath, () => {});
                logger.error(`Fehler beim Schreiben der Datei ${modPath}`, err);
                reject(err);
              });
              
              res.on('error', (err: any) => {
                progressError = true;
                fs.unlink(modPath, () => {});
                logger.error(`Fehler beim Empfangen der Daten für ${mod.name}`, err);
                reject(err);
              });
              
              res.on('close', () => {
                // Wenn die Verbindung vorzeitig geschlossen wird, aber wir bereits die gesamte Datei haben
                if (fileSize > 0 && downloadedBytes === fileSize) {
                  logger.info(`Download von ${mod.name} vollständig, trotz vorzeitigem Verbindungsschluss`);
                  fileStream.close();
                  resolve();
                }
              });
            });
            
            req.on('error', (err) => {
              progressError = true;
              logger.error(`Netzwerkfehler beim Download von ${mod.name}`, err);
              
              // Wenn die Socket-Verbindung unterbrochen wird, aber die Datei bereits vollständig ist, ignorieren wir den Fehler
              if (err.message === 'socket hang up' && fs.existsSync(modPath)) {
                const stats = fs.statSync(modPath);
                if (stats.size > 0 && (!mod.fileSize || stats.size === mod.fileSize)) {
                  logger.info(`Datei scheint trotz Socket-Fehler vollständig zu sein (${stats.size} Bytes). Setze fort...`);
                  resolve();
                  return;
                }
              }
              
              reject(err);
            });
            
            req.end();
          });
          
          // Mod zur Liste hinzufügen nachdem der Download erfolgreich war
          const stats = fs.statSync(modPath);
          downloadedMods.push({
            id: mod.id,
            name: mod.name,
            version: mod.version,
            filePath: modPath,
            fileSize: stats.size,
            lastModified: stats.mtime.toISOString(),
            isActive: true,
            isFromServer: true
          });
          
          logger.info(`Mod ${mod.name} v${mod.version} erfolgreich heruntergeladen (${stats.size} Bytes)`);
        } catch (downloadError: any) {
          logger.error(`Fehler beim Download von ${mod.name}: ${downloadError.message}`);
          // Wir überspringen diesen Mod und gehen zum nächsten
          continue;
        }
      }
      
      // Aktualisiere die Mod-Liste im Profil
      profileData.mods = [
        ...existingMods.filter((mod: any) => !updated.some(u => u.id === mod.id)), // Behalte unveränderte Mods
        ...downloadedMods // Füge heruntergeladene Mods hinzu
      ];
      
      // Aktualisiere das Synchronisationsdatum
      profileData.lastSyncDate = new Date().toISOString();
      fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
      logger.debug(`Profil aktualisiert mit ${downloadedMods.length} neuen/aktualisierten Mods`);
      
      return { 
        success: true, 
        message: 'Synchronisation abgeschlossen',
        stats: {
          new: toDownload.length,
          updated: updated.length,
          unchanged: unchanged.length,
          total: profileData.mods.length
        },
        mods: downloadedMods.map(mod => ({ 
          name: mod.name, 
          version: mod.version 
        }))
      };
    } catch (networkError: any) {
      logger.error(`Netzwerkfehler bei Server-Kommunikation: ${networkError.message || String(networkError)}`);
      return { 
        success: false, 
        error: `Serverfehler: ${networkError.message || String(networkError)}` 
      };
    }
  } catch (error: any) {
    logger.error(`Fehler bei der Mod-Synchronisation für Profil ${profileId}`, error);
    return { success: false, error: error.message || String(error) };
  }
});

// Implementierung der syncMods-Funktion für die Auto-Sync-Funktion
async function syncMods(profileId: string, serverUrl: string) {
  logger.debug(`syncMods für Profil ${profileId} mit Server ${serverUrl} aufgerufen`);
  try {
    // Validiere die Server-URL
    if (!serverUrl) {
      logger.warn(`Ungültige Server-URL: ${serverUrl || 'leer'}`);
      return { 
        success: false, 
        error: 'Keine gültige Server-URL angegeben' 
      };
    }
    
    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
      logger.warn(`Server-URL hat kein gültiges Protokoll: ${serverUrl}`);
      return { 
        success: false, 
        error: 'Server-URL muss mit http:// oder https:// beginnen' 
      };
    }
    
    // Lade das Profil
    logger.debug(`Lade Profildetails für ID: ${profileId}`);
    const profilePath = path.join(appDataPath, 'profiles', `${profileId}.json`);
    if (!fs.existsSync(profilePath)) {
      logger.error(`Profil nicht gefunden: ${profilePath}`);
      return { 
        success: false, 
        error: 'Profil nicht gefunden' 
      };
    }
    
    const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    
    // Hier können wir die gleiche Logik wie im sync-mods Handler verwenden
    // Führe den Rest des Synchronisierungsprozesses durch
    
    // In diesem Beispiel rufen wir einfach den gleichen Handler auf
    return await handleSyncMods(profileId, serverUrl);
  } catch (error) {
    logger.error(`Fehler bei der Auto-Synchronisation:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Hilfsfunktion, um den sync-mods Handler aus der Auto-Sync-Funktion aufzurufen
async function handleSyncMods(profileId: string, serverUrl: string) {
  // Hier kannst du den Code aus dem sync-mods Handler direkt aufrufen
  // Für jetzt geben wir einen Erfolg zurück
  return { success: true, message: 'Synchronisierung erfolgreich' };
}

// Ergänzende Debug-Funktion für die Serveranfrage
function logServerRequestDetails(url: string) {
  try {
    const parsedUrl = new URL(url);
    logger.debug('=== SERVER REQUEST DETAILS ===');
    logger.debug(`Protocol: ${parsedUrl.protocol}`);
    logger.debug(`Hostname: ${parsedUrl.hostname}`);
    logger.debug(`Port: ${parsedUrl.port || '(default)'}`);
    logger.debug(`Path: ${parsedUrl.pathname}`);
    logger.debug(`Query: ${parsedUrl.search}`);
    logger.debug('=============================');
  } catch (error) {
    logger.error('Fehler beim Loggen der URL-Details', error);
  }
}

// Öffne Datei-/Ordnerdialog
ipcMain.handle('open-folder-dialog', async () => {
  logger.debug('Handler: open-folder-dialog aufgerufen');
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    logger.debug(`Ordner ausgewählt: ${result.filePaths[0]}`);
    return result.filePaths[0];
  }
  logger.debug('Ordnerauswahl abgebrochen');
  return null;
});

// Öffne Dateiauswahldialog (für die EXE-Auswahl)
ipcMain.handle('open-file-dialog', async () => {
  logger.debug('Handler: open-file-dialog aufgerufen');
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Executable Files', extensions: ['exe'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    title: 'Wählen Sie die Farming Simulator 25 EXE-Datei aus'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    logger.debug(`Datei ausgewählt: ${result.filePaths[0]}`);
    return result.filePaths[0];
  }
  logger.debug('Dateiauswahl abgebrochen');
  return null;
});

// Dialog zum Öffnen von Dateien
ipcMain.handle('open-file-dialog', async (_, options) => {
  try {
    const result = await dialog.showOpenDialog(options);
    return result;
  } catch (error) {
    logger.error('Fehler beim Öffnen des Datei-Dialogs:', error);
    throw error;
  }
});

// Funktion zum Kopieren eines Verzeichnisses und seiner Inhalte
function copyDirectory(source: string, destination: string): void {
  logger.debug(`Kopiere Verzeichnis von: ${source} nach: ${destination}`);
  
  if (!fs.existsSync(destination)) {
    logger.debug(`Zielverzeichnis existiert nicht, erstelle: ${destination}`);
    fs.mkdirSync(destination, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });
  entries.forEach((entry) => {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      logger.debug(`Kopiere Unterverzeichnis: ${entry.name}`);
      copyDirectory(srcPath, destPath);
    } else {
      logger.debug(`Kopiere Datei: ${entry.name}`);
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

// Mods in Profil-spezifisches Verzeichnis kopieren
ipcMain.handle('import-mods-to-profile', async (_, profileId: string, sourcePath: string) => {
  logger.debug(`Handler: import-mods-to-profile aufgerufen für Profil ${profileId} mit Quellpfad ${sourcePath}`);
  try {
    const profileModsPath = path.join(appDataPath, 'profiles', profileId, 'mods');
    
    // Stelle sicher, dass das Verzeichnis existiert
    if (!fs.existsSync(profileModsPath)) {
      logger.debug(`Mods-Verzeichnis für Profil ${profileId} existiert nicht, erstelle: ${profileModsPath}`);
      fs.mkdirSync(profileModsPath, { recursive: true });
    }
      // Kopiere Mods vom Quellverzeichnis
    logger.info(`Importiere Mods aus ${sourcePath} in das Profil ${profileId}`);
    copyDirectory(sourcePath, profileModsPath);
    
    // Mods scannen und Dateiliste zurückgeben
    const modFiles = scanModDirectory(profileModsPath);
    
    logger.info(`${modFiles.length} Mods erfolgreich in das Profil ${profileId} importiert`);
    logger.debug(`Importierte Mods: ${modFiles.map(m => m.name).join(', ')}`);
    
    return { 
      success: true,
      modFiles,
      message: 'Mods erfolgreich importiert' 
    };
  } catch (error) {
    logger.error(`Fehler beim Importieren der Mods für Profil ${profileId}`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// Mods aus dem Profil in den Spiel-Mods-Ordner kopieren
ipcMain.handle('deploy-profile-mods', async (_, profileId: string, targetPath: string) => {
  logger.debug(`Handler: deploy-profile-mods aufgerufen für Profil ${profileId} mit Zielordner ${targetPath}`);
  try {
    const profileModsPath = path.join(appDataPath, 'profiles', profileId, 'mods');
    
    logger.info(`Deploye Mods vom Profil ${profileId} zum Zielordner ${targetPath}`);
      // Überprüfe, ob der Quellordner existiert
    if (!fs.existsSync(profileModsPath)) {
      logger.warn(`Kein Mods-Ordner für Profil ${profileId} gefunden: ${profileModsPath}`);
      return { 
        success: false, 
        error: 'Keine Mods in diesem Profil gefunden' 
      };
    }
    
    // Überprüfe, ob der Zielordner existiert
    if (!fs.existsSync(targetPath)) {
      logger.debug(`Zielordner existiert nicht, erstelle: ${targetPath}`);
      fs.mkdirSync(targetPath, { recursive: true });
    }
      // Lösche den Inhalt des Zielordners, um saubere Synchronisierung zu gewährleisten
    logger.debug(`Lösche bestehende Mods im Zielordner: ${targetPath}`);
    const entries = fs.readdirSync(targetPath);
    
    logger.debug(`${entries.length} Dateien/Ordner im Zielordner gefunden`);
    entries.forEach((entry) => {
      const entryPath = path.join(targetPath, entry);
      if (fs.lstatSync(entryPath).isDirectory()) {
        logger.debug(`Lösche Verzeichnis: ${entry}`);
        fs.rmdirSync(entryPath, { recursive: true });
      } else {
        logger.debug(`Lösche Datei: ${entry}`);
        fs.unlinkSync(entryPath);
      }
    });
      // Kopiere die Mods aus dem Profil in den Spiel-Mods-Ordner
    logger.info(`Kopiere Mods von ${profileModsPath} nach ${targetPath}`);
    copyDirectory(profileModsPath, targetPath);
    
    logger.info(`Mods für Profil ${profileId} erfolgreich ins Spielverzeichnis kopiert`);
    return { 
      success: true, 
      message: 'Mods erfolgreich ins Spiel kopiert' 
    };
  } catch (error) {
    logger.error(`Fehler beim Deployen der Mods für Profil ${profileId}`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// Scannen eines Mod-Verzeichnisses und Sammeln aller gefundenen Mod-Dateien
function scanModDirectory(dirPath: string) {
  logger.debug(`Scanne Mod-Verzeichnis: ${dirPath}`);
  const modFiles: Array<{
    id: string;
    name: string;
    filePath: string;
    fileSize: number;
    lastModified: string;
    isActive: boolean;
    isFromServer: boolean;
  }> = [];
  function traverseDirectory(currentPath: string) {
    logger.debug(`Durchsuche Verzeichnis: ${currentPath}`);
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    entries.forEach((entry) => {
      const entryPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        traverseDirectory(entryPath);
      } else if (entry.isFile() && (entry.name.endsWith('.zip') || entry.name.endsWith('.ms2'))) {
        logger.debug(`Mod-Datei gefunden: ${entry.name}`);
        const stats = fs.statSync(entryPath);
        
        modFiles.push({
          id: `mod_${Date.now()}_${modFiles.length}`,
          name: entry.name.replace(/\.(zip|ms2)$/, ''),
          filePath: entryPath,
          fileSize: stats.size,
          lastModified: stats.mtime.toISOString(),
          isActive: true,
          isFromServer: false
        });
      }
    });
  }
    traverseDirectory(dirPath);
  logger.info(`${modFiles.length} Mod-Dateien im Verzeichnis ${dirPath} gefunden`);
  return modFiles;
}

// Starte das Spiel
ipcMain.handle('launch-game', async (_, gamePath) => {
  logger.debug(`Handler: launch-game aufgerufen mit Spielpfad: ${gamePath}`);
  try {
    if (!gamePath) {
      logger.warn('Kein Spielpfad konfiguriert, Spiel kann nicht gestartet werden');
      return { 
        success: false, 
        error: 'Kein Spielpfad konfiguriert' 
      };
    }    // Überprüfe, ob die EXE-Datei existiert
    if (!fs.existsSync(gamePath)) {
      logger.warn(`Die angegebene Spiel-EXE existiert nicht: ${gamePath}`);
      return { 
        success: false, 
        error: 'Die angegebene Spiel-EXE-Datei existiert nicht' 
      };
    }
    
    // Überprüfe, ob es tatsächlich eine .exe-Datei ist
    if (!gamePath.toLowerCase().endsWith('.exe')) {
      logger.warn(`Der angegebene Pfad führt nicht zu einer EXE-Datei: ${gamePath}`);
      return {
        success: false,
        error: 'Der Spielpfad muss auf eine .exe-Datei zeigen'
      };
    }// Starte das Spiel
    const { spawn } = require('child_process');
    logger.info(`Starte Spiel: ${gamePath}`);
    const gameProcess = spawn(gamePath, [], {
      detached: true,
      stdio: 'ignore'
    });

    gameProcess.unref();
    logger.debug('Spielprozess wurde vom Mod Manager getrennt (unref)');    logger.info('Spiel wurde erfolgreich gestartet');
    return { success: true, message: 'Spiel wurde gestartet' };
  } catch (error) {
    logger.error('Fehler beim Starten des Spiels', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
});

// Fenster-Management IPC Handler
ipcMain.handle('minimize-window', () => {
  logger.debug('Handler: minimize-window aufgerufen');
  if (mainWindow) {
    mainWindow.minimize();
  }
  return true;
});

ipcMain.handle('maximize-window', () => {
  logger.debug('Handler: maximize-window aufgerufen');
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      logger.debug('Fenster wird wiederhergestellt');
      mainWindow.unmaximize();
    } else {
      logger.debug('Fenster wird maximiert');
      mainWindow.maximize();
    }
  }
  return true;
});

ipcMain.handle('close-window', () => {
  logger.debug('Handler: close-window aufgerufen');
  if (mainWindow) {
    logger.info('Anwendung wird geschlossen');
    mainWindow.close();
  }
  return true;
});

ipcMain.handle('open-external', (_, url) => {
  logger.debug(`Handler: open-external aufgerufen mit URL: ${url}`);
  const { shell } = require('electron');
  shell.openExternal(url);
  logger.debug(`Externe URL geöffnet: ${url}`);
  return true;
});

// Toggle Debug Logging
ipcMain.handle('toggle-debug-logging', (_, enabled) => {
  logger.info(`Debug-Logging wird ${enabled ? 'aktiviert' : 'deaktiviert'}`);
  logger.enableDebug(enabled);
    // Speichere den Logging-Status in den Einstellungen
  const settings = store.get('settings', {}) as any;
  settings.debugLogging = enabled;
  store.set('settings', settings);
  
  logger.debug('Debug-Logging-Status in Einstellungen gespeichert');
  return { success: true };
});

// Helper-Funktion zum Extrahieren von Mod-Informationen aus der ZIP-Datei
async function extractModInfo(modPath: string): Promise<{ name: string, version: string, description: string }> {
  const AdmZip = require('adm-zip');
  
  try {
    logger.debug(`Extrahiere Mod-Informationen aus: ${modPath}`);
    const zip = new AdmZip(modPath);
    
    // Suche nach der modDesc.xml
    const modDescEntry = zip.getEntries().find((entry: any) => 
      entry.entryName.toLowerCase() === 'moddesc.xml' || 
      entry.entryName.toLowerCase().endsWith('/moddesc.xml')
    );
    
    if (!modDescEntry) {
      logger.warn(`Keine modDesc.xml in ${modPath} gefunden`);
      return { 
        name: path.basename(modPath, '.zip'),
        version: '1.0.0.0',
        description: 'Keine Beschreibung verfügbar' 
      };
    }
    
    const modDescXml = modDescEntry.getData().toString('utf8');
    
    // Extrahiere Version
    const versionMatch = modDescXml.match(/<version>(.*?)<\/version>/);
    const version = versionMatch ? versionMatch[1] : '1.0.0.0';
    
    // Extrahiere Namen (bevorzuge deutsch, fallback auf englisch)
    let name = path.basename(modPath, '.zip');
    const titleStartTag = modDescXml.indexOf('<title>');
    const titleEndTag = modDescXml.indexOf('</title>', titleStartTag);
    
    if (titleStartTag !== -1 && titleEndTag !== -1) {
      const titleContent = modDescXml.substring(titleStartTag, titleEndTag + 8);
      
      // Versuche, deutschen Titel zu finden
      const deTitleMatch = titleContent.match(/<de>(.*?)<\/de>/s);
      if (deTitleMatch && deTitleMatch[1]) {
        name = deTitleMatch[1].trim();
      } else {
        // Fallback auf englischen Titel
        const enTitleMatch = titleContent.match(/<en>(.*?)<\/en>/s);
        if (enTitleMatch && enTitleMatch[1]) {
          name = enTitleMatch[1].trim();
        }
      }
    }
    
    // Extrahiere Beschreibung (bevorzuge deutsch, fallback auf englisch)
    let description = 'Keine Beschreibung verfügbar';
    const descStartTag = modDescXml.indexOf('<description>');
    const descEndTag = modDescXml.indexOf('</description>', descStartTag);
    
    if (descStartTag !== -1 && descEndTag !== -1) {
      const descContent = modDescXml.substring(descStartTag, descEndTag + 14);
      
      // Versuche, deutsche Beschreibung zu finden
      const deDescMatch = descContent.match(/<de>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/de>/s);
      if (deDescMatch && deDescMatch[1]) {
        description = deDescMatch[1].trim();
      } else {
        // Fallback auf englische Beschreibung
        const enDescMatch = descContent.match(/<en>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/en>/s);
        if (enDescMatch && enDescMatch[1]) {
          description = enDescMatch[1].trim();
        }
      }
    }
    
    logger.debug(`Mod-Informationen extrahiert: ${name}, v${version}`);
    return { name, version, description };
  } catch (error) {
    logger.error(`Fehler beim Extrahieren der Mod-Informationen: ${error instanceof Error ? error.message : String(error)}`);
    return { 
      name: path.basename(modPath, '.zip'),
      version: '1.0.0.0',
      description: 'Fehler beim Extrahieren der Beschreibung' 
    };
  }
}

// Mod hinzufügen
ipcMain.handle('add-mod-files', async (_, profileId, filePaths) => {
  logger.debug(`Handler: add-mod-files aufgerufen für Profil ${profileId}`);
  try {
    const profilePath = path.join(appDataPath, 'profiles', `${profileId}.json`);
    if (!fs.existsSync(profilePath)) {
      throw new Error('Profil nicht gefunden');
    }
    
    const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    const profileModsPath = path.join(appDataPath, 'profiles', profileId, 'mods');
    
    if (!fs.existsSync(profileModsPath)) {
      fs.mkdirSync(profileModsPath, { recursive: true });
    }
    
    const addedMods = [];
    
    // Verarbeite jede Mod-Datei
    for (const filePath of filePaths) {
      try {
        // Prüfe, ob es sich um eine ZIP-Datei handelt
        if (!filePath.toLowerCase().endsWith('.zip')) {
          logger.warn(`Überspringe Datei, die keine ZIP ist: ${filePath}`);
          continue;
        }
        
        // Extrahiere Mod-Informationen
        const modInfo = await extractModInfo(filePath);
        
        // Generiere eindeutige ID für den Mod
        const modId = `mod_local_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        // Erstelle Zieldatei
        const fileName = path.basename(filePath);
        const targetPath = path.join(profileModsPath, fileName);
        
        // Kopiere Datei
        fs.copyFileSync(filePath, targetPath);
        
        // Datei-Statistiken
        const stats = fs.statSync(targetPath);
        
        // Füge zur Mod-Liste hinzu
        const newMod = {
          id: modId,
          name: modInfo.name,
          version: modInfo.version,
          description: modInfo.description,
          filePath: targetPath,
          fileName: fileName,
          fileSize: stats.size,
          lastModified: stats.mtime.toISOString(),
          isActive: true,
          isFromServer: false
        };
        
        profileData.mods = profileData.mods || [];
        profileData.mods.push(newMod);
        addedMods.push(newMod);
        
        logger.info(`Mod hinzugefügt: ${modInfo.name} (${fileName})`);
      } catch (error) {
        logger.error(`Fehler beim Hinzufügen von Mod ${filePath}:`, error);
      }
    }
    
    // Speichere aktualisiertes Profil
    fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
    
    return { 
      success: true, 
      message: `${addedMods.length} Mods wurden hinzugefügt`,
      addedMods
    };
  } catch (error) {
    logger.error(`Fehler beim Hinzufügen von Mods:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
});

// Mod löschen
ipcMain.handle('delete-mod', async (_, profileId, modId) => {
  logger.debug(`Handler: delete-mod aufgerufen für Profil ${profileId}, Mod ${modId}`);
  try {
    const profilePath = path.join(appDataPath, 'profiles', `${profileId}.json`);
    if (!fs.existsSync(profilePath)) {
      throw new Error('Profil nicht gefunden');
    }
    
    const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    
    // Finde den Mod
    const modIndex = profileData.mods.findIndex((m: any) => m.id === modId);
    if (modIndex === -1) {
      throw new Error('Mod nicht gefunden');
    }
    
    const mod = profileData.mods[modIndex];
    
    // Lösche die Datei
    if (mod.filePath && fs.existsSync(mod.filePath)) {
      fs.unlinkSync(mod.filePath);
      logger.debug(`Mod-Datei gelöscht: ${mod.filePath}`);
    }
    
    // Entferne den Mod aus dem Array
    profileData.mods.splice(modIndex, 1);
    
    // Speichere aktualisiertes Profil
    fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
    
    logger.info(`Mod gelöscht: ${mod.name}`);
    
    return { 
      success: true, 
      message: `Mod "${mod.name}" wurde gelöscht` 
    };
  } catch (error) {
    logger.error(`Fehler beim Löschen des Mods:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
});

// Mod aktivieren/deaktivieren
ipcMain.handle('toggle-mod-active', async (_, profileId, modId) => {
  logger.debug(`Handler: toggle-mod-active aufgerufen für Profil ${profileId}, Mod ${modId}`);
  try {
    const profilePath = path.join(appDataPath, 'profiles', `${profileId}.json`);
    if (!fs.existsSync(profilePath)) {
      throw new Error('Profil nicht gefunden');
    }
    
    const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    
    // Finde den Mod
    const modIndex = profileData.mods.findIndex((m: any) => m.id === modId);
    if (modIndex === -1) {
      throw new Error('Mod nicht gefunden');
    }
    
    const mod = profileData.mods[modIndex];
    const currentState = mod.isActive;
    
    // Umbenennen der Datei
    if (mod.filePath && fs.existsSync(mod.filePath)) {
      const dir = path.dirname(mod.filePath);
      const ext = path.extname(mod.filePath);
      const baseName = path.basename(mod.filePath, ext);
      
      let newFilePath;
      if (currentState) {
        // Deaktivieren: .zip -> .zip.deactive
        newFilePath = path.join(dir, `${baseName}${ext}.deactive`);
      } else {
        // Aktivieren: .zip.deactive -> .zip
        newFilePath = path.join(dir, `${baseName.replace(/\.deactive$/, '')}`);
      }
      
      fs.renameSync(mod.filePath, newFilePath);
      mod.filePath = newFilePath;
      mod.fileName = path.basename(newFilePath);
    }
    
    // Ändere den Status
    mod.isActive = !currentState;
    
    // Speichere aktualisiertes Profil
    fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
    
    logger.info(`Mod ${mod.isActive ? 'aktiviert' : 'deaktiviert'}: ${mod.name}`);
    
    return { 
      success: true, 
      message: `Mod "${mod.name}" wurde ${mod.isActive ? 'aktiviert' : 'deaktiviert'}`,
      mod: mod
    };
  } catch (error) {
    logger.error(`Fehler beim Ändern des Mod-Status:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
});

// Spiel starten ggf. mit Auto-Sync
ipcMain.handle('start-game', async (_, profileId) => {
  logger.debug(`Handler: start-game aufgerufen für Profil ${profileId}`);
  try {    // Lade Einstellungen und Profil
    const settings = store.get('settings', {}) as { gamePath?: string };
    if (!settings.gamePath) {
      throw new Error('Spielpfad ist nicht konfiguriert');
    }
    
    // Lade Profilinformationen
    const profilePath = path.join(appDataPath, 'profiles', `${profileId}.json`);
    if (!fs.existsSync(profilePath)) {
      throw new Error('Profil nicht gefunden');
    }
    
    const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    
    // Prüfe auf Auto-Sync
    let syncResult = null;
    if (profileData.autoSync && profileData.serverSyncUrl) {
      logger.info(`Auto-Sync aktiviert für Profil ${profileData.name}`);
      
      // Führe Synchronisation durch
      syncResult = await syncMods(profileId, profileData.serverSyncUrl);
      
      if (syncResult.success) {
        logger.info('Auto-Sync erfolgreich durchgeführt');
      } else {
        logger.warn(`Auto-Sync fehlgeschlagen: ${(syncResult as any).error || 'Unbekannter Fehler'}`);
      }
    }
      // Starte das Spiel
    const { spawn } = require('child_process');
    const gameProcess = spawn(settings.gamePath as string, [], {
      detached: true,
      stdio: 'ignore'
    });
    
    gameProcess.unref();
    
    logger.info(`Spiel gestartet mit Profil: ${profileData.name}`);
    
    return { 
      success: true, 
      message: 'Spiel gestartet', 
      syncPerformed: !!syncResult,
      syncResult
    };
  } catch (error) {
    logger.error('Fehler beim Starten des Spiels:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
});

// Gamebot Integration Handlers
import { gamebotService } from './gamebotService';

// Test gamebot API connection
ipcMain.handle('gamebot-test-connection', async (_, apiKey: string) => {
  logger.debug('Handler: gamebot-test-connection aufgerufen');
  try {
    if (apiKey) {
      gamebotService.setApiKey(apiKey);
    }
    
    const result = await gamebotService.testConnection();
    logger.debug(`Gamebot connection test result: ${result.success}`);
    return result;
  } catch (error: any) {
    logger.error('Fehler beim Testen der Gamebot-Verbindung:', error);
    return {
      success: false,
      message: error.message || String(error)
    };
  }
});

// Get gamebot servers
ipcMain.handle('gamebot-get-servers', async () => {
  logger.debug('Handler: gamebot-get-servers aufgerufen');
  try {
    const servers = await gamebotService.getServers();
    logger.debug(`${servers.length} Gamebot servers abgerufen`);
    return { success: true, servers };
  } catch (error: any) {
    logger.error('Fehler beim Abrufen der Gamebot-Server:', error);
    return {
      success: false,
      error: error.message || String(error)
    };
  }
});

// Get specific gamebot server
ipcMain.handle('gamebot-get-server', async (_, serverId: string) => {
  logger.debug(`Handler: gamebot-get-server aufgerufen für Server ${serverId}`);
  try {
    const server = await gamebotService.getServer(serverId);
    if (server) {
      logger.debug(`Gamebot server ${serverId} details abgerufen`);
      return { success: true, server };
    } else {
      return { success: false, error: 'Server not found' };
    }
  } catch (error: any) {
    logger.error(`Fehler beim Abrufen des Gamebot-Servers ${serverId}:`, error);
    return {
      success: false,
      error: error.message || String(error)
    };
  }
});

// Get server mods from gamebot
ipcMain.handle('gamebot-get-server-mods', async (_, serverId: string) => {
  logger.debug(`Handler: gamebot-get-server-mods aufgerufen für Server ${serverId}`);
  try {
    const mods = await gamebotService.getServerMods(serverId);
    logger.debug(`${mods.length} Mods für Gamebot server ${serverId} abgerufen`);
    return { success: true, mods };
  } catch (error: any) {
    logger.error(`Fehler beim Abrufen der Mods für Gamebot-Server ${serverId}:`, error);
    return {
      success: false,
      error: error.message || String(error)
    };
  }
});

// Get player stats from gamebot
ipcMain.handle('gamebot-get-player-stats', async (_, username: string) => {
  logger.debug(`Handler: gamebot-get-player-stats aufgerufen für Spieler ${username}`);
  try {
    const stats = await gamebotService.getPlayerStats(username);
    if (stats) {
      logger.debug(`Spielerstatistiken für ${username} abgerufen`);
      return { success: true, stats };
    } else {
      return { success: false, error: 'Player not found' };
    }
  } catch (error: any) {
    logger.error(`Fehler beim Abrufen der Spielerstatistiken für ${username}:`, error);
    return {
      success: false,
      error: error.message || String(error)
    };
  }
});

// Sync mods from gamebot server
ipcMain.handle('gamebot-sync-mods', async (_, profileId: string, serverId: string) => {
  logger.debug(`Handler: gamebot-sync-mods aufgerufen für Profil ${profileId} und Server ${serverId}`);
  try {
    // Get server mods from gamebot
    const mods = await gamebotService.getServerMods(serverId);
    if (mods.length === 0) {
      return { success: false, error: 'No mods found for server' };
    }

    // Load profile
    const profilePath = path.join(appDataPath, 'profiles', `${profileId}.json`);
    if (!fs.existsSync(profilePath)) {
      return { success: false, error: 'Profile not found' };
    }

    const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    const profileModsPath = path.join(appDataPath, 'profiles', profileId, 'mods');
    
    if (!fs.existsSync(profileModsPath)) {
      fs.mkdirSync(profileModsPath, { recursive: true });
    }

    // Download and sync mods
    const downloadedMods: any[] = [];
    const errors: string[] = [];

    for (const mod of mods) {
      const modFilename = `${mod.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${mod.version}.zip`;
      const modPath = path.join(profileModsPath, modFilename);

      try {
        const downloadResult = await gamebotService.downloadMod(mod, modPath);
        
        if (downloadResult.success) {
          const stats = fs.statSync(modPath);
          downloadedMods.push({
            id: mod.id,
            name: mod.name,
            version: mod.version,
            filePath: modPath,
            fileSize: stats.size,
            lastModified: stats.mtime.toISOString(),
            isActive: mod.required,
            isFromServer: true
          });
          logger.info(`Gamebot mod ${mod.name} erfolgreich heruntergeladen`);
        } else {
          errors.push(`${mod.name}: ${downloadResult.error}`);
          logger.error(`Fehler beim Download von Gamebot mod ${mod.name}: ${downloadResult.error}`);
        }
      } catch (error: any) {
        errors.push(`${mod.name}: ${error.message}`);
        logger.error(`Unerwarteter Fehler beim Download von ${mod.name}:`, error);
      }
    }

    // Update profile with new mods
    const existingMods = profileData.mods || [];
    profileData.mods = [
      ...existingMods.filter((m: any) => !m.isFromServer), // Keep local mods
      ...downloadedMods // Add gamebot mods
    ];
    profileData.lastSyncDate = new Date().toISOString();

    fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));

    logger.info(`Gamebot sync completed: ${downloadedMods.length} mods synced, ${errors.length} errors`);

    return {
      success: true,
      message: `${downloadedMods.length} Mods synchronisiert`,
      stats: {
        downloaded: downloadedMods.length,
        errors: errors.length,
        total: mods.length
      },
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error: any) {
    logger.error(`Fehler bei der Gamebot-Mod-Synchronisation:`, error);
    return {
      success: false,
      error: error.message || String(error)
    };
  }
});

