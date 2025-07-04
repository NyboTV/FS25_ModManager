import React from 'react';
import { ModInfo } from '../../common/types';
import { useTranslation } from '../i18n';

interface ModInfoPopupProps {
  mod: ModInfo | null;
  isOpen: boolean;
  onClose: () => void;
  language: 'en' | 'de';
}

const ModInfoPopup: React.FC<ModInfoPopupProps> = ({
  mod,
  isOpen,
  onClose,
  language
}) => {
  const t = useTranslation(language);
  
  if (!isOpen || !mod) {
    return null;
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getLocalizedTitle = (): string => {
    // modDescData.title ist optional, fallback auf mod.name
    if (mod.modDescData && mod.modDescData.title) {
      return mod.modDescData.title[language] || mod.modDescData.title['en'] || Object.values(mod.modDescData.title)[0] || mod.name;
    }
    return mod.name;
  };

  const getLocalizedDescription = (): string => {
    if (mod.modDescData && mod.modDescData.description) {
      return mod.modDescData.description[language] || mod.modDescData.description['en'] || Object.values(mod.modDescData.description)[0] || mod.description || 'Keine Beschreibung verfügbar';
    }
    return mod.description || 'Keine Beschreibung verfügbar';
  };

  // Hilfsfunktion: fileSize-String (z.B. "40.37 MB") in Bytes umwandeln
  const parseFileSize = (size: any): number => {
    if (typeof size === 'number') return size;
    if (typeof size === 'string') {
      const s = size.trim().toLowerCase();
      if (s.endsWith('mb')) return Math.round(parseFloat(s) * 1024 * 1024);
      if (s.endsWith('gb')) return Math.round(parseFloat(s) * 1024 * 1024 * 1024);
      if (s.endsWith('kb')) return Math.round(parseFloat(s) * 1024);
      const num = parseInt(s.replace(/[^\d]/g, ''));
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  // Neue Struktur: Felder direkt aus ModInfo lesen, keine alten/verschachtelten Felder mehr
  // modDescData bleibt als Zusatz, aber alle Pflichtinfos kommen aus ModInfo

  return (
    <div className="popup-overlay">
      <div className="popup-content mod-info-popup">
        <div className="popup-header">
          <h2>{t('mods.info')}</h2>
          <button className="popup-close" onClick={(e) => { e.stopPropagation(); onClose(); }}>×</button>
        </div>

        <div className="popup-body">
          <div className="mod-info-content">
            {mod.iconPath && (
              <div className="mod-icon">
                <img 
                  src={mod.iconPath} 
                  alt="Mod Icon" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            <div className="mod-details">
              <div className="detail-group">
                <h3>Allgemeine Informationen</h3>
                <div className="detail-item">
                  <span className="detail-label">Name:</span>
                  <span className="detail-value">{getLocalizedTitle()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('mods.author')}:</span>
                  <span className="detail-value">{mod.author || (mod.modDescData?.author ?? 'Unbekannt')}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('mods.version')}:</span>
                  <span className="detail-value">{mod.version || (mod.modDescData?.version ?? 'Unbekannt')}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status:</span>
                  <span className={`detail-value status ${mod.isActive ? 'active' : 'inactive'}`}>{mod.isActive ? t('mods.active') : t('mods.inactive')}</span>
                </div>
                {mod.modDescData?.multiplayerSupported !== undefined && (
                  <div className="detail-item">
                    <span className="detail-label">Multiplayer:</span>
                    <span className="detail-value">{mod.modDescData.multiplayerSupported ? 'Unterstützt' : 'Nicht unterstützt'}</span>
                  </div>
                )}
              </div>

              <div className="detail-group">
                <h3>Datei-Informationen</h3>
                <div className="detail-item">
                  <span className="detail-label">{t('mods.fileSize')}:</span>
                  <span className="detail-value">{mod.fileSize ? formatFileSize(parseFileSize(mod.fileSize)) : '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('mods.fileName')}:</span>
                  <span className="detail-value file-name" title={mod.fileName || ''}>{mod.fileName || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('mods.source')}:</span>
                  <span className="detail-value">
                    {mod.downloadUrl ? 'Server Sync' : 'Lokal'}
                  </span>
                </div>
              </div>

              <div className="detail-group">
                <h3>{t('mods.description')}</h3>
                <div className="mod-description">{getLocalizedDescription()}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="popup-footer">
          <button className="button primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModInfoPopup;
