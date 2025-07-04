import React, { useState, useEffect } from 'react';
import { GamebotServer, GamebotPlayerStats, Settings } from '../../common/types';
import GamebotDemo from './GamebotDemo';

const { ipcRenderer } = window.require('electron');

interface GamebotViewProps {
  settings: Settings;
}

const GamebotView: React.FC<GamebotViewProps> = ({ settings }) => {
  const [servers, setServers] = useState<GamebotServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<GamebotServer | null>(null);
  const [playerStats, setPlayerStats] = useState<GamebotPlayerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState(settings.gamebotApiKey || '');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [username, setUsername] = useState('');
  const [showDemo, setShowDemo] = useState(false);

  // Test API connection
  const testConnection = async () => {
    if (!apiKey.trim()) {
      setError('Bitte geben Sie einen API-Schlüssel ein');
      return;
    }

    setConnectionStatus('testing');
    setError(null);

    try {
      const result = await ipcRenderer.invoke('gamebot-test-connection', apiKey.trim());
      
      if (result.success) {
        setConnectionStatus('connected');
        await loadServers();
      } else {
        setConnectionStatus('failed');
        setError(result.message || 'Verbindung fehlgeschlagen');
      }
    } catch (err: any) {
      setConnectionStatus('failed');
      setError(err.message || 'Unerwarteter Fehler');
    }
  };

  // Load servers from gamebot
  const loadServers = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await ipcRenderer.invoke('gamebot-get-servers');
      
      if (result.success) {
        setServers(result.servers || []);
      } else {
        setError(result.error || 'Fehler beim Laden der Server');
      }
    } catch (err: any) {
      setError(err.message || 'Unerwarteter Fehler');
    } finally {
      setLoading(false);
    }
  };

  // Load server details
  const loadServerDetails = async (serverId: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await ipcRenderer.invoke('gamebot-get-server', serverId);
      
      if (result.success) {
        setSelectedServer(result.server);
      } else {
        setError(result.error || 'Fehler beim Laden der Serverdetails');
      }
    } catch (err: any) {
      setError(err.message || 'Unerwarteter Fehler');
    } finally {
      setLoading(false);
    }
  };

  // Load player statistics
  const loadPlayerStats = async () => {
    if (!username.trim()) {
      setError('Bitte geben Sie einen Benutzernamen ein');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await ipcRenderer.invoke('gamebot-get-player-stats', username.trim());
      
      if (result.success) {
        setPlayerStats(result.stats);
      } else {
        setError(result.error || 'Spieler nicht gefunden');
      }
    } catch (err: any) {
      setError(err.message || 'Unerwarteter Fehler');
    } finally {
      setLoading(false);
    }
  };

  // Sync mods from gamebot server
  const syncServerMods = async (serverId: string, profileId: string = 'default') => {
    setLoading(true);
    setError(null);

    try {
      const result = await ipcRenderer.invoke('gamebot-sync-mods', profileId, serverId);
      
      if (result.success) {
        alert(`Erfolgreich! ${result.message}\n\nStatistiken:\n- Heruntergeladen: ${result.stats.downloaded}\n- Fehler: ${result.stats.errors}\n- Gesamt: ${result.stats.total}`);
      } else {
        setError(result.error || 'Mod-Synchronisation fehlgeschlagen');
      }
    } catch (err: any) {
      setError(err.message || 'Unerwarteter Fehler');
    } finally {
      setLoading(false);
    }
  };

  const formatPlaytime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatMoney = (amount: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div className="gamebot-view">
      {showDemo ? (
        <div>
          <div className="demo-toggle">
            <button onClick={() => setShowDemo(false)} className="back-btn">
              ← Zurück zur Integration
            </button>
          </div>
          <GamebotDemo />
        </div>
      ) : (
        <>
          <div className="gamebot-header">
            <h2>🎮 Farming Gamebot Integration</h2>
            <p>Verbinden Sie sich mit farming.gamebot.me für erweiterte Server- und Mod-Verwaltung</p>
            <div className="header-actions">
              <button onClick={() => setShowDemo(true)} className="demo-btn">
                📋 Integration Demo anzeigen
              </button>
            </div>
          </div>

      {/* API Configuration */}
      <div className="gamebot-config">
        <h3>API-Konfiguration</h3>
        <div className="api-config-form">
          <div className="form-group">
            <label htmlFor="apiKey">API-Schlüssel:</label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Ihr farming.gamebot.me API-Schlüssel"
              disabled={loading}
            />
          </div>
          <div className="api-actions">
            <button 
              onClick={testConnection} 
              disabled={loading || connectionStatus === 'testing'}
              className={`test-btn ${connectionStatus}`}
            >
              {connectionStatus === 'testing' && '⏳ Teste...'}
              {connectionStatus === 'connected' && '✅ Verbunden'}
              {connectionStatus === 'failed' && '❌ Fehlgeschlagen'}
              {connectionStatus === 'idle' && '🔌 Verbindung testen'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <strong>Fehler:</strong> {error}
          <button onClick={() => setError(null)} className="close-error">×</button>
        </div>
      )}

      {/* Servers Section */}
      {connectionStatus === 'connected' && (
        <div className="gamebot-servers">
          <h3>🖥️ Server</h3>
          {loading && <div className="loading">Lade Server...</div>}
          
          {servers.length > 0 ? (
            <div className="servers-grid">
              {servers.map((server) => (
                <div key={server.id} className={`server-card ${server.status}`}>
                  <div className="server-header">
                    <h4>{server.name}</h4>
                    <span className={`status ${server.status}`}>
                      {server.status === 'online' && '🟢 Online'}
                      {server.status === 'offline' && '🔴 Offline'}
                      {server.status === 'maintenance' && '🟡 Wartung'}
                    </span>
                  </div>
                  
                  <div className="server-info">
                    <p><strong>IP:</strong> {server.ip}:{server.port}</p>
                    <p><strong>Spieler:</strong> {server.players.current}/{server.players.max}</p>
                    <p><strong>Map:</strong> {server.map}</p>
                    <p><strong>Mods:</strong> {server.mods.length}</p>
                  </div>
                  
                  <div className="server-actions">
                    <button 
                      onClick={() => loadServerDetails(server.id)}
                      disabled={loading}
                    >
                      Details
                    </button>
                    <button 
                      onClick={() => syncServerMods(server.id)}
                      disabled={loading || server.status !== 'online'}
                      className="sync-btn"
                    >
                      Mods synchronisieren
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !loading && <p>Keine Server gefunden.</p>
          )}
        </div>
      )}

      {/* Server Details */}
      {selectedServer && (
        <div className="server-details">
          <h3>📋 Server Details: {selectedServer.name}</h3>
          <div className="server-details-content">
            <div className="details-info">
              <p><strong>Status:</strong> <span className={selectedServer.status}>{selectedServer.status}</span></p>
              <p><strong>Spieler:</strong> {selectedServer.players.current}/{selectedServer.players.max}</p>
              <p><strong>Map:</strong> {selectedServer.map}</p>
              <p><strong>Letzte Aktualisierung:</strong> {new Date(selectedServer.lastUpdate).toLocaleString()}</p>
            </div>
            
            {selectedServer.mods.length > 0 && (
              <div className="server-mods">
                <h4>Mod-Liste ({selectedServer.mods.length})</h4>
                <div className="mods-list">
                  {selectedServer.mods.map((mod) => (
                    <div key={mod.id} className="mod-item">
                      <div className="mod-info">
                        <strong>{mod.name}</strong> v{mod.version}
                        {mod.required && <span className="required">Erforderlich</span>}
                      </div>
                      <div className="mod-size">
                        {(mod.fileSize / 1024 / 1024).toFixed(1)} MB
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button onClick={() => setSelectedServer(null)} className="close-details">
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* Player Stats Section */}
      {connectionStatus === 'connected' && (
        <div className="player-stats-section">
          <h3>📊 Spielerstatistiken</h3>
          <div className="player-search">
            <div className="form-group">
              <label htmlFor="username">Benutzername:</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Spielername eingeben"
                disabled={loading}
                onKeyPress={(e) => e.key === 'Enter' && loadPlayerStats()}
              />
            </div>
            <button onClick={loadPlayerStats} disabled={loading || !username.trim()}>
              Statistiken laden
            </button>
          </div>

          {playerStats && (
            <div className="player-stats">
              <h4>Statistiken für {playerStats.username}</h4>
              <div className="stats-grid">
                <div className="stat-item">
                  <label>Spielzeit:</label>
                  <span>{formatPlaytime(playerStats.playtime)}</span>
                </div>
                <div className="stat-item">
                  <label>Level:</label>
                  <span>{playerStats.level}</span>
                </div>
                <div className="stat-item">
                  <label>Geld:</label>
                  <span>{formatMoney(playerStats.money)}</span>
                </div>
                <div className="stat-item">
                  <label>Zuletzt gesehen:</label>
                  <span>{new Date(playerStats.lastSeen).toLocaleString()}</span>
                </div>
              </div>

              {Object.keys(playerStats.serverStats).length > 0 && (
                <div className="server-stats">
                  <h5>Server-spezifische Statistiken:</h5>
                  {Object.entries(playerStats.serverStats).map(([serverId, stats]) => (
                    <div key={serverId} className="server-stat">
                      <strong>Server {serverId}:</strong>
                      <span>Spielzeit: {formatPlaytime(stats.playtime)}</span>
                      <span>Zuletzt gespielt: {new Date(stats.lastPlayed).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default GamebotView;