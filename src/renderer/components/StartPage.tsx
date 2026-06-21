import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Profile, Settings } from '../../common/types';
import { useTranslation } from '../i18n';

const { ipcRenderer } = window.require('electron');

interface StartPageProps {
  settings: Settings;
  modListReloadKey?: number;
  initialProfiles?: Profile[];
  onReloadProfiles?: () => void;
}

const StartPage: React.FC<StartPageProps> = ({ 
  settings, 
  modListReloadKey,
  initialProfiles = [],
  onReloadProfiles
}) => {
  const navigate = useNavigate();
  const t = useTranslation(settings.language);
  
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => {
    const saved = localStorage.getItem('selectedProfileId');
    if (saved) return saved;
    return initialProfiles.length > 0 ? initialProfiles[0].id : '';
  });
  
  const selectedProfileIdRef = React.useRef(selectedProfileId);

  useEffect(() => {
    if (initialProfiles && initialProfiles.length > 0) {
      setProfiles(initialProfiles);
      setIsLoading(false);
      if (!selectedProfileIdRef.current) {
        const saved = localStorage.getItem('selectedProfileId');
        if (saved && initialProfiles.some(p => p.id === saved)) {
          setSelectedProfileId(saved);
        } else {
          setSelectedProfileId(initialProfiles[0].id);
        }
      }
    }
  }, [initialProfiles]);

  useEffect(() => {
    selectedProfileIdRef.current = selectedProfileId;
    if (selectedProfileId) {
      localStorage.setItem('selectedProfileId', selectedProfileId);
    } else {
      localStorage.removeItem('selectedProfileId');
    }
  }, [selectedProfileId]);

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
        if (selectedProfile.serverWebStatsUrl && !serverUpdatesPreview[selectedProfileId]) {
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
    if (profiles.length === 0 || (modListReloadKey && modListReloadKey > 0)) {
      loadProfiles();
    } else {
      setIsLoading(false);
    }
  }, [modListReloadKey]);

  useEffect(() => {
    if (selectedProfileId) {
      ipcRenderer.send('watch-profile-mods', selectedProfileId);
    }
    return () => {
      ipcRenderer.send('watch-profile-mods', '');
    };
  }, [selectedProfileId]);

  useEffect(() => {
    const handleModsChanged = () => {
      console.log('StartPage: Mods folder changed, reloading profiles...');
      loadProfiles();
    };
    ipcRenderer.on('profile-mods-changed', handleModsChanged);
    return () => {
      ipcRenderer.removeListener('profile-mods-changed', handleModsChanged);
    };
  }, []);
  
  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      const loadedProfiles = await ipcRenderer.invoke('load-profiles');
      setProfiles(loadedProfiles);
      if (onReloadProfiles) onReloadProfiles();
      
      const currentId = selectedProfileIdRef.current;
      if (loadedProfiles.length > 0) {
        const exists = loadedProfiles.some((p: Profile) => p.id === currentId);
        if (!currentId || !exists) {
          setSelectedProfileId(loadedProfiles[0].id);
        } else {
          setSelectedProfileId(currentId);
        }
      } else {
        setSelectedProfileId('');
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
        <div className="dashboard-layout">
          {/* Left Column: Sleek Profiles Sidebar */}
          <div className="profiles-sidebar">
            <div className="sidebar-header">
              <h2>🎮 {t('profiles.selection') || 'Profilauswahl'}</h2>
            </div>
            <div className="sidebar-profiles-list">
              {profiles.map(profile => {
                const isSelected = profile.id === selectedProfileId;
                const totalMods = profile.mods?.length || 0;
                const activeMods = profile.mods?.filter(m => m.isActive).length || 0;
                const isMultiplayer = !!(profile.serverSyncUrl || profile.serverModListUrl || profile.serverWebStatsUrl);
                
                return (
                  <div 
                    key={profile.id} 
                    className={`sidebar-profile-item ${isSelected ? 'active' : ''}`}
                    onClick={() => !isLaunching && setSelectedProfileId(profile.id)}
                  >
                    <div className="profile-item-main">
                      <span className="profile-item-name">{profile.name}</span>
                      <span className={`game-badge ${profile.gameVersion || 'fs25'}`}>
                        {profile.gameVersion?.toUpperCase() || 'FS25'}
                      </span>
                    </div>
                    <div className="profile-item-sub">
                      <span className="profile-item-mods">📦 {activeMods}/{totalMods} Mods</span>
                      {isMultiplayer && (
                        <span className="profile-item-mp" title="Multiplayer / Server Profile">
                          👥 MP
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Profile Dashboard details */}
          <div className="dashboard-main-area">
            {selectedProfileId && (
              <div className="dashboard-main-grid">
                {(() => {
                  const selectedProfile = profiles.find(p => p.id === selectedProfileId);
                  if (!selectedProfile) return null;

                  const modsList = selectedProfile.mods || [];
                  const dlcsList = modsList.filter(m => m.isDLC === true || m.fileName.toLowerCase().startsWith('pdlc_'));
                  const normalModsList = modsList.filter(m => !(m.isDLC === true || m.fileName.toLowerCase().startsWith('pdlc_')));
                  const totalNormal = normalModsList.length;
                  const activeNormal = normalModsList.filter(m => m.isActive).length;
                  const inactiveNormal = totalNormal - activeNormal;
                  const totalDlcs = dlcsList.length;
                  const isMultiplayer = !!(selectedProfile.serverSyncUrl || selectedProfile.serverModListUrl || selectedProfile.serverWebStatsUrl);

                  return (
                    <>
                      {/* Premium Console Hero Banner */}
                      <div className="console-hero-card">
                        <div className="hero-info-section">
                          <div className="hero-title-row">
                            <h2>{selectedProfile.name}</h2>
                            <span className={`game-badge-large ${selectedProfile.gameVersion || 'fs25'}`}>
                              {selectedProfile.gameVersion?.toUpperCase() || 'FS25'}
                            </span>
                          </div>

                          {selectedProfile.description ? (
                            <p className="hero-desc">{selectedProfile.description}</p>
                          ) : (
                            <p className="hero-desc-placeholder">{t('mods.noDescription') || 'Keine Beschreibung vorhanden'}</p>
                          )}

                          <div className="hero-meta-row">
                            <div className="hero-meta-item">
                              <span className="label">{t('start.version') || 'Version'}:</span>
                              <span className="val">v{selectedProfile.version || '1.0.0'}</span>
                            </div>
                            <div className="hero-meta-item">
                              <span className="label">{t('profileEdit.autoBackup') || 'Backup'}:</span>
                              <span className="val">
                                {selectedProfile.autoBackupSavegame 
                                  ? `${t('profileEdit.savegameNum') || 'Savegame'} ${selectedProfile.savegameIndex || 1}` 
                                  : (t('start.never') || 'Deaktiviert')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="hero-launch-section">
                          {message && (
                            <div className="status-message success">
                              <span className="icon">✅</span>
                              <span className="txt" title={message}>{message}</span>
                            </div>
                          )}
                          
                          {error && (
                            <div className="status-message error">
                              <span className="icon">❌</span>
                              <span className="txt">{error}</span>
                            </div>
                          )}
                          
                          {isLaunching && deployProgress && deployProgress.total > 0 && (
                            <div className="deploy-progress-container">
                              <div className="deploy-progress-labels">
                                <span>{deployProgress.message}</span>
                                <span>{Math.round((deployProgress.current / deployProgress.total) * 100)}%</span>
                              </div>
                              <div className="deploy-progress-track">
                                <div 
                                  className="deploy-progress-bar" 
                                  style={{ 
                                    width: `${(deployProgress.current / deployProgress.total) * 100}%`,
                                    transition: 'width 0.1s linear'
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          <button 
                            className="hero-play-button"
                            onClick={handleStartGame}
                            disabled={isLaunching}
                          >
                            {isLaunching ? (
                              <>
                                <span className="loading-spinner small" style={{ borderLeftColor: 'white' }}></span>
                                {t('start.startingGame') || 'Spiel startet...'}
                              </>
                            ) : (
                              <>
                                <span>🚜</span> {t('start.startGame') || 'Spiel starten'}
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Bottom Widgets Grid */}
                      <div className="widgets-grid">
                        {/* Widget 1: Mod Overview Stats */}
                        <div className="dashboard-card">
                          <h3>📊 {t('start.modStats') || 'Mod-Übersicht'}</h3>
                          <div className="stats-flex-layout">
                            <div className="stat-item">
                              <span className="stat-num">{totalNormal}</span>
                              <span className="stat-label">{t('start.total') || 'Mods gesamt'}</span>
                            </div>
                            <div className="stat-item active-mod">
                              <span className="stat-num">{activeNormal}</span>
                              <span className="stat-label">{t('start.active') || 'Aktiv'}</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-num">{inactiveNormal}</span>
                              <span className="stat-label">{t('start.inactive') || 'Inaktiv'}</span>
                            </div>
                            {totalDlcs > 0 && (
                              <div className="stat-item dlc-mod">
                                <span className="stat-num">{totalDlcs}</span>
                                <span className="stat-label">{t('profiles.dlcs') || 'DLCs'}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Widget 2: Server Info or ModHub Updates */}
                        {isMultiplayer ? (
                          <div className="dashboard-card">
                            <h3>
                              <span>🌐 {t('start.serverInfo') || 'Server & Multiplayer'}</span>
                              {selectedProfile.serverWebStatsUrl && liveServerStats[selectedProfile.id] && !liveServerStats[selectedProfile.id].loading && !liveServerStats[selectedProfile.id].error && liveServerStats[selectedProfile.id].stats?.serverName !== 'Unknown' && (
                                <div className="pulse-badge">
                                  <span className="pulse-dot"></span>
                                  Online
                                </div>
                              )}
                            </h3>

                            <div className="server-details-list">
                              {selectedProfile.serverModListUrl && (
                                <div className="server-detail-row">
                                  <span className="lbl">{t('start.serverModUrl') || 'Server Mod URL'}:</span>
                                  <span className="val" style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>
                                    ✅ {t('start.configured') || 'Aktiviert'}
                                  </span>
                                </div>
                              )}
                              {selectedProfile.serverSyncUrl && (
                                <div className="server-detail-row">
                                  <span className="lbl">{t('start.fastdlUrl') || 'FastDL URL'}:</span>
                                  <span className="val" style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>
                                    ✅ {t('start.configured') || 'Aktiviert'}
                                  </span>
                                </div>
                              )}
                              {selectedProfile.lastSyncDate && (
                                <div className="server-detail-row">
                                  <span className="lbl">{t('start.lastSync') || 'Letzte Synchronisation'}:</span>
                                  <span className="val">
                                    {new Date(selectedProfile.lastSyncDate).toLocaleDateString()}
                                  </span>
                                </div>
                              )}

                              {/* Live Server Stats */}
                              {selectedProfile.serverWebStatsUrl && liveServerStats[selectedProfile.id] && (
                                <div className="server-live-stats-box">
                                  {liveServerStats[selectedProfile.id].loading ? (
                                    <div className="loading-state">
                                      <span className="loading-spinner small"></span>
                                      <span>{t('start.connectingToServer') || 'Abfragen...'}</span>
                                    </div>
                                  ) : liveServerStats[selectedProfile.id].error ? (
                                    <div className="error-state">
                                      <span>🔴</span>
                                      <span>{t('start.serverOfflineLabel') || 'Server offline.'}</span>
                                    </div>
                                  ) : liveServerStats[selectedProfile.id].stats?.serverName === 'Unknown' ? (
                                    <div className="offline-state">
                                      <span>🔴</span>
                                      <span>Spiel gestoppt (Server offline).</span>
                                    </div>
                                  ) : (
                                    <div className="stats-list">
                                      <div className="stat-row">
                                        <span className="label">{t('start.server') || 'Name'}</span>
                                        <span className="val">{liveServerStats[selectedProfile.id].stats?.serverName}</span>
                                      </div>
                                      <div className="stat-row">
                                        <span className="label">{t('start.map') || 'Map'}</span>
                                        <span className="val">{liveServerStats[selectedProfile.id].stats?.mapName}</span>
                                      </div>
                                      <div className="stat-row">
                                        <span className="label">{t('start.players') || 'Spieler'}</span>
                                        <span className="val highlight-green">
                                          {liveServerStats[selectedProfile.id].stats?.playersOnline} / {liveServerStats[selectedProfile.id].stats?.capacity}
                                        </span>
                                      </div>
                                      <div className="stat-row">
                                        <span className="label">{t('start.balance') || 'Kontostand'}</span>
                                        <span className="val highlight-gold">
                                          {Number(liveServerStats[selectedProfile.id].stats?.money || 0).toLocaleString('de-DE')} €
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="dashboard-card">
                            <h3>🔍 {t('start.modHubUpdatesTitle') || 'ModHub Updates'}</h3>
                            {(() => {
                              const updatableMods = selectedProfile.mods.filter(m => {
                                if (!m.isActive) return false;
                                return m.modHubVersion && m.version && m.version !== m.modHubVersion;
                              });

                              if (updatableMods.length === 0) {
                                return (
                                  <div className="no-updates-badge">
                                    <span>✅</span>
                                    <span>{t('start.allModsUpToDate') || 'Alle aktiven Mods sind aktuell!'}</span>
                                  </div>
                                );
                              }

                              return (
                                <div className="updates-list-wrapper">
                                  <div className="updates-summary-text">
                                    ⚠️ {(t('start.modsCanBeUpdated') || '{count} Updates verfügbar!').replace('{count}', String(updatableMods.length))}
                                  </div>
                                  <div className="updates-scroll-area">
                                    {updatableMods.map(u => {
                                      const title = u.modDescData?.title?.['en'] || u.modDescData?.title?.['de'] || u.name;
                                      const modUrl = u.modHubId ? `https://www.farming-simulator.com/mod.php?mod_id=${u.modHubId}` : '#';
                                      return (
                                        <div key={u.fileName} className="update-item-row">
                                          <a 
                                            href="#" 
                                            className="update-item-link"
                                            onClick={(e) => { 
                                              e.preventDefault(); 
                                              if (u.modHubId) window.require('electron').shell.openExternal(modUrl); 
                                            }}
                                            title={title}
                                          >
                                            {title}
                                          </a>
                                          <span className="update-item-version">
                                            v{u.version} ➔ <strong className="new-version">v{u.modHubVersion}</strong>
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StartPage;
