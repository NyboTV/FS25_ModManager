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
  const [showUrlInput, setShowUrlInput] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [categoryFilters, setCategoryFilters] = useState<{[profileId: string]: string}>({});
  
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent, profileId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.zip'));
    if (files.length === 0) return;

    alert(`${files.length} Mod(s) werden importiert...`);
    // In Electron, File objects have a 'path' property
    const filePaths = files.map((f: any) => f.path);
    
    try {
      const result = await ipcRenderer.invoke('import-dropped-mods', profileId, filePaths);
      if (result.success) {
        await loadProfiles();
        alert(result.message);
      } else {
        alert(`Fehler: ${result.error}`);
      }
    } catch (error) {
      console.error('Fehler beim Importieren gedroppter Mods:', error);
      alert(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleAddModFromUrl = async (profileId: string) => {
    if (!urlInput) return;
    setIsDownloading(true);
    try {
      const result = await ipcRenderer.invoke('add-mod-from-url', profileId, urlInput);
      if (result.success) {
        alert(result.message);
        await loadProfiles();
        setShowUrlInput(null);
        setUrlInput('');
      } else {
        alert(`Fehler: ${result.error}`);
      }
    } catch (error) {
      console.error('Fehler beim Herunterladen der Mod:', error);
      alert(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDownloading(false);
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

  const checkConflicts = (profile: Profile) => {
    const activeMods = profile.mods.filter(m => m.isActive);
    const activeMaps = activeMods.filter(m => m.modDescData?.isMap);
    
    const missingDeps: string[] = [];
    const activeModNames = new Set(activeMods.map(m => m.name.toLowerCase()));
    
    for (const mod of activeMods) {
      if (mod.modDescData?.dependencies) {
        for (const dep of mod.modDescData.dependencies) {
          // Giant's dependencies are usually exactly the zip name without .zip
          if (!activeModNames.has(dep.toLowerCase()) && !activeMods.some(m => m.fileName.toLowerCase() === dep.toLowerCase() + '.zip')) {
            missingDeps.push(`"${mod.name}" benötigt "${dep}"`);
          }
        }
      }
    }
    
    return { activeMaps, missingDeps };
  };

  return (    <div className="profiles-view">
      <div className="card">
        <h2>{t('profiles.title')}</h2>
        <p>Hier können Sie Ihre Mod-Profile verwalten. Jedes Profil kann unterschiedliche Mods und Einstellungen haben.</p>
        
        {profiles.length > 0 ? (
          <div className="profiles-list">
            {profiles.map((profile) => (
              <div 
                className={`profile-card ${expandedProfile === profile.id ? 'expanded' : ''}`} 
                key={profile.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, profile.id)}
              >
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
                            title="Mods hinzufügen (Datei)"
                          >
                            ➕ Mods hinzufügen (Datei)
                          </button>
                          <button 
                            className="btn btn-info btn-sm"
                            onClick={() => setShowUrlInput(profile.id === showUrlInput ? null : profile.id)}
                            title="Mod hinzufügen (URL)"
                          >
                            🌐 Mod hinzufügen (URL)
                          </button>
                        </div>
                      </div>
                      {showUrlInput === profile.id && (
                        <div className="url-input-container" style={{ margin: '10px 0', padding: '10px', background: 'rgba(0,0,0,0.1)', borderRadius: '4px', display: 'flex', gap: '10px' }}>
                          <input 
                            type="text" 
                            placeholder="z.B. https://www.farming-simulator.com/mod.php?mod_id=..." 
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color, #444)', background: 'var(--bg-secondary, #2a2a2a)', color: 'var(--text-primary, #fff)' }}
                            disabled={isDownloading}
                          />
                          <button 
                            className="btn btn-success" 
                            onClick={() => handleAddModFromUrl(profile.id)}
                            disabled={isDownloading || !urlInput}
                          >
                            {isDownloading ? 'Lädt herunter...' : 'Hinzufügen'}
                          </button>
                        </div>
                      )}
                      
                      {(() => {
                        const { activeMaps, missingDeps } = checkConflicts(profile);
                        const categories = Array.from(new Set(profile.mods.map(m => m.modDescData?.category || 'Unknown').filter(c => c !== 'Unknown'))).sort();
                        const currentCategory = categoryFilters[profile.id] || 'All';
                        const filteredMods = currentCategory === 'All' 
                          ? profile.mods 
                          : profile.mods.filter(m => (m.modDescData?.category || 'Unknown') === currentCategory);
                          
                        return (
                          <>
                            {(activeMaps.length > 1 || missingDeps.length > 0) && (
                              <div className="conflict-warnings" style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', padding: '10px', margin: '10px 0', borderRadius: '4px' }}>
                                <h4 style={{ color: '#ef4444', marginTop: 0, marginBottom: '8px' }}>⚠️ Mod-Konflikte erkannt!</h4>
                                {activeMaps.length > 1 && (
                                  <p style={{ margin: '4px 0', color: '#fca5a5' }}>
                                    Es sind {activeMaps.length} Karten (Maps) gleichzeitig aktiviert. Der Farming Simulator unterstützt nur 1 aktive Karte. Dies führt zu Abstürzen!
                                  </p>
                                )}
                                {missingDeps.length > 0 && (
                                  <ul style={{ margin: '4px 0', paddingLeft: '20px', color: '#fca5a5' }}>
                                    {missingDeps.map((dep, i) => <li key={i}>{dep}</li>)}
                                  </ul>
                                )}
                              </div>
                            )}

                            {categories.length > 0 && (
                              <div className="category-filter" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span>Filter:</span>
                                <select 
                                  value={currentCategory}
                                  onChange={(e) => setCategoryFilters(prev => ({ ...prev, [profile.id]: e.target.value }))}
                                  style={{ padding: '6px', borderRadius: '4px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                                >
                                  <option value="All">Alle Mods ({profile.mods.length})</option>
                                  {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat} ({profile.mods.filter(m => m.modDescData?.category === cat).length})</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {filteredMods.length > 0 ? (
                              <div className="mods-list">
                                {filteredMods.map((mod) => (
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
                              <div className="no-mods">
                                {profile.mods.length > 0 ? 'Keine Mods in dieser Kategorie gefunden.' : t('mods.noMods')}
                              </div>
                            )}
                          </>
                        );
                      })()}
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
