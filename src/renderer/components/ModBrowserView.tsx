import React, { useState, useEffect } from 'react';
import { Settings, Profile } from '../../common/types';
import { useTranslation } from '../i18n';

const { ipcRenderer } = window.require('electron');

interface ModBrowserViewProps {
  settings: Settings;
}

const ModBrowserView: React.FC<ModBrowserViewProps> = ({ settings }) => {
  const t = useTranslation(settings.language);
  
  const [mods, setMods] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  
  const [selectedModId, setSelectedModId] = useState<string | null>(null);
  const [modDetail, setModDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('All');
  
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    // Reset to page 0 when search or category changes
    if (page !== 0) {
      setPage(0);
    } else {
      fetchPage(0, searchQuery, category);
    }
  }, [searchQuery, category]);

  useEffect(() => {
    fetchPage(page, searchQuery, category);
  }, [page]);

  const loadProfiles = async () => {
    try {
      const loadedProfiles = await ipcRenderer.invoke('load-profiles');
      setProfiles(loadedProfiles);
      if (loadedProfiles.length > 0) {
        setSelectedProfileId(loadedProfiles[0].id);
      }
    } catch (error) {
      console.error("Fehler beim Laden der Profile:", error);
    }
  };

  const fetchPage = async (pageNumber: number, search: string = '', cat: string = 'All') => {
    setLoading(true);
    setError(null);
    try {
      const result = await ipcRenderer.invoke('fetch-modhub-page', pageNumber, search, cat);
      if (result.success) {
        setMods(result.mods);
        setHasNext(result.hasNext);
      } else {
        setError(result.error || 'Unknown error');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleModClick = async (modId: string) => {
    setSelectedModId(modId);
    setModDetail(null);
    setLoadingDetail(true);
    try {
      const result = await ipcRenderer.invoke('fetch-modhub-detail', modId);
      if (result.success) {
        setModDetail(result.mod);
      } else {
        alert("Fehler beim Laden der Details: " + result.error);
        setSelectedModId(null);
      }
    } catch (err) {
      alert("Fehler: " + err);
      setSelectedModId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedProfileId || !modDetail) return;
    setIsDownloading(true);
    
    // Wir nutzen das existierende download-modhub-mod (braucht fileName. Wir erfinden einen temporären, 
    // modhub-service.ts findet den echten Namen über Content-Disposition raus)
    const tempFileName = modDetail.title.replace(/[^a-zA-Z0-9]/g, '_') + '.zip';
    
    ipcRenderer.send('download-modhub-mod', selectedProfileId, tempFileName, modDetail.id, modDetail);
    
    // Das Modal kann offen bleiben, App.tsx Toast zeigt Download-Fortschritt
    setIsDownloading(false);
    setSelectedModId(null);
  };

  return (
    <div className="modbrowser-view" style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>ModHub Browser</h2>
        <p style={{ margin: '0 0 15px 0', color: 'var(--text-secondary)' }}>
          Suche und installiere Mods direkt aus dem offiziellen ModHub.
        </p>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Mod suchen..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          />
          <select 
            value={category} 
            onChange={e => setCategory(e.target.value)}
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          >
            <option value="All">Alle Kategorien</option>
            <option value="map">Karten</option>
            <option value="tractor">Traktoren</option>
            <option value="harvester">Erntemaschinen</option>
            <option value="trailer">Anhänger</option>
            <option value="implement">Geräte</option>
            <option value="object">Objekte</option>
            <option value="script">Skripte</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ padding: '15px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '20px' }}>
          Fehler beim Laden: {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          Lade Mods...
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
          gap: '20px' 
        }}>
          {mods.map(mod => (
            <div 
              key={mod.id} 
              className="mod-card"
              onClick={() => handleModClick(mod.id)}
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: '1px solid var(--border-color)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'flex',
                flexDirection: 'column'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ 
                height: '150px', 
                background: '#111', 
                backgroundImage: mod.imageUrl ? `url(${mod.imageUrl})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative'
              }}>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '5px 10px', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span>{mod.rating}</span>
                  <span style={{ color: 'var(--primary-color)' }}>{mod.category}</span>
                </div>
              </div>
              <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', lineHeight: '1.2' }}>{mod.title}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 'auto' }}>Von: {mod.author}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination at bottom */}
      {!loading && !error && (
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'center', marginTop: '20px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Zurück
          </button>
          <span>Seite {page + 1}</span>
          <button 
            className="btn btn-secondary" 
            onClick={() => setPage(p => p + 1)}
            disabled={!hasNext}
          >
            Nächste
          </button>
        </div>
      )}

      {/* Detail Modal Overlay */}
      {selectedModId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
        }} onClick={() => setSelectedModId(null)}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            
            <button 
              onClick={() => setSelectedModId(null)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', zIndex: 10 }}
            >
              ✕
            </button>

            {loadingDetail ? (
              <div style={{ padding: '50px', textAlign: 'center' }}>Lade Details...</div>
            ) : modDetail ? (
              <>
                <div style={{ 
                  width: '100%', 
                  height: '300px', 
                  backgroundImage: `url(${modDetail.imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }} />
                
                <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <h2 style={{ margin: '0 0 5px 0' }}>{modDetail.title || mods.find(m => m.id === selectedModId)?.title}</h2>
                    <div style={{ display: 'flex', gap: '15px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      <span>Autor: {modDetail.author}</span>
                      <span>Version: {modDetail.version}</span>
                      <span>Größe: {modDetail.size}</span>
                      <span>Kategorie: {modDetail.category}</span>
                    </div>
                  </div>

                  <div style={{ lineHeight: '1.6', color: '#ccc' }}>
                    {modDetail.description.map((p: string, i: number) => <p key={i}>{p}</p>)}
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginTop: '10px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Ziel-Profil für Installation:</label>
                      <select 
                        value={selectedProfileId} 
                        onChange={e => setSelectedProfileId(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-color)' }}
                      >
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <button 
                      className="btn btn-success" 
                      style={{ padding: '10px 20px', height: 'fit-content', alignSelf: 'flex-end' }}
                      onClick={handleDownload}
                      disabled={isDownloading || !selectedProfileId}
                    >
                      {isDownloading ? 'Wird heruntergeladen...' : 'Mod Herunterladen'}
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

    </div>
  );
};

export default ModBrowserView;
