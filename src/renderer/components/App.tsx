import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import StartPage from './StartPage';
import ProfilesView from './ProfilesView';
import SettingsView from './SettingsView';
import ProfileSettingsView from './ProfileSettingsView';
import ProfileEditPopup from './ProfileEditPopup';
import SyncProgressPopup from './SyncProgressPopup';
import ModInfoPopup from './ModInfoPopup';
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
  const [modListReloadKey, setModListReloadKey] = useState(0);

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

  const handleSyncComplete = () => {
    setSyncProgress(prev => ({ ...prev, status: 'completed' }));
    setModListReloadKey(key => key + 1); // Trigger Reload
  };
  const handleSyncError = (event: any, error: string) => {
    setSyncProgress(prev => ({ ...prev, status: 'error' }));
    setModListReloadKey(key => key + 1); // Trigger Reload auch bei Fehler
  };

    ipcRenderer.on('update-available', handleUpdateAvailable);
    ipcRenderer.on('sync-progress', handleSyncProgress);
    ipcRenderer.on('sync-complete', handleSyncComplete);
    ipcRenderer.on('sync-error', handleSyncError);

    return () => {
      ipcRenderer.removeListener('update-available', handleUpdateAvailable);
      ipcRenderer.removeListener('sync-progress', handleSyncProgress);
      ipcRenderer.removeListener('sync-complete', handleSyncComplete);
      ipcRenderer.removeListener('sync-error', handleSyncError);
    };
  }, [showSyncProgress]);

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
    if (updateInfo?.downloadUrl) {
      ipcRenderer.invoke('open-external', updateInfo.downloadUrl);
    }
    setShowUpdateDialog(false);
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
            </div>
            <div className="popup-footer">
              <button className="button secondary" onClick={() => setShowUpdateDialog(false)}>
                {t('update.later')}
              </button>
              <button className="button primary" onClick={handleDownloadUpdate}>
                {t('update.download')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
