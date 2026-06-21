import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import { logger } from '../main';

interface DownloadProgressCallback {
  (progress: number, speedMbPerSec: number, etaSeconds: number): void;
}

export class ModDownloader {
  private currentRequest: http.ClientRequest | null = null;
  private isSkipped: boolean = false;
  private skipReason: 'skip' | 'local' | null = null;
  private isPaused: boolean = false;
  private activeResponse: http.IncomingMessage | null = null;

  async download(
    serverMod: any,
    targetPath: string,
    signal: AbortSignal | null,
    progressCallback?: DownloadProgressCallback
  ): Promise<void> {
    this.isSkipped = false;
    this.skipReason = null;
    this.currentRequest = null;
    this.isPaused = false;
    this.activeResponse = null;

    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Synchronisation abgebrochen'));
        return;
      }

      const filePath = path.join(targetPath, serverMod.fileName || `${serverMod.id}.zip`);
      const fileAlreadyExisted = fs.existsSync(filePath);
      let expectedSize = 0;
      let downloadCompleted = false;

      let file: fs.WriteStream | null = null;
      const url = new URL(serverMod.downloadUrl);
      
      const client = url.protocol === 'https:' ? https : http;

      const request = client.get(serverMod.downloadUrl, (response) => {
        this.currentRequest = request;
        this.activeResponse = response;
        if (this.isPaused) {
          response.pause();
        }

        if (response.statusCode !== 200) {
          request.destroy();
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const contentType = response.headers['content-type'] || '';
        if (contentType.toLowerCase().includes('text/html')) {
          request.destroy();
          reject(new Error('Server returned HTML instead of mod file'));
          return;
        }

        expectedSize = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedSize = 0;
        const startTime = Date.now();
        let lastReportTime = startTime;

        file = fs.createWriteStream(filePath, { highWaterMark: 1024 * 1024 });

        response.on('data', (chunk) => {
          if (signal?.aborted) {
            if (file) file.close();
            request.destroy();
            this.cleanupPartialFile(filePath, fileAlreadyExisted);
            reject(new Error('Synchronisation abgebrochen'));
            return;
          }

          if (this.isSkipped) {
            if (file) file.close();
            request.destroy();
            if (this.skipReason === 'skip') {
              this.cleanupPartialFile(filePath, fileAlreadyExisted);
            }
            reject(new Error('SKIPPED'));
            return;
          }

          downloadedSize += chunk.length;

          const now = Date.now();
          // Report every 250ms max to prevent flooding IPC
          if (progressCallback && expectedSize > 0 && (now - lastReportTime > 250 || downloadedSize === expectedSize)) {
            const elapsedSecs = (now - startTime) / 1000;
            const progress = (downloadedSize / expectedSize) * 100;
            
            let speedMbPerSec = 0;
            let etaSeconds = 0;
            
            if (elapsedSecs > 0) {
              const speedBytesPerSec = downloadedSize / elapsedSecs;
              speedMbPerSec = parseFloat((speedBytesPerSec / (1024 * 1024)).toFixed(2));
              const remainingBytes = expectedSize - downloadedSize;
              etaSeconds = Math.round(remainingBytes / speedBytesPerSec);
            }

            progressCallback(progress, speedMbPerSec, etaSeconds);
            lastReportTime = now;
          }
        });

        response.on('end', () => {
          downloadCompleted = true;
          if (file) file.end();
        });

        response.on('error', (error) => {
          if (file) file.close();
          this.cleanupPartialFile(filePath, fileAlreadyExisted);
          if (this.isSkipped || error?.message === 'SKIPPED') {
            reject(new Error('SKIPPED'));
          } else {
            reject(error);
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          if (file) file.close();
          this.currentRequest = null;
          this.activeResponse = null;
          this.isPaused = false;
          resolve();
        });

        file.on('error', (error) => {
          if (file) file.close();
          this.cleanupPartialFile(filePath, fileAlreadyExisted);
          if (this.isSkipped || error?.message === 'SKIPPED') {
            reject(new Error('SKIPPED'));
          } else {
            reject(error);
          }
        });
      });

      request.on('error', (error) => {
        if (file) file.close();
        this.cleanupPartialFile(filePath, fileAlreadyExisted);
        if (this.isSkipped || error?.message === 'SKIPPED') {
          reject(new Error('SKIPPED'));
        } else {
          reject(new Error(`Request error: ${error.message}`));
        }
      });

      request.setTimeout(120000, () => {
        request.destroy();
        if (file) file.close();
        this.cleanupPartialFile(filePath, fileAlreadyExisted);
        reject(new Error('Download-Timeout (2 Minuten)'));
      });

      if (signal) {
        const onAbort = () => {
          request.destroy();
          if (file) file.close();
          this.cleanupPartialFile(filePath, fileAlreadyExisted);
          reject(new Error('Synchronisation abgebrochen'));
        };
        signal.addEventListener('abort', onAbort);
      }
    });
  }

  skip(reason: 'skip' | 'local'): void {
    this.isSkipped = true;
    this.skipReason = reason;
    if (this.currentRequest) {
      this.currentRequest.destroy(new Error('SKIPPED'));
    }
  }

  pause(): void {
    this.isPaused = true;
    if (this.activeResponse) {
      logger.info('Download-Stream pausiert.');
      this.activeResponse.pause();
    }
  }

  resume(): void {
    this.isPaused = false;
    if (this.activeResponse) {
      logger.info('Download-Stream fortgesetzt.');
      this.activeResponse.resume();
    }
  }

  getSkipReason(): 'skip' | 'local' | null {
    return this.skipReason;
  }

  private cleanupPartialFile(filePath: string, existedBefore: boolean): void {
    setTimeout(() => {
      try {
        if (!existedBefore && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info(`Entferne unvollständige Download-Datei: ${filePath}`);
        }
      } catch (err) {
        logger.error(`Fehler bei Bereinigung von Teildatei: ${err}`);
      }
    }, 100);
  }
}
