export interface Profile {
  id: string;
  name: string;
  version: string;
  description?: string;
  serverSyncUrl?: string;
  serverModListUrl?: string;
  modFolderPath: string;
  gameVersion: 'fs19' | 'fs22' | 'fs25'; // Neue Property für Spielversion
  lastSyncDate?: string;
  serverWebStatsUrl?: string;
  autoBackupSavegame?: boolean;
  savegameIndex?: number;
  launchParameters?: string;
  mods: ModInfo[];
}

export interface ModInfo {
  name: string;
  version?: string;
  author?: string;
  description?: string;
  isActive: boolean;
  fileName: string;
  fileSize: string; // z.B. "40.37 MB"
  modHub?: string;
  downloadUrl?: string;
  detailUrl?: string;
  iconPath?: string;
  tags?: string[];
  modHubId?: string;
  modHubCategory?: string;
  modHubVersion?: string;
  modHubRating?: string;
  modHubVotes?: string;
  modHubSize?: string;
  modHubReleased?: string;
  modHubPlatform?: string;
  modHubManufacturer?: string;
  modDescData?: ModDescData;
  isDLC?: boolean;
  isFromServer?: boolean;
}

export interface ModDescData {
  author?: string;
  version?: string;
  title?: { [lang: string]: string };
  description?: { [lang: string]: string };
  iconFilename?: string;
  multiplayerSupported?: boolean;
  dependencies?: string[];
  isMap?: boolean;
  category?: string;
}

export interface GameSettings {
  gamePath: string;
  defaultModFolder: string;
}

export interface Settings {
  games: {
    fs19: GameSettings;
    fs22: GameSettings;
    fs25: GameSettings;
  };
  autoCheckUpdates: boolean;
  language: 'en' | 'de' | 'fr';
  debugLogging: boolean;
  betaUpdates?: boolean;
  currentVersion?: string;
  selectedGame?: 'fs19' | 'fs22' | 'fs25';
  defaultModFolder?: string;
  gamePath?: string;
  theme?: 'light' | 'dark';
  lastLaunchedProfileId?: string;
  autoStartProfileId?: string | null;
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

export interface SyncProgress {
  profileId?: string;
  currentMod: string;
  totalMods: number;
  completedMods: number;
  currentFileProgress: number;
  speedMbPerSec?: number;
  etaSeconds?: number;
  status: 'downloading' | 'extracting' | 'verifying' | 'completed' | 'error' | 'cancelled' | 'saving' | 'launching' | 'paused';
  downloadSource?: 'fastDL' | 'modList' | 'modsPage';
  failedMods?: string[];
  errorMessage?: string;
  totalServerMods?: number;
}

export interface PopupData {
  type: 'profile-edit' | 'confirm' | 'info' | 'error';
  title: string;
  data?: any;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl?: string;
  releaseNotes?: string;
  isPreRelease?: boolean;
}

export interface LanguageStrings {
  [key: string]: string;
}
