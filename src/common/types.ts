export interface Profile {
  id: string;
  name: string;
  version: string;
  description?: string;
  serverSyncUrl?: string;
  modFolderPath: string;
  lastSyncDate?: string;
  mods: ModInfo[];
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
