# FastDL Server Guide (Eigener Mod-Download Server)

Wenn du einen Dedicated Server für Farming Simulator betreibst, kennst du wahrscheinlich das Problem: Der Download von Mods direkt über das Web-Interface des GIANTS-Servers ist oft sehr langsam (teilweise auf wenige KB/s limitiert).

Dieser ModManager besitzt eine integrierte **FastDownload (FastDL) Unterstützung**, ähnlich wie man es von Source-Engine Spielen (Garry's Mod, CS:S) kennt.

Damit können deine Spieler Mods in voller Geschwindigkeit herunterladen!

## Wie funktioniert es?
Der ModManager benötigt keine spezielle API oder komplexe Software. Er kann jede normale Website lesen, die ein einfaches **Directory Listing** (also eine Liste von Dateien) anzeigt.

Alles, was du tun musst, ist deine `.zip` Mod-Dateien auf einen normalen Webserver hochzuladen.

## Einen Webserver einrichten

### Option A: Günstiger Webspace (Empfohlen für Anfänger)
1. Miete dir einen günstigen Webspace (z.B. bei Nitrado, Strato, IONOS, Netcup). Webspace ist sehr günstig und bietet ungedrosselte Download-Raten.
2. Verbinde dich per FTP mit deinem Webspace.
3. Erstelle einen Ordner namens `mods`.
4. Lade alle `.zip` Mods deines Servers in diesen Ordner hoch.
5. Rufe die URL in deinem Browser auf (z.B. `http://dein-webspace.de/mods/`). 
6. Wenn du eine einfache, weiße Seite siehst, die all deine `.zip` Dateien als Links auflistet, funktioniert es!

### Option B: Eigener Nginx / Apache Server (Für Fortgeschrittene)
Wenn du einen eigenen vServer oder Root-Server besitzt, kannst du einfach Nginx oder Apache installieren.

**Nginx Konfiguration:**
Füge in deiner Server-Konfiguration (`/etc/nginx/sites-available/default`) das Modul `autoindex on` hinzu:

```nginx
server {
    listen 80;
    server_name fastdl.deine-domain.de;

    location /mods/ {
        alias /var/www/fastdl/mods/;
        autoindex on;        # Aktiviert die Datei-Übersicht
        autoindex_exact_size off;
        autoindex_localtime on;
    }
}
```

Lade deine Mods nach `/var/www/fastdl/mods/` hoch und lade Nginx neu (`systemctl reload nginx`).

## Den Link in den ModManager eintragen
Egal welche Option du wählst: Nimm den generierten Link (z.B. `http://fastdl.deine-domain.de/mods/`) und trage ihn in den ModManager ein:

1. Gehe in den ModManager.
2. Erstelle ein Profil für deinen Server oder klicke bei einem bestehenden Profil auf **Bearbeiten**.
3. Trage den Link unter **FastDL Server-URL (für Sync)** ein.
4. Klicke auf den Button **Link prüfen**, um sicherzugehen, dass der ModManager die Dateien findet.
5. Speichern und auf **Synchronisieren** klicken.

Der ModManager wird nun alle Mods auf dem FastDL Server mit deinem lokalen Ordner vergleichen, fehlende Mods herunterladen und veraltete aktualisieren!
