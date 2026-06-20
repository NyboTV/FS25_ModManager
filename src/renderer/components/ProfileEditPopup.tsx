import React, { useState, useEffect } from 'react';
import { Profile } from '../../common/types';
import { useTranslation } from '../i18n';

interface ProfileEditPopupProps {
  profile: Profile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: Profile) => void;
  isCreating: boolean;
  language?: 'en' | 'de';
  settings?: any; // Settings für Standard-Pfade
}

const ProfileEditPopup: React.FC<ProfileEditPopupProps> = ({
  profile,
  isOpen,
  onClose,
  onSave,
  isCreating,
  language = 'de',
  settings
}) => {  const [formData, setFormData] = useState<Partial<Profile>>({
    name: '',
    description: '',
    serverSyncUrl: '',
    gameVersion: 'fs25',
    version: '1.0.0'
    // modFolderPath wird automatisch generiert
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [copyCurrentMods, setCopyCurrentMods] = useState(false);
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);
  const [urlCheckResult, setUrlCheckResult] = useState<{ success?: boolean; message?: string } | null>(null);
  
  // Übersetzungsfunktion
  const t = useTranslation(language);
  useEffect(() => {
    if (isOpen) {
      if (profile && !isCreating) {
        // Bearbeitung eines existierenden Profils
        setFormData({
          name: profile.name,
          description: profile.description || '',
          serverSyncUrl: profile.serverSyncUrl || '',
          gameVersion: profile.gameVersion || 'fs25',
          version: profile.version || '1.0.0'
        });
      } else {
        // Neues Profil erstellen
        setFormData({
          name: '',
          description: '',
          serverSyncUrl: '',
          gameVersion: 'fs25',
          version: '1.0.0'        });
        setCopyCurrentMods(false);
      }
      setErrors({});
    }
  }, [isOpen, profile?.id, isCreating]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
      // Bei Spielversions-Änderung automatisch Standard-Mod-Pfad setzen
    if (field === 'gameVersion' && settings?.games?.[value as 'fs19' | 'fs22' | 'fs25']?.defaultModFolder) {
      setFormData(prev => ({
        ...prev,
        [field]: value as 'fs19' | 'fs22' | 'fs25',
        modFolderPath: settings.games[value as 'fs19' | 'fs22' | 'fs25'].defaultModFolder
      }));
    }
    
    // Entferne Fehler für dieses Feld
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
    
    // Reset check result when URL changes
    if (field === 'serverSyncUrl') {
      setUrlCheckResult(null);
    }
  };
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};    if (!formData.name?.trim()) {
      newErrors.name = t('profileEdit.nameRequired');
    }

    // Mod folder nicht mehr validieren - wird automatisch gesetzt

    if (formData.serverSyncUrl && !isValidUrl(formData.serverSyncUrl)) {
      newErrors.serverSyncUrl = t('profileEdit.invalidUrl');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleCheckUrl = async () => {
    if (!formData.serverSyncUrl) return;
    if (!isValidUrl(formData.serverSyncUrl)) {
      setUrlCheckResult({ success: false, message: 'Ungültiges URL-Format' });
      return;
    }

    setIsCheckingUrl(true);
    setUrlCheckResult(null);
    try {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('check-fastdl-url', formData.serverSyncUrl);
      if (result.success) {
        setUrlCheckResult({ success: true, message: `${result.count} Mods gefunden` });
      } else {
        setUrlCheckResult({ success: false, message: result.error || 'Fehler beim Prüfen' });
      }
    } catch (error) {
      setUrlCheckResult({ success: false, message: 'Verbindungsfehler' });
    } finally {
      setIsCheckingUrl(false);
    }
  };

  const getDocumentsModPath = (profileId: string): string => {
    // Erstelle automatischen Pfad im Dokumentenordner basierend auf der ID (Zeitstempel)
    const os = require('os');
    const path = require('path');
    return path.join(os.homedir(), 'Documents', 'FS_ModManager', 'Profiles', profileId);
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }
    
    const profileId = profile?.id || `profile_${Date.now()}`;
    
    const profileData: any = {
      id: profileId,
      name: formData.name!,
      version: formData.version || '1.0.0',
      description: formData.description,
      serverSyncUrl: formData.serverSyncUrl,
      modFolderPath: profile?.modFolderPath || getDocumentsModPath(profileId), // Immer alten Pfad behalten!
      gameVersion: formData.gameVersion as 'fs19' | 'fs22' | 'fs25',
      mods: profile?.mods || []
    };

    if (isCreating && copyCurrentMods && settings?.games?.[formData.gameVersion as 'fs19' | 'fs22' | 'fs25']?.defaultModFolder) {
      profileData._copyFromModFolder = settings.games[formData.gameVersion as 'fs19' | 'fs22' | 'fs25'].defaultModFolder;
    }

    onSave(profileData);
  };

  if (!isOpen) {
    return null;
  }  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content profile-edit-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h2>{isCreating ? t('profileEdit.create') : t('profileEdit.title')}</h2>
          <button className="popup-close" onClick={(e) => { e.stopPropagation(); onClose(); }}>×</button>
        </div>

        <div className="popup-body">
          <div className="form-group">
            <label htmlFor="profileName">{t('profileEdit.name')} *</label>
            <input
              id="profileName"
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={errors.name ? 'error' : ''}
              placeholder={t('profileEdit.name')}
            />            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>          <div className="form-group">
            <label htmlFor="gameVersion">Spielversion *</label>
            <select
              id="gameVersion"
              value={formData.gameVersion || 'fs25'}
              onChange={(e) => handleInputChange('gameVersion', e.target.value)}
              className="dark-select"
            >
              <option value="fs19">Farming Simulator 19</option>
              <option value="fs22">Farming Simulator 22</option>
              <option value="fs25">Farming Simulator 25</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="packVersion">Pack-Version</label>
            <input
              id="packVersion"
              type="text"
              value={formData.version || ''}
              onChange={(e) => handleInputChange('version', e.target.value)}
              placeholder="z.B. 1.0.0"
            />
          </div>

          <div className="form-group">
            <label htmlFor="profileDescription">{t('profileEdit.description')}</label>
            <textarea
              id="profileDescription"
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder={t('profileEdit.descriptionPlaceholder')}
              rows={3}            />
          </div>

          {isCreating && (
            <div className="form-group">
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px' }}>
                <input
                  type="checkbox"
                  checked={copyCurrentMods}
                  onChange={(e) => setCopyCurrentMods(e.target.checked)}
                />
                Aktuelle Mods hinzufügen
              </label>
              <div style={{ fontSize: '0.85em', color: '#aaa', marginTop: '4px' }}>
                Kopiert die aktuell installierten Mods aus dem Spiel in dieses neue Profil.
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="serverSyncUrl">FastDL Server-URL (für Sync)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="serverSyncUrl"
                type="text"
                value={formData.serverSyncUrl || ''}
                onChange={(e) => handleInputChange('serverSyncUrl', e.target.value)}
                className={errors.serverSyncUrl ? 'error' : ''}
                placeholder="http://dein-server.de/mods/"
                style={{ flex: 1 }}
              />
              <button 
                className="button secondary" 
                onClick={handleCheckUrl}
                disabled={isCheckingUrl || !formData.serverSyncUrl}
                style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}
              >
                {isCheckingUrl ? 'Prüfe...' : 'Link prüfen'}
              </button>
            </div>
            {urlCheckResult && (
              <div style={{ 
                marginTop: '6px', 
                fontSize: '0.9em', 
                color: urlCheckResult.success ? '#4ade80' : '#f87171' 
              }}>
                {urlCheckResult.success ? '✅ ' : '❌ '}
                {urlCheckResult.message}
              </div>
            )}
            {errors.serverSyncUrl && <span className="error-message">{errors.serverSyncUrl}</span>}
          </div>
        </div>

        <div className="popup-footer">
          <button className="button secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="button primary" onClick={handleSave}>
            {isCreating ? t('profileEdit.create') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditPopup;
