import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';
import { logger } from './main';

export interface LogIssue {
  modName: string;
  errorMessage: string;
  count: number;
}

export class LogAnalyzer {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
    this.setupIpcHandlers();
  }

  private setupIpcHandlers(): void {
    ipcMain.handle('analyze-log', async () => {
      logger.debug('Handler: analyze-log aufgerufen');
      try {
        const settings: any = this.store.get('settings', {});
        if (!settings.defaultModFolder) {
          return { success: false, errorCode: 'NO_MOD_FOLDER', error: 'Kein Mod-Ordner konfiguriert.' };
        }

        // Annahme: defaultModFolder ist z.B. "Documents/My Games/FarmingSimulator2025/mods"
        // Die log.txt liegt im Parent-Ordner "FarmingSimulator2025"
        const gameFolder = path.dirname(settings.defaultModFolder);
        const logFilePath = path.join(gameFolder, 'log.txt');

        if (!fs.existsSync(logFilePath)) {
          return { success: false, errorCode: 'NO_LOG_FILE', errorData: gameFolder, error: 'log.txt nicht gefunden in ' + gameFolder };
        }

        const logContent = fs.readFileSync(logFilePath, 'utf8');
        const lines = logContent.split('\n');

        const issues = new Map<string, LogIssue>();

        for (const line of lines) {
          if (line.includes('Error:') || line.includes('Warning:')) {
            // Versuche den Modnamen zu extrahieren. Oft steht dort etwas wie "FS25_Courseplay/irgendwas" 
            // oder "Error: Failed to load ... in FS25_MyMod"
            const match = line.match(/(?:FS25_[a-zA-Z0-9_]+)/);
            if (match) {
              const modName = match[0];
              if (!issues.has(modName)) {
                issues.set(modName, {
                  modName,
                  errorMessage: line.trim(),
                  count: 1
                });
              } else {
                const existing = issues.get(modName)!;
                existing.count++;
              }
            }
          }
        }

        const issuesArray = Array.from(issues.values()).sort((a, b) => b.count - a.count);

        return {
          success: true,
          issues: issuesArray,
          logPath: logFilePath
        };
      } catch (error) {
        logger.error('Fehler bei der Log-Analyse:', error);
        return { success: false, error: String(error) };
      }
    });
  }
}
