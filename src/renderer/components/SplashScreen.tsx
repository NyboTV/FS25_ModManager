import React, { useEffect, useState } from 'react';

import { useTranslation } from '../i18n';

interface SplashScreenProps {
  onComplete: () => void;
  language?: 'en' | 'de' | string;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, language }) => {
  const [fadingOut, setFadingOut] = useState(false);
  const t = useTranslation((language as 'en' | 'de') || 'de');

  useEffect(() => {
    // Zeige den Splash-Screen für mindestens 2 Sekunden, dann ausfaden
    const timer = setTimeout(() => {
      setFadingOut(true);
      setTimeout(onComplete, 500); // 500ms für die CSS Transition
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`splash-screen ${fadingOut ? 'fade-out' : ''}`}>
      <div className="splash-content">
        <div className="tractor-icon">🚜</div>
        <h1 className="splash-title">FS25 Mod Manager</h1>
        <p className="splash-subtitle">{t("start.loadingProfiles") || "Lade Profile und Einstellungen..."}</p>
        <div className="splash-loader">
          <div className="loader-bar"></div>
        </div>
      </div>

      <style>{`
        .splash-screen {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          transition: opacity 0.5s ease, visibility 0.5s ease;
        }
        .splash-screen.fade-out {
          opacity: 0;
          visibility: hidden;
        }
        .splash-content {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .tractor-icon {
          font-size: 80px;
          margin-bottom: 20px;
          animation: bounce 2s infinite ease-in-out;
          filter: drop-shadow(0 0 20px rgba(59, 130, 246, 0.5));
        }
        .splash-title {
          color: #f8fafc;
          font-size: 2.5rem;
          font-weight: 800;
          margin: 0 0 10px 0;
          letter-spacing: 1px;
          text-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }
        .splash-subtitle {
          color: #94a3b8;
          font-size: 1.1rem;
          margin: 0 0 40px 0;
        }
        .splash-loader {
          width: 300px;
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          overflow: hidden;
          position: relative;
        }
        .loader-bar {
          position: absolute;
          top: 0;
          left: -100%;
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, transparent, #3b82f6, transparent);
          animation: loading 1.5s infinite ease-in-out;
        }
        @keyframes loading {
          0% { left: -50%; }
          100% { left: 100%; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
