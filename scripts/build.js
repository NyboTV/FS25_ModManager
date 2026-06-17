const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

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
    log.success(`package.json auf Version v${newVersion} aktualisiert!`);
    
    return newVersion;
}

async function startBuild() {
    console.clear();
    log.header('FS25 ModManager - Interaktives Build Script');

    try {
        const newVersion = await incrementVersion();
        
        log.header(`Starte Build für v${newVersion}...`);

        log.step('Kompiliere TypeScript...');
        runCommand('npm run build');
        log.success('TypeScript kompiliert!');

        log.step('Verpacke App als Installer (Electron-Builder)...');
        // Delete old build folder to avoid locking issues if possible (ignore errors)
        try { fs.rmSync(path.join(ROOT_DIR, 'build'), { recursive: true, force: true }); } catch (e) {}
        
        runCommand('npm run package');
        
        log.header('Build erfolgreich abgeschlossen! 🎉');
        console.log(`Dein Installer befindet sich im Ordner: ${colors.bright}build/Farming Simulator Mod Manager Setup ${newVersion}.exe${colors.reset}\n`);

    } catch (err) {
        log.error(`Build abgebrochen: ${err.message}`);
    } finally {
        rl.close();
    }
}

startBuild();
