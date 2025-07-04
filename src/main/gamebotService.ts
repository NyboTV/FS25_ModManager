import * as https from 'https';
import * as http from 'http';
import { logger } from './logger';
import { GamebotServer, GamebotApiResponse, GamebotPlayerStats, GamebotMod } from '../common/types';

/**
 * Service class for interacting with farming.gamebot.me API
 */
export class GamebotService {
  private baseUrl = 'https://farming.gamebot.me/api';
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.apiKey = apiKey;
    }
  }

  /**
   * Set API key for authentication
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    logger.debug('Gamebot API key updated');
  }

  /**
   * Make HTTP request to gamebot API
   */
  private async makeRequest<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<GamebotApiResponse<T>> {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}${endpoint}`;
      const client = url.startsWith('https://') ? https : http;
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FS25-ModManager/1.0.0',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        }
      };

      logger.debug(`Making ${method} request to gamebot API: ${url}`);

      const req = client.request(url, options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsedResponse = JSON.parse(responseData);
            
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              logger.debug(`Gamebot API request successful: ${endpoint}`);
              resolve({
                success: true,
                data: parsedResponse,
                timestamp: new Date().toISOString()
              });
            } else {
              logger.warn(`Gamebot API request failed: ${res.statusCode} - ${responseData}`);
              resolve({
                success: false,
                error: parsedResponse.error || `HTTP ${res.statusCode}`,
                timestamp: new Date().toISOString()
              });
            }
          } catch (error) {
            logger.error('Failed to parse gamebot API response', error);
            resolve({
              success: false,
              error: 'Invalid response format',
              timestamp: new Date().toISOString()
            });
          }
        });
      });

      req.on('error', (error) => {
        logger.error('Gamebot API request error', error);
        reject(error);
      });

      req.setTimeout(10000, () => {
        logger.error('Gamebot API request timeout');
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data && method === 'POST') {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  /**
   * Get list of servers
   */
  async getServers(): Promise<GamebotServer[]> {
    try {
      const response = await this.makeRequest<GamebotServer[]>('/servers');
      
      if (response.success && response.data) {
        return response.data;
      } else {
        logger.warn(`Failed to get servers: ${response.error}`);
        return [];
      }
    } catch (error) {
      logger.error('Error getting servers from gamebot', error);
      return [];
    }
  }

  /**
   * Get specific server details
   */
  async getServer(serverId: string): Promise<GamebotServer | null> {
    try {
      const response = await this.makeRequest<GamebotServer>(`/servers/${serverId}`);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        logger.warn(`Failed to get server ${serverId}: ${response.error}`);
        return null;
      }
    } catch (error) {
      logger.error(`Error getting server ${serverId} from gamebot`, error);
      return null;
    }
  }

  /**
   * Get mods for a specific server
   */
  async getServerMods(serverId: string): Promise<GamebotMod[]> {
    try {
      const response = await this.makeRequest<GamebotMod[]>(`/servers/${serverId}/mods`);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        logger.warn(`Failed to get mods for server ${serverId}: ${response.error}`);
        return [];
      }
    } catch (error) {
      logger.error(`Error getting mods for server ${serverId} from gamebot`, error);
      return [];
    }
  }

  /**
   * Get player statistics
   */
  async getPlayerStats(username: string): Promise<GamebotPlayerStats | null> {
    try {
      const response = await this.makeRequest<GamebotPlayerStats>(`/players/${username}/stats`);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        logger.warn(`Failed to get stats for player ${username}: ${response.error}`);
        return null;
      }
    } catch (error) {
      logger.error(`Error getting stats for player ${username} from gamebot`, error);
      return null;
    }
  }

  /**
   * Test API connection and authentication
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.makeRequest('/ping');
      
      if (response.success) {
        return {
          success: true,
          message: 'Gamebot API connection successful'
        };
      } else {
        return {
          success: false,
          message: response.error || 'Connection failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Download mod file from gamebot
   */
  async downloadMod(mod: GamebotMod, destinationPath: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const client = mod.downloadUrl.startsWith('https://') ? https : http;
      
      logger.info(`Downloading mod from gamebot: ${mod.name} v${mod.version}`);
      
      const req = client.get(mod.downloadUrl, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          logger.error(`Failed to download mod: HTTP ${res.statusCode}`);
          resolve({ success: false, error: `HTTP ${res.statusCode}` });
          return;
        }

        const fs = require('fs');
        const fileStream = fs.createWriteStream(destinationPath);
        
        res.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          logger.info(`Mod downloaded successfully: ${mod.name}`);
          resolve({ success: true });
        });
        
        fileStream.on('error', (err: Error) => {
          fs.unlink(destinationPath, () => {});
          logger.error(`Error writing mod file: ${err.message}`);
          resolve({ success: false, error: err.message });
        });
      });
      
      req.on('error', (err) => {
        logger.error(`Error downloading mod: ${err.message}`);
        resolve({ success: false, error: err.message });
      });
      
      req.setTimeout(30000, () => {
        req.destroy();
        resolve({ success: false, error: 'Download timeout' });
      });
      
      req.end();
    });
  }
}

// Export singleton instance
export const gamebotService = new GamebotService();