import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Profile, Settings, ModInfo } from '../../common/types';
import axios from 'axios';

const { ipcRenderer } = window.require('electron');

interface ProfileSettingsViewProps {
  settings: Settings;
  modListReloadKey?: number;
}

const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({ settings, modListReloadKey }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState('');
  const [deployError, setDeployError] = useState('');
  
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);
  const [urlCheckResult, setUrlCheckResult] = useState<{ success?: boolean; message?: string } | null>(null);

  useEffect(() => {
    loadProfile();
  }, [id, modListReloadKey]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const profiles = await ipcRenderer.invoke('load-profiles');
      const foundProfile = profiles.find((p: Profile) => p.id === id);
      
      if (foundProfile) {
        setProfile(foundProfile);
      } else {
        alert('Profil nicht gefunden');
        navigate('/');
      }
    } catch (error) {
      console.error('Fehler beim Laden des Profils:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!profile) return;
    
    const { name, value } = e.target;
    setProfile({
      ...profile,
      [name]: value
    });
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    
    try {
      await ipcRenderer.invoke('save-profile', profile);
      alert('Profil erfolgreich gespeichert');    } catch (error) {
      console.error('Fehler beim Speichern des Profils:', error);
      alert(`Fehler beim Speichern des Profils: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleFolderSelect = async () => {
    if (!profile) return;
    
    const folderPath = await ipcRenderer.invoke('open-folder-dialog');
    if (folderPath) {
      setProfile({
        ...profile,
        modFolderPath: folderPath
      });
    }
  };  const handleSyncWithServer = async () => {
    console.log('🚀 handleSyncWithServer called');
    console.log('🚀 Profile:', profile);
    
    if (!profile || !profile.serverSyncUrl) {
      console.log('❌ No profile or serverSyncUrl');
      setSyncError('Bitte geben Sie eine Server-Sync-URL ein');
      return;
    }
    
    try {
      console.log('🚀 Starting sync process...');
      setIsSyncing(true);
      setSyncMessage('Verbindung zum Server wird hergestellt...');
      setSyncError('');
      
      // Prüfen, ob die URL gültig ist
      if (!profile.serverSyncUrl.startsWith('http')) {
        throw new Error('Ungültige Server-URL. Die URL muss mit http:// oder https:// beginnen.');
      }
      
      // Versuchen Sie, die URL zu analysieren
      try {
        const url = new URL(profile.serverSyncUrl);
        console.log('✅ URL is valid:', url.toString());
      } catch (e) {
        throw new Error('Ungültige URL-Format.');
      }
      
      setSyncMessage('Lade Mod-Liste vom Server...');
      
      console.log('🚀 Calling IPC sync-mods with:', profile.id, profile.serverSyncUrl);
      
      // IPC-Aufruf zum Main-Prozess für die tatsächliche Server-Synchronisation
      const result = await ipcRenderer.invoke('sync-mods', profile.id, profile.serverSyncUrl);
      
      console.log('📦 IPC Result:', result);
        if (result.success) {
        const stats = result.stats || { new: 0, updated: 0, unchanged: 0, total: 0 };
        setSyncMessage(
          `Synchronisation abgeschlossen: ${stats.new} neue, ${stats.updated} aktualisierte, ${stats.unchanged} unveränderte Mods. Gesamtzahl: ${stats.total} Mods.`
        );
        
        // Aktualisiertes Profil neu laden, um die neuen Mods anzuzeigen
        await loadProfile();
          // Download-Leiste dauerhaft anzeigen - Status bleibt sichtbar
        setSyncMessage('Synchronisation abgeschlossen');
        setIsSyncing(false);
        // Entferne nicht mehr die Nachricht - sie bleibt dauerhaft sichtbar
      } else {
        throw new Error(result.error || 'Unbekannter Fehler bei der Server-Synchronisation');
      }        } catch (error) {
      console.error('❌ Error during sync:', error);
      setSyncError(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
      setIsSyncing(false);
    }
  };

  const handleDeployMods = async () => {
    if (!profile) return;
    
    try {
      setIsDeploying(true);
      setDeployMessage('Mods werden bereitgestellt...');
      setDeployError('');
      
      // Hier sollte die Logik für die Bereitstellung der Mods implementiert werden
      // Zum Beispiel das Hochladen der Mod-Dateien an den Server oder das Erstellen eines Installationspakets
      
      setTimeout(() => {
        setDeployMessage('Mods erfolgreich bereitgestellt');
        
        setTimeout(() => {
          setDeployMessage('');
          setIsDeploying(false);
        }, 2000);
      }, 2000);
    } catch (error) {
      console.error('Fehler bei der Bereitstellung der Mods:', error);
      setDeployError(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
      setIsDeploying(false);
    }
  };

  const handleDeployToGame = async () => {
    if (!profile) return;
    
    const gameVersion = profile.gameVersion || 'fs25';
    const defaultModFolder = settings.games?.[gameVersion]?.defaultModFolder || settings.defaultModFolder;
    
    if (!defaultModFolder) {
      setDeployError(`Bitte legen Sie zuerst einen Standardmodordner für ${gameVersion.toUpperCase()} in den Einstellungen fest`);
      return;
    }
    
    try {
      setIsDeploying(true);
      setDeployMessage('Bereite Bereitstellung der Mods vor...');
      setDeployError('');
      
      // Bestätigung vom Benutzer einholen
      if (!confirm(`Diese Aktion wird alle aktuellen Mods im Ordner "${defaultModFolder}" durch die Mods dieses Profils ersetzen. Möchten Sie fortfahren?`)) {
        setIsDeploying(false);
        setDeployMessage('');
        return;
      }
      
      setDeployMessage('Kopiere Mods ins Spiel...');
      
      // Rufe die Funktion zum Bereitstellen der Mods auf
      const result = await ipcRenderer.invoke('deploy-profile-mods', profile.id, defaultModFolder);
      
      if (result.success) {
        setDeployMessage('Mods wurden erfolgreich ins Spiel kopiert');
        setTimeout(() => {
          setDeployMessage('');
        }, 3000);
      } else {
        setDeployError(`Fehler beim Bereitstellen der Mods: ${result.error}`);
      }
    } catch (error) {
      console.error('Fehler beim Bereitstellen der Mods:', error);
      setDeployError(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDeploying(false);
    }
  };

  if (isLoading) {
    return <div className="loading">Lade Profil...</div>;
  }

  const handleCheckUrl = async () => {
    if (!profile || !profile.serverSyncUrl) return;
    
    setIsCheckingUrl(true);
    setUrlCheckResult(null);
    try {
      const result = await ipcRenderer.invoke('check-fastdl-url', profile.serverSyncUrl);
      if (result.success) {
        setUrlCheckResult({ success: true, message: `${result.count} Mods gefunden` });
      } else {
        setUrlCheckResult({ success: false, message: result.error || 'Fehler beim Prüfen' });
      }
    } catch (error) {
      setUrlCheckResult({ success: false, message: 'Verbindungsfehler' });
    } finally {
      setIsCheckingUrl(false);
    }
  };

  if (!profile) {
    return <div className="error">Profil nicht gefunden</div>;
  }

  return (
    <div className="profile-settings-view">
      <div className="card">
        <h2>Profil Einstellungen</h2>
        
        <div className="form-group">
          <label htmlFor="name">Profilname</label>
          <input
            type="text"
            id="name"
            name="name"
            value={profile.name}
            onChange={handleChange}
            placeholder="z.B. Mein Hauptprofil"
          />
        </div>
          <div className="form-group">
          <label htmlFor="version">Modpack-Version</label>
          <input
            type="text"
            id="version"
            name="version"
            value={profile.version}
            onChange={handleChange}
            placeholder="z.B. v1.0.0 oder 2024-06-19"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="description">Beschreibung</label>
          <textarea
            id="description"
            name="description"
            value={profile.description || ''}
            onChange={handleChange}
            placeholder="Beschreibung des Profils"
          />
        </div>
  
        
        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleSaveProfile}>
            Profil speichern
          </button>
          <button className="btn" onClick={() => navigate('/')}>
            Zurück zur Übersicht
          </button>
        </div>
      </div>
      
      <div className="card">
        <h2>Server-Synchronisation</h2>
        <p>Hier können Sie einen Server-Link eingeben, um Mods mit einem Dedicated Server zu synchronisieren.</p>
        
        <div className="form-group">
            <label htmlFor="server-sync-url">Server-Link (FastDL)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                id="server-sync-url"
                name="serverSyncUrl"
                value={profile.serverSyncUrl || ''}
                onChange={handleChange}
                placeholder="z.B. http://178.63.189.92:8080/mods.html?lang=de"
                style={{ flex: 1 }}
              />
              <button 
                className="btn btn-secondary" 
                onClick={handleCheckUrl}
                disabled={isCheckingUrl || !profile.serverSyncUrl}
                style={{ whiteSpace: 'nowrap' }}
              >
                {isCheckingUrl ? 'Prüfe...' : 'Link prüfen'}
              </button>
            </div>
            {urlCheckResult && (
              <div style={{ 
                marginTop: '6px', 
                fontSize: '0.9em', 
                color: urlCheckResult.success ? '#4ade80' : '#f87171' 
              }}>
                {urlCheckResult.success ? '✅ ' : '❌ '}
                {urlCheckResult.message}
              </div>
            )}
            <small>Der Link sollte auf die Mods-Übersichtsseite des Servers verweisen (Directory Listing oder GIANTS Server).</small>
          </div>
        
        {profile.lastSyncDate && (
          <div className="info-box">
            <p>Letzte Synchronisierung: {new Date(profile.lastSyncDate).toLocaleString()}</p>
          </div>
        )}
          <div className="sync-actions">
          {/* DEBUG INFO */}
          <div style={{background: 'yellow', padding: '5px', margin: '5px 0'}}>
            DEBUG: isSyncing = {String(isSyncing)} | Button should be: {isSyncing ? 'DISABLED' : 'ENABLED'}
          </div>
          
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              console.log('🔵 Button clicked!');
              console.log('🔍 isSyncing:', isSyncing);
              console.log('🔍 Button disabled:', isSyncing);
              try {
                handleSyncWithServer();
              } catch (error) {
                console.error('❌ Error calling handleSyncWithServer:', error);
              }
            }}
            disabled={false}
            style={{ 
              backgroundColor: isSyncing ? '#ccc' : '#007bff',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              border: '2px solid red' // Debug border
            }}
            onMouseEnter={() => console.log('🔵 Button hover IN')}
            onMouseLeave={() => console.log('🔵 Button hover OUT')}
          >
            {isSyncing ? 'Synchronisierung läuft...' : 'Mit Server synchronisieren'}
          </button>
        </div>
          {/* Download-Leiste wird dauerhaft angezeigt */}
        <div className="alert alert-info">
          {syncMessage || 'Bereit für Synchronisation'}
        </div>
        
        {syncError && (
          <div className="alert alert-error">
            {syncError}
          </div>
        )}
      </div>
      
      <div className="card">
        <h2>Mods im Profil</h2>
        {profile.mods.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Name</th>
                <th>Version</th>
                <th>Größe</th>
                <th>Quelle</th>
              </tr>
            </thead>
            <tbody>
              {profile.mods.map((mod) => (
                <tr key={mod.fileName}>
                  <td>
                    <span className={`status ${mod.isActive ? 'active' : 'inactive'}`}>
                      {mod.isActive ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td>{mod.name}</td>
                  <td>{mod.version || 'Unbekannt'}</td>
                  <td>{mod.fileSize || '-'}</td>
                  <td>
                    <span className={`badge ${mod.downloadUrl ? 'badge-primary' : 'badge-secondary'}`}>
                      {mod.downloadUrl ? 'Server' : 'Lokal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>Dieses Profil enthält noch keine Mods.</p>
            <p>Synchronisieren Sie mit einem Server oder fügen Sie Mods manuell hinzu.</p>
          </div>
        )}
      </div>
      
      <div className="card">
        <h2>Mods bereitstellen</h2>
        <p>Hier können Sie die Mods Ihres Profils bereitstellen, um sie auf einem Server zu verwenden.</p>
        
        <div className="form-actions">
          <button 
            className="btn btn-primary" 
            onClick={handleDeployMods}
            disabled={isDeploying}
          >
            {isDeploying ? 'Bereitstellung läuft...' : 'Mods bereitstellen'}
          </button>
        </div>
        
        {deployMessage && (
          <div className="alert alert-success">
            {deployMessage}
          </div>
        )}
        
        {deployError && (
          <div className="alert alert-error">
            {deployError}
          </div>
        )}
      </div>
      
      <div className="card">
        <h2>Mods ins Spiel laden</h2>
        <p>
          Hier können Sie die Mods dieses Profils in den Spielordner kopieren, um sie im Spiel zu verwenden.
          Das überschreibt alle bestehenden Mods im Spielordner.
        </p>
        
        <div className="info-box">
          <p><strong>Spielmodordner:</strong> {settings.games?.[profile.gameVersion || 'fs25']?.defaultModFolder || settings.defaultModFolder || 'Nicht festgelegt'}</p>
        </div>
        
        <div className="deploy-actions">
          <button 
            className="btn btn-primary" 
            onClick={handleDeployToGame}
            disabled={isDeploying}
          >
            {isDeploying ? 'Kopiere Mods...' : 'Mods ins Spiel kopieren'}
          </button>
        </div>
        
        {deployMessage && (
          <div className="alert alert-success">
            {deployMessage}
          </div>
        )}
        
        {deployError && (
          <div className="alert alert-error">
            {deployError}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSettingsView;
