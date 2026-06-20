const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Sprache erkennen
const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
const isGerman = locale.toLowerCase().startsWith('de');

const T = {
    de: {
        configTitle: " FS25 FastDL Server Konfiguration",
        askPort: "Auf welchem Port soll der Server laufen? (Standard: 34567): ",
        askSameHost: "Läuft dieser FastDL Server auf demselben PC/Server wie dein FS25 Dedicated Server? (j/n): ",
        foundDefault: "\nWir haben folgenden Mods-Ordner gefunden:\n=> %s\nIst das korrekt? Soll dieser verwendet werden? (j/n): ",
        defaultNotFound: "\nStandard-Verzeichnis nicht gefunden.",
        askManualPath: "\nBitte gib den vollständigen Pfad zum FS25 'mods' Ordner ein:\n> ",
        errInvalidPath: "[FEHLER] Dieser Pfad existiert nicht oder ist kein Verzeichnis. Bitte erneut versuchen.",
        useLocalFolder: "\nEs wird der lokale 'files'-Ordner in diesem Verzeichnis genutzt.",
        serverOnline: " FastDL Webserver ist ONLINE",
        port: " -> Port:",
        urlLocal: " -> URL (Lokal): ",
        urlLan: " -> URL (LAN):   ",
        urlPublic: " -> URL (Public):",
        path: " -> Pfad:",
        putModsInLocal: "Lege deine .zip Mods in den \"files\" Ordner.",
        modsServedDirectly: "Mods werden nun direkt aus deinem FS25 Mods-Ordner bereitgestellt.",
        pressCtrlC: "Drücke STRG+C um den Server zu beenden.",
        indexTitle: "Index von ",
        goBack: "../ (Zurück)"
    },
    en: {
        configTitle: " FS25 FastDL Server Configuration",
        askPort: "Which port should the server run on? (Default: 34567): ",
        askSameHost: "Is this FastDL Server running on the same PC/Server as your FS25 Dedicated Server? (y/n): ",
        foundDefault: "\nWe found the following mods folder:\n=> %s\nIs this correct? Should it be used? (y/n): ",
        defaultNotFound: "\nDefault directory not found.",
        askManualPath: "\nPlease enter the full path to your FS25 'mods' folder:\n> ",
        errInvalidPath: "[ERROR] This path does not exist or is not a directory. Please try again.",
        useLocalFolder: "\nUsing the local 'files' folder in this directory.",
        serverOnline: " FastDL Webserver is ONLINE",
        port: " -> Port:",
        urlLocal: " -> URL (Local): ",
        urlLan: " -> URL (LAN):   ",
        urlPublic: " -> URL (Public):",
        path: " -> Path:",
        putModsInLocal: "Place your .zip mods into the \"files\" folder.",
        modsServedDirectly: "Mods are now served directly from your FS25 mods folder.",
        pressCtrlC: "Press CTRL+C to stop the server.",
        indexTitle: "Index of ",
        goBack: "../ (Go back)"
    }
};

const lang = isGerman ? T.de : T.en;

const CONFIG_FILE = path.join(__dirname, 'config.json');
const LOCAL_FILES_DIR = path.join(__dirname, 'files');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

function getLanIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function getPublicIp() {
    return new Promise(resolve => {
        https.get('https://api.ipify.org', { timeout: 3000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data.trim()));
        }).on('error', () => resolve(null))
          .on('timeout', () => resolve(null));
    });
}

const MIME_TYPES = {
    '.zip': 'application/zip',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.json': 'application/json'
};

