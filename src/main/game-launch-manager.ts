import { ipcMain } from 'electron';
import * as fs from 'fs';
import { logger } from './main';

export class GameLaunchManager {
  constructor() {
    this.setupIpcHandlers();
  }

  private setupIpcHandlers(): void {
    // Starte das Spiel
    ipcMain.handle('launch-game', async (_, gamePath: string, launchParams?: string) => {
      logger.debug(`Handler: launch-game aufgerufen mit Spielpfad: ${gamePath} und Params: ${launchParams}`);
      try {
        if (!gamePath) {
          logger.warn('Kein Spielpfad konfiguriert, Spiel kann nicht gestartet werden');
          return { 
            success: false, 
            error: 'Kein Spielpfad konfiguriert' 
          };
        }
        
        // Überprüfe, ob die EXE-Datei existiert
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
        }
        
        // Parameter parsen
        const args = launchParams ? launchParams.split(' ').filter(p => p.trim().length > 0) : [];
        
        // Starte das Spiel
        const { spawn } = require('child_process');
        const path = require('path');
        logger.info(`Starte Spiel: ${gamePath} mit Argumenten: ${args.join(' ')}`);
        const gameProcess = spawn(gamePath, args, {
          cwd: path.dirname(gamePath),
          detached: true,
          stdio: 'ignore'
        });

        gameProcess.unref();
        logger.debug('Spielprozess wurde vom Mod Manager getrennt (unref)');
        
        logger.info('Spiel wurde erfolgreich gestartet');
        return { success: true, message: 'Spiel wurde gestartet' };
      } catch (error) {
        logger.error('Fehler beim Starten des Spiels', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });
  }
}
