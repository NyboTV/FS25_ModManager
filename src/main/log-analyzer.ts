import * as fs from 'fs';
import * as path from 'path';
import { ipcMain } from 'electron';
import { logger } from './main';

export interface LogEntry {
  type: 'info' | 'warning' | 'error';
  message: string;
  time?: string;
  relatedMod?: string;
  count?: number;
}

export class LogAnalyzer {
  constructor() {
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    ipcMain.handle('analyze-log', async (event, logPath: string) => {
      try {
        return await this.analyzeLogFile(logPath);
      } catch (error) {
        logger.error(`Fehler beim Analysieren der Logdatei: ${error}`);
        return { success: false, error: String(error) };
      }
    });
  }

  async analyzeLogFile(logPath: string): Promise<{ success: boolean; entries?: LogEntry[]; error?: string }> {
    if (!fs.existsSync(logPath)) {
      return { success: false, error: 'Die log.txt Datei wurde nicht gefunden.' };
    }

    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    const entryMap = new Map<string, LogEntry>();
    const modRegex = /([a-zA-Z0-9_-]+)\.zip/i;

    for (const line of lines) {
      if (!line.trim()) continue;

      let type: 'info' | 'warning' | 'error' = 'info';
      
      if (line.includes('Error:') || line.includes('Error (')) {
        type = 'error';
      } else if (line.includes('Warning:') || line.includes('Warning (')) {
        type = 'warning';
      } else if (line.includes('Error')) { // generic fallback
        type = 'error';
      }

      // Versuch, einen betroffenen Mod-Namen zu finden (z.B. aus Pfaden)
      let relatedMod: string | undefined = undefined;
      const match = line.match(modRegex);
      if (match && match[1]) {
        relatedMod = match[1];
      } else if (line.includes('/mods/')) {
        const parts = line.split('/mods/');
        if (parts.length > 1) {
          const modPart = parts[1].split('/')[0];
          relatedMod = modPart.replace('.zip', '');
        }
      }

      if (type !== 'info') {
        const trimmedMessage = line.trim();
        const key = `${type}_${trimmedMessage}`;
        
        if (entryMap.has(key)) {
          const existing = entryMap.get(key)!;
          existing.count = (existing.count || 1) + 1;
        } else {
          entryMap.set(key, {
            type,
            message: trimmedMessage,
            relatedMod,
            count: 1
          });
        }
      }
    }

    const entries: LogEntry[] = Array.from(entryMap.values());
    return { success: true, entries };
  }
}
