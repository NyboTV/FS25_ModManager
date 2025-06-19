import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

class Logger {
  private logFilePath: string;
  private isDebugEnabled: boolean;

  constructor() {
    const appDataPath = path.join(os.homedir(), 'Documents', 'FS_ModManager');
    this.logFilePath = path.join(appDataPath, 'log.txt');
    this.isDebugEnabled = false;
    
    // Verzeichnis erstellen, falls es nicht existiert
    if (!fs.existsSync(appDataPath)) {
      fs.mkdirSync(appDataPath, { recursive: true });
    }
    
    // Alte Logdatei überschreiben
    this.initLogFile();
  }

  public enableDebug(enable: boolean): void {
    this.isDebugEnabled = enable;
    this.info(`Debug-Logging wurde ${enable ? 'aktiviert' : 'deaktiviert'}`);
  }

  public isDebugMode(): boolean {
    return this.isDebugEnabled;
  }

  private initLogFile(): void {
    const timestamp = new Date().toISOString();
    const header = `=== FS25 MOD MANAGER LOG - GESTARTET ${timestamp} ===\n`;
    fs.writeFileSync(this.logFilePath, header);
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  private writeToFile(message: string): void {
    try {
      fs.appendFileSync(this.logFilePath, message + '\n');
    } catch (error) {
      console.error('Fehler beim Schreiben der Logdatei:', error);
    }
  }

  public info(message: string): void {
    const formattedMessage = this.formatMessage('INFO', message);
    console.log(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  public error(message: string, error?: any): void {
    let errorMessage = message;
    if (error) {
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
        if (this.isDebugEnabled && error.stack) {
          errorMessage += `\n${error.stack}`;
        }
      } else {
        errorMessage += `: ${String(error)}`;
      }
    }
    
    const formattedMessage = this.formatMessage('ERROR', errorMessage);
    console.error(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  public debug(message: string): void {
    if (!this.isDebugEnabled) return;
    
    const formattedMessage = this.formatMessage('DEBUG', message);
    console.debug(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  public warn(message: string): void {
    const formattedMessage = this.formatMessage('WARN', message);
    console.warn(formattedMessage);
    this.writeToFile(formattedMessage);
  }
}

// Singleton-Instanz
export const logger = new Logger();
