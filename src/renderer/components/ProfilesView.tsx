import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Profile, Settings, ModInfo } from '../../common/types';
import { useTranslation } from '../i18n';

const { ipcRenderer } = window.require('electron');

interface ProfilesViewProps {
  settings: Settings;
  onShowModInfo: (mod: ModInfo) => void;
  modListReloadKey?: number;
}

const ProfilesView: React.FC<ProfilesViewProps> = ({ 
  settings, 
  onShowModInfo,
  modListReloadKey
}) => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  
  const [isSyncing, setIsSyncing] = useState<{[profileId: string]: boolean}>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [categoryFilters, setCategoryFilters] = useState<{[profileId: string]: string}>({});
  const [searchQueries, setSearchQueries] = useState<{[profileId: string]: string}>({});
  const [sortOrders, setSortOrders] = useState<{[profileId: string]: string}>({});
  const [syncUrlType, setSyncUrlType] = useState<'checking' | 'giants' | 'fastdl' | null>(null);
  


  // Übersetzungsfunktion
  const t = useTranslation(settings.language);

  useEffect(() => {
    loadProfiles();
  }, [modListReloadKey]);

  useEffect(() => {
    if (selectedProfileId) {
      ipcRenderer.send('start-modhub-mapping', selectedProfileId);
    }
  }, [selectedProfileId]);

  const loadProfiles = async () => {
    try {
      const loadedProfiles = await ipcRenderer.invoke('load-profiles');
      setProfiles(loadedProfiles);
      if (loadedProfiles.length > 0 && !selectedProfileId) {
        setSelectedProfileId(loadedProfiles[0].id);
      }
    } catch (error) {
      console.error(t('profiles.loadError'), error);
    }
  };

  const checkSyncUrl = async (url: string) => {
    if (!url) {
      setSyncUrlType(null);
      return;
    }
    setSyncUrlType('checking');
    try {
      const result = await ipcRenderer.invoke('check-fastdl-url', url);
      if (result.success) {
        setSyncUrlType(result.hasVersions ? 'giants' : 'fastdl');
      } else {
        setSyncUrlType(null);
      }
    } catch (err) {
      setSyncUrlType(null);
    }
  };

  useEffect(() => {
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (profile?.serverSyncUrl) {
      checkSyncUrl(profile.serverSyncUrl);
    } else {
      setSyncUrlType(null);
    }
  }, [selectedProfileId]);

  const handleCreateProfile = async () => {
    try {
      const newProfile = {
        id: `profile_${Date.now()}`,
        name: t('profiles.newProfile'),
        gameVersion: 'fs25',
        version: '1.0.0',
        description: '',
        serverSyncUrl: '',
        mods: []
      };
      await ipcRenderer.invoke('create-profile', newProfile);
      setSelectedProfileId(newProfile.id);
      await loadProfiles();
    } catch (error) {
      console.error(t('profiles.createError'), error);
      alert(`${t('profiles.createError')} ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm(t('profiles.deleteConfirm'))) {
      return;
    }

    try {
      await ipcRenderer.invoke('delete-profile', profileId);
      setSelectedProfileId('');
      await loadProfiles();
    } catch (error) {
      console.error(t('profiles.deleteError'), error);
      alert(`${t('profiles.deleteError')} ${error instanceof Error ? error.message : String(error)}`);
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
      console.log(`${t('sync.syncing')} ${profile.name} (${profile.id})`);
      await ipcRenderer.invoke('sync-profile', profile.id);
    } catch (error) {
      console.error(t('sync.errorDetail'), error);
      alert(`${t('sync.errorDetail')} ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSyncing(prev => ({ ...prev, [profile.id]: false }));
    }
  };

  const handleToggleMod = async (profileId: string, modId: string, isActive: boolean) => {
    try {
      await ipcRenderer.invoke('toggle-mod', profileId, modId, isActive);
      await loadProfiles();
    } catch (error) {
      console.error(t('mods.toggleError'), error);
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
      console.error(t('mods.deleteError'), error);
      alert(`${t('mods.deleteError')} ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleOpenModFolder = async (profile: Profile) => {
    try {
      const { shell } = window.require('electron');
      await shell.openPath(profile.modFolderPath);
    } catch (error) {
      console.error(t('mods.openFolderError'), error);
      alert(`${t('mods.openFolderError')} ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  const handleSelectFolder = async (field: 'modFolderPath') => {
    if (!selectedProfile) return;
    const folderPath = await ipcRenderer.invoke('open-folder-dialog');
    if (folderPath) {
      const updatedProfile = { ...selectedProfile, [field]: folderPath };
      try {
        await ipcRenderer.invoke('save-profile', updatedProfile);
        await loadProfiles();
      } catch (error) {
        console.error(t('profiles.saveError'), error);
      }
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
        const modCount = result.filePaths.length;
        alert(t('mods.addProgress').replace('{count}', modCount.toString()));

        for (const filePath of result.filePaths) {
          await ipcRenderer.invoke('add-mod-to-profile', profile.id, filePath);
        }

        await loadProfiles();
        alert(t('mods.addSuccess').replace('{count}', modCount.toString()));
      }
    } catch (error) {
      console.error(t('mods.addError'), error);
      alert(`${t('mods.addError')} ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent, profileId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files).filter((f: any) => f.name.toLowerCase().endsWith('.zip'));
    if (files.length === 0) return;

    alert(t('mods.importProgress').replace('{count}', files.length.toString()));
    const filePaths = files.map((f: any) => f.path);
    
    try {
      const result = await ipcRenderer.invoke('import-dropped-mods', profileId, filePaths);
      if (result.success) {
        await loadProfiles();
        alert(result.message);
      } else {
        alert(`${t('error.prefix')} ${result.error}`);
      }
    } catch (error) {
      console.error(t('mods.importError'), error);
      alert(`${t('error.prefix')} ${error instanceof Error ? error.message : String(error)}`);
    }
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
          if (!activeModNames.has(dep.toLowerCase()) && !activeMods.some(m => m.fileName.toLowerCase() === dep.toLowerCase() + '.zip')) {
            missingDeps.push(`"${mod.name}" benötigt "${dep}"`);
          }
        }
      }
    }
    
    return { activeMaps, missingDeps };
  };

  const handleProfileChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!selectedProfile) return;
    
    const target = e.target as HTMLInputElement;
    const { name, value, type, checked } = target;
    
    let parsedValue: any = value;
    if (type === 'checkbox') parsedValue = checked;
    if (type === 'number') parsedValue = parseInt(value, 10);

    const updatedProfile = {
      ...selectedProfile,
      [name]: parsedValue
    };
    
    try {
      await ipcRenderer.invoke('save-profile', updatedProfile);
      await loadProfiles(); // Reload to reflect changes
    } catch (error) {
      console.error(t('profiles.saveError'), error);
    }
  };

  return (
    <div className="profiles-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Kachel 1: {t('profiles.selection')} */}
      <div className="card profile-selection-card">
        <h2>{t('profiles.title')}</h2>
        <p>{t('profiles.selectionDesc')}</p>
        <div 
          className="profile-selector-grid" 
          style={{ 
            display: 'flex', 
            gap: '20px', 
            marginTop: '15px', 
            overflowX: 'auto', 
            padding: '10px 5px 20px 5px',
            scrollSnapType: 'x mandatory'
          }}
        >
          {profiles.map(p => {
            const isActive = p.id === selectedProfileId;
            const activeModsCount = p.mods.filter(m => m.isActive).length;
            return (
              <div 
                key={p.id}
                onClick={() => setSelectedProfileId(p.id)}
                style={{
                  minWidth: '200px',
                  height: '150px',
                  borderRadius: '12px',
                  background: isActive ? 'linear-gradient(145deg, rgba(59, 130, 246, 0.15), rgba(30, 64, 175, 0.3))' : 'rgba(255, 255, 255, 0.05)',
                  border: isActive ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                  boxShadow: isActive ? '0 0 15px rgba(59, 130, 246, 0.4)' : '0 4px 6px rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '15px',
                  transition: 'all 0.2s ease',
                  scrollSnapAlign: 'start',
                  position: 'relative'
                }}
                className="profile-tile"
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1em', color: isActive ? '#fff' : 'var(--text-primary)', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</h3>
                  <span style={{ fontSize: '0.75em', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.3)', padding: '3px 8px', borderRadius: '12px' }}>
                    {p.gameVersion?.toUpperCase() || 'FS25'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', color: '#aaa', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                    <span>Gesamt</span>
                    <span style={{ fontWeight: 'bold', color: '#fff' }}>{p.mods.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', color: '#aaa' }}>
                    <span>Aktiv</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--success-color)' }}>{activeModsCount}</span>
                  </div>
                </div>
              </div>
            );
          })}
          
          <div 
            onClick={handleCreateProfile}
            style={{
              minWidth: '200px',
              height: '150px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '2px dashed var(--border-color)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '15px',
              transition: 'all 0.2s ease',
              scrollSnapAlign: 'start',
              gap: '15px'
            }}
            className="profile-tile-add"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'var(--primary-color)';
              e.currentTarget.style.color = 'var(--primary-color)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ fontSize: '2.5em', color: 'inherit', fontWeight: '300' }}>+</div>
            <div style={{ fontSize: '0.9em', color: 'inherit', textAlign: 'center', fontWeight: '500' }}>{t('profiles.createNew') || 'Neues Profil'}</div>
          </div>
        </div>
      </div>

      {selectedProfile && (
        <>
          {/* Kachel 2: Profil Einstellungen */}
          <div className="card profile-settings-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>{t('profiles.editTitle')}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedProfile.serverSyncUrl && (
                  <button 
                    className="btn btn-success btn-sm"
                    onClick={() => handleSyncProfile(selectedProfile)}
                    disabled={!!isSyncing[selectedProfile.id]}
                  >
                    {isSyncing[selectedProfile.id] ? t('profiles.syncing') : t('profiles.sync')}
                  </button>
                )}
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteProfile(selectedProfile.id)}
                >
                  {t('profiles.delete')}
                </button>
              </div>
            </div>

            <div className="profile-stats" style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              <span>Mods: {selectedProfile.mods.length}</span> | 
              <span> {t('mods.active')}: {selectedProfile.mods.filter(m => m.isActive).length}</span>
              {selectedProfile.lastSyncDate && (
                <span> | Letzter Sync: {new Date(selectedProfile.lastSyncDate).toLocaleDateString()}</span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>{t('profileEdit.name')}</label>
                <input type="text" name="name" value={selectedProfile.name} onChange={handleProfileChange} />
              </div>
              <div className="form-group">
                <label>{t('profileEdit.gameVersion')}</label>
                <select name="gameVersion" value={selectedProfile.gameVersion || 'fs25'} onChange={handleProfileChange}>
                  <option value="fs25">Farming Simulator 25</option>
                  <option value="fs22">Farming Simulator 22</option>
                  <option value="fs19">Farming Simulator 19</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('profileEdit.description')}</label>
                <input type="text" name="description" value={selectedProfile.description || ''} onChange={handleProfileChange} placeholder="Optionale Beschreibung..." />
              </div>
              <div className="form-group">
                <label>{t('profileEdit.packVersion')}</label>
                <input type="text" name="version" value={selectedProfile.version || '1.0.0'} onChange={handleProfileChange} placeholder="z.B. 1.0.0" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>{t('profileEdit.serverSyncUrl')}</label>
                <input 
                  type="text" 
                  name="serverSyncUrl" 
                  value={selectedProfile.serverSyncUrl || ''} 
                  onChange={handleProfileChange} 
                  onBlur={(e) => checkSyncUrl(e.target.value)}
                  placeholder="http://localhost:8080/mods.html" 
                />
                {syncUrlType === 'checking' && <small style={{ color: 'var(--text-color)', opacity: 0.7, marginTop: '4px', display: 'block' }}>{t('profiles.checkingUrl')}</small>}
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>
                  {t('profileEdit.serverStatsUrl')} 
                  {syncUrlType === 'fastdl' && <span style={{ color: '#ef4444', marginLeft: '8px' }}>{t('profileEdit.fastdlRequired')}</span>}
                </label>
                <input 
                  type="text" 
                  name="serverWebStatsUrl" 
                  value={selectedProfile.serverWebStatsUrl || ''} 
                  onChange={handleProfileChange} 
                  placeholder="http://[IP_ADDRESS]/feed/dedicated-server-stats.xml?code=XXX" 
                  style={syncUrlType === 'fastdl' && !selectedProfile.serverWebStatsUrl ? { borderColor: '#ef4444' } : {}}
                />
                {syncUrlType === 'fastdl' && !selectedProfile.serverWebStatsUrl ? (
                  <small style={{ color: '#ef4444', marginTop: '4px', display: 'block' }}>
                    {t('profileEdit.fastdlWarning')}
                  </small>
                ) : (
                  <small style={{ color: 'var(--text-color)', opacity: 0.7, marginTop: '4px', display: 'block' }}>
                    {t('profileEdit.statsInfo')}
                  </small>
                )}
              </div>
              
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>{t('profileEdit.modFolder')}</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" value={selectedProfile.modFolderPath || ''} readOnly style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }} />
                  <button className="btn btn-secondary" onClick={() => handleSelectFolder('modFolderPath')}>{t('settings.browse')}</button>
                </div>
              </div>
              
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>{t('profileEdit.launchParams')}</label>
                <input type="text" name="launchParameters" value={selectedProfile.launchParameters || ''} onChange={handleProfileChange} placeholder="-autoStartSavegameId 1" />
              </div>
              
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', width: 'fit-content' }}>
                  <input type="checkbox" name="autoBackupSavegame" checked={!!selectedProfile.autoBackupSavegame} onChange={handleProfileChange} style={{ width: 'auto', margin: 0 }} />
                  <span>{t('profileEdit.autoBackup')}</span>
                </label>
              </div>
              
              {selectedProfile.autoBackupSavegame && (
                <div className="form-group">
                  <label>{t('profileEdit.savegameNum')}</label>
                  <input type="number" name="savegameIndex" min="1" max="20" value={selectedProfile.savegameIndex || 1} onChange={handleProfileChange} />
                </div>
              )}
            </div>
          </div>

          {/* Kachel 3: Mod Liste */}
          <div 
            className="card profile-mods-card"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, selectedProfile.id)}
          >
            <div className="mods-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>{t('mods.title')}</h3>
              <div className="mods-actions">
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenModFolder(selectedProfile)}
                  title="Mod-Ordner öffnen"
                >
                  📁 {t('profiles.openFolder') || 'Ordner öffnen'}
                </button>
                <div className="profile-actions" style={{ display: 'flex', gap: '5px' }}>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const { ipcRenderer } = window.require('electron');
                      ipcRenderer.send('force-modhub-updates', selectedProfile.id);
                    }}
                    title="Prüft alle Mods mit Mod-ID auf Updates"
                  >
                    🔄 Updates Prüfen
                  </button>
                  <button 
                    className="btn btn-success btn-sm"
                    onClick={() => handleAddMods(selectedProfile)}
                    title="Mods hinzufügen (Datei)"
                  >
                    ➕ {t('profiles.addFile') || 'Datei'}
                  </button>
                </div>
              </div>
            </div>
            {(() => {
              const { activeMaps, missingDeps } = checkConflicts(selectedProfile);
              const categories = Array.from(new Set(selectedProfile.mods.flatMap(m => {
                const c = m.modHubCategory || m.modDescData?.category || 'Unknown';
                if (c === 'Unknown') return [];
                return c.split('-').map(x => x.trim()).filter(Boolean);
              }))).sort();
              const tags = Array.from(new Set(selectedProfile.mods.flatMap(m => m.tags || []))).sort();
              const currentCategory = categoryFilters[selectedProfile.id] || 'All';
              const currentSearch = (searchQueries[selectedProfile.id] || '').toLowerCase();
              const currentSort = sortOrders[selectedProfile.id] || 'nameAsc';

              let filteredMods = selectedProfile.mods;

              // 1. Kategoriefilter
              if (currentCategory !== 'All') {
                filteredMods = filteredMods.filter(m => {
                  const c = m.modHubCategory || m.modDescData?.category || 'Unknown';
                  const cats = c !== 'Unknown' ? c.split('-').map(x => x.trim()).filter(Boolean) : [];
                  return cats.includes(currentCategory) || (m.tags || []).includes(currentCategory);
                });
              }

              // 2. Suchfilter
              if (currentSearch) {
                filteredMods = filteredMods.filter(m => {
                  const title = getModTitle(m).toLowerCase();
                  const filename = m.fileName.toLowerCase();
                  const author = (m.modDescData?.author || m.author || '').toLowerCase();
                  return title.includes(currentSearch) || filename.includes(currentSearch) || author.includes(currentSearch);
                });
              }

              // 3. Sortierung
              filteredMods = [...filteredMods].sort((a, b) => {
                if (currentSort === 'activeFirst') {
                  if (a.isActive && !b.isActive) return -1;
                  if (!a.isActive && b.isActive) return 1;
                  return getModTitle(a).localeCompare(getModTitle(b));
                } else if (currentSort === 'nameDesc') {
                  return getModTitle(b).localeCompare(getModTitle(a));
                } else { // nameAsc
                  return getModTitle(a).localeCompare(getModTitle(b));
                }
              });
                
              return (
                <>
                  {(activeMaps.length > 1 || missingDeps.length > 0) && (
                    <div className="conflict-warnings" style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', padding: '10px', margin: '10px 0', borderRadius: '4px' }}>
                      <h4 style={{ color: '#ef4444', marginTop: 0, marginBottom: '8px' }}>{t("profiles.conflictWarning") || "⚠️ Mod Conflicts Detected!"}</h4>
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

                  <div className="filter-sort-bar" style={{ marginBottom: '15px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
                      <span>🔍</span>
                      <input 
                        type="text" 
                        placeholder={t('mods.search') || 'Mods durchsuchen...'} 
                        value={currentSearch}
                        onChange={(e) => setSearchQueries(prev => ({ ...prev, [selectedProfile.id]: e.target.value }))}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>📂</span>
                      <select 
                        value={currentCategory}
                        onChange={(e) => setCategoryFilters(prev => ({ ...prev, [selectedProfile.id]: e.target.value }))}
                        style={{ padding: '6px', borderRadius: '4px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                      >
                        <option value="All">{t("profiles.allMods") || "Alle Kategorien"} ({selectedProfile.mods.length})</option>
                        {categories.length > 0 && <optgroup label={t("profiles.categories") || "Categories"}>
                          {categories.map(cat => (
                            <option key={`cat_${cat}`} value={cat}>{cat} ({selectedProfile.mods.filter(m => {
                              const c = m.modHubCategory || m.modDescData?.category || 'Unknown';
                              const cats = c !== 'Unknown' ? c.split('-').map(x => x.trim()).filter(Boolean) : [];
                              return cats.includes(cat);
                            }).length})</option>
                          ))}
                        </optgroup>}
                        {tags.length > 0 && <optgroup label={t("profiles.customTags") || "Custom Tags"}>
                          {tags.map(tag => (
                            <option key={`tag_${tag}`} value={tag}>#{tag} ({selectedProfile.mods.filter(m => (m.tags || []).includes(tag)).length})</option>
                          ))}
                        </optgroup>}
                      </select>
                      
                      {currentCategory !== 'All' && (
                        <button 
                          className="btn btn-sm btn-secondary" 
                          onClick={() => {
                            const newProfile = { ...selectedProfile };
                            newProfile.mods.forEach(m => {
                              const c = m.modHubCategory || m.modDescData?.category || 'Unknown';
                              const cats = c !== 'Unknown' ? c.split('-').map(x => x.trim()).filter(Boolean) : [];
                              if (cats.includes(currentCategory) || (m.tags || []).includes(currentCategory)) {
                                m.isActive = !m.isActive;
                              }
                            });
                            ipcRenderer.invoke('save-profile', newProfile).then(loadProfiles);
                          }}
                        >
                          {t('profiles.toggleAllIn') || 'Alle in umschalten'} {currentCategory}
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>↕️</span>
                      <select 
                        value={currentSort}
                        onChange={(e) => setSortOrders(prev => ({ ...prev, [selectedProfile.id]: e.target.value }))}
                        style={{ padding: '6px', borderRadius: '4px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                      >
                        <option value="nameAsc">{t('mods.sortNameAsc') || 'Name (A-Z)'}</option>
                        <option value="nameDesc">{t('mods.sortNameDesc') || 'Name (Z-A)'}</option>
                        <option value="activeFirst">{t('mods.sortActiveFirst') || 'Aktive zuerst'}</option>
                      </select>
                    </div>
                  </div>

                  {filteredMods.length > 0 ? (
                    <div className="mods-list">
                      {filteredMods.map((mod) => (
                        <div key={mod.fileName} className={`mod-item ${mod.isActive ? 'active' : 'inactive'}`}>

                          <div className="mod-info">
                            <div className="mod-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{getModTitle(mod)}</span>
                              {((mod.modHubId && mod.modHubId !== '!') || (mod.modHub && mod.modHub !== 'no')) && (
                                <span title="Im ModHub verfügbar" style={{ 
                                  background: 'rgba(16, 185, 129, 0.2)', 
                                  color: '#34d399', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  fontSize: '0.7rem',
                                  fontWeight: 'bold',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  🌐 ModHub
                                </span>
                              )}
                              {mod.modHubId && mod.modHubId !== '!' && mod.modHubVersion && mod.version && mod.version !== mod.modHubVersion && (
                                <span title={`Update auf Version ${mod.modHubVersion} verfügbar!`} style={{ 
                                  background: 'rgba(239, 68, 68, 0.2)', 
                                  color: '#ef4444', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  fontSize: '0.7rem',
                                  fontWeight: 'bold',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  ⚠️ Update
                                </span>
                              )}
                              {mod.tags && mod.tags.length > 0 && (
                                <div className="mod-tags" style={{ display: 'inline-flex', gap: '4px' }}>
                                  {mod.tags.map(t => (
                                    <span key={t} style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '2px 6px', borderRadius: '12px', fontSize: '0.75rem' }}>#{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mod-actions">
                            
                            {mod.modHubId && mod.modHubId !== '!' && mod.modHubVersion && mod.version && mod.version !== mod.modHubVersion && (
                              <button
                                className="btn btn-sm"
                                style={{ backgroundColor: '#ef4444', color: 'white' }}
                                onClick={() => {
                                  ipcRenderer.send('download-modhub-mod', selectedProfile.id, mod.fileName, mod.modHubId);
                                }}
                              >
                                ⬇️ Update ({mod.modHubVersion})
                              </button>
                            )}

                            <button
                              className={`btn btn-sm ${mod.isActive ? 'btn-warning' : 'btn-success'}`}
                              onClick={() => handleToggleMod(selectedProfile.id, mod.fileName, !mod.isActive)}
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
                              onClick={() => handleDeleteMod(selectedProfile.id, mod.fileName)}
                            >
                              {t('mods.delete')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-mods">
                      {selectedProfile.mods.length > 0 ? 'Keine Mods in dieser Kategorie gefunden.' : t('mods.noMods')}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
};

export default ProfilesView;
