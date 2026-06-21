import React from 'react';
import { SyncProgress } from '../../common/types';
import { useTranslation } from '../i18n';

interface SyncProgressPopupProps {
  isOpen: boolean;
  progress: SyncProgress;
  onCancel?: () => void;
  onSkipCurrentMod?: () => void;
  onProvideLocalMod?: () => void;
  onPauseToggle?: () => void;
  autoLaunch?: boolean;
  onAutoLaunchChange?: (val: boolean) => void;
  language?: 'en' | 'de' | 'fr';
  autoLaunchCountdown?: number | null;
  onCancelAutoLaunch?: () => void;
}

const SyncProgressPopup: React.FC<SyncProgressPopupProps> = ({
  isOpen,
  progress,
  onCancel,
  onSkipCurrentMod,
  onProvideLocalMod,
  onPauseToggle,
  autoLaunch = false,
  onAutoLaunchChange,
  language = 'de',
  autoLaunchCountdown = null,
  onCancelAutoLaunch
}) => {
  const t = useTranslation(language);
  
  if (!isOpen) {
    return null;
  }

  const totalProgress = progress.totalMods > 0 ? (progress.completedMods / progress.totalMods) * 100 : 100;
  const progressText = progress.totalServerMods !== undefined
    ? t('sync.progressCountWithTotal')
        .replace('{completed}', progress.completedMods.toString())
        .replace('{total}', progress.totalMods.toString())
        .replace('{serverTotal}', progress.totalServerMods.toString())
    : t('sync.progressCount')
        .replace('{completed}', progress.completedMods.toString())
        .replace('{total}', progress.totalMods.toString());
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
        return t('sync.cancelled');
      case 'saving':
        return t('sync.saving');
      case 'paused':
        return t('sync.paused');
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
      case 'paused':
        return '#fbbf24';
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
                {progress.status === 'downloading' && progress.downloadSource && (
                  <div style={{ marginTop: '5px', fontSize: '0.9em', color: progress.downloadSource === 'fastDL' ? '#fbbf24' : '#9ca3af' }}>
                    {progress.downloadSource === 'fastDL' ? t('sync.fromFastDL') : t('sync.fromModsPage')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {progress.status === 'error' && progress.errorMessage && (
            <div className="sync-error-banner" style={{
              marginTop: '15px',
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderLeft: '4px solid #ef4444',
              borderRadius: '6px',
              color: '#fca5a5',
              fontSize: '0.95em',
              lineHeight: '1.4',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}>
              <span style={{ fontWeight: 'bold', color: '#f87171' }}>{t('common.error')}:</span>
              <span>{progress.errorMessage}</span>
            </div>
          )}

          {progress.status === 'completed' && autoLaunchCountdown !== null && (
            <div className="auto-launch-countdown-banner" style={{
              marginTop: '15px',
              padding: '15px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              borderLeft: '4px solid var(--primary-color)',
              borderRadius: '6px',
              color: '#fff',
              textAlign: 'center',
              fontSize: '1.1em',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '1.5em' }}>🚀</span>
              <span>{t('sync.launchingIn').replace('{count}', autoLaunchCountdown.toString())}</span>
            </div>
          )}

          <div className="progress-section">
            <div className="progress-label">
              {t('sync.totalProgress')} ({progressText})
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
              <span className="detail-label">{t('sync.detailCompleted')}:</span>
              <span className="detail-value">{progress.completedMods}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('sync.detailRemaining')}:</span>
              <span className="detail-value">{Math.max(0, progress.totalMods - progress.completedMods)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('sync.detailSpeed')}:</span>
              <span className="detail-value">
                {progress.speedMbPerSec !== undefined && progress.speedMbPerSec > 0
                  ? `${progress.speedMbPerSec.toFixed(2)} MB/s`
                  : '--'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('sync.detailEta')}:</span>
              <span className="detail-value">
                {progress.etaSeconds !== undefined && progress.etaSeconds > 0
                  ? (progress.etaSeconds < 60
                      ? `${progress.etaSeconds}s`
                      : `${Math.floor(progress.etaSeconds / 60)}m ${progress.etaSeconds % 60}s`)
                  : '--'}
              </span>
            </div>
          </div>
          
          {onAutoLaunchChange && progress.status !== 'completed' && progress.status !== 'error' && (
            <div style={{ marginTop: '15px' }}>
              <label className="checkbox-label" htmlFor="autoLaunchSync" style={{ color: '#fff' }}>
                <input 
                  type="checkbox" 
                  id="autoLaunchSync" 
                  checked={autoLaunch} 
                  onChange={(e) => onAutoLaunchChange(e.target.checked)} 
                />
                {t('sync.autoLaunch')}
              </label>
            </div>
          )}
        </div>        <div className="popup-footer">
          {progress.status === 'completed' ? (
            autoLaunchCountdown !== null && onCancelAutoLaunch ? (
              <button className="button danger" onClick={onCancelAutoLaunch} style={{ background: '#ef4444', color: '#fff', border: 'none' }}>
                {t('sync.cancelLaunch') || 'Start abbrechen'}
              </button>
            ) : (
              <button className="button primary" onClick={onCancel}>
                {t('sync.close')}
              </button>
            )
          ) : progress.status === 'error' ? (
            <button className="button secondary" onClick={onCancel}>
              {t('sync.close')}
            </button>
          ) : progress.status === 'cancelled' ? (
            <button className="button secondary" onClick={onCancel}>
              {t('sync.close')}
            </button>
          ) : (
            <>
              {(progress.status === 'downloading' || progress.status === 'paused') && (
                <div style={{ display: 'flex', gap: '8px', marginRight: 'auto' }}>
                  {onPauseToggle && (
                    <button className="button secondary" onClick={onPauseToggle} title={progress.status === 'paused' ? t('sync.resumeTooltip') : t('sync.pauseTooltip')}>
                      {progress.status === 'paused' ? t('sync.resume') : t('sync.pause')}
                    </button>
                  )}
                  {onSkipCurrentMod && (
                    <button className="button secondary" onClick={onSkipCurrentMod} title={t('sync.skipTooltip')}>
                      {t('sync.skip')}
                    </button>
                  )}
                  {onProvideLocalMod && (
                    <button className="button secondary" onClick={onProvideLocalMod} title={t('sync.localFileTooltip')}>
                      {t('sync.localFile')}
                    </button>
                  )}
                </div>
              )}
              {onCancel && (
                <button className="button secondary" onClick={onCancel}>
                  {t('sync.cancel')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncProgressPopup;
