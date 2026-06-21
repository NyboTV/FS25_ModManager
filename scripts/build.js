const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const os = require('os');
const https = require('https');

// Lade .env Datei für GitHub Token
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT_DIR = path.join(__dirname, '..');
const PKG_JSON_PATH = path.join(ROOT_DIR, 'package.json');

// ANSI Colors for premium UI
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    fg: {
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        cyan: "\x1b[36m",
    }
};

const log = {
    header: (msg) => console.log(`\n${colors.fg.cyan}${colors.bright}🚀 ${msg}${colors.reset}\n`),
    step: (msg) => console.log(`${colors.fg.cyan}➜ ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.fg.green}✔ ${msg}${colors.reset}`),
    error: (msg) => console.error(`\n${colors.fg.red}${colors.bright}✖ ${msg}${colors.reset}\n`)
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (query) => new Promise(resolve => rl.question(`${colors.fg.yellow}?${colors.reset} ${colors.bright}${query}${colors.reset}`, resolve));

function runCommand(cmd) {
    try {
        execSync(cmd, { cwd: ROOT_DIR, stdio: 'inherit' });
    } catch (e) {
        throw new Error(`Command failed: ${cmd}`);
    }
}

async function incrementVersion() {
    const pkgJson = JSON.parse(fs.readFileSync(PKG_JSON_PATH, 'utf8'));
    let [major, minor, patch] = pkgJson.version.split('-')[0].split('.').map(Number);

    console.log(`\nAktuelle Version: ${colors.bright}v${pkgJson.version}${colors.reset}`);
    console.log(`1. Patch erhöhen (v${major}.${minor}.${patch + 1}) - Für kleine Bugfixes`);
    console.log(`2. Minor erhöhen (v${major}.${minor + 1}.0) - Für neue Features`);
    console.log(`3. Major erhöhen (v${major + 1}.0.0) - Für große, neue Meilensteine`);
    console.log(`4. Version beibehalten (v${pkgJson.version}) - Nur neu kompilieren\n`);

    const choice = await ask(`Wähle eine Option (1-4): `);

    if (choice === '1') { patch++; }
    else if (choice === '2') { minor++; patch = 0; }
    else if (choice === '3') { major++; minor = 0; patch = 0; }
    else if (choice === '4') { 
        log.step(`Version bleibt bei v${pkgJson.version}`);
        return pkgJson.version; 
    }
    else {
        log.error('Ungültige Eingabe. Version wird nicht geändert.');
        return pkgJson.version;
    }

    const newVersion = `${major}.${minor}.${patch}`;
    pkgJson.version = newVersion;
    fs.writeFileSync(PKG_JSON_PATH, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');
    
    // Update CHANGELOG.md
    try {
        const changelogPath = path.join(ROOT_DIR, 'CHANGELOG.md');
        if (fs.existsSync(changelogPath)) {
            let changelog = fs.readFileSync(changelogPath, 'utf8');
            const today = new Date().toISOString().split('T')[0];
            if (changelog.includes('### [Unreleased]')) {
                changelog = changelog.replace('### [Unreleased]', `### [Unreleased]\n\n## [${newVersion}] - ${today}`);
            } else {
                changelog = changelog.replace('## [Unreleased]', `## [Unreleased]\n\n## [${newVersion}] - ${today}`);
            }
            fs.writeFileSync(changelogPath, changelog, 'utf8');
            log.success(`CHANGELOG.md aktualisiert für Version v${newVersion}!`);
        }
    } catch (e) {
        log.error('Fehler beim Aktualisieren der CHANGELOG.md: ' + e.message);
    }

    log.success(`package.json auf Version v${newVersion} aktualisiert!`);
    
    return newVersion;
}


function getReleaseNotes(version) {
    try {
        const changelogPath = path.join(ROOT_DIR, 'CHANGELOG.md');
        if (!fs.existsSync(changelogPath)) return '';
        const content = fs.readFileSync(changelogPath, 'utf8');
        
        const regex = /##\s*\[?\d+\.\d+\.\d+\]?[\s\S]*?(?=\r?\n##\s*\d|\r?\n##\s*\[?\d|\s*$)/;
        const match = content.match(regex);
        if (match) {
            return match[0].replace(/^##\s*\[?.*\]?.*\r?\n/, '').trim();
        }
    } catch (e) {
        console.error('Fehler beim Extrahieren der Release Notes:', e);
    }
    return '';
}

function githubRequest(method, pathUrl, data, token, retries = 3) {
    return new Promise((resolve, reject) => {
        let bodyData = '';
        if (data) {
            bodyData = JSON.stringify(data);
        }

        const options = {
            hostname: 'api.github.com',
            port: 443,
            path: pathUrl,
            method: method,
            headers: {
                'User-Agent': 'fs25-modmanager-build-script',
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        };

        if (data) {
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(bodyData);
        }

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        resolve(body);
                    }
                } else {
                    reject(new Error(`GitHub API error (${res.statusCode}): ${body}`));
                }
            });
        });

        req.on('error', (e) => {
            const retryableErrors = ['ECONNABORTED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE'];
            if (retries > 0 && retryableErrors.includes(e.code)) {
                console.log(`\n⚠️ Netzwerk-Fehler (${e.code}). Versuche es in 2 Sekunden erneut (Verbleibende Versuche: ${retries})...`);
                setTimeout(() => {
                    githubRequest(method, pathUrl, data, token, retries - 1).then(resolve, reject);
                }, 2000);
            } else {
                reject(e);
            }
        });

        if (data) {
            req.write(bodyData);
        }
        req.end();
    });
}

