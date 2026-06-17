import React, { useState } from 'react';
import { useTranslation } from '../i18n';

const { ipcRenderer } = window.require('electron');

interface LogEntry {
  type: 'info' | 'warning' | 'error';
  message: string;
  relatedMod?: string;
  count?: number;
}

interface LogAnalyzerViewProps {
  settings: any;
}

const LogAnalyzerView: React.FC<LogAnalyzerViewProps> = ({ settings }) => {
  const t = useTranslation(settings.language);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<'fs19' | 'fs22' | 'fs25'>('fs25');

  const handleAnalyze = async (manualPath?: string) => {
    setIsAnalyzing(true);
    setError(null);
    
    let logPath = manualPath || '';
    
    if (!logPath) {
      // Check if the user has a custom mod folder defined in settings for the selected game
      const gameSettings = settings.games?.[selectedGame];
      if (gameSettings && gameSettings.defaultModFolder) {
        // Assuming defaultModFolder is like .../FarmingSimulator2025/mods
        // The log.txt is in the parent directory
        const pathModule = window.require('path');
        logPath = pathModule.join(gameSettings.defaultModFolder, '..', 'log.txt');
      } else {
        // Fallback to standard path
        const year = selectedGame.replace('fs', '20');
        logPath = `${process.env.USERPROFILE}\\Documents\\My Games\\FarmingSimulator${year}\\log.txt`;
      }
    }
    
    try {
      const result = await ipcRenderer.invoke('analyze-log', logPath);
      if (result.success) {
        setLogEntries(result.entries || []);
      } else {
        setError(`${result.error || 'Unbekannter Fehler'}\nVersuchter Pfad: ${logPath}`);
      }
    } catch (e) {
      setError(`Ein Fehler ist aufgetreten: ${String(e)}\nVersuchter Pfad: ${logPath}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBrowseLog = async () => {
    try {
      const filePath = await ipcRenderer.invoke('open-file-dialog');
      if (filePath) {
        handleAnalyze(filePath);
      }
    } catch (err) {
      setError(`Fehler beim Durchsuchen: ${String(err)}`);
    }
  };

  return (
    <div className="log-analyzer-view" style={{ padding: '20px' }}>
      <div className="card">
        <h2>Game Log Analyzer</h2>
        <p>Analysiere deine Farming Simulator `log.txt` auf Fehler, Warnungen und Mod-Konflikte.</p>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px' }}>
          <select 
            value={selectedGame} 
            onChange={(e) => setSelectedGame(e.target.value as any)}
            className="input-select"
            style={{ width: '200px' }}
          >
            <option value="fs25">Farming Simulator 25</option>
            <option value="fs22">Farming Simulator 22</option>
            <option value="fs19">Farming Simulator 19</option>
          </select>

          <button 
            className="btn btn-primary" 
            onClick={() => handleAnalyze()} 
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Analysiere...' : 'Log.txt analysieren'}
          </button>
          
          <button 
            className="btn btn-secondary" 
            onClick={handleBrowseLog} 
            disabled={isAnalyzing}
          >
            Durchsuchen...
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <div style={{ marginTop: '20px' }}>
          {logEntries.length === 0 && !isAnalyzing && !error && (
            <p>No errors or warnings found yet. Click analyze to start.</p>
          )}

          {logEntries.length > 0 && (
            <div style={{ maxHeight: '500px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
              {logEntries.map((entry, index) => (
                <div 
                  key={index} 
                  style={{ 
                    padding: '8px', 
                    marginBottom: '4px',
                    borderLeft: `4px solid ${entry.type === 'error' ? '#ff4d4f' : entry.type === 'warning' ? '#ff6b00' : '#1ed760'}`,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                  }}
                >
                  <strong style={{ color: entry.type === 'error' ? '#ff4d4f' : entry.type === 'warning' ? '#ff6b00' : '#1ed760', display: 'inline-block', width: '70px' }}>
                    [{entry.type.toUpperCase()}]
                  </strong> 
                  {entry.relatedMod && <span style={{ color: '#00d2ff', marginRight: '10px' }}>[{entry.relatedMod}]</span>}
                  {entry.count && entry.count > 1 && <span style={{ color: '#eb7a00', marginRight: '10px', fontWeight: 'bold', backgroundColor: 'rgba(235, 122, 0, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>x{entry.count}</span>}
                  {entry.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogAnalyzerView;
