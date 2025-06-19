import React, { useState } from 'react';
import { Settings } from '../../common/types';

const { ipcRenderer } = window.require('electron');

interface SettingsViewProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ settings, setSettings }) => {
  const [localSettings, setLocalSettings] = useState<Settings>({ ...settings });
  const [saveStatus, setSaveStatus] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setLocalSettings({
      ...localSettings,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : value
    });
  };  const handleFolderSelect = async (type: 'defaultModFolder' | 'gamePath') => {
    // Verwende verschiedene Dialoge für Ordner und Dateien
    const isFile = type === 'gamePath';
    const path = await ipcRenderer.invoke(isFile ? 'open-file-dialog' : 'open-folder-dialog');
    
    if (path) {
      setLocalSettings({
        ...localSettings,
        [type]: path
      });
    }
  };

  const handleSaveSettings = async () => {
    try {
      await ipcRenderer.invoke('save-settings', localSettings);
      setSettings(localSettings);
      setSaveStatus('Einstellungen erfolgreich gespeichert');
      
      // Aktualisiere das Theme
      document.body.className = localSettings.theme === 'dark' ? 'theme-dark' : '';
      
      setTimeout(() => {
        setSaveStatus('');
      }, 3000);    } catch (error) {
      console.error('Fehler beim Speichern der Einstellungen:', error);
      setSaveStatus(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="settings-view">
      <div className="card">
        <h2>Einstellungen</h2>
        
        <div className="form-group">
          <label htmlFor="default-mod-folder">Standard-Mod-Ordner</label>
          <div className="folder-select">            <input 
              type="text" 
              id="default-mod-folder" 
              name="defaultModFolder"
              value={localSettings.defaultModFolder} 
              onChange={handleChange}
              readOnly
            />
            <button className="btn" onClick={() => handleFolderSelect('defaultModFolder')}>Durchsuchen</button>
          </div>
          <small>Der Standardordner für Mods im Spiel.</small>
        </div>
          <div className="form-group">
          <label htmlFor="game-path">Spiel-Programmdatei (EXE)</label>
          <div className="folder-select">
            <input 
              type="text" 
              id="game-path" 
              name="gamePath"
              value={localSettings.gamePath || ''} 
              onChange={handleChange}
              readOnly
              placeholder="z.B. C:\Program Files\Farming Simulator 25\FarmingSimulator25.exe"
            />
            <button className="btn" onClick={() => handleFolderSelect('gamePath')}>EXE wählen</button>
          </div>
          <small>Die ausführbare Datei des Spiels (FarmingSimulator25.exe).</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="theme-select">Darstellung</label>
          <select 
            id="theme-select" 
            name="theme" 
            value={localSettings.theme}
            onChange={handleChange}
          >
            <option value="light">Hell</option>
            <option value="dark">Dunkel</option>
          </select>
        </div>
        
        <div className="form-group">
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              name="autoCheckUpdates"
              checked={localSettings.autoCheckUpdates}
              onChange={handleChange}
            />
            Automatisch nach Updates suchen
          </label>
        </div>
          <div className="form-group">
          <label htmlFor="language-select">Sprache</label>
          <select 
            id="language-select" 
            name="language" 
            value={localSettings.language}
            onChange={handleChange}
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </div>
        
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="debugLogging"
              checked={localSettings.debugLogging || false}
              onChange={handleChange}
            />
            Debug-Logging aktivieren
          </label>
          <small>
            Aktiviert erweiterte Protokollierung für Fehleranalyse. Log-Datei wird in "Dokumente/FS_ModManager/log.txt" gespeichert.
          </small>
        </div>
        
        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleSaveSettings}>
            Einstellungen speichern
          </button>
        </div>
        
        {saveStatus && (
          <div className={`alert ${saveStatus.includes('Fehler') ? 'alert-error' : 'alert-success'}`}>
            {saveStatus}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsView;