async function createOrUpdateGithubRelease(version, title, notes, releaseType, token) {
    const pkgJson = JSON.parse(fs.readFileSync(PKG_JSON_PATH, 'utf8'));
    const repoUrl = pkgJson.repository;
    const [owner, repo] = repoUrl.split('/');
    
    const tag = `v${version}`;
    log.step(`Verbinde mit GitHub um Release/Draft für ${tag} vorzubereiten...`);
    
    try {
        // Liste alle Releases auf, da Drafts nicht über den Tag-Pfad angerufen werden können
        const releases = await githubRequest('GET', `/repos/${owner}/${repo}/releases`, null, token);
        let release = null;
        if (Array.isArray(releases)) {
            release = releases.find(r => r.tag_name === tag);
        }
        
        const payload = {
            tag_name: tag,
            name: title,
            body: notes,
            draft: true, // Vorab immer als Draft erstellen, um unfertige Uploads für User zu verhindern
            prerelease: releaseType === 'prerelease'
        };
        
        if (release && release.id) {
            log.step(`Release ID ${release.id} gefunden. Aktualisiere Details als Draft...`);
            await githubRequest('PATCH', `/repos/${owner}/${repo}/releases/${release.id}`, payload, token);
            log.success('GitHub Release-Details erfolgreich aktualisiert (als Draft)!');
        } else {
            log.step(`Erstelle neues Draft-Release (wird nach erfolgreichem Upload veröffentlicht)...`);
            await githubRequest('POST', `/repos/${owner}/${repo}/releases`, payload, token);
            log.success('GitHub Draft-Release erfolgreich erstellt!');
        }
    } catch (e) {
        log.error(`Fehler beim Erstellen/Aktualisieren der GitHub Release-Details: ${e.message}`);
        throw e;
    }
}

async function publishGithubRelease(version, releaseType, token) {
    const pkgJson = JSON.parse(fs.readFileSync(PKG_JSON_PATH, 'utf8'));
    const repoUrl = pkgJson.repository;
    const [owner, repo] = repoUrl.split('/');
    
    const tag = `v${version}`;
    const releaseTypeLabel = releaseType === 'prerelease' ? 'Pre-Release' : 'Live Release';
    log.step(`Veröffentliche das Release auf GitHub als ${releaseTypeLabel}...`);
    
    try {
        const releases = await githubRequest('GET', `/repos/${owner}/${repo}/releases`, null, token);
        let release = null;
        if (Array.isArray(releases)) {
            release = releases.find(r => r.tag_name === tag);
        }
        
        if (release && release.id) {
            log.step(`Release ID ${release.id} gefunden. Schalte Entwurf-Modus aus...`);
            
            const payload = {
                draft: false,
                prerelease: releaseType === 'prerelease'
            };
            
            await githubRequest('PATCH', `/repos/${owner}/${repo}/releases/${release.id}`, payload, token);
            log.success(`GitHub Release erfolgreich als ${releaseTypeLabel} veröffentlicht!`);
        } else {
            log.error(`Release für Tag ${tag} konnte auf GitHub nicht gefunden werden.`);
        }
    } catch (e) {
        log.error(`Fehler beim Veröffentlichen des GitHub Releases: ${e.message}`);
    }
}

