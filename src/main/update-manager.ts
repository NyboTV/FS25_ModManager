import * as https from 'https';
import { UpdateInfo } from '../common/types';
import { logger } from './main';

export class UpdateManager {
  private readonly githubRepo = 'NyboTV/FS25_ModManager';
  private readonly currentVersion: string;

  constructor(currentVersion: string) {
    this.currentVersion = currentVersion;
  }

  /**
   * Prüft auf Updates vom GitHub Repository
   */
  async checkForUpdates(): Promise<UpdateInfo> {
    try {
      const latestRelease = await this.getLatestRelease();
      
      if (!latestRelease) {
        return {
          hasUpdate: false,
          currentVersion: this.currentVersion,
          latestVersion: this.currentVersion
        };
      }

      const hasUpdate = this.compareVersions(this.currentVersion, latestRelease.tag_name) < 0;

      return {
        hasUpdate,
        currentVersion: this.currentVersion,
        latestVersion: latestRelease.tag_name,
        downloadUrl: latestRelease.html_url,
        releaseNotes: latestRelease.body
      };
    } catch (error) {
      logger.error('Fehler beim Prüfen auf Updates:', error);
      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        latestVersion: this.currentVersion
      };
    }
  }

  /**
   * Holt die neueste Version vom GitHub API
   */
  private async getLatestRelease(): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.githubRepo}/releases/latest`,
        headers: {
          'User-Agent': 'FS25-ModManager'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const release = JSON.parse(data);
              resolve(release);
            } else {
              logger.warn(`GitHub API Fehler: ${res.statusCode}`);
              resolve(null);
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request Timeout'));
      });

      req.end();
    });
  }

  /**
   * Vergleicht zwei Versionsnummern
   * Rückgabe: -1 wenn v1 < v2, 0 wenn gleich, 1 wenn v1 > v2
   */
  private compareVersions(v1: string, v2: string): number {
    // Entferne 'v' Präfix falls vorhanden
    const version1 = v1.replace(/^v/, '');
    const version2 = v2.replace(/^v/, '');

    const parts1 = version1.split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = version2.split('.').map(n => parseInt(n, 10) || 0);

    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }

    return 0;
  }
}
