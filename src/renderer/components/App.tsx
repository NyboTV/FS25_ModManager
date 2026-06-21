import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import StartPage from './StartPage';
import ProfilesView from './ProfilesView';
import SettingsView from './SettingsView';
import SyncProgressPopup from './SyncProgressPopup';
import ModInfoPopup from './ModInfoPopup';
import LogAnalyzerView from './LogAnalyzerView';
import StorageCleanerView from './StorageCleanerView';
import InGameUpdatesPopup from './InGameUpdatesPopup';
import ModBrowserView from './ModBrowserView';
import SplashScreen from './SplashScreen';
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
  const [appIsReady, setAppIsReady] = useState(false);
  
  const [showSyncProgress, setShowSyncProgress] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    currentMod: '',
    totalMods: 0,
    completedMods: 0,
    currentFileProgress: 0,
    status: 'downloading'
  });

  const [mappingProgress, setMappingProgress] = useState<{current: number, total: number, modName: string, status: string, profileName?: string} | null>(null);
  const [activeDownloads, setActiveDownloads] = useState<Record<string, {modId: string, fileName: string, status: string, percent: number, profileName?: string}>>({});

  const [showModInfo, setShowModInfo] = useState(false);
  const [selectedMod, setSelectedMod] = useState<ModInfo | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'available' | 'downloading' | 'ready' | 'error'>('available');
  const [updateProgress, setUpdateProgress] = useState({ percent: 0, speed: 0 });
  const [updateErrorMsg, setUpdateErrorMsg] = useState<string>('');
  const [modListReloadKey, setModListReloadKey] = useState(0);
  const [autoLaunchOnSyncComplete, setAutoLaunchOnSyncComplete] = useState(false);
  const [inGameUpdates, setInGameUpdates] = useState<{ profile: any, changes: string[] } | null>(null);

  // Übersetzungsfunktion
  const t = useTranslation(settings.language);
  useEffect(() => {
    // Lade die App-Einstellungen beim Start
    const loadSettings = async () => {
      const savedSettings = await ipcRenderer.invoke('load-settings');
      setSettings(savedSettings);
      
      // Setze das Theme basierend auf den Einstellungen
      document.body.className = savedSettings.theme === 'dark' ? 'theme-dark' : '';
      
      // Check for in-game updates
      if (savedSettings.lastLaunchedProfileId) {
        try {
          const profiles = await ipcRenderer.invoke('load-profiles');
          const lastProfile = profiles.find((p: any) => p.id === savedSettings.lastLaunchedProfileId);
          if (lastProfile) {
            const gameVersion = lastProfile.gameVersion || 'fs25';
            const gamePath = savedSettings.games[gameVersion as keyof typeof savedSettings.games]?.defaultModFolder;
            if (gamePath) {
              const result = await ipcRenderer.invoke('check-in-game-mod-updates', lastProfile.id, gamePath);
              if (result.success && result.hasChanges) {
                setInGameUpdates({ profile: lastProfile, changes: result.changes });
              }
            }
          }
        } catch (e) {
          console.error('Failed to check in-game updates', e);
        }
      }
    };
    
    loadSettings();
  }, []);

  useEffect(() => {

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

    const handleUpdateError = (e: any, errorMsg: string) => {
      setUpdateStatus('error');
      setUpdateErrorMsg(errorMsg);
    };
    
    ipcRenderer.on('update-download-progress', handleUpdateProgress);
    ipcRenderer.on('update-downloaded', handleUpdateDownloaded);
    ipcRenderer.on('update-error', handleUpdateError);

    const handleMappingProgress = (_: any, data: any) => setMappingProgress(data);
    const handleMappingComplete = () => {
      setMappingProgress(null);
      setModListReloadKey(key => key + 1); // Reload to show updated ModHub IDs and versions
    };

    ipcRenderer.on('modhub-mapping-progress', handleMappingProgress);
    ipcRenderer.on('modhub-mapping-complete', handleMappingComplete);

    const handleModUpdateProgress = (_: any, data: any) => {
      setActiveDownloads(prev => ({ ...prev, [data.modId]: data }));
    };
    const handleModUpdateComplete = (_: any, data: any) => {
      setActiveDownloads(prev => {
        const next = { ...prev };
        delete next[data.modId];
        return next;
      });
      if (data.success) {
        setModListReloadKey(key => key + 1);
      } else {
        if (data.error !== 'Abgebrochen') {
          alert(`Fehler beim Update von ${data.fileName}: ${data.error}`);
        }
      }
    };

    ipcRenderer.on('mod-update-progress', handleModUpdateProgress);
    ipcRenderer.on('mod-update-complete', handleModUpdateComplete);

    return () => {
      ipcRenderer.removeListener('update-available', handleUpdateAvailable);
      ipcRenderer.removeListener('sync-progress', handleSyncProgress);
      ipcRenderer.removeListener('sync-complete', handleSyncComplete);
      ipcRenderer.removeListener('sync-error', handleSyncError);
      ipcRenderer.removeListener('update-download-progress', handleUpdateProgress);
      ipcRenderer.removeListener('update-downloaded', handleUpdateDownloaded);
      ipcRenderer.removeListener('update-error', handleUpdateError);
      ipcRenderer.removeListener('modhub-mapping-progress', handleMappingProgress);
      ipcRenderer.removeListener('modhub-mapping-complete', handleMappingComplete);
      ipcRenderer.removeListener('mod-update-progress', handleModUpdateProgress);
      ipcRenderer.removeListener('mod-update-complete', handleModUpdateComplete);
    };
  }, [showSyncProgress, autoLaunchOnSyncComplete]); // Removed 'settings' to prevent infinite loop

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
    if (path.startsWith('/modbrowser')) return 'modbrowser';
    if (path.startsWith('/logs')) return 'logs';
    if (path.startsWith('/profile-settings')) return 'profile-settings';
    if (path.startsWith('/storage')) return 'storage';
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

  return (
    <div className="container">
      {!appIsReady && <SplashScreen onComplete={() => setAppIsReady(true)} language={settings?.language} />}
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
          className={`tab ${getCurrentTab() === 'modbrowser' ? 'active' : ''}`}
          onClick={() => navigate('/modbrowser')}
        >
          ModHub
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
          {t('nav.logs')}
        </div>
        <div 
          className={`tab ${getCurrentTab() === 'storage' ? 'active' : ''}`}
          onClick={() => navigate('/storage')}
        >
          {t('nav.storage')}
        </div>
        
        {getCurrentTab() === 'modbrowser' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '5px', alignItems: 'center', paddingRight: '15px' }}>
            <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '14px', background: 'var(--surface)' }} onClick={() => window.dispatchEvent(new CustomEvent('webview-go-back'))}>&larr;</button>
            <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '14px', background: 'var(--surface)' }} onClick={() => window.dispatchEvent(new CustomEvent('webview-go-forward'))}>&rarr;</button>
            <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '14px', background: 'var(--surface)' }} onClick={() => window.dispatchEvent(new CustomEvent('webview-reload'))}>&#x21bb;</button>
          </div>
        )}
      </div>
      <div className="content">
        <Routes>
          <Route path="/" element={<StartPage settings={settings} modListReloadKey={modListReloadKey} />} />
          <Route path="/profiles" element={
            <ProfilesView 
              settings={settings} 
              onShowModInfo={handleShowModInfo}
              modListReloadKey={modListReloadKey}
            />
          } />
          <Route path="/settings" element={<SettingsView settings={settings} setSettings={setSettings} />} />
          <Route path="/modbrowser" element={<ModBrowserView settings={settings} />} />
          <Route path="/logs" element={<LogAnalyzerView settings={settings} />} />
          <Route path="/storage" element={<StorageCleanerView settings={settings} />} />
        </Routes>
      </div>

      <footer className="footer">
        <div className="footer-content">
          <div className="copyright">
            Farming Mod Manager © 2026 | <a href="#" onClick={() => ipcRenderer.invoke('open-external', 'https://github.com/NyboTV/FS25_ModManager')}>GitHub</a>
          </div>
          <div className="version">
            Version {settings.currentVersion}
          </div>
        </div>
        <div className="legal">
          Farming Simulator ist eine eingetragene Marke von GIANTS Software GmbH. Diese Anwendung steht in keiner Verbindung zu GIANTS Software.
        </div>
      </footer>      

      {mappingProgress && (
          <div className="mapping-toast" style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: 'rgba(20, 20, 25, 0.95)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '15px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 9999,
            width: '300px'
          }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--primary-color)' }}>
              {mappingProgress.status === 'checking_updates' ? 'ModHub Update-Check' : t('mapping.title')}
              {mappingProgress.profileName ? ` (${mappingProgress.profileName})` : ''}
            </h4>
            <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#ccc' }}>
              {mappingProgress.status === 'checking_updates' ? 'Prüfe auf Updates beim ModHub...' : t('mapping.desc')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>{mappingProgress.modName}</span>
              <span>{mappingProgress.current} / {mappingProgress.total}</span>
            </div>
            <div className="progress-bar" style={{ height: '6px', backgroundColor: 'var(--surface)', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
              <div className="progress-fill" style={{ width: `${mappingProgress.total > 0 ? (mappingProgress.current / mappingProgress.total) * 100 : 100}%`, height: '100%', backgroundColor: 'var(--primary-color)' }} />
            </div>
            <button 
                onClick={() => {
                  ipcRenderer.send('cancel-modhub-mapping');
                  setMappingProgress(null);
                }}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-color)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--surface)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Abbrechen
              </button>
          </div>
        )}

      {Object.keys(activeDownloads).length > 0 && (
          <div className="mapping-toast" style={{
            position: 'fixed',
            bottom: mappingProgress ? '140px' : '20px',
            right: '20px',
            backgroundColor: 'rgba(20, 20, 25, 0.95)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '15px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 9999,
            width: '320px',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--primary-color)' }}>
              Mod Downloads ({Object.keys(activeDownloads).length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {Object.values(activeDownloads).map((download) => (
                <div key={download.modId} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h5 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#fff' }}>
                      {download.profileName ? `[${download.profileName}] ` : ''}{download.fileName}
                    </h5>
                    <button 
                      onClick={() => {
                        if (confirm(t('downloads.cancelConfirm') || 'Download wirklich abbrechen?')) {
                          ipcRenderer.send('cancel-mod-download', download.modId);
                        }
                      }}
                      title={t('downloads.cancel') || 'Abbrechen'}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: 'var(--text-muted)', 
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '0 4px',
                        lineHeight: '1'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px', color: '#ccc' }}>
                    <span>{download.status === 'queued' ? 'In Warteschlange...' : download.status === 'starting' ? 'Verbinde...' : 'Lade herunter'}</span>
                    <span>{download.percent}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: '6px', backgroundColor: 'var(--surface)', borderRadius: '3px', overflow: 'hidden', marginBottom: '0' }}>
                    <div className="progress-fill" style={{ width: `${download.percent}%`, height: '100%', backgroundColor: download.status === 'queued' ? '#6b7280' : '#ef4444' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Popups */}
      <SyncProgressPopup
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
                  <p>{t('update.available')}</p>
                  <div className="version-info">
                    <div>{t('update.current')}: <strong>{updateInfo.currentVersion}</strong></div>
                    <div>{t('update.latest')}: <strong>{updateInfo.latestVersion}</strong></div>
                  </div>
                  {updateInfo.releaseNotes && (
                    <div className="release-notes">
                      <h4>{t('update.releaseNotes')}:</h4>
                      <div className="notes-content" dangerouslySetInnerHTML={{ 
                        __html: (() => {
                          const txt = document.createElement('textarea');
                          txt.innerHTML = updateInfo.releaseNotes as string;
                          return txt.value;
                        })()
                      }} />
                    </div>
                  )}
                </>
              )}
              {updateStatus === 'downloading' && (
                <div className="update-progress">
                  <p>{t('update.downloading')}</p>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${updateProgress.percent || 0}%` }} />
                  </div>
                  <div className="progress-stats">
                    <span>{Math.round(updateProgress.percent || 0)}%</span>
                    <span>{updateProgress.speed ? (updateProgress.speed / (1024 * 1024)).toFixed(1) : '0.0'} MB/s</span>
                  </div>
                </div>
              )}
              {updateStatus === 'ready' && (
                <div className="update-ready">
                  <p>{t('update.ready')}</p>
                  <p>{t('update.restarting')}</p>
                </div>
              )}
              {updateStatus === 'error' && (
                <div className="update-error" style={{ color: '#ef4444', marginTop: '10px' }}>
                  <p><strong>Fehler beim Update:</strong></p>
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '4px', fontSize: '12px', wordBreak: 'break-all' }}>
                    {updateErrorMsg}
                  </div>
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
              {updateStatus === 'error' && (
                <button className="button secondary" onClick={() => setShowUpdateDialog(false)}>
                  Schließen
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

      {inGameUpdates && (
        <InGameUpdatesPopup 
          profile={inGameUpdates.profile}
          changes={inGameUpdates.changes}
          onImport={async (changes) => {
            const gameVersion = inGameUpdates.profile.gameVersion || 'fs25';
            const gamePath = settings.games[gameVersion as keyof typeof settings.games]?.defaultModFolder;
            if (gamePath) {
              await ipcRenderer.invoke('import-in-game-updates', inGameUpdates.profile.id, gamePath, changes);
              setModListReloadKey(key => key + 1);
            }
            setInGameUpdates(null);
          }}
          onIgnore={() => setInGameUpdates(null)}
        />
      )}
    </div>
  );
};

export default App;