const TEMP_BUILD_DIR = path.join(os.tmpdir(), 'fs25-modmanager-build');

async function startBuild() {
    console.clear();
    log.header('FS25 ModManager - Interaktives Build Script');

    try {
        const pkgJson = JSON.parse(fs.readFileSync(PKG_JSON_PATH, 'utf8'));
        const oldVersion = pkgJson.version;
        const newVersion = await incrementVersion();
        const versionChanged = oldVersion !== newVersion;
        
        let releaseType = 'draft';
        let releaseTitle = `Update v${newVersion}`;
        let releaseNotesText = '';
        
        if (versionChanged) {
            console.log(`\n${colors.fg.yellow}Release-Konfiguration:${colors.reset}`);
            console.log(`1. Entwurf (Draft Release) - Nur hochladen, nicht direkt veröffentlichen (Empfohlen)`);
            console.log(`2. Direkt Veröffentlichen (Live Release) - Direkt für alle sichtbar machen`);
            console.log(`3. Pre-Release (Vorabversion) - Als Vorabversion kennzeichnen\n`);
            
            const relTypeChoice = await ask(`Wähle den Release-Typ (1-3, Standard 1): `);
            if (relTypeChoice === '2') {
                releaseType = 'release';
                log.step('Modus: Live Release (Direkte Veröffentlichung)');
            } else if (relTypeChoice === '3') {
                releaseType = 'prerelease';
                log.step('Modus: Pre-Release (Vorabversion)');
            } else {
                releaseType = 'draft';
                log.step('Modus: Draft Release (Entwurf)');
            }
            
            const customTitle = await ask(`Release-Titel eingeben (Enter für "${releaseTitle}"): `);
            if (customTitle.trim()) {
                releaseTitle = customTitle.trim();
            }

            // Release Notes extrahieren
            releaseNotesText = getReleaseNotes(newVersion);
            if (releaseNotesText) {
                log.success('Release Notes erfolgreich aus CHANGELOG.md extrahiert!');
            }
        }
        
        if (versionChanged) {
            if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
                console.log(`\n${colors.fg.yellow}Für den automatischen Upload auf GitHub wird ein Personal Access Token (GH_TOKEN) benötigt.${colors.reset}`);
                console.log(`${colors.dim}(Wenn du keins hast, drücke einfach Enter, um nur lokal zu bauen)${colors.reset}`);
                const token = await ask("GitHub Token: ");
                if (token.trim()) {
                    process.env.GH_TOKEN = token.trim();
                }
            }

            if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) {
                const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
                // GitHub Release/Draft ERST erstellen/aktualisieren und fertig machen!
                await createOrUpdateGithubRelease(newVersion, releaseTitle, releaseNotesText, releaseType, token);

                log.step('Passe package.json temporär für den Release-Typ und Release-Informationen an...');
                const currentPkgJson = JSON.parse(fs.readFileSync(PKG_JSON_PATH, 'utf8'));
                if (!currentPkgJson.build) currentPkgJson.build = {};
                if (!currentPkgJson.build.publish) currentPkgJson.build.publish = [{}];
                if (currentPkgJson.build.publish[0]) {
                    // Wir belassen es während des Builds immer auf 'draft', damit electron-builder
                    // die Release-Veröffentlichung nicht vorzeitig durchführt.
                    currentPkgJson.build.publish[0].releaseType = 'draft';
                }
                
                if (!currentPkgJson.build.releaseInfo) currentPkgJson.build.releaseInfo = {};
                currentPkgJson.build.releaseInfo.releaseName = releaseTitle;
                if (releaseNotesText) {
                    currentPkgJson.build.releaseInfo.releaseNotes = releaseNotesText;
                }
                
                fs.writeFileSync(PKG_JSON_PATH, JSON.stringify(currentPkgJson, null, 2) + '\n', 'utf8');
                log.success('package.json erfolgreich temporär angepasst.');
            }
        }
        
        log.header(`Starte Build für v${newVersion}...`);

        log.step('Kompiliere TypeScript...');
        runCommand('npm run build');
        log.success('TypeScript kompiliert!');

        log.step('Verpacke App als Installer (Electron-Builder)...');
        // Kill running electron, app, and installer instances to avoid file lock issues on Windows
        try {
            if (process.platform === 'win32') {
                execSync('taskkill /f /im electron.exe /t', { stdio: 'ignore' });
                execSync('taskkill /f /im "Farming Simulator Mod Manager.exe" /t', { stdio: 'ignore' });
                execSync('taskkill /f /im fs25_modmanager.exe /t', { stdio: 'ignore' });
                execSync('taskkill /f /im "Farming Simulator Mod Manager Setup*.exe" /t', { stdio: 'ignore' });
                execSync('taskkill /f /im "Farming-Simulator-Mod-Manager-Setup*.exe" /t', { stdio: 'ignore' });
            }
        } catch (e) {}
        
        // Delete old temp and local build folders
        try { fs.rmSync(TEMP_BUILD_DIR, { recursive: true, force: true }); } catch (e) {}
        try { fs.rmSync(path.join(ROOT_DIR, '.build'), { recursive: true, force: true }); } catch (e) {}
        
        if (versionChanged && (process.env.GH_TOKEN || process.env.GITHUB_TOKEN)) {
            log.step(`Baue Installer und lade in das vorbereitete Release auf GitHub hoch...`);
            let buildCmd = 'npx electron-builder build --win --x64 --publish always';
            buildCmd += ` -c.directories.output="${TEMP_BUILD_DIR}"`;
            runCommand(buildCmd);
            log.success(`Installer erfolgreich gebaut und auf GitHub hochgeladen!`);

            // Veröffentliche das Release, wenn der Upload erfolgreich war und der Typ nicht 'draft' ist
            if (releaseType !== 'draft') {
                const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
                log.step('Warte 2 Sekunden, damit sich die Netzwerkverbindungen nach dem Upload beruhigen...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                await publishGithubRelease(newVersion, releaseType, token);
            }
        } else {
            log.step('Baue lokal...');
            runCommand(`npx electron-builder build --win --x64 -c.directories.output="${TEMP_BUILD_DIR}"`);
        }
        
        // Copy only the final setup exe back to the project releases directory
        const RELEASES_DIR = path.join(ROOT_DIR, 'releases');
        if (!fs.existsSync(RELEASES_DIR)) {
            fs.mkdirSync(RELEASES_DIR, { recursive: true });
        }
        
        const installerName = `Farming Simulator Mod Manager Setup ${newVersion}.exe`;
        const tempInstallerPath = path.join(TEMP_BUILD_DIR, installerName);
        const localInstallerPath = path.join(RELEASES_DIR, installerName);
        
        if (fs.existsSync(tempInstallerPath)) {
            log.step('Kopiere Setup-Installer in das Releases-Verzeichnis...');
            fs.copyFileSync(tempInstallerPath, localInstallerPath);
            log.success(`Installer erfolgreich kopiert: releases/${installerName}`);
        }

        log.header('Build erfolgreich abgeschlossen! 🎉');
        console.log(`Dein Installer befindet sich unter: ${colors.bright}releases/${installerName}${colors.reset}\n`);

    } catch (err) {
        log.error(`Build abgebrochen: ${err.message}`);
    } finally {
        // Restore package.json Release-Konfiguration
        try {
            const pkgJson = JSON.parse(fs.readFileSync(PKG_JSON_PATH, 'utf8'));
            let changed = false;
            if (pkgJson.build) {
                if (pkgJson.build.publish && pkgJson.build.publish[0] && pkgJson.build.publish[0].releaseType !== 'draft') {
                    pkgJson.build.publish[0].releaseType = 'draft';
                    changed = true;
                }
                if (pkgJson.build.releaseInfo) {
                    delete pkgJson.build.releaseInfo;
                    changed = true;
                }
            }
            if (changed) {
                fs.writeFileSync(PKG_JSON_PATH, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');
                log.step('package.json Release-Konfiguration zurückgesetzt.');
            }
        } catch (e) {}

        // Clean up temp directories
        try {
            if (fs.existsSync(TEMP_BUILD_DIR)) {
                fs.rmSync(TEMP_BUILD_DIR, { recursive: true, force: true });
            }
        } catch (e) {}

        rl.close();
    }
}

startBuild();
