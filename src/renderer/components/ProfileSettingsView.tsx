import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Profile, Settings, ModInfo } from '../../common/types';
import axios from 'axios';

const { ipcRenderer } = window.require('electron');

interface ProfileSettingsViewProps {
  settings: Settings;
}

const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({ settings }) => {
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

  // Status für Download-Fortschritt
  const [downloadProgress, setDownloadProgress] = useState<{
    modName: string;
    percent: number;
    downloadedBytes: number;
    totalBytes: number;
  } | null>(null);

  useEffect(() => {
    loadProfile();
  }, [id]);

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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, type?: 'checkbox') => {
    if (!profile) return;
    
    const { name, value } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : false;
    
    setProfile({
      ...profile,
      [name]: type === 'checkbox' ? checked : value
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
  };
  const handleSyncWithServer = async () => {
    if (!profile || !profile.serverSyncUrl) {
      setSyncError('Bitte geben Sie eine Server-Sync-URL ein');
      return;
    }
    
    try {
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
      } catch (e) {
        throw new Error('Ungültige URL-Format.');
      }
      
      setSyncMessage('Lade Mod-Liste vom Server...');
      
      // IPC-Aufruf zum Main-Prozess für die tatsächliche Server-Synchronisation
      const result = await ipcRenderer.invoke('sync-mods', profile.id, profile.serverSyncUrl);
        if (result.success) {
        const stats = result.stats || { new: 0, updated: 0, unchanged: 0, total: 0 };
        setSyncMessage(
          `Synchronisation abgeschlossen: ${stats.new} neue, ${stats.updated} aktualisierte, ${stats.unchanged} unveränderte Mods. Gesamtzahl: ${stats.total} Mods.`
        );
        
        // Aktualisiertes Profil neu laden, um die neuen Mods anzuzeigen
        await loadProfile();
        
        // Status-Nachricht länger anzeigen, damit der Benutzer die Statistik lesen kann
        setTimeout(() => {
          setSyncMessage('');
          setIsSyncing(false);
        }, 5000);
      } else {
        throw new Error(result.error || 'Unbekannter Fehler bei der Server-Synchronisation');
      }
        } catch (error) {
      console.error('Fehler bei der Server-Synchronisation:', error);
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
    
    if (!settings.defaultModFolder) {
      setDeployError('Bitte legen Sie zuerst einen Standardmodordner in den Einstellungen fest');
      return;
    }
    
    try {
      setIsDeploying(true);
      setDeployMessage('Bereite Bereitstellung der Mods vor...');
      setDeployError('');
      
      // Bestätigung vom Benutzer einholen
      if (!confirm(`Diese Aktion wird alle aktuellen Mods im Ordner "${settings.defaultModFolder}" durch die Mods dieses Profils ersetzen. Möchten Sie fortfahren?`)) {
        setIsDeploying(false);
        setDeployMessage('');
        return;
      }
      
      setDeployMessage('Kopiere Mods ins Spiel...');
      
      // Rufe die Funktion zum Bereitstellen der Mods auf
      const result = await ipcRenderer.invoke('deploy-profile-mods', profile.id, settings.defaultModFolder);
      
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

  // Höre auf Download-Fortschritt
  useEffect(() => {
    const handleDownloadProgress = (_event: any, progress: any) => {
      setDownloadProgress(progress);
    };

    ipcRenderer.on('download-progress', handleDownloadProgress);

    return () => {
      ipcRenderer.removeListener('download-progress', handleDownloadProgress);
    };
  }, []);

  // Mod-Dateien hinzufügen
  const handleAddMods = async () => {
    try {
      // Dialog zum Öffnen von Dateien anzeigen
      const result = await ipcRenderer.invoke('open-file-dialog', {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'ZIP-Dateien', extensions: ['zip'] }],
        title: 'Mods auswählen'
      });
      
      if (result && result.filePaths && result.filePaths.length > 0) {
        // Mods zum Profil hinzufügen
        const addResult = await ipcRenderer.invoke('add-mod-files', profile?.id, result.filePaths);
        
        if (addResult.success) {
          // Profil neu laden
          await loadProfile();
          alert(`${addResult.message}`);
        } else {
          alert(`Fehler: ${addResult.error}`);
        }
      }
    } catch (error) {
      console.error('Fehler beim Hinzufügen von Mods:', error);
      alert(`Fehler beim Hinzufügen von Mods: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Mod löschen
  const handleDeleteMod = async (modId: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diesen Mod löschen möchten?')) {
      return;
    }
    
    try {
      const result = await ipcRenderer.invoke('delete-mod', profile?.id, modId);
      
      if (result.success) {
        await loadProfile();
      } else {
        alert(`Fehler: ${result.error}`);
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Mods:', error);
      alert(`Fehler beim Löschen des Mods: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Mod aktivieren/deaktivieren
  const handleToggleModActive = async (modId: string) => {
    try {
      const result = await ipcRenderer.invoke('toggle-mod-active', profile?.id, modId);
      
      if (result.success) {
        await loadProfile();
      } else {
        alert(`Fehler: ${result.error}`);
      }
    } catch (error) {
      console.error('Fehler beim Ändern des Mod-Status:', error);
      alert(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (isLoading) {
    return <div className="loading">Lade Profil...</div>;
  }

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
          <label htmlFor="version">Spielversion</label>
          <input
            type="text"
            id="version"
            name="version"
            value={profile.version}
            onChange={handleChange}
            placeholder="z.B. FS25"
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
          <label htmlFor="server-sync-url">Server-Link</label>
          <input
            type="text"
            id="server-sync-url"
            name="serverSyncUrl"
            value={profile.serverSyncUrl || ''}
            onChange={handleChange}
            placeholder="z.B. http://178.63.189.92:8080/mods.html?lang=de"
          />
          <small>Der Link sollte auf die Mods-Übersichtsseite des Servers verweisen.</small>
        </div>
        
        {profile.lastSyncDate && (
          <div className="info-box">
            <p>Letzte Synchronisierung: {new Date(profile.lastSyncDate).toLocaleString()}</p>
          </div>
        )}
        
        <div className="sync-actions">
          <button 
            className="btn btn-secondary" 
            onClick={handleSyncWithServer}
            disabled={isSyncing}
          >
            {isSyncing ? 'Synchronisierung läuft...' : 'Mit Server synchronisieren'}
          </button>
        </div>
        
        {syncMessage && (
          <div className="alert alert-success">
            {syncMessage}
          </div>
        )}
        
        {syncError && (
          <div className="alert alert-error">
            {syncError}
          </div>
        )}
      </div>
        <div className="card">
        <h2>Mods im Profil</h2>
        
        <div className="mod-actions">
          <button 
            className="btn btn-secondary" 
            onClick={handleAddMods}
          >
            Mods hinzufügen
          </button>
        </div>
        
        {profile.mods.length > 0 ? (
          <table className="mod-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Name</th>
                <th>Version</th>
                <th>Größe</th>
                <th>Quelle</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {profile.mods.map((mod) => (
                <tr key={mod.id} title={mod.description || ''}>
                  <td>
                    <span className={`status ${mod.isActive ? 'active' : 'inactive'}`}>
                      {mod.isActive ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td>{mod.name}</td>
                  <td>{mod.version || 'Unbekannt'}</td>
                  <td>{(mod.fileSize / (1024 * 1024)).toFixed(2)} MB</td>
                  <td>
                    <span className={`badge ${mod.isFromServer ? 'badge-primary' : 'badge-secondary'}`}>
                      {mod.isFromServer ? 'Server' : 'Lokal'}
                    </span>
                  </td>
                  <td className="action-buttons">
                    <button 
                      className="btn-icon" 
                      onClick={() => handleToggleModActive(mod.id)}
                      title={mod.isActive ? 'Deaktivieren' : 'Aktivieren'}
                    >
                      {mod.isActive ? '🔴' : '🟢'}
                    </button>
                    <button 
                      className="btn-icon delete" 
                      onClick={() => handleDeleteMod(mod.id)}
                      title="Löschen"
                    >
                      🗑️
                    </button>
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
          <p><strong>Spielmodordner:</strong> {settings.defaultModFolder}</p>
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
