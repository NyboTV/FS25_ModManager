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
      }
      setErrors({});
    }
  }, [isOpen, profile, isCreating]);

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
  };  const getDocumentsModPath = (profileName: string): string => {
    // Erstelle automatischen Pfad im Dokumentenordner 
    const os = require('os');
    const path = require('path');
    const cleanName = profileName.replace(/[^a-zA-Z0-9]/g, '_');
    return path.join(os.homedir(), 'Documents', 'FS_ModManager', 'Profiles', cleanName);
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }    const profileData: Profile = {
      id: profile?.id || `profile_${Date.now()}`,
      name: formData.name!,
      version: formData.version || '1.0.0',
      description: formData.description,
      serverSyncUrl: formData.serverSyncUrl,
      modFolderPath: getDocumentsModPath(formData.name!), // Automatischer Pfad
      gameVersion: formData.gameVersion as 'fs19' | 'fs22' | 'fs25',
      mods: profile?.mods || []
    };

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

          <div className="form-group">
            <label htmlFor="serverSyncUrl">{t('profileEdit.serverUrl')}</label>
            <input
              id="serverSyncUrl"
              type="text"
              value={formData.serverSyncUrl || ''}
              onChange={(e) => handleInputChange('serverSyncUrl', e.target.value)}
              className={errors.serverSyncUrl ? 'error' : ''}
              placeholder={t('profileEdit.serverUrlPlaceholder')}
            />
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
