==============================================
 FS25 ModManager - FastDL Server
==============================================

[DEUTSCH]
Dieser einfache Webserver macht deine Mods im lokalen Netzwerk oder Internet (falls Port-Freigabe eingerichtet ist) verfügbar, sodass andere Spieler über den ModManager deine Mods per FastDL synchronisieren können.

BENUTZUNG:
1. Führe die Datei "start-fastdl.bat" mit einem Doppelklick aus.
2. Der Server fragt dich interaktiv, ob er auf demselben Host wie der FS25 Server läuft.
   - Wenn JA: Er versucht deinen FS25 Mods-Ordner automatisch zu finden. Du kannst diesen direkt freigeben, ohne Mods kopieren zu müssen.
   - Wenn NEIN: Er erstellt einen lokalen "files"-Ordner, in den du deine freizugebenden Mods kopieren kannst.
3. Trage im FS25 ModManager bei deinem Profil die FastDL-Server-URL ein:
   Lokal: http://localhost:34567/
   Netzwerk: http://<deine-lokale-IP>:34567/ (z.B. http://192.168.178.20:34567/)

VORAUSSETZUNGEN:
- Du benötigst Node.js (https://nodejs.org/) auf deinem System, damit der Server gestartet werden kann.

----------------------------------------------

[ENGLISH]
This simple web server makes your mods available on your local network or the internet (if port forwarding is set up), allowing other players to synchronize your mods via FastDL using the ModManager.

USAGE:
1. Run the "start-fastdl.bat" file by double-clicking it.
2. The server will ask you interactively if it runs on the same host as your FS25 server.
   - If YES: It will try to automatically find your FS25 mods folder. You can serve this folder directly without needing to copy mods.
   - If NO: It will create a local "files" folder for you to place the mods you want to share.
3. In the FS25 ModManager, enter the FastDL server URL for your profile:
   Local: http://localhost:34567/
   Network: http://<your-local-IP>:34567/ (e.g. http://192.168.178.20:34567/)

REQUIREMENTS:
- You need Node.js (https://nodejs.org/) installed on your system to start the server.
