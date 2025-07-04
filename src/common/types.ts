export interface Profile {
  id: string;
  name: string;
  version: string;
  description?: string;
  serverSyncUrl?: string;
  modFolderPath: string;
  lastSyncDate?: string;
  mods: ModInfo[];
  gamebotSettings?: GamebotSettings;
}

export interface ModInfo {
  id: string;
  name: string;
  version?: string;
  author?: string;
  description?: string;
  isActive: boolean;
  filePath: string;
  fileSize: number;
  lastModified: string;
  isFromServer: boolean;
}

export interface Settings {
  defaultModFolder: string;
  gamePath: string;
  theme: 'light' | 'dark';
  autoCheckUpdates: boolean;
  language: string;
  debugLogging: boolean;
  gamebotApiKey?: string;
  gamebotEnabled?: boolean;
}

export interface ServerModResponse {
  mods: ServerModInfo[];
}

export interface ServerModInfo {
  id: string;
  name: string;
  version: string;
  fileSize: number;
  downloadUrl: string;
  required: boolean;
}

// Gamebot Integration Types
export interface GamebotSettings {
  enabled: boolean;
  apiKey?: string;
  serverIds: string[];
  autoSync: boolean;
  syncInterval: number; // in minutes
}

export interface GamebotServer {
  id: string;
  name: string;
  ip: string;
  port: number;
  status: 'online' | 'offline' | 'maintenance';
  players: {
    current: number;
    max: number;
  };
  map: string;
  mods: GamebotMod[];
  lastUpdate: string;
}

export interface GamebotMod {
  id: string;
  name: string;
  version: string;
  downloadUrl: string;
  fileSize: number;
  required: boolean;
  hash?: string;
}

export interface GamebotPlayerStats {
  username: string;
  playtime: number;
  level: number;
  money: number;
  lastSeen: string;
  serverStats: {
    [serverId: string]: {
      playtime: number;
      lastPlayed: string;
    };
  };
}

export interface GamebotApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
