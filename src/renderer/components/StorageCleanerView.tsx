import React, { useState, useEffect } from 'react';
import { Settings } from '../../common/types';

const { ipcRenderer } = window.require('electron');

interface OrphanedMod {
  path: string;
  name: string;
  size: number;
}

import { useTranslation } from '../i18n';

interface StorageCleanerViewProps {
  settings: Settings;
}

const StorageCleanerView: React.FC<StorageCleanerViewProps> = ({ settings }) => {
  const [orphanedMods, setOrphanedMods] = useState<OrphanedMod[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [freedSpaceTotal, setFreedSpaceTotal] = useState<number>(0);
  const t = useTranslation(settings.language);

  const scanMods = async () => {
    setLoading(true);
    setError(null);
    try {
      // Nutze den FS25 Pfad als Standard
      const defaultModFolder = settings.games?.fs25?.defaultModFolder || settings.defaultModFolder;
      if (!defaultModFolder) {
        throw new Error(t("storage.noModFolder") || "Kein Mod-Ordner in den Einstellungen hinterlegt.");
      }
      
      const result = await ipcRenderer.invoke('scan-orphaned-mods', defaultModFolder);
      if (result.success) {
        setOrphanedMods(result.orphaned || []);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scanMods();
  }, []);

  const deleteMods = async () => {
    if (orphanedMods.length === 0) return;
    if (!confirm((t("storage.confirmDelete") || `Möchtest du wirklich {count} verwaiste Mods löschen?`).replace('{count}', orphanedMods.length.toString()))) return;

    setLoading(true);
    try {
      const paths = orphanedMods.map(m => m.path);
      const result = await ipcRenderer.invoke('delete-orphaned-mods', paths);
      if (result.success) {
        alert((t("storage.deletedResult") || `{count} Mods gelöscht. Platz freigegeben: {space}`).replace('{count}', result.deleted.toString()).replace('{space}', formatFileSize(result.freedSpace)));
        setFreedSpaceTotal(prev => prev + result.freedSpace);
        await scanMods();
      } else {
        alert(`${t("storage.deleteError") || "Fehler beim Löschen:"} ${result.error}`);
      }
    } catch (err) {
      alert(`${t("common.error") || "Fehler"}: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalSize = orphanedMods.reduce((acc, mod) => acc + mod.size, 0);

  return (
    <div className="storage-cleaner-view" style={{ padding: '20px', overflowY: 'auto', height: '100%' }}>
      <div className="card">
        <h2>{t("storage.title") || "🧹 Speicher-Bereinigung (Junk-Cleaner)"}</h2>
        <p>
          {t("storage.desc") || "Dieses Tool scannt deinen globalen Mod-Ordner nach verwaisten Mods. Verwaiste Mods sind Dateien, die aktuell in keinem deiner Singleplayer-Profile genutzt werden. (Multiplayer/Server-Profile werden ignoriert, da diese ihre eigenen Sync-Ordner nutzen)."}
        </p>
        
        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={scanMods} disabled={loading}>
            {loading ? (t("storage.scanning") || 'Scanne Festplatte...') : (t("storage.scanBtn") || 'Erneut scannen')}
          </button>
          
          <button 
            className="btn btn-danger" 
            onClick={deleteMods} 
            disabled={loading || orphanedMods.length === 0}
          >
            {t("storage.deleteBtn") || "Alle verwaisten Mods löschen"} ({formatFileSize(totalSize)})
          </button>
        </div>

        {error && (
          <div className="error-message" style={{ color: '#ef4444', marginBottom: '20px' }}>
            {t("common.error") || "Fehler"}: {error}
          </div>
        )}

        {freedSpaceTotal > 0 && (
          <div style={{ padding: '10px', background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', borderRadius: '4px', marginBottom: '20px' }}>
            {(t("storage.freedSpaceMsg") || "🎉 Du hast heute bereits {space} Speicherplatz freigeräumt!").replace('{space}', formatFileSize(freedSpaceTotal))}
          </div>
        )}

        {!loading && !error && orphanedMods.length === 0 && (
          <div className="success-message" style={{ color: '#4ade80', padding: '20px', background: 'rgba(74, 222, 128, 0.1)', borderRadius: '8px' }}>
            {t("storage.cleanMsg") || "✨ Dein Mod-Ordner ist sauber! Es wurden keine verwaisten Dateien gefunden."}
          </div>
        )}

        {!loading && orphanedMods.length > 0 && (
          <div className="orphaned-list">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              {t("storage.junkFiles") || "Gefundene Junk-Dateien"} ({orphanedMods.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
              {orphanedMods.map((mod, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
                  <span style={{ color: '#ccc' }}>{mod.name}</span>
                  <span style={{ color: '#fbbf24' }}>{formatFileSize(mod.size)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorageCleanerView;
