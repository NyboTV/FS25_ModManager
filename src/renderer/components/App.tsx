import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import StartPage from './StartPage';
import ProfilesView from './ProfilesView';
import SettingsView from './SettingsView';
import ProfileSettingsView from './ProfileSettingsView';
import ProfileEditPopup from './ProfileEditPopup';
import SyncProgressPopup from './SyncProgressPopup';
import ModInfoPopup from './ModInfoPopup';
import LogAnalyzerView from './LogAnalyzerView';
import { Settings, UpdateInfo, SyncProgress, ModInfo } from '../../common/types';
import { useTranslation } from '../i18n';

const { ipcRenderer } = window.require('electron');

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();  const [settings, setSettings] = useState<Settings>({
    games: {
      fs19: {
        gamePath: '',
        defaultModFolder: ''
      },
      fs22: {
        gamePath: '',
        defaultModFolder: ''
      },
      fs25: {
        gamePath: '',
        defaultModFolder: ''
      }
    },
    autoCheckUpdates: true,
    language: 'de',
    debugLogging: false,
    currentVersion: '1.0.0'
  });

  // Popup-States
  const [showProfileEditPopup, setShowProfileEditPopup] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  
  const [showSyncProgress, setShowSyncProgress] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    currentMod: '',
    totalMods: 0,
    completedMods: 0,
    currentFileProgress: 0,
    status: 'downloading'
  });

  const [showModInfo, setShowModInfo] = useState(false);
  const [selectedMod, setSelectedMod] = useState<ModInfo | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'available' | 'downloading' | 'ready'>('available');
  const [updateProgress, setUpdateProgress] = useState({ percent: 0, speed: 0 });
  const [modListReloadKey, setModListReloadKey] = useState(0);
  const [autoLaunchOnSyncComplete, setAutoLaunchOnSyncComplete] = useState(false);

  // Übersetzungsfunktion
  const t = useTranslation(settings.language);
  useEffect(() => {
    // Lade die App-Einstellungen beim Start
    const loadSettings = async () => {
      const savedSettings = await ipcRenderer.invoke('load-settings');
      setSettings(savedSettings);
      
      // Setze das Theme basierend auf den Einstellungen
      document.body.className = savedSettings.theme === 'dark' ? 'theme-dark' : '';
    };
    
    loadSettings();

    // Event-Listener für IPC-Events
    const handleUpdateAvailable = (event: any, info: UpdateInfo) => {
      setUpdateInfo(info);
      setShowUpdateDialog(true);
    };

    const handleSyncProgress = (event: any, progress: SyncProgress) => {
      setSyncProgress(progress);
      if (!showSyncProgress) {
        setShowSyncProgress(true);
      }
    };

  const handleSyncComplete = async () => {
    setSyncProgress(prev => ({ ...prev, status: 'completed' }));
    setModListReloadKey(key => key + 1); // Trigger Reload
    
    // Auto Launch
    if (autoLaunchOnSyncComplete) {
      setSyncProgress(prev => ({ ...prev, status: 'launching', currentMod: 'Starte Spiel...' }));
      try {
        const profiles = await ipcRenderer.invoke('load-profiles');
        // Hacky way to get profileId since it might be in state
        // Da state updates asynchron sind, holen wir die aktuelle Progress direkt von der Main oder wir nutzen einen Ref.
        // Einfacher: Wir holen uns das Profil aus den global geladenen Profilen
      } catch (error) {
        console.error('Fehler beim Auto-Launch:', error);
      }
    }
  };
  const handleSyncError = (event: any, error: string) => {
    setSyncProgress(prev => ({ ...prev, status: 'error' }));
    setModListReloadKey(key => key + 1); // Trigger Reload auch bei Fehler
  };

    ipcRenderer.on('update-available', handleUpdateAvailable);
    ipcRenderer.on('sync-progress', handleSyncProgress);
    ipcRenderer.on('sync-complete', handleSyncComplete);
    ipcRenderer.on('sync-error', handleSyncError);
    
    const handleUpdateProgress = (e: any, progress: any) => {
      setUpdateStatus('downloading');
      setUpdateProgress(progress);
    };
    
    const handleUpdateDownloaded = () => {
      setUpdateStatus('ready');
    };
    
    ipcRenderer.on('update-download-progress', handleUpdateProgress);
    ipcRenderer.on('update-downloaded', handleUpdateDownloaded);

    return () => {
      ipcRenderer.removeListener('update-available', handleUpdateAvailable);
      ipcRenderer.removeListener('sync-progress', handleSyncProgress);
      ipcRenderer.removeListener('sync-complete', handleSyncComplete);
      ipcRenderer.removeListener('sync-error', handleSyncError);
      ipcRenderer.removeListener('update-download-progress', handleUpdateProgress);
      ipcRenderer.removeListener('update-downloaded', handleUpdateDownloaded);
    };
  }, [showSyncProgress, autoLaunchOnSyncComplete, settings]); // settings und autoLaunch als Dependency hinzufügen

  // Ref für AutoLaunch & SyncProgress, um in der useEffect Closure immer den aktuellen Wert zu haben
  const syncProgressRef = React.useRef(syncProgress);
  const autoLaunchRef = React.useRef(autoLaunchOnSyncComplete);
  const settingsRef = React.useRef(settings);
  
  useEffect(() => {
    syncProgressRef.current = syncProgress;
    autoLaunchRef.current = autoLaunchOnSyncComplete;
    settingsRef.current = settings;
  }, [syncProgress, autoLaunchOnSyncComplete, settings]);

  useEffect(() => {
    const onSyncCompleteAsync = async () => {
      if (autoLaunchRef.current && syncProgressRef.current.profileId) {
        try {
          const profiles = await ipcRenderer.invoke('load-profiles');
          const profile = profiles.find((p: any) => p.id === syncProgressRef.current.profileId);
          if (profile) {
            const gameVersion = (profile.gameVersion as keyof typeof settingsRef.current.games) || 'fs25';
            const gameSettings = settingsRef.current.games?.[gameVersion];
            if (gameSettings?.defaultModFolder && gameSettings?.gamePath) {
              await ipcRenderer.invoke('deploy-profile-mods', profile.id, gameSettings.defaultModFolder);
              await ipcRenderer.invoke('launch-game', gameSettings.gamePath);
            }
          }
        } catch (err) {
          console.error("Auto-launch failed:", err);
        }
      }
    };
    
    // Override den handleSyncComplete vom anderen useEffect
    const handleSyncCompleteOverride = () => {
      setSyncProgress(prev => ({ ...prev, status: 'completed' }));
      setModListReloadKey(key => key + 1);
      onSyncCompleteAsync();
    };

    ipcRenderer.removeAllListeners('sync-complete');
    ipcRenderer.on('sync-complete', handleSyncCompleteOverride);
    
    return () => {
      ipcRenderer.removeListener('sync-complete', handleSyncCompleteOverride);
    }
  }, []); // Dieser Effekt kümmert sich nur um sync-complete Override

  const handleSkipCurrentMod = () => {
    ipcRenderer.invoke('skip-current-mod');
  };

  const handleProvideLocalMod = () => {
    if (syncProgress.currentMod && syncProgress.profileId) {
      ipcRenderer.invoke('provide-local-mod', syncProgress.currentMod, syncProgress.profileId);
    }
  };

  const handleCancelSync = async () => {
    try {
      await ipcRenderer.invoke('abort-sync');
      setShowSyncProgress(false);
      setSyncProgress({
        currentMod: '',
        totalMods: 0,
        completedMods: 0,
        currentFileProgress: 0,
        status: 'cancelled'
      });
    } catch (error) {
      console.error('Fehler beim Abbrechen der Synchronisation:', error);
    }
  };
  // Aktuellen Tab basierend auf der URL bestimmen
  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/profiles')) return 'profiles';
    if (path.startsWith('/logs')) return 'logs';
    if (path.startsWith('/profile-settings')) return 'profile-settings';
    return 'start';
  };
  const handleMinimize = () => {
    ipcRenderer.invoke('minimize-window');
  };
  
  const handleMaximize = () => {
    ipcRenderer.invoke('maximize-window');
  };
    const handleClose = () => {
    ipcRenderer.invoke('close-window');
  };

  // Popup-Handler
  const handleCreateProfile = () => {
    setEditingProfile(null);
    setIsCreatingProfile(true);
    setShowProfileEditPopup(true);
  };

  const handleEditProfile = (profile: any) => {
    setEditingProfile(profile);
    setIsCreatingProfile(false);
    setShowProfileEditPopup(true);
  };
  const handleSaveProfile = async (profile: any) => {
    try {
      if (isCreatingProfile) {
        await ipcRenderer.invoke('create-profile', profile);
      } else {
        await ipcRenderer.invoke('update-profile', profile);
      }
      setShowProfileEditPopup(false);
      
      // Aktualisiere die Profile-Liste nach dem Speichern
      if (location.pathname === '/profiles') {
        // Trigger Reload der ProfilesView
        window.location.reload();
      }
    } catch (error) {
      console.error('Fehler beim Speichern des Profils:', error);
    }
  };

  const handleShowModInfo = (mod: ModInfo) => {
    setSelectedMod(mod);
    setShowModInfo(true);
  };

  const handleDownloadUpdate = () => {
    setUpdateStatus('downloading');
    ipcRenderer.invoke('download-update');
  };
  
  const handleInstallUpdate = () => {
    ipcRenderer.invoke('install-update');
  };

  return (    <div className="container">
      <header className="header">
        <h1>{t('app.title')}</h1>
        
        <div className="window-controls">
          <button className="minimize" onClick={handleMinimize}>_</button>
          <button className="maximize" onClick={handleMaximize}>□</button>
          <button className="close" onClick={handleClose}>✕</button>
        </div>
      </header>
      
      <div className="tabs">
        <div 
          className={`tab ${getCurrentTab() === 'start' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          {t('nav.start')}
        </div>
        <div 
          className={`tab ${getCurrentTab() === 'profiles' ? 'active' : ''}`}
          onClick={() => navigate('/profiles')}
        >
          {t('nav.profiles')}
        </div>
        <div 
          className={`tab ${getCurrentTab() === 'settings' ? 'active' : ''}`}
          onClick={() => navigate('/settings')}
        >
          {t('nav.settings')}
        </div>
        <div 
          className={`tab ${getCurrentTab() === 'logs' ? 'active' : ''}`}
          onClick={() => navigate('/logs')}
        >
          Log Analyzer
        </div>
        {location.pathname.includes('/profile-settings/') && (
          <div className="tab active">
            {t('nav.profileSettings')}
          </div>
        )}
      </div>      <div className="content">
        <Routes>
          <Route path="/" element={<StartPage settings={settings} modListReloadKey={modListReloadKey} />} />
          <Route path="/profiles" element={
            <ProfilesView 
              settings={settings} 
              onCreateProfile={handleCreateProfile}
              onEditProfile={handleEditProfile}
              onShowModInfo={handleShowModInfo}
              modListReloadKey={modListReloadKey}
            />
          } />
          <Route path="/settings" element={<SettingsView settings={settings} setSettings={setSettings} />} />
          <Route path="/profile-settings/:id" element={<ProfileSettingsView settings={settings} modListReloadKey={modListReloadKey} />} />
          <Route path="/logs" element={<LogAnalyzerView settings={settings} />} />
        </Routes>
      </div>

      <footer className="footer">
        <div className="footer-content">
          <div className="copyright">
            Farming Mod Manager © 2025 | <a href="#" onClick={() => ipcRenderer.invoke('open-external', 'https://github.com/NyboTV/FS25_ModManager')}>GitHub</a>
          </div>
          <div className="version">
            Version {settings.currentVersion}
          </div>
        </div>
        <div className="legal">
          Farming Simulator ist eine eingetragene Marke von GIANTS Software GmbH. Diese Anwendung steht in keiner Verbindung zu GIANTS Software.
        </div>
      </footer>      {/* Popups */}      <ProfileEditPopup
        profile={editingProfile}
        isOpen={showProfileEditPopup}
        onClose={() => setShowProfileEditPopup(false)}
        onSave={handleSaveProfile}
        isCreating={isCreatingProfile}
        language={settings.language}
        settings={settings}
      />      <SyncProgressPopup
        isOpen={showSyncProgress}
        progress={syncProgress}
        onCancel={handleCancelSync}
        onSkipCurrentMod={handleSkipCurrentMod}
        onProvideLocalMod={handleProvideLocalMod}
        autoLaunch={autoLaunchOnSyncComplete}
        onAutoLaunchChange={setAutoLaunchOnSyncComplete}
        language={settings.language}
      />

      <ModInfoPopup
        mod={selectedMod}
        isOpen={showModInfo}
        onClose={() => setShowModInfo(false)}
        language={settings.language}
      />

      {/* Update Dialog */}
      {showUpdateDialog && updateInfo && (
        <div className="popup-overlay">
          <div className="popup-content update-dialog">            <div className="popup-header">
              <h2>{t('update.available')}</h2>
              <button className="popup-close" onClick={() => setShowUpdateDialog(false)}>×</button>
            </div>
            <div className="popup-body">
              {updateStatus === 'available' && (
                <>
                  <p>Eine neue Version ist verfügbar!</p>
                  <div className="version-info">
                    <div>{t('update.current')}: <strong>{updateInfo.currentVersion}</strong></div>
                    <div>{t('update.latest')}: <strong>{updateInfo.latestVersion}</strong></div>
                  </div>
                  {updateInfo.releaseNotes && (
                    <div className="release-notes">
                      <h4>{t('update.releaseNotes')}:</h4>
                      <div className="notes-content">{updateInfo.releaseNotes}</div>
                    </div>
                  )}
                </>
              )}
              {updateStatus === 'downloading' && (
                <div className="update-progress">
                  <p>Update wird heruntergeladen...</p>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${updateProgress.percent}%` }} />
                  </div>
                  <div className="progress-stats">
                    <span>{Math.round(updateProgress.percent)}%</span>
                    <span>{(updateProgress.speed / (1024 * 1024)).toFixed(2)} MB/s</span>
                  </div>
                </div>
              )}
              {updateStatus === 'ready' && (
                <div className="update-ready">
                  <p>Das Update wurde erfolgreich heruntergeladen und ist bereit zur Installation!</p>
                  <p>Die Anwendung wird neu gestartet.</p>
                </div>
              )}
            </div>
            <div className="popup-footer">
              {updateStatus === 'available' && (
                <>
                  <button className="button secondary" onClick={() => setShowUpdateDialog(false)}>
                    {t('update.later')}
                  </button>
                  <button className="button primary" onClick={handleDownloadUpdate}>
                    {t('update.download')}
                  </button>
                </>
              )}
              {updateStatus === 'downloading' && (
                <button className="button secondary" disabled>
                  Herunterladen...
                </button>
              )}
              {updateStatus === 'ready' && (
                <button className="button primary" onClick={handleInstallUpdate}>
                  Jetzt Neustarten & Installieren
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
