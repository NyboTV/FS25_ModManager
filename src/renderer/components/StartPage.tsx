import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Profile, Settings } from '../../common/types';
import { useTranslation } from '../i18n';

const { ipcRenderer } = window.require('electron');

interface StartPageProps {
  settings: Settings;
  modListReloadKey?: number;
}

const StartPage: React.FC<StartPageProps> = ({ settings, modListReloadKey }) => {
  const navigate = useNavigate();
  const t = useTranslation(settings.language);
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deployProgress, setDeployProgress] = useState<{current: number, total: number, message: string} | null>(null);
  const [serverUpdatesPreview, setServerUpdatesPreview] = useState<{ [profileId: string]: { count: number, loading: boolean } }>({});
  const [liveServerStats, setLiveServerStats] = useState<{ [profileId: string]: { stats?: any, error?: string, loading: boolean } }>({});
  
  const [isCheckingModHub, setIsCheckingModHub] = useState(false);
  const [modHubUpdates, setModHubUpdates] = useState<any[]>([]);

  useEffect(() => {
    const handleDeployProgress = (_: any, progress: any) => {
      setDeployProgress(progress);
      setMessage(progress.message);
    };
    
    ipcRenderer.on('deploy-progress', handleDeployProgress);
    return () => {
      ipcRenderer.removeListener('deploy-progress', handleDeployProgress);
    };
  }, []);

  useEffect(() => {
    if (selectedProfileId) {
      const selectedProfile = profiles.find(p => p.id === selectedProfileId);
      if (selectedProfile) {
        // Mod Updates
        if (selectedProfile.serverSyncUrl && !serverUpdatesPreview[selectedProfileId]) {
          setServerUpdatesPreview(prev => ({ ...prev, [selectedProfileId]: { count: 0, loading: true } }));
          ipcRenderer.invoke('check-server-updates', selectedProfile)
            .then((res: any) => {
              if (res.success) {
                setServerUpdatesPreview(prev => ({ ...prev, [selectedProfileId]: { count: res.count, loading: false } }));
              } else {
                setServerUpdatesPreview(prev => ({ ...prev, [selectedProfileId]: { count: 0, loading: false } }));
              }
            })
            .catch(() => {
               setServerUpdatesPreview(prev => ({ ...prev, [selectedProfileId]: { count: 0, loading: false } }));
            });
        }
        
        // Live Server Stats
        if (selectedProfile.serverWebStatsUrl && !liveServerStats[selectedProfileId]) {
          setLiveServerStats(prev => ({ ...prev, [selectedProfileId]: { loading: true } }));
          
          const fetchStatsWithRetry = async (url: string, attemptsLeft: number = 6) => {
            try {
              const res = await ipcRenderer.invoke('fetch-server-stats', url);
              if (res.success) {
                setLiveServerStats(prev => ({ ...prev, [selectedProfileId]: { stats: res.stats, loading: false } }));
              } else {
                if (attemptsLeft > 1) {
                  setLiveServerStats(prev => ({ ...prev, [selectedProfileId]: { error: `Server offline... (Versuch ${7 - attemptsLeft}/6)`, loading: true } }));
                  setTimeout(() => fetchStatsWithRetry(url, attemptsLeft - 1), 5000);
                } else {
                  setLiveServerStats(prev => ({ ...prev, [selectedProfileId]: { error: res.error, loading: false } }));
                }
              }
            } catch (err: any) {
              if (attemptsLeft > 1) {
                setLiveServerStats(prev => ({ ...prev, [selectedProfileId]: { error: `Server offline... (Versuch ${7 - attemptsLeft}/6)`, loading: true } }));
                setTimeout(() => fetchStatsWithRetry(url, attemptsLeft - 1), 5000);
              } else {
                setLiveServerStats(prev => ({ ...prev, [selectedProfileId]: { error: String(err), loading: false } }));
              }
            }
          };
          
          fetchStatsWithRetry(selectedProfile.serverWebStatsUrl);
        }
      }
    }
  }, [selectedProfileId, profiles]);

  useEffect(() => {
    loadProfiles();
  }, [modListReloadKey]);
  
  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      const loadedProfiles = await ipcRenderer.invoke('load-profiles');
      setProfiles(loadedProfiles);
      
      if (loadedProfiles.length > 0) {
        setSelectedProfileId(loadedProfiles[0].id);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Profile:', error);
      setError(`Fehler beim Laden der Profile: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
      setIsLaunching(false);
    }
  };
  
  const handleCheckModHubUpdates = async (profile: Profile) => {
    setIsCheckingModHub(true);
    setModHubUpdates([]);
    try {
      const activeMods = profile.mods.filter(m => m.isActive).map(m => ({
        name: m.modDescData?.title?.['en'] || m.modDescData?.title?.['de'] || Object.values(m.modDescData?.title || {})[0] || m.name,
        version: m.version
      }));
      // Sende Dateinamen oder internen Namen
      const searchData = profile.mods.filter(m => m.isActive).map(m => ({
        name: m.name, 
        version: m.version
      }));

      const result = await ipcRenderer.invoke('scrape-modhub-updates', searchData);
      if (result.success && result.updates) {
        setModHubUpdates(result.updates);
        if (result.updates.length === 0) {
          alert(t("start.allCheckedModsUpToDate") || "Alle überprüften Mods sind aktuell!");
        }
      }
    } catch (error) {
      console.error('Fehler beim Prüfen von ModHub:', error);
    } finally {
      setIsCheckingModHub(false);
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProfileId(e.target.value);
  };

  const handleStartGame = async () => {
    if (!selectedProfileId) {
      setError(t("start.pleaseSelectProfile") || 'Bitte wählen Sie ein Profil aus');
      return;
    }
    
    const selectedProfile = profiles.find(p => p.id === selectedProfileId);
    if (!selectedProfile) {
      setError(t("start.profileNotFound") || 'Profil nicht gefunden');
      return;
    }

    const gameVersion = selectedProfile.gameVersion || 'fs25';
    const gameSettings = settings.games?.[gameVersion];
    
    if (!gameSettings?.defaultModFolder) {
      setError(`${t("start.modFolderNotConfigured") || "Der Mod-Ordner für"} ${gameVersion.toUpperCase()} ${t("start.isNotConfigured") || "ist nicht konfiguriert. Bitte überprüfen Sie die Einstellungen."}`);
      return;
    }
    
    if (!gameSettings?.gamePath) {
      setError(`${t("start.gamePathNotConfigured") || "Der Spielpfad für"} ${gameVersion.toUpperCase()} ${t("start.isNotConfigured") || "ist nicht konfiguriert. Bitte überprüfen Sie die Einstellungen."}`);
      return;
    }
    
    try {
      setIsLaunching(true);
      setDeployProgress(null);
      setMessage(t("start.preparingMods") || 'Bereite Mods vor...');
      setError('');
      
      // Map-Konflikt-Detektor
      const activeMaps = selectedProfile.mods.filter(m => m.isActive && m.modDescData?.isMap);
      if (activeMaps.length > 1) {
        const mapNames = activeMaps.map(m => m.name).join(', ');
        if (!confirm(`${t("start.warningMultipleMaps") || "⚠️ ACHTUNG: Du hast mehr als eine Karte"} (${activeMaps.length}) ${t("start.activatedInProfile") || "im Profil aktiviert"}:\n${mapNames}\n\n${t("start.onlyOneMapSupported") || "Das Spiel unterstützt nur EINE Map pro Profil und wird voraussichtlich abstürzen oder Fehler verursachen."}\n\n${t("start.startAnyway") || "Trotzdem starten?"}`)) {
          setIsLaunching(false);
          return;
        }
      }
      
      const deployResult = await ipcRenderer.invoke('deploy-profile-mods', selectedProfileId, gameSettings.defaultModFolder);
      
      if (!deployResult.success) {
        throw new Error(deployResult.error);
      }
      
      // Savegame Backup
      if (selectedProfile.autoBackupSavegame && selectedProfile.savegameIndex) {
        setMessage(`${t("start.creatingBackup") || "Erstelle Backup für Savegame"} ${selectedProfile.savegameIndex}...`);
        const backupResult = await ipcRenderer.invoke('backup-savegame', selectedProfileId, gameSettings.defaultModFolder, selectedProfile.savegameIndex);
        if (!backupResult.success) {
          if (!confirm(`⚠️ ${t("start.backupFailed") || "Backup fehlgeschlagen"}: ${backupResult.error}\n\n${t("start.startAnyway") || "Trotzdem starten?"}`)) {
            setIsLaunching(false);
            return;
          }
        }
      }
      
      // Speichere zuletzt genutztes Profil für In-Game Update Check
      await ipcRenderer.invoke('save-settings', { ...settings, lastLaunchedProfileId: selectedProfileId });
      
      setMessage(`${t("start.modsPrepared") || "Mods erfolgreich vorbereitet! Starte"} Farming Simulator 25...`);
      
      const launchResult = await ipcRenderer.invoke('launch-game', gameSettings.gamePath, selectedProfile.launchParameters);
      
      if (!launchResult.success) {
        throw new Error(launchResult.error || (t("start.unknownLaunchError") || 'Unbekannter Fehler beim Starten des Spiels'));
      }
      
      setMessage(`${gameVersion.toUpperCase()} ${t("start.wasStarted") || "wurde gestartet!"}`);
      
      setTimeout(() => {
        setMessage('');
        setDeployProgress(null);
        setIsLaunching(false);
      }, 3000);
      
    } catch (error) {
      console.error('Fehler beim Starten des Spiels:', error);
      setError(`${t("start.error") || "Fehler"}: ${error instanceof Error ? error.message : String(error)}`);
      setIsLaunching(false);
      setDeployProgress(null);
    }
  };
  
  const handleManageProfiles = () => {
    navigate('/profiles');
  };
  
  if (isLoading) {
    return (
      <div className="start-page">
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p>{t("start.loading") || "Lade Profile..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="start-page-new">
      {profiles.length === 0 ? (
        <div className="no-profiles-section">
          <div className="welcome-card">
            <h1>🚜 {t("start.welcome") || "Willkommen beim Farming Mod Manager"}</h1>
            <p>{t("start.noProfilesDesc") || "Du hast noch keine Profile erstellt."}</p>
            <p>{t("start.createFirstProfile") || "Erstelle dein erstes Profil, um zu beginnen!"}</p>
            <button className="btn btn-primary btn-large" onClick={handleManageProfiles}>
              {t("start.createFirstProfileBtn") || "Erstes Profil erstellen"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Hauptinhalt Bereich */}
          <div className="main-content-area">
            {/* Profil Auswahl */}
            <div className="profile-selection-card">
              <h2>🎮 {t("start.selectProfile") || "Profil auswählen"}</h2>
              <div className="profile-selector">
                <select 
                  value={selectedProfileId}
                  onChange={handleProfileChange}
                  disabled={isLaunching}
                  className="profile-select"
                >
                  {profiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} ({profile.gameVersion?.toUpperCase() || 'FS25'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Profil Details Grid */}
            {selectedProfileId && (
              <div className="profile-details-grid">
                {(() => {
                  const selectedProfile = profiles.find(p => p.id === selectedProfileId);
                  if (!selectedProfile) return null;

                  return (
                    <>
                      {/* Profil Info */}
                      <div className="info-card">
                        <h3>📋 {t("start.profileInfo") || "Profil-Informationen"}</h3>
                        <div className="info-item">
                          <span className="label">{t("start.name") || "Name:"}</span>
                          <span className="value">{selectedProfile.name}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">{t("start.gameVersion") || "Game version:"}</span>
                          <span className="value">{selectedProfile.gameVersion?.toUpperCase() || 'FS25'}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">{t("start.version") || "Version:"}</span>
                          <span className="value">{selectedProfile.version}</span>
                        </div>
                        {selectedProfile.description && (
                          <div className="info-item">
                            <span className="label">{t("start.description") || "Description:"}</span>
                            <span className="value">{selectedProfile.description}</span>
                          </div>
                        )}
                      </div>

                      {/* Mod Statistiken */}
                      <div className="info-card">
                        <h3>{t("start.modStats") || "📦 Mod Overview"}</h3>
                        <div className="mod-stats">
                          <div className="stat-item">
                            <span className="stat-number">{selectedProfile.mods.length}</span>
                            <span className="stat-label">{t("start.total") || "Total"}</span>
                          </div>
                          <div className="stat-item active">
                            <span className="stat-number">{selectedProfile.mods.filter(m => m.isActive).length}</span>
                            <span className="stat-label">{t("start.active") || "Active"}</span>
                          </div>
                          <div className="stat-item inactive">
                            <span className="stat-number">{selectedProfile.mods.filter(m => !m.isActive).length}</span>
                            <span className="stat-label">{t("start.inactive") || "Inactive"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Server Info */}
                      {(selectedProfile.serverSyncUrl || selectedProfile.serverWebStatsUrl) && (
                        <div className="info-card">
                          <h3>{t("start.serverInfo") || "🌐 Server & Multiplayer"}</h3>
                          {selectedProfile.serverSyncUrl && (
                            <>
                              <div className="info-item">
                                <span className="label">{t("start.syncUrl") || "Sync URL:"}</span>
                                <span className="value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }} title={selectedProfile.serverSyncUrl}>
                                  {selectedProfile.serverSyncUrl}
                                </span>
                              </div>
                              {selectedProfile.lastSyncDate && (
                                <div className="info-item">
                                  <span className="label">{t("start.lastSync") || "Last sync:"}</span>
                                  <span className="value">{new Date(selectedProfile.lastSyncDate).toLocaleString('de-DE')}</span>
                                </div>
                              )}
                              
                              {/* Mini Checkup */}
                              {serverUpdatesPreview[selectedProfile.id] && (
                                <div className="info-item" style={{ marginTop: '10px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                                  <span className="label">{t("start.updatesAvailableLabel") || "Updates available:"}</span>
                                  <span className="value" style={{ fontWeight: 'bold', color: serverUpdatesPreview[selectedProfile.id].loading ? '#aaa' : (serverUpdatesPreview[selectedProfile.id].count > 0 ? '#fbbf24' : '#4ade80') }}>
                                    {serverUpdatesPreview[selectedProfile.id].loading 
                                      ? (t("start.checkingServer") || 'Prüfe Server...') 
                                      : (serverUpdatesPreview[selectedProfile.id].count > 0 
                                          ? (t("start.modsCanBeUpdated") || '⚠️ {count} Mods können aktualisiert werden').replace('{count}', serverUpdatesPreview[selectedProfile.id].count.toString()) 
                                          : (t("start.allModsUpToDate") || '✅ Alle Mods aktuell'))}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                          
                          {/* Live Server Stats */}
                          {selectedProfile.serverWebStatsUrl && liveServerStats[selectedProfile.id] && (
                            <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid #3b82f6', borderRadius: '4px' }}>
                              <h4 style={{ margin: '0 0 10px 0', color: '#60a5fa' }}>{t("start.liveServerStats") || "📡 Live Server Status"}</h4>
                              {liveServerStats[selectedProfile.id].loading ? (
                                <span style={{ color: '#ccc', fontSize: '0.9rem' }}>{t("start.connectingToServer") || "Connecting to server..."}</span>
                              ) : liveServerStats[selectedProfile.id].error ? (
                                <span style={{ color: '#f87171', fontSize: '0.9rem' }}>{t("start.serverOfflineLabel") || "Server offline or unreachable."}</span>
                              ) : (
                                <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#94a3b8' }}>{t("start.server") || "Server:"}</span>
                                    <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>{liveServerStats[selectedProfile.id].stats?.serverName}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#94a3b8' }}>{t("start.map") || "Map:"}</span>
                                    <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>{liveServerStats[selectedProfile.id].stats?.mapName}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#94a3b8' }}>{t("start.players") || "Players:"}</span>
                                    <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>
                                      {liveServerStats[selectedProfile.id].stats?.playersOnline} / {liveServerStats[selectedProfile.id].stats?.capacity}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#94a3b8' }}>{t("start.balance") || "Balance:"}</span>
                                    <span style={{ fontWeight: 'bold', color: '#4ade80' }}>
                                      {Number(liveServerStats[selectedProfile.id].stats?.money || 0).toLocaleString('de-DE')} €
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ModHub Info für Singleplayer */}
                      {!selectedProfile.serverSyncUrl && (
                        <div className="info-card">
                          <h3>{t("start.modHubUpdatesTitle") || "🔍 ModHub Updates"}</h3>
                          <p style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '10px' }}>
                            Prüfe deine aktiven Singleplayer-Mods auf offizielle GIANTS ModHub Updates.
                          </p>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCheckModHubUpdates(selectedProfile)}
                            disabled={isCheckingModHub}
                          >
                            {isCheckingModHub ? t('start.modHubChecking') : t('start.modHubUpdates')}
                          </button>
                          
                          {modHubUpdates.length > 0 && (
                            <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(251, 191, 36, 0.1)', borderLeft: '4px solid #fbbf24', borderRadius: '4px' }}>
                              <h4 style={{ margin: '0 0 5px 0', color: '#fbbf24' }}>⚠️ {modHubUpdates.length} Updates gefunden!</h4>
                              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem' }}>
                                {modHubUpdates.map((u: any) => (
                                  <li key={u.name} style={{ margin: '3px 0' }}>
                                    <a href="#" style={{ color: '#60a5fa', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); window.require('electron').shell.openExternal(u.url); }}>{u.name}</a> (v{u.latestVersion})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Launch Button Bereich - Unten Mittig */}
          <div className="launch-section">
            {message && (
              <div 
                className="status-message success" 
                style={{ 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  maxWidth: '500px', 
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span className="status-icon" style={{ flexShrink: 0 }}>✅</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{message}</span>
              </div>
            )}
            
            {error && (
              <div className="status-message error">
                <span className="status-icon">❌</span>
                {error}
              </div>
            )}
            
            {isLaunching && deployProgress && deployProgress.total > 0 && (
              <div className="progress-container" style={{ width: '100%', maxWidth: '400px', margin: '15px auto', background: '#333', borderRadius: '8px', overflow: 'hidden', border: '1px solid #444' }}>
                <div 
                  className="progress-bar" 
                  style={{ 
                    height: '12px', 
                    background: '#4ade80', 
                    width: `${Math.max(2, (deployProgress.current / deployProgress.total) * 100)}%`,
                    transition: 'width 0.1s linear'
                  }}
                />
              </div>
            )}

            <button 
              className="launch-button"
              onClick={handleStartGame}
              disabled={isLaunching || !selectedProfileId}
            >
              {isLaunching ? (
                <>
                  <span className="loading-spinner small"></span>
                  Starte Spiel...
                </>
              ) : (
                <>
                  🚜 Spiel starten
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default StartPage;
