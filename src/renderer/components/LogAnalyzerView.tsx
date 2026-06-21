import React, { useState, useEffect } from 'react';
import { Settings } from '../../common/types';

const { ipcRenderer } = window.require('electron');

interface LogIssue {
  modName: string;
  errorMessage: string;
  count: number;
}

import { useTranslation } from '../i18n';

interface LogAnalyzerViewProps {
  settings: Settings;
}

const LogAnalyzerView: React.FC<LogAnalyzerViewProps> = ({ settings }) => {
  const [issues, setIssues] = useState<LogIssue[]>([]);
  const [logPath, setLogPath] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslation(settings.language);

  const analyzeLog = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ipcRenderer.invoke('analyze-log');
      if (result.success) {
        setIssues(result.issues);
        setLogPath(result.logPath);
      } else {
        if (result.errorCode === 'NO_MOD_FOLDER') {
          setError(t("logs.errorNoModFolder") || "Kein Mod-Ordner konfiguriert.");
        } else if (result.errorCode === 'NO_LOG_FILE') {
          setError((t("logs.errorNoLog") || "log.txt nicht gefunden in {folder}").replace('{folder}', result.errorData));
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyzeLog();
  }, []);

  const openLogFile = async () => {
    if (!logPath) return;
    try {
      const { shell } = window.require('electron');
      await shell.openPath(logPath);
    } catch (err) {
      alert(`${t("common.error")}: ${err}`);
    }
  };

  return (
    <div className="log-analyzer-view" style={{ padding: '20px', overflowY: 'auto', height: '100%' }}>
      <div className="card">
        <h2>{t("logs.title") || "🛠️ Auto-Debugger (Log-Analyse)"}</h2>
        <p>{t("logs.desc") || "Der Auto-Debugger scannt deine aktuelle FS25 log.txt nach Fehlern und zeigt dir an, welche Mods diese verursachen."}</p>
        
        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={analyzeLog} disabled={loading}>
            {loading ? (t("logs.analyzing") || 'Analysiere...') : (t("logs.rescan") || 'Log neu einlesen')}
          </button>
          {logPath && (
            <button className="btn btn-secondary" onClick={openLogFile}>
              {t("logs.openLog") || 'log.txt öffnen'}
            </button>
          )}
        </div>

        {error && (
          <div className="error-message" style={{ color: '#ef4444', marginBottom: '20px' }}>
            {t("common.error") || "Fehler"}: {error}
          </div>
        )}

        {!loading && !error && issues.length === 0 && (
          <div className="success-message" style={{ color: '#4ade80', padding: '20px', background: 'rgba(74, 222, 128, 0.1)', borderRadius: '8px' }}>
            {t("logs.noErrorsFound") || "🎉 Keine fehlerhaften Mods in der log.txt gefunden! Dein Spiel sollte stabil laufen."}
          </div>
        )}

        {!loading && issues.length > 0 && (
          <div className="issues-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', borderRadius: '4px' }}>
              {(t("logs.errorsFound") || "⚠️ {count} Mods verursachen Fehler!").replace('{count}', issues.length.toString())}
            </div>
            {issues.map((issue, idx) => (
              <div key={idx} className="issue-card" style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, color: '#fca5a5' }}>{issue.modName}</h3>
                  <span style={{ background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                    {issue.count} {t("logs.errorCount") || "Fehler gefunden"}
                  </span>
                </div>
                <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.9rem', color: '#ccc', wordBreak: 'break-all' }}>
                  {t("logs.example") || "Beispiel:"} {issue.errorMessage}
                </p>
                <div style={{ marginTop: '15px' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>
                    {t("logs.tip") || "Tipp: Gehe in deine Profile und deaktiviere oder lösche diesen Mod, um Abstürze zu vermeiden."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogAnalyzerView;
