# FS25 Mod Manager

Ein moderner Mod-Manager für Farming Simulator 25, der es Ihnen ermöglicht, verschiedene Mod-Profile zu erstellen, zu verwalten und mit Dedicated Servern zu synchronisieren. Die Anwendung bietet eine benutzerfreundliche Oberfläche für die einfache Organisation Ihrer Farming Simulator Mods.

![FS25 Mod Manager Screenshot](https://github.com/username/Fs25_ModManager/raw/main/screenshots/main.png)

## Installation

**Wichtig:** Als Endbenutzer müssen Sie die Anwendung nicht selbst bauen. Laden Sie einfach die neueste Version der fertigen Anwendung aus dem [Releases-Bereich](https://github.com/username/Fs25_ModManager/releases) herunter und installieren Sie sie.

1. Laden Sie die neueste `FS25_ModManager-Setup.exe` aus den Releases herunter
2. Führen Sie die Setup-Datei aus und folgen Sie den Anweisungen
3. Nach der Installation können Sie den FS25 Mod Manager über die Desktop-Verknüpfung starten

## Funktionen im Detail

### Profilverwaltung
- Erstellen Sie beliebig viele Mod-Profile für verschiedene Spielsituationen
- Jedes Profil kann seine eigenen Mods und Einstellungen haben
- Ideal für verschiedene Spielstände oder für Single- und Multiplayer-Spiele

### Mod-Bereitstellung
"Mods bereitstellen" bedeutet, dass die Mods aus dem ausgewählten Profil in Ihren Farming Simulator Mods-Ordner kopiert werden. Dies ermöglicht es Ihnen, schnell zwischen verschiedenen Mod-Sets zu wechseln, ohne Dateien manuell kopieren zu müssen.

### Server-Synchronisation
- Verbinden Sie sich mit einem Dedicated Server, um dessen Mod-Liste abzurufen
- Automatischer Download fehlender Mods von der Server-Quelle
- Bleiben Sie immer auf dem neuesten Stand mit den Server-Mods

### Benutzerfreundliche Oberfläche
- Modernes, dunkles Design
- Einfache Navigation durch Tabs
- Übersichtliche Darstellung aller Mod-Profile

## Anleitung zur Verwendung

### Erste Schritte
1. Starten Sie den FS25 Mod Manager
2. Gehen Sie zu den Einstellungen und konfigurieren Sie:
   - Den Standard-Mod-Ordner (z.B. `Dokumente\My Games\FarmingSimulator2025\mods`)
   - Den Pfad zur Farming Simulator 25 Exe-Datei (durch direkte Auswahl der `.exe`)
   - Weitere Optionen wie Sprache und Theme

### Profile verwalten
1. Wechseln Sie zum Tab "Profile"
2. Klicken Sie auf "Neues Profil erstellen"
3. Geben Sie einen Namen für das Profil ein
4. Optional: Aktivieren Sie die Option "Aktuelle Mods importieren", um vorhandene Mods zu übernehmen

### Mods für ein Profil bereitstellen
1. Wählen Sie auf der Startseite ein Profil aus dem Dropdown-Menü
2. Klicken Sie auf "Mods bereitstellen" - dies kopiert die Mods des ausgewählten Profils in Ihren Spiel-Mods-Ordner
3. Klicken Sie auf "Spiel starten", um Farming Simulator 25 mit den bereitgestellten Mods zu starten

### Server-Synchronisation
1. Öffnen Sie die Profileinstellungen durch Klicken auf "Bearbeiten" bei einem Profil
2. Geben Sie die Server-URL ein (Format: `http://server.domain.com/mods`)
3. Klicken Sie auf "Mit Server synchronisieren"
4. Der Manager lädt fehlende Mods herunter und aktualisiert bestehende Mods

### Debug-Logging
1. Gehen Sie in die Einstellungen
2. Aktivieren Sie "Debug-Logging"
3. Die Log-Datei finden Sie unter `Dokumente\FS_ModManager\log.txt`

## Systemanforderungen

- Windows 10/11
- Farming Simulator 25
- 150 MB freier Festplattenspeicher
- Internetverbindung für die Server-Synchronisation



## Fehlerbehebung

- **Mods werden nicht kopiert**: Stellen Sie sicher, dass die Pfade in den Einstellungen korrekt sind
- **Server-Synchronisation fehlgeschlagen**: Überprüfen Sie die Server-URL und Ihre Internetverbindung
- **Anwendung startet nicht**: Prüfen Sie die Log-Datei unter `Dokumente\FS_ModManager\log.txt`

## Lizenz

[Lizens](/LICENSE.txt)