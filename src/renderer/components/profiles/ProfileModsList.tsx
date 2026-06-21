import React from 'react';
import { Profile, ModInfo, Settings } from '../../../common/types';
import { ModItemRow } from './ModItemRow';

const { ipcRenderer } = window.require('electron');

interface ProfileModsListProps {
  selectedProfile: Profile;
  selectedMods: Set<string>;
  setSelectedMods: React.Dispatch<React.SetStateAction<Set<string>>>;
  categoryFilters: {[profileId: string]: string};
  setCategoryFilters: React.Dispatch<React.SetStateAction<{[profileId: string]: string}>>;
  searchQueries: {[profileId: string]: string};
  setSearchQueries: React.Dispatch<React.SetStateAction<{[profileId: string]: string}>>;
  sortOrders: {[profileId: string]: string};
  setSortOrders: React.Dispatch<React.SetStateAction<{[profileId: string]: string}>>;
  onShowModInfo: (mod: ModInfo) => void;
  onToggleMod: (profileId: string, modId: string, isActive: boolean) => void;
  onDeleteMod: (profileId: string, modId: string) => void;
  onBulkToggle: (isActive: boolean) => void;
  onBulkDelete: () => void;
  onOpenModFolder: (profile: Profile) => void;
  onAddMods: (profile: Profile) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, profileId: string) => void;
  getModTitle: (mod: ModInfo) => string;
  settings: Settings;
  loadProfiles: () => Promise<void>;
  t: (key: string) => string;
}

