import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Profile, Settings } from '../../common/types';

const { ipcRenderer } = window.require('electron');

interface ProfilesViewProps {
  settings: Settings;
}

const ProfilesView: React.FC<ProfilesViewProps> = ({ settings }) => {
  const navigate = useNavigate();  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [importModsFromCurrent, setImportModsFromCurrent] = useState(true);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const loadedProfiles = await ipcRenderer.invoke('load-profiles');
      setProfiles(loadedProfiles);
    } catch (error) {
      console.error('Fehler beim Laden der Profile:', error);
    }
  };
  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      alert('Bitte geben Sie einen Namen für das Profil ein');
      return;
    }

    try {
      const profileId = `profile_${Date.now()}`;
      
      const newProfile: Profile = {
        id: profileId,
        name: newProfileName,
        version: 'FS25',
        modFolderPath: settings.defaultModFolder,
        mods: []
      };

      // Speichere das Profil zunächst
      await ipcRenderer.invoke('save-profile', newProfile);

      // Wenn der Benutzer die aktuellen Mods importieren möchte
      if (importModsFromCurrent && settings.defaultModFolder) {
        const importResult = await ipcRenderer.invoke(
          'import-mods-to-profile', 
          profileId, 
          settings.defaultModFolder
        );

        if (importResult.success) {
          // Aktualisiere das Profil mit den importierten Mods
          newProfile.mods = importResult.modFiles;
          await ipcRenderer.invoke('save-profile', newProfile);
          
          alert(`Profil erstellt und ${importResult.modFiles.length} Mods importiert`);
        } else {
          alert(`Profil erstellt, aber Fehler beim Importieren der Mods: ${importResult.error}`);
        }
      } else {
        alert('Profil erfolgreich erstellt');
      }

      setNewProfileName('');
      setIsCreatingProfile(false);
      await loadProfiles();} catch (error) {
      console.error('Fehler beim Erstellen des Profils:', error);
      alert(`Fehler beim Erstellen des Profils: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Sind Sie sicher, dass Sie dieses Profil löschen möchten?')) {
      return;
    }

    try {
      await ipcRenderer.invoke('delete-profile', profileId);
      await loadProfiles();    } catch (error) {
      console.error('Fehler beim Löschen des Profils:', error);
      alert(`Fehler beim Löschen des Profils: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="profiles-view">
      <div className="card">
        <h2>Profile</h2>
        <p>Hier können Sie Ihre Mod-Profile verwalten. Jedes Profil kann unterschiedliche Mods und Einstellungen haben.</p>
        
        {profiles.length > 0 ? (
          <div className="profiles-list">
            {profiles.map((profile) => (
              <div className="profile-card" key={profile.id}>
                <div className="profile-info">
                  <h3>{profile.name}</h3>
                  <p>Version: {profile.version}</p>
                  {profile.lastSyncDate && (
                    <p>Letzte Synchronisierung: {new Date(profile.lastSyncDate).toLocaleString()}</p>
                  )}
                  <p>Mods: {profile.mods.length}</p>
                </div>
                <div className="profile-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => navigate(`/profile-settings/${profile.id}`)}
                  >
                    Bearbeiten
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={() => handleDeleteProfile(profile.id)}
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}          </div>
        ) : (
          <div className="empty-state">
            <p>Sie haben noch keine Profile erstellt.</p>
          </div>
        )}
        
        <div className="create-profile-section">
          {isCreatingProfile ? (
          <div className="create-profile-form">
            <h3>Neues Profil erstellen</h3>
            <div className="form-group">
              <label htmlFor="profile-name">Profilname</label>
              <input
                type="text"
                id="profile-name"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="z.B. Mein Hauptprofil"
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={importModsFromCurrent}
                  onChange={(e) => setImportModsFromCurrent(e.target.checked)}
                />
                Aktuelle Mods aus dem Spielordner importieren
              </label>
              <small>
                Alle Mods aus dem Ordner {settings.defaultModFolder} werden in dieses Profil kopiert.
              </small>
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleCreateProfile}>
                Erstellen
              </button>
              <button className="btn" onClick={() => setIsCreatingProfile(false)}>
                Abbrechen
              </button>
            </div>          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => setIsCreatingProfile(true)}>
            Neues Profil erstellen
          </button>
        )}
        </div>
      </div>
    </div>
  );
};

export default ProfilesView;
