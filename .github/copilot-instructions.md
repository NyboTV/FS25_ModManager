<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# FS25 Mod Manager

Dies ist ein Farming Simulator 25 Mod-Manager, der mit TypeScript, Electron und React entwickelt wurde. Die Anwendung ermöglicht Benutzern, verschiedene Mod-Profile zu erstellen und mit Dedicated Servern zu synchronisieren.

## Projektstruktur

- `src/main`: Electron-Hauptprozess-Code 
- `src/renderer`: React-basierter UI-Code für den Renderer-Prozess
- `src/common`: Gemeinsame Typen und Helfer, die von beiden Prozessen verwendet werden
- `src/renderer/components`: React-Komponenten
- `src/renderer/styles`: SCSS-Stile für die Anwendung

## Wichtige Funktionen

1. **Profilverwaltung**: Erstellen, Bearbeiten und Löschen von Mod-Profilen
2. **Server-Synchronisation**: Synchronisieren von Mods mit einem Dedicated Server
3. **Einstellungen**: Konfiguration von App-Einstellungen
4. **Lokale Speicherung**: Alle Daten werden im Benutzerordner unter "Dokumente/FS_ModManager" gespeichert

## Wichtige Dateien

- `src/main/main.ts`: Haupteinstiegspunkt für den Electron-Prozess
- `src/renderer/index.tsx`: Haupteinstiegspunkt für den React-Renderer
- `src/renderer/components/App.tsx`: Hauptkomponente der Anwendung
- `src/common/types.ts`: TypeScript-Schnittstellen für die Anwendung

## Entwicklungstechnologien

- TypeScript für typsichere Entwicklung
- Electron für die Desktop-Anwendung
- React für die Benutzeroberfläche
- SCSS für Styling
- Webpack für das Bundling


## Konsole
- Dieses Projekt befindet sich auf Windows 11 und nutzt die Konsole für die Entwicklung.
- Konsole unterstützt kein `&&` oder `||` für Befehle, daher werden separate Zeilen verwendet oder Powershell trennungen wie `;` oder `&` verwendet.
- Beispiel für die Ausführung von Befehlen in der Konsole:
  ```bash
  npm run dev
  npm run package
  ```
