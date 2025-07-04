import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Profile, Settings, ModInfo } from '../../common/types';
import { useTranslation } from '../i18n';

const { ipcRenderer } = window.require('electron');

interface ProfilesViewProps {
  settings: Settings;
  onCreateProfile: () => void;
  onEditProfile: (profile: Profile) => void;
  onShowModInfo: (mod: ModInfo) => void;
  modListReloadKey?: number;
}

const ProfilesView: React.FC<ProfilesViewProps> = ({ 
  settings, 
  onCreateProfile, 
  onEditProfile, 
  onShowModInfo,
  modListReloadKey
}) => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<{[profileId: string]: boolean}>({});
  
  // Übersetzungsfunktion
  const t = useTranslation(settings.language);

  useEffect(() => {
    loadProfiles();
  }, [modListReloadKey]);
  const loadProfiles = async () => {
    try {
      const loadedProfiles = await ipcRenderer.invoke('load-profiles');
      setProfiles(loadedProfiles);
    } catch (error) {
      console.error('Fehler beim Laden der Profile:', error);
    }
  };
  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm(t('profiles.deleteConfirm'))) {
      return;
    }

    try {
      await ipcRenderer.invoke('delete-profile', profileId);
      await loadProfiles();
    } catch (error) {
      console.error('Fehler beim Löschen des Profils:', error);
      alert(`Fehler beim Löschen des Profils: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const handleSyncProfile = async (profile: Profile) => {
    if (isSyncing[profile.id]) return; // Spam-Schutz: Doppelklick verhindern
    if (!profile.serverSyncUrl) {
      alert(t('sync.error'));
      return;
    }
    setIsSyncing(prev => ({ ...prev, [profile.id]: true }));
    try {
      console.log(`Synchronisiere Profil: ${profile.name} (${profile.id})`);
      await ipcRenderer.invoke('sync-profile', profile.id);
    } catch (error) {
      console.error('Fehler beim Synchronisieren:', error);
      alert(`Fehler beim Synchronisieren: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSyncing(prev => ({ ...prev, [profile.id]: false }));
    }
  };

  const handleToggleMod = async (profileId: string, modId: string, isActive: boolean) => {
    try {
      await ipcRenderer.invoke('toggle-mod', profileId, modId, isActive);
      await loadProfiles();
    } catch (error) {
      console.error('Fehler beim Umschalten des Mods:', error);
    }
  };
  const handleDeleteMod = async (profileId: string, modId: string) => {
    if (!confirm(t('mods.deleteConfirm'))) {
      return;
    }

    try {
      await ipcRenderer.invoke('delete-mod', profileId, modId);
      await loadProfiles();
    } catch (error) {
      console.error('Fehler beim Löschen des Mods:', error);
      alert(`Fehler beim Löschen des Mods: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleOpenModFolder = async (profile: Profile) => {
    try {
      const { shell } = window.require('electron');
      await shell.openPath(profile.modFolderPath);
    } catch (error) {
      console.error('Fehler beim Öffnen des Mod-Ordners:', error);
      alert(`Fehler beim Öffnen des Mod-Ordners: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleAddMods = async (profile: Profile) => {
    try {
      const result = await ipcRenderer.invoke('select-file', {
        filters: [
          { name: 'Mod Files', extensions: ['zip'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile', 'multiSelections']
      });

      if (result && result.filePaths && result.filePaths.length > 0) {
        // Zeige Fortschritt an
        const modCount = result.filePaths.length;
        alert(`${modCount} Mod(s) werden hinzugefügt...`);

        for (const filePath of result.filePaths) {
          await ipcRenderer.invoke('add-mod-to-profile', profile.id, filePath);
        }

        // Profile neu laden
        await loadProfiles();
        alert(`${modCount} Mod(s) erfolgreich hinzugefügt!`);
      }
    } catch (error) {
      console.error('Fehler beim Hinzufügen der Mods:', error);
      alert(`Fehler beim Hinzufügen der Mods: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getModTitle = (mod: ModInfo): string => {
    if (mod.modDescData?.title) {
      return mod.modDescData.title[settings.language] || 
             mod.modDescData.title['en'] || 
             Object.values(mod.modDescData.title)[0] || 
             mod.name;
    }
    return mod.name;
  };
  return (    <div className="profiles-view">
      <div className="card">
        <h2>{t('profiles.title')}</h2>
        <p>Hier können Sie Ihre Mod-Profile verwalten. Jedes Profil kann unterschiedliche Mods und Einstellungen haben.</p>
        
        {profiles.length > 0 ? (
          <div className="profiles-list">
            {profiles.map((profile) => (
              <div className="profile-card" key={profile.id}>
                <div className="profile-header">
                  <div className="profile-info">
                    <h3>{profile.name}</h3>                    <div className="profile-stats">
                      <span>Mods: {profile.mods.length}</span>
                      <span>{t('mods.active')}: {profile.mods.filter(m => m.isActive).length}</span>
                      {profile.lastSyncDate && (
                        <span>Sync: {new Date(profile.lastSyncDate).toLocaleDateString()}</span>
                      )}
                    </div>
                    {profile.description && (
                      <p className="profile-description">{profile.description}</p>
                    )}
                  </div>
                  <div className="profile-actions">
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => setExpandedProfile(
                        expandedProfile === profile.id ? null : profile.id
                      )}
                    >
                      {expandedProfile === profile.id ? t('profiles.less') : t('profiles.details')}
                    </button>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => onEditProfile(profile)}
                    >
                      {t('common.edit')}
                    </button>
                    {profile.serverSyncUrl && (
                      <button 
                        className="btn btn-success btn-sm"
                        onClick={() => handleSyncProfile(profile)}
                        disabled={!!isSyncing[profile.id]}
                      >
                        {isSyncing[profile.id] ? t('profiles.syncing') : t('profiles.sync')}
                      </button>
                    )}
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteProfile(profile.id)}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>                {expandedProfile === profile.id && (
                  <div className="profile-details">
                    <div className="profile-mods">
                      <div className="mods-header">
                        <h4>{t('mods.title')} ({profile.mods.length})</h4>
                        <div className="mods-actions">
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenModFolder(profile)}
                            title="Mod-Ordner öffnen"
                          >
                            📁 Ordner öffnen
                          </button>
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAddMods(profile)}
                            title="Mods hinzufügen"
                          >
                            ➕ Mods hinzufügen
                          </button>
                        </div>
                      </div>
                      {profile.mods.length > 0 ? (
                        <div className="mods-list">
                          {profile.mods.map((mod) => (
                            <div key={mod.fileName} className={`mod-item ${mod.isActive ? 'active' : 'inactive'}`}>
                              <div className="mod-info">
                                <div className="mod-name">{getModTitle(mod)}</div>
                              </div>
                              <div className="mod-actions">
                                <button
                                  className={`btn btn-sm ${mod.isActive ? 'btn-warning' : 'btn-success'}`}
                                  onClick={() => handleToggleMod(profile.id, mod.fileName, !mod.isActive)}
                                >
                                  {mod.isActive ? t('mods.deactivate') : t('mods.activate')}
                                </button>
                                <button
                                  className="btn btn-sm btn-info"
                                  onClick={() => onShowModInfo(mod)}
                                >
                                  {t('mods.info')}
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDeleteMod(profile.id, mod.fileName)}
                                >
                                  {t('common.delete')}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="no-mods">{t('mods.noMods')}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>Sie haben noch keine Profile erstellt.</p>
          </div>
        )}
        
        <div className="create-profile-section">
          <button className="btn btn-primary" onClick={onCreateProfile}>
            {t('profiles.createNew')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilesView;
