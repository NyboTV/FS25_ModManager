import React from 'react';
import { Profile } from '../../../common/types';

interface ProfileSelectorProps {
  profiles: Profile[];
  selectedProfileId: string;
  setSelectedProfileId: (id: string) => void;
  onCreateProfile: () => void;
  t: (key: string) => string;
}

export const ProfileSelector: React.FC<ProfileSelectorProps> = ({
  profiles,
  selectedProfileId,
  setSelectedProfileId,
  onCreateProfile,
  t
}) => {
  return (
    <div className="card profile-selection-card">
      <h2>{t('profiles.title')}</h2>
      <p>{t('profiles.selectionDesc')}</p>
      <div 
        className="profile-selector-grid" 
        style={{ 
          display: 'flex', 
          gap: '20px', 
          marginTop: '15px', 
          overflowX: 'auto', 
          padding: '10px 5px 20px 5px',
          scrollSnapType: 'x mandatory'
        }}
      >
        {profiles.map(p => {
          const isActive = p.id === selectedProfileId;
          const activeModsCount = p.mods ? p.mods.filter(m => m.isActive).length : 0;
          return (
            <div 
              key={p.id}
              onClick={() => setSelectedProfileId(p.id)}
              style={{
                minWidth: '200px',
                height: '150px',
                borderRadius: '12px',
                background: isActive ? 'linear-gradient(145deg, rgba(59, 130, 246, 0.15), rgba(30, 64, 175, 0.3))' : 'rgba(255, 255, 255, 0.05)',
                border: isActive ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                boxShadow: isActive ? '0 0 15px rgba(59, 130, 246, 0.4)' : '0 4px 6px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '15px',
                transition: 'all 0.2s ease',
                scrollSnapAlign: 'start',
                position: 'relative'
              }}
              className="profile-tile"
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1em', color: isActive ? '#fff' : 'var(--text-primary)', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</h3>
                <span style={{ fontSize: '0.75em', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.3)', padding: '3px 8px', borderRadius: '12px' }}>
                  {p.gameVersion?.toUpperCase() || 'FS25'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', color: '#aaa', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                  <span>{t('start.total')}</span>
                  <span style={{ fontWeight: 'bold', color: '#fff' }}>{p.mods ? p.mods.length : 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', color: '#aaa' }}>
                  <span>{t('mods.active')}</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--success-color)' }}>{activeModsCount}</span>
                </div>
              </div>
            </div>
          );
        })}
        
        <div 
          onClick={onCreateProfile}
          style={{
            minWidth: '200px',
            height: '150px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '2px dashed var(--border-color)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '15px',
            transition: 'all 0.2s ease',
            scrollSnapAlign: 'start',
            gap: '15px'
          }}
          className="profile-tile-add"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.borderColor = 'var(--primary-color)';
            e.currentTarget.style.color = 'var(--primary-color)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ fontSize: '2.5em', color: 'inherit', fontWeight: '300' }}>+</div>
          <div style={{ fontSize: '0.9em', color: 'inherit', textAlign: 'center', fontWeight: '500' }}>{t('profiles.createNew') || 'Neues Profil'}</div>
        </div>
      </div>
    </div>
  );
};
