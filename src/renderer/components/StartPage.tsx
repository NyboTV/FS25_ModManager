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
      setMessage('Bereite Mods vor...');
      setError('');
      
      const deployResult = await ipcRenderer.invoke('deploy-profile-mods', selectedProfileId, gameSettings.defaultModFolder);
      
      if (!deployResult.success) {
        throw new Error(deployResult.error || 'Unbekannter Fehler beim Kopieren der Mods');
      }
      
      setMessage(`Starte ${gameVersion.toUpperCase()}...`);
      
      const launchResult = await ipcRenderer.invoke('launch-game', gameSettings.gamePath);
      
      if (!launchResult.success) {
        throw new Error(launchResult.error || 'Unbekannter Fehler beim Starten des Spiels');
      }
      
      setMessage(`${gameVersion.toUpperCase()} wurde gestartet!`);
      
      setTimeout(() => {
        setMessage('');
        setIsLaunching(false);
      }, 3000);
      
    } catch (error) {
      console.error('Fehler beim Starten des Spiels:', error);
      setError(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
      setIsLaunching(false);
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
              <div className="status-message success">
                <span className="status-icon">✅</span>
                {message}
              </div>
            )}
            
            {error && (
              <div className="status-message error">
                <span className="status-icon">❌</span>
                {error}
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
