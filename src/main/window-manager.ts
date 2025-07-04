import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as url from 'url';
import Store from 'electron-store';
import { logger } from './main';

interface WindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private store: Store;

  constructor(store: Store) {
    this.store = store;
    this.setupIpcHandlers();
  }

  createWindow(): BrowserWindow {
    // Lade gespeicherte Fensterposition und -größe falls vorhanden
    const savedBounds = this.store.get('windowBounds', {
      width: 1280,
      height: 800,
      x: undefined,
      y: undefined
    }) as WindowBounds;
    
    const isMaximized = this.store.get('isMaximized', false) as boolean;
    
    // Erstelle das Browserfenster mit fester Startgröße oder gespeicherter Größe
    this.mainWindow = new BrowserWindow({
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
    this.mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
      })
    );

    // Öffne DevTools, wenn gewünscht
    // this.mainWindow.webContents.openDevTools();

    // Zeige das Fenster erst, wenn es vollständig geladen ist (verhindert weißes Flackern)
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow!.show();
      
      // Wenn das Fenster vorher maximiert war, stelle diesen Zustand wieder her
      if (this.store.get('isMaximized', false)) {
        this.mainWindow!.maximize();
      }
    });

    // Speichere Fenstergröße und -position vor dem Schließen
    this.mainWindow.on('close', () => {
      if (this.mainWindow) {
        if (!this.mainWindow.isMaximized()) {
          this.store.set('windowBounds', this.mainWindow.getBounds());
        }
        this.store.set('isMaximized', this.mainWindow.isMaximized());
      }
    });
    
    // Emittiert, wenn das Fenster geschlossen wird
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  private setupIpcHandlers(): void {
    // Fenster-Management IPC Handler
    ipcMain.handle('minimize-window', () => {
      logger.debug('Handler: minimize-window aufgerufen');
      if (this.mainWindow) {
        this.mainWindow.minimize();
      }
      return true;
    });

    ipcMain.handle('maximize-window', () => {
      logger.debug('Handler: maximize-window aufgerufen');
      if (this.mainWindow) {
        if (this.mainWindow.isMaximized()) {
          logger.debug('Fenster wird wiederhergestellt');
          this.mainWindow.unmaximize();
        } else {
          logger.debug('Fenster wird maximiert');
          this.mainWindow.maximize();
        }
      }
      return true;
    });

    ipcMain.handle('close-window', () => {
      logger.debug('Handler: close-window aufgerufen');
      if (this.mainWindow) {
        logger.info('Anwendung wird geschlossen');
        this.mainWindow.close();
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
  }
}
