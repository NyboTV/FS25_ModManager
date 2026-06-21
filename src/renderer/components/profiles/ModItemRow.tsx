import React from 'react';
import { ModInfo } from '../../../common/types';

const { ipcRenderer } = window.require('electron');

interface ModItemRowProps {
  mod: ModInfo;
  selectedProfileId: string;
  selectedMods: Set<string>;
  setSelectedMods: React.Dispatch<React.SetStateAction<Set<string>>>;
  onShowModInfo: (mod: ModInfo) => void;
  onToggleMod: (profileId: string, modId: string, isActive: boolean) => void;
  onDeleteMod: (profileId: string, modId: string) => void;
  getModTitle: (mod: ModInfo) => string;
  t: (key: string) => string;
}

export const ModItemRow: React.FC<ModItemRowProps> = ({
  mod,
  selectedProfileId,
  selectedMods,
  setSelectedMods,
  onShowModInfo,
  onToggleMod,
  onDeleteMod,
  getModTitle,
  t
}) => {
  return (
    <div className={`mod-item ${mod.isActive ? 'active' : 'inactive'}`}>
      <div className="mod-info">
        <div className="mod-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input 
            type="checkbox" 
            checked={selectedMods.has(mod.fileName)}
            onChange={(e) => {
              const newSet = new Set(selectedMods);
              if (e.target.checked) newSet.add(mod.fileName);
              else newSet.delete(mod.fileName);
              setSelectedMods(newSet);
            }}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <span style={{ cursor: 'pointer' }} onClick={() => onShowModInfo(mod)}>{getModTitle(mod)}</span>
          {((mod.modHubId && mod.modHubId !== '!') || (mod.modHub && mod.modHub !== 'no')) && (
            <span title={t('mods.availableOnModHub')} style={{ 
              background: 'rgba(16, 185, 129, 0.2)', 
              color: '#34d399', 
              padding: '2px 6px', 
              borderRadius: '4px', 
              fontSize: '0.7rem',
              fontWeight: 'bold',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              🌐 ModHub
            </span>
          )}
          {mod.modHubId && mod.modHubId !== '!' && mod.modHubVersion && mod.version && mod.version !== mod.modHubVersion && (
            <span title={t('mods.updateAvailableTooltip').replace('{version}', mod.modHubVersion)} style={{ 
              background: 'rgba(239, 68, 68, 0.2)', 
              color: '#ef4444', 
              padding: '2px 6px', 
              borderRadius: '4px', 
              fontSize: '0.7rem',
              fontWeight: 'bold',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              ⚠️ Update
            </span>
          )}
          {mod.tags && mod.tags.length > 0 && (
            <div className="mod-tags" style={{ display: 'inline-flex', gap: '4px' }}>
              {mod.tags.map(tag => (
                <span key={tag} style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '2px 6px', borderRadius: '12px', fontSize: '0.75rem' }}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mod-actions">
        
        {mod.modHubId && mod.modHubId !== '!' && mod.modHubVersion && mod.version && mod.version !== mod.modHubVersion && (
          <button
            className="btn btn-sm"
            style={{ backgroundColor: '#ef4444', color: 'white' }}
            onClick={() => {
              ipcRenderer.send('download-modhub-mod', selectedProfileId, mod.fileName, mod.modHubId);
            }}
          >
            ⬇️ Update ({mod.modHubVersion})
          </button>
        )}

        <button
          className={`btn btn-sm ${mod.isActive ? 'btn-warning' : 'btn-success'}`}
          onClick={() => onToggleMod(selectedProfileId, mod.fileName, !mod.isActive)}
        >
          {mod.isActive ? t('mods.deactivate') : t('mods.activate')}
        </button>
        <button
          className="btn btn-sm btn-info"
          onClick={() => onShowModInfo(mod)}
        >
          {t('mods.info')}
        </button>
        <button
          className="btn btn-sm btn-danger"
          onClick={() => onDeleteMod(selectedProfileId, mod.fileName)}
        >
          {t('mods.delete')}
        </button>
      </div>
    </div>
  );
};
