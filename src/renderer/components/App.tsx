import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import StartPage from './StartPage';
import ProfilesView from './ProfilesView';
import SettingsView from './SettingsView';
import ProfileSettingsView from './ProfileSettingsView';
import GamebotView from './GamebotView';
import { Settings } from '../../common/types';

const { ipcRenderer } = window.require('electron');

const App: React.FC = () => {  const navigate = useNavigate();
  const location = useLocation();  const [settings, setSettings] = useState<Settings>({
    defaultModFolder: '',
    gamePath: '',
    theme: 'light',
    autoCheckUpdates: true,
    language: 'de',
    debugLogging: false
  });

  useEffect(() => {
    // Lade die App-Einstellungen beim Start
    const loadSettings = async () => {
      const savedSettings = await ipcRenderer.invoke('load-settings');
      setSettings(savedSettings);
      
      // Setze das Theme basierend auf den Einstellungen
      document.body.className = savedSettings.theme === 'dark' ? 'theme-dark' : '';
    };
    
    loadSettings();
  }, []);
  // Aktuellen Tab basierend auf der URL bestimmen
  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/profiles')) return 'profiles';
    if (path.startsWith('/profile-settings')) return 'profile-settings';
    if (path.startsWith('/gamebot')) return 'gamebot';
    return 'start';
  };
  const handleMinimize = () => {
    ipcRenderer.invoke('minimize-window');
  };
  
  const handleMaximize = () => {
    ipcRenderer.invoke('maximize-window');
  };
  
  const handleClose = () => {
    ipcRenderer.invoke('close-window');
  };

  return (
    <div className="container">
      <header className="header">
        <h1>FS25 Mod Manager</h1>
        
        <div className="window-controls">
          <button className="minimize" onClick={handleMinimize}>_</button>
          <button className="maximize" onClick={handleMaximize}>□</button>
          <button className="close" onClick={handleClose}>✕</button>
        </div>
      </header>
        <div className="tabs">
        <div 
          className={`tab ${getCurrentTab() === 'start' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          Start
        </div>
        <div 
          className={`tab ${getCurrentTab() === 'profiles' ? 'active' : ''}`}
          onClick={() => navigate('/profiles')}
        >
          Profile
        </div>
        <div 
          className={`tab ${getCurrentTab() === 'gamebot' ? 'active' : ''}`}
          onClick={() => navigate('/gamebot')}
        >
          Gamebot
        </div>
        <div 
          className={`tab ${getCurrentTab() === 'settings' ? 'active' : ''}`}
          onClick={() => navigate('/settings')}
        >
          Einstellungen
        </div>
        {location.pathname.includes('/profile-settings/') && (
          <div className="tab active">
            Profil Einstellungen
          </div>
        )}
      </div>
        <div className="content">
        <Routes>
          <Route path="/" element={<StartPage settings={settings} />} />
          <Route path="/profiles" element={<ProfilesView settings={settings} />} />
          <Route path="/gamebot" element={<GamebotView settings={settings} />} />
          <Route path="/settings" element={<SettingsView settings={settings} setSettings={setSettings} />} />
          <Route path="/profile-settings/:id" element={<ProfileSettingsView settings={settings} />} />
        </Routes>
      </div>
        <footer className="footer">
        <div className="footer-content">
          <div className="copyright">
            FS25 Mod Manager © 2025 | <a href="#" onClick={() => ipcRenderer.invoke('open-external', 'https://github.com/username/fs25-mod-manager')}>GitHub</a>
          </div>
          <div className="version">
            Version 1.0.0
          </div>
        </div>
        <div className="legal">
          Farming Simulator ist eine eingetragene Marke von GIANTS Software GmbH. Diese Anwendung steht in keiner Verbindung zu GIANTS Software.
        </div>
      </footer>
    </div>
  );
};

export default App;
