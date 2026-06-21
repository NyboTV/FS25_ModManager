import React, { useState, useEffect } from 'react';
import { Settings, GameSettings } from '../../common/types';
import { useTranslation } from '../i18n';

const { ipcRenderer } = window.require('electron');

interface SettingsViewProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ settings, setSettings }) => {
  // Migration für alte Settings-Struktur
  const migrateSettings = (oldSettings: any): Settings => {
    if (oldSettings.games) {
      return oldSettings; // Bereits neue Struktur
    }
      // Migriere alte Struktur
    return {
      games: {
        fs19: {
          gamePath: '',
          defaultModFolder: ''
        },
        fs22: {
          gamePath: '',
          defaultModFolder: ''
        },
        fs25: {
          gamePath: oldSettings.gamePath || '',
          defaultModFolder: oldSettings.defaultModFolder || ''
        }
      },
      autoCheckUpdates: oldSettings.autoCheckUpdates || true,
      language: oldSettings.language || 'en',
      debugLogging: oldSettings.debugLogging || false,
      currentVersion: oldSettings.currentVersion || '1.0.0'
    };
  };

  const [localSettings, setLocalSettings] = useState<Settings>(migrateSettings(settings));
  const [saveStatus, setSaveStatus] = useState('');
  const [expandedGame, setExpandedGame] = useState<string | null>('fs25');
  const [appVersion, setAppVersion] = useState<string>(localSettings.currentVersion || '1.0.0');
  const t = useTranslation(settings.language);
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    ipcRenderer.invoke('load-profiles').then((loadedProfiles: any) => {
      const mpProfiles = (loadedProfiles || []).filter((p: any) => p.serverSyncUrl || p.serverModListUrl || p.serverWebStatsUrl);
      setProfiles(mpProfiles);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    ipcRenderer.invoke('get-app-version').then((version: string) => {
      setAppVersion(version);
    }).catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' 
      ? (e.target as HTMLInputElement).checked 
      : value;
    
    const updatedSettings = {
      ...localSettings,
      [name]: newValue
    };
    
    setLocalSettings(updatedSettings);

      // Bei Sprachänderung sofort anwenden und speichern
      if (name === 'language') {
        setSettings(updatedSettings);
        ipcRenderer.invoke('save-settings', updatedSettings).catch((err: any) => {
          console.error('Failed to save language setting', err);
        });
      }
      
      // Bei Beta-Updates sofort anwenden
      if (name === 'betaUpdates') {
        ipcRenderer.invoke('set-beta-updates', newValue).catch(console.error);
      }
  };

  const handleGameSettingChange = (game: 'fs19' | 'fs22' | 'fs25', field: 'gamePath' | 'defaultModFolder', value: string) => {
    const updatedSettings = {
      ...localSettings,
      games: {
        ...localSettings.games,
        [game]: {
          ...localSettings.games[game],
          [field]: value
        }
      }
    };
    
    setLocalSettings(updatedSettings);
  };

  const handleFolderSelect = async (gameAndType: string) => {
    const [game, type] = gameAndType.split('-') as ['fs19' | 'fs22' | 'fs25', 'gamePath' | 'defaultModFolder'];
    try {
      let result;
      if (type === 'gamePath') {
        result = await ipcRenderer.invoke('select-file', {
          filters: [{ name: 'Executable', extensions: ['exe'] }]
        });
      } else {
        result = await ipcRenderer.invoke('select-folder');
      }
      console.log('Ordnerauswahl Ergebnis:', result);
      if (typeof result === 'string' && result.length > 0) {
        handleGameSettingChange(game, type, result);
      } else if (result && result.filePaths && result.filePaths.length > 0) {
        handleGameSettingChange(game, type, result.filePaths[0]);
      }
    } catch (error) {
      console.error('Fehler beim Auswählen:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await ipcRenderer.invoke('save-settings', localSettings);
      setSettings(localSettings);
      setSaveStatus(t('settings.saveSuccess'));
      
      setTimeout(() => {
        setSaveStatus('');
      }, 3000);
    } catch (error) {
      console.error('Fehler beim Speichern der Einstellungen:', error);
      setSaveStatus(t('settings.saveError').replace('{error}', error instanceof Error ? error.message : String(error)));
    }
  };
  return (
    <div className="settings-view">
      <div className="card">
        <h2>{t('settings.title')}</h2>
        
        <div className="form-group">
          <label htmlFor="language-select">{t('settings.language')}</label>
          <select 
            id="language-select" 
            name="language" 
            value={localSettings.language}
            onChange={handleChange}
            className="dark-select"
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="autostart-select">{t('settings.autoStartProfile') || 'Auto-Start Profil'}</label>
          <select 
            id="autostart-select" 
            name="autoStartProfileId" 
            value={localSettings.autoStartProfileId || ''} 
            onChange={handleChange}
            className="dark-select"
          >
            <option value="">{t('settings.autoStartProfileNone') || 'Keins'}</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.gameVersion?.toUpperCase() || 'FS25'})</option>
            ))}
          </select>
          <small style={{ color: 'var(--text-color)', opacity: 0.7, marginTop: '4px', display: 'block' }}>
            {t('settings.autoStartProfileInfo') || 'Nur Multiplayer-Profile mit Sync-URL werden unterstützt.'}
          </small>
        </div>

        <div className="form-group game-settings-section">
          <h3>{t('settings.gameSettings')}</h3>
          
          {(['fs19', 'fs22', 'fs25'] as const).map((game) => (
            <details 
              key={game} 
              className="game-collapsible"
              open={expandedGame === game}
              onToggle={(e) => setExpandedGame((e.target as HTMLDetailsElement).open ? game : null)}
            >              <summary className="game-header">
                <strong>{t(`settings.${game}`)}</strong>
              </summary>
              
              <div className="game-content">
                <div className="form-group">
                  <label htmlFor={`${game}-mod-folder`}>{t('settings.defaultModFolder')}</label>
                  <div className="folder-select">
                    <input 
                      type="text" 
                      id={`${game}-mod-folder`}
                      value={localSettings.games[game].defaultModFolder} 
                      onChange={(e) => handleGameSettingChange(game, 'defaultModFolder', e.target.value)}
                      readOnly
                      placeholder={t('settings.defaultModFolderDescription')}
                    />
                    <button 
                      className="btn" 
                      onClick={() => handleFolderSelect(`${game}-defaultModFolder`)}
                    >
                      {t('settings.browse')}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor={`${game}-game-path`}>{t('settings.gamePath')}</label>
                  <div className="folder-select">
                    <input 
                      type="text" 
                      id={`${game}-game-path`}
                      value={localSettings.games[game].gamePath} 
                      onChange={(e) => handleGameSettingChange(game, 'gamePath', e.target.value)}
                      readOnly
                      placeholder={t('settings.gamePathPlaceholder')}
                    />
                    <button 
                      className="btn" 
                      onClick={() => handleFolderSelect(`${game}-gamePath`)}
                    >
                      {t('settings.selectExe')}
                    </button>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="debugLogging"
              checked={localSettings.debugLogging || false}
              onChange={handleChange}
            />
            {t('settings.debugLogging')}
          </label>
          <small>
            {t('settings.debugLoggingDescription')}
          </small>
        </div>

        <div className="form-group">
          <label>{t('settings.updateCheck')}</label>
          <div className="update-section">
            <div className="form-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  name="autoCheckUpdates"
                  checked={localSettings.autoCheckUpdates}
                  onChange={handleChange}
                />
                {t('settings.autoCheckUpdates')}
              </label>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  name="betaUpdates"
                  checked={localSettings.betaUpdates || false}
                  onChange={handleChange}
                />
                {t('settings.betaUpdates')}
              </label>
              <small>{t('settings.betaUpdatesDesc')}</small>
            </div>
            <button 
              className="btn btn-secondary"
              onClick={async () => {
                try {
                  const updateInfo = await ipcRenderer.invoke('check-for-updates');
                  if (updateInfo && updateInfo.hasUpdate) {
                    alert(t('settings.updateAvailable')
                      .replace('{latest}', updateInfo.latestVersion)
                      .replace('{current}', updateInfo.currentVersion));
                  } else {
                    alert(t('settings.noUpdates'));
                  }
                } catch (err: any) {
                  alert(`${t('common.error') || 'Fehler'}: ${err.message || err.toString()}`);
                }
              }}
            >
              {t('settings.checkUpdatesNow')}
            </button>
            <small>{t('settings.currentVersion')}: {appVersion}</small>
          </div>
        </div>
        
        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleSaveSettings}>
            {t('settings.save')}
          </button>
        </div>
        
        {saveStatus && (
          <div className={`alert ${saveStatus.includes('Fehler') || saveStatus.includes('Error') ? 'alert-error' : 'alert-success'}`}>
            {saveStatus}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsView;
