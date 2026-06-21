# FS25 Mod Manager

[![GitHub Release](https://img.shields.io/github/v/release/NyboTV/FS25_ModManager?style=for-the-badge&color=success)](https://github.com/NyboTV/FS25_ModManager/releases/latest)
[![GitHub Downloads](https://img.shields.io/github/downloads/NyboTV/FS25_ModManager/total?style=for-the-badge&color=blue)](https://github.com/NyboTV/FS25_ModManager/releases)
[![GitHub License](https://img.shields.io/github/license/NyboTV/FS25_ModManager?style=for-the-badge)](https://github.com/NyboTV/FS25_ModManager/blob/main/LICENSE)

Ein moderner, robuster Mod-Manager für Farming Simulator (FS19, FS22, FS25), entwickelt mit TypeScript, Electron und React. Die Anwendung ermöglicht Ihnen, verschiedene Mod-Profile zu erstellen, zu verwalten und nahtlos mit Dedicated Servern zu synchronisieren. Mit einer benutzerfreundlichen Oberfläche und fortschrittlichen Funktionen für die einfache Organisation Ihrer Farming Simulator Mods.

![FS25 Mod Manager Screenshot](https://raw.githubusercontent.com/NyboTV/FS25_ModManager/refs/heads/master/dist/image/screenshot.png)

## 🚀 Installation

**Für Endbenutzer:**
1. Laden Sie die neueste `Farming Simulator Mod Manager Setup.exe` aus dem [Releases-Bereich](https://github.com/NyboTV/FS25_ModManager/releases) herunter
2. Führen Sie die Setup-Datei aus und folgen Sie den Anweisungen
3. Die Anwendung erstellt automatisch eine Desktop-Verknüpfung
4. Starten Sie den Farming Simulator ModManager und konfigurieren Sie Ihre Einstellungen

## ✨ Hauptfunktionen

### 🗂️ Erweiterte Profilverwaltung
- **Unbegrenzte Profile**: Erstellen Sie beliebig viele Mod-Profile für verschiedene Spielsituationen
- **Flexible Organisation**: Jedes Profil kann seine eigenen Mods und Einstellungen haben
- **Vielseitige Nutzung**: Ideal für verschiedene Spielstände, Single- und Multiplayer-Spiele oder Serverszenarien
- **Sichere Datenspeicherung**: Alle Profildaten werden strukturiert im JSON-Format gespeichert

### 🔄 Intelligente Mod-Bereitstellung
"Mods bereitstellen" bedeutet, dass die Mods aus dem ausgewählten Profil sicher in Ihren Farming Simulator Mods-Ordner kopiert werden. Dies ermöglicht es Ihnen:
- Schnelles Wechseln zwischen verschiedenen Mod-Sets ohne manuelle Dateioperationen
- Automatische Backup-Erstellung vor Änderungen
- Robuste Behandlung von Dateikonflikten und langen Dateinamen unter Windows

### 🌐 Verbesserte Server-Synchronisation
- **Automatische Erkennung**: Verbinden Sie sich mit Dedicated Servern und rufen Sie deren komplette Mod-Liste ab
- **Intelligenter Download**: Automatischer Download fehlender Mods direkt von der Mod-Quelle
- **Vollständige Dateinamen**: Abrufen der originalen Mod-Dateinamen von den Detail-Seiten (nicht verkürzte HTML-Namen)
- **Sync-Schutz**: Integrierter Spam-Schutz verhindert versehentliche mehrfache Synchronisationen
- **Fortschrittsanzeige**: Detaillierte Anzeige des Synchronisationsfortschritts
- **FastDL Webserver**: Ein integrierter, eigenständiger Webserver (`fastdl-server.js`) für blitzschnelle Mod-Downloads. Ideal, wenn ModManager und Dedicated Server auf demselben Host laufen, um die Mods in Gigabit-Geschwindigkeit direkt an die Clients auszuliefern, ohne auf die langsame native In-Game-Download-Geschwindigkeit angewiesen zu sein.

### 🌍 Mehrsprachigkeitsunterstützung (i18n)
- **Modulares System**: Vollständig überarbeitetes Internationalisierungssystem
- **Sprachunterstützung**: Deutsch und Englisch verfügbar
- **Erweiterbar**: Einfaches Hinzufügen neuer Sprachen durch separate Sprachdateien
- **Aufgeräumt**: Alle nicht verwendeten Übersetzungsschlüssel wurden entfernt

### 🎨 Moderne Benutzeroberfläche
- **Dunkles Design**: Modernes, augenfreundliches Design
- **Intuitive Navigation**: Einfache Bedienung durch strukturierte Tabs
- **Responsive Layouts**: Übersichtliche Darstellung aller Mod-Profile und Einstellungen
- **Entwicklungstools**: Automatisches Öffnen der DevTools im Entwicklungsmodus

## 📖 Anleitung zur Verwendung

### Erste Einrichtung
1. **Anwendung starten**: Starten Sie den FS25 Mod Manager über die Desktop-Verknüpfung
2. **Grundeinstellungen konfigurieren**:
   - Gehen Sie zu den Einstellungen (⚙️ Tab)
   - **Standard-Mod-Ordner**: Wählen Sie Ihren Mods-Ordner (z.B. `Dokumente\My Games\FarmingSimulator2025\mods`)
   - **Spiel-Executable**: Wählen Sie die `FarmingSimulator2025.exe` Datei direkt aus
   - **Sprache**: Wählen Sie zwischen Deutsch und Englisch
   - **Debug-Logging**: Optional für erweiterte Fehlerverfolgung aktivieren

### 🗂️ Profile verwalten
1. **Neues Profil erstellen**:
   - Wechseln Sie zum Tab "Profile"
   - Klicken Sie auf "Neues Profil erstellen"
   - Vergeben Sie einen aussagekräftigen Namen
   - **Tipp**: Aktivieren Sie "Aktuelle Mods importieren", um vorhandene Mods zu übernehmen

2. **Profile bearbeiten**:
   - Klicken Sie auf "Bearbeiten" bei einem Profil
   - Konfigurieren Sie Server-URLs für automatische Synchronisation
   - Verwalten Sie die Mod-Liste des Profils

### 🎮 Mods bereitstellen und Spiel starten
1. **Profil auswählen**: Wählen Sie auf der Startseite ein Profil aus dem Dropdown-Menü
2. **Mods bereitstellen**: Klicken Sie auf "Mods bereitstellen"
   - Die Anwendung kopiert automatisch alle Mods des Profils in Ihren Spiel-Mods-Ordner
   - Bestehende Mods werden sicher gesichert
3. **Spiel starten**: Klicken Sie auf "Spiel starten" für den direkten Launch von Farming Simulator

### 🌐 Server-Synchronisation (Erweitert)
1. **Server konfigurieren**:
   - Öffnen Sie die Profileinstellungen (Bearbeiten-Button)
   - Geben Sie die Server-URL ein (Format: `http://server.domain.com/mods`)
   - Speichern Sie die Einstellungen

2. **Synchronisation starten**:
   - Klicken Sie auf "Mit Server synchronisieren"
   - Der Manager analysiert die Server-Mod-Liste
   - **Automatischer Download**: Fehlende Mods werden automatisch heruntergeladen
   - **Intelligente Updates**: Bestehende Mods werden auf Aktualität geprüft
   - **Fortschrittsanzeige**: Verfolgen Sie den Synchronisationsprozess in Echtzeit

### 🔧 Debug und Problembehandlung
1. **Debug-Logging aktivieren**:
   - Gehen Sie in die Einstellungen
   - Aktivieren Sie "Debug-Logging"
   - Log-Dateien finden Sie unter `Dokumente\FS_ModManager\logs\`

2. **Datenordner**:
   - Alle Anwendungsdaten werden in `Dokumente\FS_ModManager\` gespeichert
   - Profile: `profiles\`
   - Einstellungen: `settings.json`
   - Logs: `logs\`

## 💻 Für Entwickler

### Technologie-Stack
- **TypeScript**: Typsichere Entwicklung für bessere Code-Qualität
- **Electron**: Cross-Platform Desktop-Anwendungsframework
- **React**: Moderne, komponentenbasierte Benutzeroberfläche
- **SCSS**: Erweiterte Styling-Möglichkeiten
- **Webpack**: Modulbündelung und Build-Prozess

### Projektstruktur
```
src/
├── main/               # Electron-Hauptprozess
│   ├── main.ts         # Haupteinstiegspunkt
│   ├── profile-manager.ts
│   ├── mod-sync-manager.ts
│   ├── settings-manager.ts
│   └── ...
├── renderer/           # React-UI (Renderer-Prozess)
│   ├── components/     # React-Komponenten
│   ├── lang/          # Übersetzungsdateien (i18n)
│   ├── styles/        # SCSS-Styling
│   └── index.tsx      # UI-Einstiegspunkt
└── common/            # Gemeinsame Typen und Utilities
    └── types.ts       # TypeScript-Interfaces
```

### Development Setup
```powershell
# Repository klonen
git clone https://github.com/NyboTV/FS25_ModManager.git
cd Fs25_ModManager

# Dependencies installieren
npm install

# Entwicklungsmodus starten (mit DevTools)
npm run dev

# Produktions-Build erstellen
npm run build

# Anwendung paketieren
npm run package
```

### Verfügbare Scripts
- `npm run dev`: Startet die Anwendung im Entwicklungsmodus
- `npm run build`: Erstellt einen Produktions-Build
- `npm run package`: Paketiert die Anwendung für die Distribution

### Wichtige Features für Entwickler
- **Automatische DevTools**: Öffnen sich automatisch im Entwicklungsmodus
- **Hot Reload**: Automatisches Neuladen bei Code-Änderungen
- **TypeScript**: Vollständige Typisierung für bessere IDE-Unterstützung
- **Modulares i18n**: Einfaches Hinzufügen neuer Sprachen
- **Robuste Fehlerbehandlung**: Umfassende Logging- und Debug-Funktionen

### Windows-spezifische Behandlung
Die Anwendung wurde speziell für Windows-Umgebungen optimiert:
- **Lange Dateinamen**: Robuste Behandlung von Windows-Pfadlängenbeschränkungen
- **Gesperrte Dateien**: Intelligente Konfliktbehandlung bei Dateizugriff
- **PowerShell-Kompatibilität**: Alle Terminal-Befehle sind PowerShell-kompatibel


## ⚙️ Systemanforderungen

- **Betriebssystem**: Windows 10/11 (64-bit)
- **Spiel**: Farming Simulator 19, 22 oder 25
- **Speicherplatz**: 200 MB freier Festplattenspeicher
- **Netzwerk**: Internetverbindung für Server-Synchronisation und Mod-Downloads
- **Zusätzlich**: .NET Framework (wird automatisch installiert)

## 🔧 Fehlerbehebung

### Häufige Probleme und Lösungen

**🗂️ Mods werden nicht kopiert**
- Überprüfen Sie die Pfade in den Einstellungen
- Stellen Sie sicher, dass der Mods-Ordner existiert und beschreibbar ist
- Aktivieren Sie Debug-Logging für detaillierte Informationen

**🌐 Server-Synchronisation fehlgeschlagen**
- Überprüfen Sie die Server-URL (Format: `http://server.domain.com/mods`)
- Testen Sie Ihre Internetverbindung
- Prüfen Sie, ob der Server erreichbar ist
- Kontrollieren Sie die Log-Dateien unter `Dokumente\FS_ModManager\logs\`

**🚀 Anwendung startet nicht**
- Überprüfen Sie die Log-Datei unter `Dokumente\FS_ModManager\logs\`
- Stellen Sie sicher, dass .NET Framework installiert ist
- Führen Sie die Anwendung als Administrator aus (falls nötig)

**📁 Lange Dateinamen (Windows)**
- Bei Problemen mit sehr langen Mod-Dateinamen:
- Die Anwendung behandelt dies automatisch
- Falls Probleme auftreten, nutzen Sie kürzere Profilnamen

**🔒 Gesperrte Dateien**
- Schließen Sie das Spiel vor der Mod-Bereitstellung
- Beenden Sie andere Anwendungen, die auf den Mods-Ordner zugreifen könnten
- Die Anwendung behandelt die meisten Konflikte automatisch

### Debug-Informationen sammeln
1. Aktivieren Sie "Debug-Logging" in den Einstellungen
2. Reproduzieren Sie das Problem
3. Senden Sie die Log-Dateien aus `Dokumente\FS_ModManager\logs\` an den Support

## 🎯 Roadmap und geplante Features

- **Erweiterte Mod-Verwaltung**: Kategorisierung und Tagging von Mods
- **Backup-System**: Automatische Backups vor größeren Änderungen
- **Mod-Updates**: Automatische Erkennung von Mod-Updates
- **Performance-Optimierungen**: Weitere Verbesserungen für große Mod-Sammlungen
- **Weitere Sprachen**: Französisch, Spanisch und weitere Sprachen

## 📄 Lizenz

Dieses Projekt steht unter der **ISC-Lizenz**.

**Farming Simulator** ist eine eingetragene Marke von **GIANTS Software GmbH**.

---

## 🤝 Beitragen

Beiträge sind willkommen! Bitte erstellen Sie einen Pull Request oder öffnen Sie ein Issue für Verbesserungsvorschläge.

### Development Guidelines
- Verwenden Sie TypeScript für alle neuen Features
- Folgen Sie den bestehenden Code-Konventionen
- Testen Sie Änderungen gründlich vor dem Commit
- Dokumentieren Sie neue Features in der README

## ⭐ Support

Falls Sie Probleme haben oder Verbesserungsvorschläge haben, können Sie:
- Ein [GitHub Issue](https://github.com/NyboTV/FS25_ModManager/issues) erstellen
- Die Debug-Logs aus `Dokumente\FS_ModManager\logs\` bereitstellen
- Screenshots oder detaillierte Beschreibungen des Problems hinzufügen

**Wenn Sie dieses Projekt nützlich finden, geben Sie ihm gerne einen Stern ⭐ auf GitHub!**

## ⚠️ Bekannte Einschränkungen (Limitations)

Bitte beachte folgende Einschränkungen der App, die durch externe Plattformen oder APIs bedingt sind:

1. **ModHub Updates:** Die Erkennung, ob ein Mod veraltet ist, basiert rein auf der Überprüfung der Versionsnummern (ausgelesen aus der ModHub HTML-Seite im Vergleich zu deiner lokalen Datei). Da GIANTS keine API mit Datei-Hashes bereitstellt, sind exakte Datei-Inhaltsprüfungen nicht möglich. Stimmt die Version überein, gilt der Mod als "aktuell" – auch wenn der Inhalt abweicht.
2. **ModHub Mapping:** Die Zuordnung lokaler Mods zum ModHub erfolgt über einen intelligenten Abgleich des Dateinamens mit den ModHub-Seiten. Mods, deren Dateiname nach dem Download stark verändert wurde, oder Mods von inoffiziellen Drittanbieter-Seiten können nicht immer zuverlässig erkannt werden.
3. **Dedicated Server Sync (FastDL):** Bei der Nutzung reiner FastDL-Dienste (ohne die GIANTS Web-Interface HTML-Struktur) muss zwingend eine `dedicated-server-stats.xml` URL im Profil hinterlegt werden, um die korrekten Mod-Versionen vom Server zu ermitteln.