async function initConfig() {
    let config = { port: 34567, serveDir: LOCAL_FILES_DIR };

    if (fs.existsSync(CONFIG_FILE)) {
        try {
            config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            // Wenn Config existiert, direkt starten
            startServer(config);
            return;
        } catch(e) {
            console.error("Config Datei fehlerhaft, starte Setup neu.");
        }
    }

    console.log("==============================================");
    console.log(lang.configTitle);
    console.log("==============================================");
    
    // Port abfragen
    const portStr = await askQuestion(lang.askPort);
    if (portStr.trim() !== '') {
        const parsedPort = parseInt(portStr.trim(), 10);
        if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
            config.port = parsedPort;
        }
    }

    const sameHostStr = await askQuestion(lang.askSameHost);
    const isSameHost = sameHostStr.trim().toLowerCase().startsWith('j') || sameHostStr.trim().toLowerCase().startsWith('y');
    
    if (isSameHost) {
        // Versuche den Standard-Ordner zu finden
        const docsPath = path.join(os.homedir(), 'Documents', 'My Games', 'FarmingSimulator2025', 'mods');
        let foundDefault = false;
        
        if (fs.existsSync(docsPath)) {
            const useDefaultStr = await askQuestion(lang.foundDefault.replace('%s', docsPath));
            if (useDefaultStr.trim().toLowerCase().startsWith('j') || useDefaultStr.trim().toLowerCase().startsWith('y')) {
                config.serveDir = docsPath;
                foundDefault = true;
            }
        } else {
            console.log(lang.defaultNotFound);
        }
        
        if (!foundDefault) {
            let validPath = false;
            while (!validPath) {
                const manualPath = await askQuestion(lang.askManualPath);
                // Entferne eventuelle Anführungszeichen
                const cleanPath = manualPath.replace(/^["']|["']$/g, '').trim();
                
                if (fs.existsSync(cleanPath) && fs.statSync(cleanPath).isDirectory()) {
                    config.serveDir = cleanPath;
                    validPath = true;
                } else {
                    console.log(lang.errInvalidPath);
                }
            }
        }
    } else {
        // Verwende lokalen Ordner
        if (!fs.existsSync(LOCAL_FILES_DIR)) {
            fs.mkdirSync(LOCAL_FILES_DIR);
        }
        console.log(lang.useLocalFolder);
        config.serveDir = LOCAL_FILES_DIR;
    }

    // Speichern
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 4), 'utf8');

    rl.close();
    startServer(config);
}

async function startServer(config) {
    const { port, serveDir } = config;

    const server = http.createServer((req, res) => {
        // Entferne Query Parameter
        const urlPath = req.url.split('?')[0];
        console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${urlPath}`);
        
        // Sicherheit: path.normalize verhindert Directory Traversal Angriffe ("../")
        const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
        
        let filePath = path.join(serveDir, safePath);
        
        // Prüfen, ob die Datei innerhalb des Verzeichnisses liegt
        if (!filePath.startsWith(serveDir)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('403 Forbidden');
            return;
        }

        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            
            // Wenn es ein Ordner ist, zeige den Datei-Index an
            if (stat.isDirectory()) {
                const files = fs.readdirSync(filePath);
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                
                let listItems = files.map(f => {
                    try {
                        const isDir = fs.statSync(path.join(filePath, f)).isDirectory();
                        const display = isDir ? `${f}/` : f;
                        const href = path.posix.join(urlPath === '/' ? '' : urlPath, f);
                        return `<li><a href="${href}">${display}</a></li>`;
                    } catch(e) {
                        return '';
                    }
                }).join('\n');

                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>FastDL Index</title>
                        <style>
                            body { font-family: monospace; background: #1e1e1e; color: #fff; padding: 20px; }
                            a { color: #4da6ff; text-decoration: none; }
                            a:hover { text-decoration: underline; }
                            ul { list-style: none; padding: 0; }
                            li { padding: 4px 0; }
                        </style>
                    </head>
                    <body>
                        <h2>${lang.indexTitle}${urlPath}</h2>
                        <hr>
                        <ul>
                            ${urlPath !== '/' ? `<li><a href="../">${lang.goBack}</a></li>` : ''}
                            ${listItems}
                        </ul>
                    </body>
                    </html>
                `);
                return;
            }

            // Datei ausliefern
            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': stat.size,
                'Access-Control-Allow-Origin': '*'
            });

            const readStream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 }); // 1MB Chunks für maximalen Netzwerkdurchsatz
            readStream.pipe(res);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
        }
    });

    const publicIp = await getPublicIp();
    const lanIp = getLanIp();

    server.listen(port, () => {
        console.log(`\n=========================================`);
        console.log(lang.serverOnline);
        console.log(`=========================================`);
        console.log(`${lang.port} ${port}`);
        console.log(`${lang.urlLocal} http://localhost:${port}/`);
        console.log(`${lang.urlLan} http://${lanIp}:${port}/`);
        if (publicIp) {
            console.log(`${lang.urlPublic} http://${publicIp}:${port}/`);
        }
        console.log(`${lang.path} ${serveDir}`);
        console.log(`=========================================\n`);
        
        if (serveDir === LOCAL_FILES_DIR) {
            console.log(lang.putModsInLocal);
        } else {
            console.log(lang.modsServedDirectly);
        }
        console.log(lang.pressCtrlC);
        console.log(`(Tipp: Um die Konfiguration zu ändern, lösche die config.json)`);
    });
}

// Start interactive config
initConfig();