export const ProfileModsList: React.FC<ProfileModsListProps> = ({
  selectedProfile,
  selectedMods,
  setSelectedMods,
  categoryFilters,
  setCategoryFilters,
  searchQueries,
  setSearchQueries,
  sortOrders,
  setSortOrders,
  onShowModInfo,
  onToggleMod,
  onDeleteMod,
  onBulkToggle,
  onBulkDelete,
  onOpenModFolder,
  onAddMods,
  onDragOver,
  onDrop,
  getModTitle,
  settings,
  loadProfiles,
  t
}) => {
  const checkConflicts = (profile: Profile) => {
    const mods = profile.mods || [];
    const activeMods = mods.filter(m => m.isActive);
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

  const { activeMaps, missingDeps } = checkConflicts(selectedProfile);
  const modsList = selectedProfile.mods || [];
  const localModsList = modsList.filter(m => !(m.isDLC === true || m.fileName.toLowerCase().startsWith('pdlc_')));
  
  const categories = Array.from(new Set(localModsList.flatMap(m => {
    const c = m.modHubCategory || m.modDescData?.category || 'Unknown';
    if (c === 'Unknown') return [];
    return c.split('-').map(x => x.trim()).filter(Boolean);
  }))).sort();
  
  const tags = Array.from(new Set(localModsList.flatMap(m => m.tags || []))).sort();
  const currentCategory = categoryFilters[selectedProfile.id] || 'All';
  const currentSearch = (searchQueries[selectedProfile.id] || '').toLowerCase();
  const currentSort = sortOrders[selectedProfile.id] || 'nameAsc';

  let filteredMods = localModsList;

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

  const selectedModsList = Array.from(selectedMods).map(fileName => modsList.find(m => m.fileName === fileName)).filter(Boolean) as ModInfo[];
  const hasModHubUpdates = selectedModsList.some(mod => mod.modHubId && mod.modHubId !== '!' && mod.modHubVersion && mod.version && mod.version !== mod.modHubVersion);
  const hasServerUrl = !!(selectedProfile.serverModListUrl || selectedProfile.serverSyncUrl || selectedProfile.serverWebStatsUrl);

  const handleBulkUpdate = () => {
    selectedModsList.forEach(mod => {
      if (mod.modHubId && mod.modHubId !== '!' && mod.modHubVersion && mod.version && mod.version !== mod.modHubVersion) {
        ipcRenderer.send('download-modhub-mod', selectedProfile.id, mod.fileName, mod.modHubId);
      }
    });
  };

  const handleBulkForceSync = () => {
    ipcRenderer.invoke('force-sync-mods', selectedProfile.id, Array.from(selectedMods));
  };

  return (
    <div 
      className="card profile-mods-card"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, selectedProfile.id)}
    >
      <div className="mods-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>{t('mods.title')}</h3>
        <div className="mods-actions">
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => onOpenModFolder(selectedProfile)}
            title={t('profiles.openFolderTooltip')}
          >
            📁 {t('profiles.openFolder')}
          </button>
          <div className="profile-actions" style={{ display: 'flex', gap: '5px' }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                if (confirm(t('profiles.rescanTooltip') || 'Liest alle ZIP-Dateien im Ordner komplett neu ein und aktualisiert die Versionen/Metadaten in der profile.json')) {
                  try {
                    const res = await ipcRenderer.invoke('rescan-profile-mods', selectedProfile.id);
                    if (res.success) {
                      await loadProfiles();
                      alert(t('profiles.rescanSuccess') || 'Profil erfolgreich neu eingelesen!');
                    } else {
                      alert((t('profiles.rescanError') || 'Fehler beim Neu-Einlesen:') + ' ' + res.error);
                    }
                  } catch (e: any) {
                    alert((t('profiles.rescanError') || 'Fehler beim Neu-Einlesen:') + ' ' + e.message);
                  }
                }
              }}
              title={t('profiles.rescanTooltip')}
            >
              🔍 {t('profiles.rescan')}
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (selectedProfile.serverSyncUrl || selectedProfile.serverModListUrl) {
                  ipcRenderer.invoke('sync-profile', selectedProfile.id);
                } else {
                  ipcRenderer.send('start-modhub-mapping', selectedProfile.id);
                }
              }}
              title={
                (selectedProfile.serverSyncUrl || selectedProfile.serverModListUrl)
                  ? t('profiles.syncWithServerTooltip')
                  : t('profiles.checkUpdatesModHubTooltip')
              }
            >
              {
                (selectedProfile.serverSyncUrl || selectedProfile.serverModListUrl) 
                  ? `🔄 ${t('profiles.syncWithServer')}`
                  : `🔄 ${t('profiles.checkUpdatesModHub')}`
              }
            </button>
            <button 
              className="btn btn-success btn-sm"
              onClick={() => onAddMods(selectedProfile)}
              title={t('profiles.addFileTooltip')}
            >
              ➕ {t('profiles.addFile')}
            </button>
          </div>
        </div>
      </div>

      {(activeMaps.length > 1 || missingDeps.length > 0) && (
        <div className="conflict-warnings" style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', padding: '10px', margin: '10px 0', borderRadius: '4px' }}>
          <h4 style={{ color: '#ef4444', marginTop: 0, marginBottom: '8px' }}>{t("profiles.conflictWarning")}</h4>
          {activeMaps.length > 1 && (
            <p style={{ margin: '4px 0', color: '#fca5a5' }}>
              {t('profiles.conflictMaps').replace('{count}', activeMaps.length.toString())}
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
            value={searchQueries[selectedProfile.id] || ''}
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
            <option value="All">{t("profiles.allMods") || "Alle Kategorien"} ({localModsList.length})</option>
            {categories.length > 0 && <optgroup label={t("profiles.categories") || "Categories"}>
              {categories.map(cat => (
                <option key={`cat_${cat}`} value={cat}>{cat} ({localModsList.filter(m => {
                  const c = m.modHubCategory || m.modDescData?.category || 'Unknown';
                  const cats = c !== 'Unknown' ? c.split('-').map(x => x.trim()).filter(Boolean) : [];
                  return cats.includes(cat);
                }).length})</option>
              ))}
            </optgroup>}
            {tags.length > 0 && <optgroup label={t("profiles.customTags") || "Custom Tags"}>
              {tags.map(tag => (
                <option key={`tag_${tag}`} value={tag}>#{tag} ({localModsList.filter(m => (m.tags || []).includes(tag)).length})</option>
              ))}
            </optgroup>}
          </select>
          
          {currentCategory !== 'All' && (
            <button 
              className="btn btn-sm btn-secondary" 
              onClick={() => {
                const updatedMods = [...modsList];
                updatedMods.forEach(m => {
                  const c = m.modHubCategory || m.modDescData?.category || 'Unknown';
                  const cats = c !== 'Unknown' ? c.split('-').map(x => x.trim()).filter(Boolean) : [];
                  if (cats.includes(currentCategory) || (m.tags || []).includes(currentCategory)) {
                    m.isActive = !m.isActive;
                  }
                });
                const updatedProfile = { ...selectedProfile, mods: updatedMods };
                ipcRenderer.invoke('save-profile', updatedProfile).then(loadProfiles);
              }}
            >
              {t('profiles.toggleAllIn') || 'Alle in umschalten'} {currentCategory}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={filteredMods.length > 0 && selectedMods.size === filteredMods.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedMods(new Set(filteredMods.map(m => m.fileName)));
                } else {
                  setSelectedMods(new Set());
                }
              }}
              style={{ width: '16px', height: '16px' }}
            />
            <span>{t('bulk.selectAll') || 'Alle'}</span>
          </label>
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
      </div>

      {selectedMods.size > 0 && (
        <div style={{ 
          display: 'flex', gap: '10px', padding: '10px 15px', 
          background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', 
          marginBottom: '15px', alignItems: 'center',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
            {t('bulk.selected').replace('{count}', selectedMods.size.toString())}:
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => onBulkToggle(true)}>{t('bulk.enable') || 'Aktivieren'}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => onBulkToggle(false)}>{t('bulk.disable') || 'Deaktivieren'}</button>
          {hasModHubUpdates && (
            <button className="btn btn-warning btn-sm" onClick={handleBulkUpdate}>⬇️ {t('bulk.update') || 'Update'}</button>
          )}
          {hasServerUrl && (
            <button className="btn btn-success btn-sm" onClick={handleBulkForceSync}>🔄 {t('bulk.forceSync') || 'Force Sync'}</button>
          )}
          <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={onBulkDelete}>{t('bulk.delete') || 'Löschen'}</button>
        </div>
      )}

      {filteredMods.length > 0 ? (
        <div className="mods-list">
          {filteredMods.map((mod) => (
            <ModItemRow 
              key={mod.fileName}
              mod={mod}
              selectedProfileId={selectedProfile.id}
              selectedMods={selectedMods}
              setSelectedMods={setSelectedMods}
              onShowModInfo={onShowModInfo}
              onToggleMod={onToggleMod}
              onDeleteMod={onDeleteMod}
              getModTitle={getModTitle}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className="no-mods">
          {modsList.length > 0 ? t('mods.noCategoryMods') : t('mods.noMods')}
        </div>
      )}
    </div>
  );
};
