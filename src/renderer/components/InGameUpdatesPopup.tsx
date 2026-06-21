import React, { useState } from 'react';
import { Profile } from '../../common/types';
import { useTranslation } from '../i18n';

interface InGameUpdatesPopupProps {
  profile: Profile;
  changes: string[];
  onImport: (changes: string[]) => Promise<void>;
  onIgnore: () => void;
  language?: string;
}

const InGameUpdatesPopup: React.FC<InGameUpdatesPopupProps> = ({
  profile,
  changes,
  onImport,
  onIgnore,
  language = 'de'
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const t = useTranslation(language as any);

  const handleImport = async () => {
    setIsImporting(true);
    try {
      await onImport(changes);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="popup-overlay active">
      <div className="popup-content" style={{ maxWidth: '600px' }}>
        <div className="popup-header">
          <h2 style={{ color: '#fbbf24' }}>{t('inGame.title')}</h2>
        </div>
        
        <div className="popup-body">
          <p>
            {t('inGame.desc')}
          </p>
          <p>
            {t('inGame.lastPlayed')} <strong>{profile.name}</strong>
          </p>
          
          <div style={{ background: 'var(--bg-darker)', padding: '15px', borderRadius: '8px', margin: '15px 0', maxHeight: '150px', overflowY: 'auto' }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>
              {t('inGame.changesFound').replace('{count}', changes.length.toString())}
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#ccc' }}>
              {changes.map(mod => (
                <li key={mod}>{mod}</li>
              ))}
            </ul>
          </div>
          
          <p style={{ color: '#aaa', fontSize: '0.9em' }}>
            {t('inGame.warning')}
          </p>
        </div>
        
        <div className="popup-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            className="btn-secondary" 
            onClick={onIgnore}
            disabled={isImporting}
          >
            {t('inGame.ignoreBtn')}
          </button>
          <button 
            className="btn-primary" 
            style={{ background: '#4ade80', color: '#000' }}
            onClick={handleImport}
            disabled={isImporting}
          >
            {isImporting ? t('inGame.importing') : t('inGame.importBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InGameUpdatesPopup;
