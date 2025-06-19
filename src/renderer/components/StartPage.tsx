import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Profile, Settings } from '../../common/types';

const { ipcRenderer } = window.require('electron');

interface StartPageProps {
  settings: Settings;
}

const StartPage: React.FC<StartPageProps> = ({ settings }) => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  useEffect(() => {
    loadProfiles();
  }, []);
  
  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      const loadedProfiles = await ipcRenderer.invoke('load-profiles');
      setProfiles(loadedProfiles);
      
      // Wenn Profile geladen wurden, wähle automatisch das erste aus
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
    
    if (!settings.defaultModFolder) {
      setError('Der Spielmod-Ordner ist nicht konfiguriert. Bitte überprüfen Sie die Einstellungen.');
      return;
    }
    
    if (!settings.gamePath) {
      setError('Der Spielpfad ist nicht konfiguriert. Bitte überprüfen Sie die Einstellungen.');
      return;
    }
    
    try {
      setIsLaunching(true);
      setMessage('Bereite Mods vor...');
      setError('');
      
      // Deploye die Mods ins Spielverzeichnis
      const deployResult = await ipcRenderer.invoke('deploy-profile-mods', selectedProfileId, settings.defaultModFolder);
      
      if (!deployResult.success) {
        throw new Error(deployResult.error || 'Unbekannter Fehler beim Kopieren der Mods');
      }
      
      setMessage('Starte Farming Simulator 25...');
      
      // Starte das Spiel
      const launchResult = await ipcRenderer.invoke('launch-game', settings.gamePath);
      
      if (!launchResult.success) {
        throw new Error(launchResult.error || 'Unbekannter Fehler beim Starten des Spiels');
      }
      
      setMessage('Farming Simulator 25 wurde gestartet!');
      
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
    return <div className="loading">Lade Profile...</div>;
  }
  
  return (
    <div className="start-page">
      <div className="card welcome-card">
        <h2>Willkommen beim FS25 Mod Manager</h2>
        <p>Wählen Sie ein Profil und starten Sie das Spiel mit Ihren bevorzugten Mods.</p>
      </div>
      
      <div className="card start-game-card">
        <h2>Spiel starten</h2>
        
        {profiles.length === 0 ? (
          <div className="alert alert-warning">
            <p>Sie haben noch keine Profile erstellt.</p>
            <button className="btn btn-primary" onClick={handleManageProfiles}>
              Profile verwalten
            </button>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="profile-select">Profil auswählen</label>
              <select 
                id="profile-select"
                value={selectedProfileId}
                onChange={handleProfileChange}
                disabled={isLaunching}
              >
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>
            
            {selectedProfileId && (
              <div className="profile-info">
                <h3>Profildetails</h3>
                {profiles.find(p => p.id === selectedProfileId)?.description && (
                  <p>{profiles.find(p => p.id === selectedProfileId)?.description}</p>
                )}
                <p>
                  <strong>Version:</strong> {profiles.find(p => p.id === selectedProfileId)?.version}
                </p>
                <p>
                  <strong>Mods:</strong> {profiles.find(p => p.id === selectedProfileId)?.mods.length || 0} Mods
                </p>
              </div>
            )}
            
            <div className="launch-actions">
              <button 
                className="btn btn-primary btn-large"
                onClick={handleStartGame}
                disabled={isLaunching || !selectedProfileId}
              >
                {isLaunching ? 'Starte...' : 'Farming Simulator 25 starten'}
              </button>
            </div>
            
            <div className="secondary-actions">
              <button className="btn" onClick={handleManageProfiles} disabled={isLaunching}>
                Profile verwalten
              </button>
            </div>
          </>
        )}
        
        {message && (
          <div className="alert alert-success">
            {message}
          </div>
        )}
        
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default StartPage;
