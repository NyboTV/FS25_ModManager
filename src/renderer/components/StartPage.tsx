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
      if (selectedProfile?.serverSyncUrl && !serverUpdatesPreview[selectedProfileId]) {
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
    }
  };
  
  const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProfileId(e.target.value);
  };

  const handleStartGame = async () => {
    if (!selectedProfileId) {
      setError('Bitte wählen Sie ein Profil aus');
      return;
    }
    
    const selectedProfile = profiles.find(p => p.id === selectedProfileId);
    if (!selectedProfile) {
      setError('Profil nicht gefunden');
      return;
    }

    const gameVersion = selectedProfile.gameVersion || 'fs25';
    const gameSettings = settings.games?.[gameVersion];
    
    if (!gameSettings?.defaultModFolder) {
      setError(`Der Mod-Ordner für ${gameVersion.toUpperCase()} ist nicht konfiguriert. Bitte überprüfen Sie die Einstellungen.`);
      return;
    }
    
    if (!gameSettings?.gamePath) {
      setError(`Der Spielpfad für ${gameVersion.toUpperCase()} ist nicht konfiguriert. Bitte überprüfen Sie die Einstellungen.`);
      return;
    }
    
    try {
      setIsLaunching(true);
      setDeployProgress(null);
      setMessage('Bereite Mods vor...');
      setError('');
      
      const deployResult = await ipcRenderer.invoke('deploy-profile-mods', selectedProfileId, gameSettings.defaultModFolder);
      
      if (!deployResult.success) {
        throw new Error(deployResult.error);
      }
      
      // Speichere zuletzt genutztes Profil für In-Game Update Check
      await ipcRenderer.invoke('save-settings', { ...settings, lastLaunchedProfileId: selectedProfileId });
      
      setMessage('Mods erfolgreich vorbereitet! Starte Farming Simulator 25...');
      
      const launchResult = await ipcRenderer.invoke('launch-game', gameSettings.gamePath);
      
      if (!launchResult.success) {
        throw new Error(launchResult.error || 'Unbekannter Fehler beim Starten des Spiels');
      }
      
      setMessage(`${gameVersion.toUpperCase()} wurde gestartet!`);
      
      setTimeout(() => {
        setMessage('');
        setDeployProgress(null);
        setIsLaunching(false);
      }, 3000);
      
    } catch (error) {
      console.error('Fehler beim Starten des Spiels:', error);
      setError(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
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
          <p>Lade Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="start-page-new">
      {profiles.length === 0 ? (
        <div className="no-profiles-section">
          <div className="welcome-card">
            <h1>🚜 Willkommen beim Farming Mod Manager</h1>
            <p>Du hast noch keine Profile erstellt.</p>
            <p>Erstelle dein erstes Profil, um zu beginnen!</p>
            <button className="btn btn-primary btn-large" onClick={handleManageProfiles}>
              Erstes Profil erstellen
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Hauptinhalt Bereich */}
          <div className="main-content-area">
            {/* Profil Auswahl */}
            <div className="profile-selection-card">
              <h2>🎮 Profil auswählen</h2>
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
                        <h3>📋 Profil-Informationen</h3>
                        <div className="info-item">
                          <span className="label">Name:</span>
                          <span className="value">{selectedProfile.name}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Spielversion:</span>
                          <span className="value">{selectedProfile.gameVersion?.toUpperCase() || 'FS25'}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Version:</span>
                          <span className="value">{selectedProfile.version}</span>
                        </div>
                        {selectedProfile.description && (
                          <div className="info-item">
                            <span className="label">Beschreibung:</span>
                            <span className="value">{selectedProfile.description}</span>
                          </div>
                        )}
                      </div>

                      {/* Mod Statistiken */}
                      <div className="info-card">
                        <h3>📦 Mod-Übersicht</h3>
                        <div className="mod-stats">
                          <div className="stat-item">
                            <span className="stat-number">{selectedProfile.mods.length}</span>
                            <span className="stat-label">Gesamt</span>
                          </div>
                          <div className="stat-item active">
                            <span className="stat-number">{selectedProfile.mods.filter(m => m.isActive).length}</span>
                            <span className="stat-label">Aktiv</span>
                          </div>
                          <div className="stat-item inactive">
                            <span className="stat-number">{selectedProfile.mods.filter(m => !m.isActive).length}</span>
                            <span className="stat-label">Inaktiv</span>
                          </div>
                        </div>
                      </div>

                      {/* Server Info */}
                      {selectedProfile.serverSyncUrl && (
                        <div className="info-card">
                          <h3>🌐 Server-Synchronisation</h3>
                          <div className="info-item">
                            <span className="label">Server-URL:</span>
                            <span className="value">{selectedProfile.serverSyncUrl}</span>
                          </div>
                          {selectedProfile.lastSyncDate && (
                            <div className="info-item">
                              <span className="label">Letzter Sync:</span>
                              <span className="value">{new Date(selectedProfile.lastSyncDate).toLocaleString('de-DE')}</span>
                            </div>
                          )}
                          
                          {/* Mini Checkup */}
                          {serverUpdatesPreview[selectedProfile.id] && (
                            <div className="info-item" style={{ marginTop: '10px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                              <span className="label">Updates verfügbar:</span>
                              <span className="value" style={{ fontWeight: 'bold', color: serverUpdatesPreview[selectedProfile.id].loading ? '#aaa' : (serverUpdatesPreview[selectedProfile.id].count > 0 ? '#fbbf24' : '#4ade80') }}>
                                {serverUpdatesPreview[selectedProfile.id].loading 
                                  ? 'Prüfe Server...' 
                                  : (serverUpdatesPreview[selectedProfile.id].count > 0 
                                      ? `⚠️ ${serverUpdatesPreview[selectedProfile.id].count} Mods können aktualisiert werden` 
                                      : '✅ Alle Mods aktuell')}
                              </span>
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
