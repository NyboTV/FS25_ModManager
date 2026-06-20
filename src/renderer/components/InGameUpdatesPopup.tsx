import React, { useState } from 'react';
import { Profile } from '../../common/types';

interface InGameUpdatesPopupProps {
  profile: Profile;
  changes: string[];
  onImport: (changes: string[]) => Promise<void>;
  onIgnore: () => void;
}

const InGameUpdatesPopup: React.FC<InGameUpdatesPopupProps> = ({
  profile,
  changes,
  onImport,
  onIgnore
}) => {
  const [isImporting, setIsImporting] = useState(false);

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
          <h2 style={{ color: '#fbbf24' }}>⚠️ In-Game Updates erkannt</h2>
        </div>
        
        <div className="popup-body">
          <p>
            Wir haben Änderungen an deinen Mods im Spiel-Ordner erkannt. 
            Möglicherweise hast du In-Game über den ModHub Updates oder neue Mods heruntergeladen.
          </p>
          <p>
            Zuletzt gespieltes Profil: <strong>{profile.name}</strong>
          </p>
          
          <div style={{ background: 'var(--bg-darker)', padding: '15px', borderRadius: '8px', margin: '15px 0', maxHeight: '150px', overflowY: 'auto' }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>Gefundene Änderungen ({changes.length}):</p>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#ccc' }}>
              {changes.map(mod => (
                <li key={mod}>{mod}</li>
              ))}
            </ul>
          </div>
          
          <p style={{ color: '#aaa', fontSize: '0.9em' }}>
            Möchtest du diese Änderungen in dein Profil übernehmen? Wenn du auf "Ignorieren" klickst, werden die im Spiel geladenen Mods beim nächsten Start wieder gelöscht und auf den alten Profil-Stand zurückgesetzt.
          </p>
        </div>
        
        <div className="popup-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            className="btn-secondary" 
            onClick={onIgnore}
            disabled={isImporting}
          >
            ❌ Ignorieren (Verwerfen)
          </button>
          <button 
            className="btn-primary" 
            style={{ background: '#4ade80', color: '#000' }}
            onClick={handleImport}
            disabled={isImporting}
          >
            {isImporting ? 'Übernehme...' : '✅ Ins Profil übernehmen'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InGameUpdatesPopup;
