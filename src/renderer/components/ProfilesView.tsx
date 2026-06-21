import React, { useState, useEffect } from 'react';
import { Profile, Settings, ModInfo } from '../../common/types';
import { useTranslation } from '../i18n';
import { ProfileSelector } from './profiles/ProfileSelector';
import { ProfileSettingsForm } from './profiles/ProfileSettingsForm';
import { ProfileModsList } from './profiles/ProfileModsList';

const { ipcRenderer } = window.require('electron');

interface ProfilesViewProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  onShowModInfo: (mod: ModInfo) => void;
  modListReloadKey?: number;
  initialProfiles?: Profile[];
  onReloadProfiles?: () => void;
}

const ProfilesView: React.FC<ProfilesViewProps> = ({ 
  settings, 
  setSettings,
  onShowModInfo,
  modListReloadKey,
  initialProfiles = [],
  onReloadProfiles
}) => {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => {
    const saved = localStorage.getItem('selectedProfileId');
    if (saved) return saved;
    return initialProfiles.length > 0 ? initialProfiles[0].id : '';
  });

  useEffect(() => {
    if (initialProfiles && initialProfiles.length > 0) {
      setProfiles(initialProfiles);
      if (!selectedProfileIdRef.current) {
        const saved = localStorage.getItem('selectedProfileId');
        if (saved && initialProfiles.some(p => p.id === saved)) {
          setSelectedProfileId(saved);
        } else {
          setSelectedProfileId(initialProfiles[0].id);
        }
      }
    }
  }, [initialProfiles]);
  
  const selectedProfileIdRef = React.useRef(selectedProfileId);

  useEffect(() => {
    selectedProfileIdRef.current = selectedProfileId;
    if (selectedProfileId) {
      localStorage.setItem('selectedProfileId', selectedProfileId);
    } else {
      localStorage.removeItem('selectedProfileId');
    }
  }, [selectedProfileId]);
  
  const [isSyncing, setIsSyncing] = useState<{[profileId: string]: boolean}>({});
  const [categoryFilters, setCategoryFilters] = useState<{[profileId: string]: string}>({});
  const [searchQueries, setSearchQueries] = useState<{[profileId: string]: string}>({});
  const [sortOrders, setSortOrders] = useState<{[profileId: string]: string}>({});
  const [syncUrlType, setSyncUrlType] = useState<'checking' | 'giants' | 'fastdl' | null>(null);
  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
  
  const t = useTranslation(settings.language);

  useEffect(() => {
    if (profiles.length === 0 || (modListReloadKey && modListReloadKey > 0)) {
      loadProfiles();
    }
  }, [modListReloadKey]);

  useEffect(() => {
    if (selectedProfileId) {
      ipcRenderer.send('start-modhub-mapping', selectedProfileId);
      ipcRenderer.send('watch-profile-mods', selectedProfileId);
      setSelectedMods(new Set());
    }
    return () => {
      ipcRenderer.send('watch-profile-mods', '');
    };
  }, [selectedProfileId]);

  useEffect(() => {
    const handleModsChanged = () => {
      console.log('Mods folder changed, reloading profiles...');
      loadProfiles();
    };
    ipcRenderer.on('profile-mods-changed', handleModsChanged);
    return () => {
      ipcRenderer.removeListener('profile-mods-changed', handleModsChanged);
    };
  }, []);

  const loadProfiles = async () => {
    try {
      const loadedProfiles = await ipcRenderer.invoke('load-profiles');
      setProfiles(loadedProfiles);
      if (onReloadProfiles) onReloadProfiles();
      
      const currentId = selectedProfileIdRef.current;
      if (loadedProfiles.length > 0) {
        const exists = loadedProfiles.some((p: Profile) => p.id === currentId);
        if (!currentId || !exists) {
          setSelectedProfileId(loadedProfiles[0].id);
        } else {
          setSelectedProfileId(currentId);
        }
      } else {
        setSelectedProfileId('');
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
  }, [selectedProfileId, profiles]);

  const handleCreateProfile = async () => {
    try {
      const newProfile = {
        id: `profile_${Date.now()}`,
        name: t('profiles.newProfile'),
        gameVersion: 'fs25',
        version: '1.0.0',
        description: '',
        serverSyncUrl: '',
        serverModListUrl: '',
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
    if (isSyncing[profile.id]) return;
    if (!profile.serverModListUrl && !profile.serverWebStatsUrl && !profile.serverSyncUrl) {
      alert(t('sync.error'));
      return;
    }
    setIsSyncing(prev => ({ ...prev, [profile.id]: true }));
    try {
      console.log(`${t('sync.syncing')} ${profile.name} (${profile.id})`);
      await ipcRenderer.invoke('sync-profile', profile.id);
      await loadProfiles();
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

  const handleBulkToggle = async (isActive: boolean) => {
    if (!selectedProfileId || selectedMods.size === 0) return;
    try {
      await ipcRenderer.invoke('toggle-mods-bulk', selectedProfileId, Array.from(selectedMods), isActive);
      setSelectedMods(new Set());
      await loadProfiles();
    } catch (error) {
      console.error('Error toggling mods bulk', error);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedProfileId || selectedMods.size === 0) return;
    const confirmMessage = t('bulk.deleteConfirm')?.replace('{count}', selectedMods.size.toString()) || `Willst du wirklich ${selectedMods.size} Mods löschen?`;
    if (!confirm(confirmMessage)) return;
    try {
      await ipcRenderer.invoke('delete-mods-bulk', selectedProfileId, Array.from(selectedMods));
      setSelectedMods(new Set());
      await loadProfiles();
    } catch (error) {
      console.error('Error deleting mods bulk', error);
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
    const folderPath = await ipcRenderer.invoke('select-folder');
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
      await loadProfiles();
    } catch (error) {
      console.error(t('profiles.saveError'), error);
    }
  };

  const handleToggleAutoStart = async (profileId: string, checked: boolean) => {
    const updatedSettings = {
      ...settings,
      autoStartProfileId: checked ? profileId : null
    };
    try {
      await ipcRenderer.invoke('save-settings', updatedSettings);
      setSettings(updatedSettings);
    } catch (error) {
      console.error(t('settings.saveError')?.replace('{error}', String(error)) || 'Fehler beim Speichern der Einstellungen:', error);
    }
  };

  return (
    <div className="profiles-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <ProfileSelector 
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        setSelectedProfileId={setSelectedProfileId}
        onCreateProfile={handleCreateProfile}
        t={t}
      />

      {selectedProfile && (
        <>
          <ProfileSettingsForm 
            selectedProfile={selectedProfile}
            isSyncing={!!isSyncing[selectedProfile.id]}
            onSyncProfile={handleSyncProfile}
            onDeleteProfile={handleDeleteProfile}
            onProfileChange={handleProfileChange}
            onSelectFolder={handleSelectFolder}
            settings={settings}
            onToggleAutoStart={handleToggleAutoStart}
            t={t}
          />

          <ProfileModsList 
            selectedProfile={selectedProfile}
            selectedMods={selectedMods}
            setSelectedMods={setSelectedMods}
            categoryFilters={categoryFilters}
            setCategoryFilters={setCategoryFilters}
            searchQueries={searchQueries}
            setSearchQueries={setSearchQueries}
            sortOrders={sortOrders}
            setSortOrders={setSortOrders}
            onShowModInfo={onShowModInfo}
            onToggleMod={handleToggleMod}
            onDeleteMod={handleDeleteMod}
            onBulkToggle={handleBulkToggle}
            onBulkDelete={handleBulkDelete}
            onOpenModFolder={handleOpenModFolder}
            onAddMods={handleAddMods}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            getModTitle={getModTitle}
            settings={settings}
            loadProfiles={loadProfiles}
            t={t}
          />
        </>
      )}
    </div>
  );
};

export default ProfilesView;
