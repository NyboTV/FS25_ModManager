import React, { useState } from 'react';
import { Profile, Settings } from '../../../common/types';

interface ProfileSettingsFormProps {
  selectedProfile: Profile;
  isSyncing: boolean;
  onSyncProfile: (profile: Profile) => void;
  onDeleteProfile: (profileId: string) => void;
  onProfileChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSelectFolder: (field: 'modFolderPath') => void;
  settings: Settings;
  onToggleAutoStart: (profileId: string, checked: boolean) => void;
  t: (key: string) => string;
}

export const ProfileSettingsForm: React.FC<ProfileSettingsFormProps> = ({
  selectedProfile,
  isSyncing,
  onSyncProfile,
  onDeleteProfile,
  onProfileChange,
  onSelectFolder,
  settings,
  onToggleAutoStart,
  t
}) => {
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const modsList = selectedProfile.mods || [];
  const normalMods = modsList.filter(m => !(m.isDLC === true || m.fileName.toLowerCase().startsWith('pdlc_')));
  const activeNormalMods = normalMods.filter(m => m.isActive);
  const dlcCount = modsList.filter(m => m.isDLC === true || m.fileName.toLowerCase().startsWith('pdlc_')).length;
  const isMultiplayer = !!(selectedProfile.serverSyncUrl || selectedProfile.serverModListUrl || selectedProfile.serverWebStatsUrl);

  return (
    <div className="card profile-settings-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>{t('profiles.editTitle')}</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-danger btn-sm"
            onClick={() => onDeleteProfile(selectedProfile.id)}
          >
            {t('profiles.delete')}
          </button>
        </div>
      </div>

      <div className="profile-stats" style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginBottom: '20px' }}>
        <span>{t('mods.title')}: {normalMods.length}</span> | 
        <span> {t('mods.active')}: {activeNormalMods.length}</span>
        {dlcCount > 0 && (
          <>
            <span> | </span>
            <span>{t('profiles.dlcs') || 'DLCs'}: {dlcCount}</span>
          </>
        )}
        {selectedProfile.lastSyncDate && (
          <span> | {t('profiles.lastSyncText').replace('{date}', new Date(selectedProfile.lastSyncDate).toLocaleDateString())}</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div className="form-group">
          <label>{t('profileEdit.name')}</label>
          <input type="text" name="name" value={selectedProfile.name} onChange={onProfileChange} />
        </div>
        <div className="form-group">
          <label>{t('profileEdit.gameVersion')}</label>
          <select name="gameVersion" value={selectedProfile.gameVersion || 'fs25'} onChange={onProfileChange}>
            <option value="fs25">{t('settings.fs25')}</option>
            <option value="fs22">{t('settings.fs22')}</option>
            <option value="fs19">{t('settings.fs19')}</option>
          </select>
        </div>
        <div className="form-group">
          <label>{t('profileEdit.description')}</label>
          <input type="text" name="description" value={selectedProfile.description || ''} onChange={onProfileChange} placeholder={t('profileEdit.descriptionPlaceholder')} />
        </div>
        <div className="form-group">
          <label>{t('profileEdit.packVersion')}</label>
          <input type="text" name="version" value={selectedProfile.version || '1.0.0'} onChange={onProfileChange} placeholder="z.B. 1.0.0" />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label>{t('profileEdit.modListUrl')}</label>
          <input 
            type={focusedField === 'serverModListUrl' ? 'text' : 'password'} 
            name="serverModListUrl" 
            value={selectedProfile.serverModListUrl || ''} 
            onChange={onProfileChange} 
            onFocus={() => setFocusedField('serverModListUrl')}
            onBlur={() => setFocusedField(null)}
            placeholder="http://127.0.0.1:8081/mods.html"
          />
          <small style={{ color: 'var(--text-color)', opacity: 0.7, marginTop: '4px', display: 'block' }}>
            {t('profileEdit.modListUrlInfo')}
          </small>
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label>{t('profileEdit.serverSyncUrl')}</label>
          <input 
            type={focusedField === 'serverSyncUrl' ? 'text' : 'password'} 
            name="serverSyncUrl" 
            value={selectedProfile.serverSyncUrl || ''} 
            onChange={onProfileChange} 
            onFocus={() => setFocusedField('serverSyncUrl')}
            onBlur={() => setFocusedField(null)}
            placeholder="http://127.0.0.1:34567/mods.html"
          />
          <small style={{ color: 'var(--text-color)', opacity: 0.7, marginTop: '4px', display: 'block' }}>
            {t('profileEdit.fastdlUrlInfo')}
          </small>
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label>{t('profileEdit.serverStatsUrl')}</label>
          <input 
            type={focusedField === 'serverWebStatsUrl' ? 'text' : 'password'} 
            name="serverWebStatsUrl" 
            value={selectedProfile.serverWebStatsUrl || ''} 
            onChange={onProfileChange} 
            onFocus={() => setFocusedField('serverWebStatsUrl')}
            onBlur={() => setFocusedField(null)}
            placeholder="http://[IP_ADDRESS]/feed/dedicated-server-stats.xml?code=XXX" 
          />
          <small style={{ color: 'var(--text-color)', opacity: 0.7, marginTop: '4px', display: 'block' }}>
            {t('profileEdit.serverStatsUrlInfo')}
          </small>
        </div>
        
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label>{t('profileEdit.modFolder')}</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" value={selectedProfile.modFolderPath || ''} readOnly style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }} />
            <button className="btn btn-secondary" onClick={() => onSelectFolder('modFolderPath')}>{t('settings.browse')}</button>
          </div>
        </div>
        
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label>{t('profileEdit.launchParams')}</label>
          <input type="text" name="launchParameters" value={selectedProfile.launchParameters || ''} onChange={onProfileChange} placeholder="-autoStartSavegameId 1" />
        </div>
        
        {isMultiplayer && (
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', width: 'fit-content' }}>
              <input 
                type="checkbox" 
                checked={settings.autoStartProfileId === selectedProfile.id} 
                onChange={(e) => onToggleAutoStart(selectedProfile.id, e.target.checked)} 
                style={{ width: 'auto', margin: 0 }} 
              />
              <span style={{ fontWeight: '500', color: 'var(--primary-color)' }}>
                ⭐ {t('profileEdit.autoStart') || 'Als Auto-Start Profil festlegen'}
              </span>
            </label>
          </div>
        )}

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', width: 'fit-content' }}>
            <input type="checkbox" name="autoBackupSavegame" checked={!!selectedProfile.autoBackupSavegame} onChange={onProfileChange} style={{ width: 'auto', margin: 0 }} />
            <span>{t('profileEdit.autoBackup')}</span>
          </label>
        </div>
        
        {selectedProfile.autoBackupSavegame && (
          <div className="form-group">
            <label>{t('profileEdit.savegameNum')}</label>
            <input type="number" name="savegameIndex" min="1" max="20" value={selectedProfile.savegameIndex || 1} onChange={onProfileChange} />
          </div>
        )}
      </div>
    </div>
  );
};
