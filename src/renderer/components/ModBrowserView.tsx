import React, { useState, useEffect, useRef } from 'react';
import { Settings, Profile } from '../../common/types';
import { useTranslation } from '../i18n';

const { ipcRenderer, shell } = window.require('electron');

interface ModBrowserViewProps {
  settings: Settings;
}

const ModBrowserView: React.FC<ModBrowserViewProps> = ({ settings }) => {
  const t = useTranslation(settings.language);
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  
  // Download Intercept State
  const [downloadPending, setDownloadPending] = useState<{ url: string, modId: string } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const webviewRef = useRef<any>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

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

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleWillNavigate = (event: any) => {
      const url = event.url;
      // Download abfangen
      const isDownloadUrl = (url.includes('action=download') && url.includes('mod_id=')) || url.match(/\/storage\/[0-9]+\/.*\.zip/i);
      
      if (isDownloadUrl) {
        event.preventDefault();
        webview.stop(); // Stoppe die Navigation im Webview
        
        let modId = '';
        const modIdMatch1 = url.match(/mod_id=([0-9]+)/);
        const modIdMatch2 = url.match(/\/storage\/0*([0-9]+)\//);
        
        if (modIdMatch1) modId = modIdMatch1[1];
        else if (modIdMatch2) modId = modIdMatch2[1];
        
        if (modId) {
          setDownloadPending({ url, modId });
        }
      } else if (!url.includes('farming-simulator.com') && !url.includes('giants-software.com')) {
        // Externe Links blockieren und im echten Browser öffnen
        event.preventDefault();
        webview.stop();
        shell.openExternal(url);
      }
    };

    const handleNewWindow = (event: any) => {
      // Wenn das Webview versucht, ein neues Fenster zu öffnen (target="_blank")
      event.preventDefault();
      const url = event.url;
      
      const isDownloadUrl = (url.includes('action=download') && url.includes('mod_id=')) || url.match(/\/storage\/[0-9]+\/.*\.zip/i);
      
      if (isDownloadUrl) {
        let modId = '';
        const modIdMatch1 = url.match(/mod_id=([0-9]+)/);
        const modIdMatch2 = url.match(/\/storage\/0*([0-9]+)\//);
        
        if (modIdMatch1) modId = modIdMatch1[1];
        else if (modIdMatch2) modId = modIdMatch2[1];
        
        if (modId) {
          setDownloadPending({ url, modId });
        }
      } else if (!url.includes('farming-simulator.com') && !url.includes('giants-software.com')) {
        shell.openExternal(url);
      }
    };

    const handleDomReady = () => {
      // Custom CSS injizieren für Dark Mode und passendes Design
      const customCSS = `
        body, html, .white-bg { background-color: #1e1e2e !important; color: #cdd6f4 !important; }
        .main-header, .header, .footer, .tabs { background-color: #11111b !important; border-color: #313244 !important; }
        .mod-item, .mod-item__content, .box-mods-item-info { background-color: #181825 !important; border: 1px solid #313244 !important; border-radius: 8px !important; overflow: hidden !important; }
        .mod-item__content h4, .title-label, h1, h2, h3, h4, h5, h6 { color: #cba6f7 !important; }
        p, span, div { color: #bac2de !important; }
        .button, .button-buy { background-color: #89b4fa !important; color: #11111b !important; border: none !important; border-radius: 6px !important; font-weight: bold !important; }
        a { color: #89b4fa !important; }
        .table-row { border-bottom: 1px solid #313244 !important; }
        .table-cell b { color: #cdd6f4 !important; }
        .pagination li a { background-color: #181825 !important; color: #cdd6f4 !important; border: 1px solid #313244 !important; border-radius: 4px !important; }
        .pagination li.current a { background-color: #89b4fa !important; color: #11111b !important; }
        input, select { background-color: #11111b !important; color: #cdd6f4 !important; border: 1px solid #313244 !important; border-radius: 4px !important; }
        /* Verstecke nervige Elemente wie Ads oder den Header-Login */
        .header__top, .header, .main-header, .ad-banner, .social-box, .partners { display: none !important; }
      `;
      webview.insertCSS(customCSS);
    };

    const handleGoBack = () => webview.goBack();
    const handleGoForward = () => webview.goForward();
    const handleReload = () => webview.reload();

    webview.addEventListener('will-navigate', handleWillNavigate);
    webview.addEventListener('new-window', handleNewWindow);
    webview.addEventListener('dom-ready', handleDomReady);

    window.addEventListener('webview-go-back', handleGoBack);
    window.addEventListener('webview-go-forward', handleGoForward);
    window.addEventListener('webview-reload', handleReload);

    return () => {
      webview.removeEventListener('will-navigate', handleWillNavigate);
      webview.removeEventListener('new-window', handleNewWindow);
      webview.removeEventListener('dom-ready', handleDomReady);
      window.removeEventListener('webview-go-back', handleGoBack);
      window.removeEventListener('webview-go-forward', handleGoForward);
      window.removeEventListener('webview-reload', handleReload);
    };
  }, []);

  const handleDownloadConfirm = async () => {
    if (!selectedProfileId || !downloadPending) return;
    setIsDownloading(true);
    
    const tempFileName = `mod_${downloadPending.modId}.zip`;
    
    ipcRenderer.send('download-modhub-mod', selectedProfileId, tempFileName, downloadPending.modId, {
       title: `Mod ${downloadPending.modId}`,
       version: '1.0.0.0',
       url: downloadPending.url
    });
    
    setIsDownloading(false);
    setDownloadPending(null);
  };

  const startUrl = settings.language === 'de'
    ? 'https://www.farming-simulator.com/mods.php?lang=de&country=de&title=fs2025&page=0'
    : 'https://www.farming-simulator.com/mods.php?lang=en&country=us&title=fs2025&page=0';

  return (
    <div className="modbrowser-view" style={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: 'calc(100vh - 165px)',
      margin: '-24px',
      width: 'calc(100% + 48px)',
      borderRadius: '0 0 8px 8px',
      overflow: 'hidden'
    }}>
      
      {/* Webview Component */}
      <webview
        ref={webviewRef}
        src={startUrl}
        style={{ flex: 1, border: 'none', background: '#fff' }}
        allowpopups={true}
      />

      {/* Download Intercept Modal */}
      {downloadPending && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
        }} onClick={() => setDownloadPending(null)}>
          <div style={{
            background: '#1e1e2e', // Klarer dunkler Hintergrund
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
            padding: '25px',
            border: '2px solid #89b4fa', // Heller Rahmen zur Abgrenzung
            boxShadow: '0 20px 50px rgba(0,0,0,0.9)', // Starker Schatten
            position: 'relative',
            color: '#cdd6f4'
          }} onClick={e => e.stopPropagation()}>
            
            <button 
              onClick={() => setDownloadPending(null)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: '#313244', border: '1px solid #45475a', color: '#cdd6f4', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}
            >
              ×
            </button>

            <h2 style={{ margin: '0 0 15px 0', color: '#cba6f7' }}>Mod Download</h2>
            <p style={{ color: '#bac2de', marginBottom: '20px' }}>
              Du lädst den Mod (ID: <strong style={{color: '#f9e2af'}}>{downloadPending.modId}</strong>) herunter. In welches Profil soll er installiert werden?
            </p>

            <div style={{ background: '#11111b', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #313244' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#bac2de' }}>Ziel-Profil:</label>
              <select 
                value={selectedProfileId} 
                onChange={e => setSelectedProfileId(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', background: '#181825', color: '#cdd6f4', border: '1px solid #45475a', outline: 'none' }}
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setDownloadPending(null)}
                style={{ background: '#313244', border: 'none', color: '#cdd6f4', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
              >
                Abbrechen
              </button>
              <button 
                className="btn btn-success" 
                onClick={handleDownloadConfirm}
                disabled={isDownloading || !selectedProfileId}
                style={{ background: '#a6e3a1', border: 'none', color: '#11111b', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', opacity: (isDownloading || !selectedProfileId) ? 0.5 : 1 }}
              >
                {isDownloading ? 'Starte Download...' : 'Herunterladen & Installieren'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ModBrowserView;
