import React from 'react';
import { SyncProgress } from '../../common/types';
import { useTranslation } from '../i18n';

interface SyncProgressPopupProps {
  isOpen: boolean;
  progress: SyncProgress;
  onCancel?: () => void;
  language?: 'en' | 'de';
}

const SyncProgressPopup: React.FC<SyncProgressPopupProps> = ({
  isOpen,
  progress,
  onCancel,
  language = 'de'
}) => {
  const t = useTranslation(language);
  
  if (!isOpen) {
    return null;
  }

  const totalProgress = (progress.completedMods / progress.totalMods) * 100;
  const currentFileProgress = progress.currentFileProgress;  const getStatusText = (status: string) => {
    switch (status) {
      case 'downloading':
        return t('sync.downloading');
      case 'extracting':
        return t('sync.extracting');
      case 'verifying':
        return t('sync.verifying');
      case 'completed':
        return t('sync.completed');
      case 'error':
        return t('sync.error');
      case 'cancelled':
        return 'Abgebrochen';
      case 'saving':
        return t('sync.saving');
      default:
        return status;
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'downloading':
        return '#2196F3';
      case 'extracting':
        return '#FF9800';
      case 'verifying':
        return '#9C27B0';
      case 'completed':
        return '#4CAF50';
      case 'error':
        return '#F44336';
      case 'cancelled':
        return '#FF9800';
      default:
        return '#2196F3';
    }
  };

  return (
    <div className="popup-overlay">      <div className="popup-content sync-progress-popup">
        <div className="popup-header">
          <h2>{t('sync.running')}</h2>
        </div>

        <div className="popup-body">
          <div className="sync-status">
            <div className="status-info">
              <div className="status-text">
                Status: <span style={{ color: getStatusColor(progress.status) }}>
                  {getStatusText(progress.status)}
                </span>
              </div>
              <div className="current-mod">
                {t('sync.currentMod')}: <strong>{progress.currentMod}</strong>
              </div>
            </div>
          </div>

          <div className="progress-section">
            <div className="progress-label">
              {t('sync.totalProgress')} ({progress.completedMods} von {progress.totalMods} Mods)
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ 
                  width: `${totalProgress}%`,
                  backgroundColor: getStatusColor(progress.status)
                }}
              />
            </div>
            <div className="progress-percentage">
              {Math.round(totalProgress)}%
            </div>
          </div>

          <div className="progress-section">
            <div className="progress-label">
              {progress.status === 'downloading' && t('sync.downloading')}
              {progress.status === 'extracting' && t('sync.extracting')}
              {progress.status === 'verifying' && t('sync.verifying')}
              {progress.status !== 'downloading' && progress.status !== 'extracting' && progress.status !== 'verifying' && t('sync.currentMod')}
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ 
                  width: `${progress.currentFileProgress}%`,
                  backgroundColor: getStatusColor(progress.status)
                }}
              />
            </div>
            <div className="progress-percentage">
              {Math.round(progress.currentFileProgress)}%
            </div>
          </div>

          <div className="sync-details">
            <div className="detail-item">
              <span className="detail-label">Abgeschlossen:</span>
              <span className="detail-value">{progress.completedMods}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Verbleibend:</span>
              <span className="detail-value">{progress.totalMods - progress.completedMods}</span>
            </div>
          </div>
        </div>        <div className="popup-footer">
          {progress.status === 'completed' ? (
            <button className="button primary" onClick={onCancel}>
              {t('sync.close')}
            </button>
          ) : progress.status === 'error' ? (
            <button className="button secondary" onClick={onCancel}>
              {t('sync.close')}
            </button>
          ) : progress.status === 'cancelled' ? (
            <button className="button secondary" onClick={onCancel}>
              {t('sync.close')}
            </button>
          ) : (
            onCancel && (
              <button className="button secondary" onClick={onCancel}>
                {t('sync.cancel')}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncProgressPopup;
