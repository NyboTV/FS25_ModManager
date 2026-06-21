# AI Rules & Preferences für FS25 ModManager

## Generelle Projekt-Infos
- **Technologie-Stack:** Electron, React, TypeScript, Webpack, SCSS.
- **Sprache UI:** Englisch ist Default (Fallback), Deutsch ist verfügbar. Das UI nutzt einen eigenen `i18n` Hook für Übersetzungen.
- **Temporäre Skripte:** Jegliche Test- und Hilfsskripte müssen ausschließlich im Ordner `ai-script/` abgelegt werden. Dieser Ordner wird in der `.gitignore` ignoriert.
- **Code Editieren:** KEINE separaten Skripte (wie Node.js-Skripte mit Regex/String-Replace) erstellen, um Code in existierenden Dateien anzupassen. IMMER stattdessen direkt die dedizierten Edit-Tools (`replace_file_content` oder `multi_replace_file_content`) verwenden, da Skripte Zeilenumbrüche zerstören und Syntaxfehler verursachen können.
## Design- & UI-Vorgaben
- **Moderne Aesthetics:** Das Design soll "Wow"-Faktor haben. Glasmorphismus, weiche Übergänge, hochwertige Farben (Dark-Theme basiert mit Blau/Gold Akzenten) und gute Abstände.
- **Übersetzungen:** NIEMALS hart kodierte deutsche oder englische Strings in den React-Komponenten belassen. Alles muss über `t('key')` eingebunden werden und in `src/renderer/lang/de.ts` und `en.ts` gepflegt sein.

## Funktionsvorgaben
- **Dedi-Server WebStats URL:** Wird bevorzugt für den FastDL-Sync genutzt, da nur diese XML die Hash-Werte und Versionsnummern ausgibt. Falls eine FastDL-URL ohne Giants-Webserver-HTML genutzt wird, ist die WebStats URL ein **Pflichtfeld**, da sonst keine Versionen geprüft werden können.
- **Server Status (Startseite):** Zeigt *nur* Server-Informationen an, wenn der Server läuft. "Online"-Status an sich weglassen. Nur wenn nichts erreichbar ist, wird "Offline" angezeigt. Retry-Logik (max 6x alle 5 Sekunden) nutzen, da Server beim Hochfahren oft kurz `undefined` zurückgeben.
- **Datenverarbeitung & Synchronisation:** Puffer-Konkatenation von Netzwerk-Streams IMMER mit `Buffer.concat()` durchführen, niemals als String-Append (`data += chunk`), da dies Sonderzeichen (ä,ö,ü) zerstört.
- **Live Server Stats (Spieler):** Zur Zählung der Spieler die `numUsed` Property nutzen, oder alternativ alle `<Slot>` Einträge mit `isUsed="true"` zählen.

## Changelog-Pflege
- Jede relevante Änderung muss kurz und stichpunktartig im `CHANGELOG.md` festgehalten werden.
