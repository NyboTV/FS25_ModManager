import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.farming-simulator.com';
const OUTPUT_FILE = path.join(__dirname, '..', 'remote', 'mod-mapping.json');

interface ModMapping {
  [zipName: string]: {
    modId: string;
    title: string;
    category: string;
    author: string;
  }
}

let mapping: ModMapping = {};
const knownModIds = new Set<string>();

if (fs.existsSync(OUTPUT_FILE)) {
  try {
    mapping = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    for (const zip of Object.keys(mapping)) {
      knownModIds.add(mapping[zip].modId);
    }
    console.log(`Lade ${knownModIds.size} bekannte Mods aus ${OUTPUT_FILE}`);
  } catch (e) {
    console.warn('Konnte bestehendes Mapping nicht lesen, fange neu an.');
  }
}

async function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time));
}

async function scrapeModhub() {
  console.log('Starte ModHub Hochleistungs-Scraper (Pure HTTP/Axios)...');
  
  let p = 0;
  let newModIds: string[] = [];
  let stopPagination = false;
  
  const isFullScan = process.argv.includes('--full');
  if (isFullScan) {
    console.log('FULL SCAN Modus aktiviert: Überspringe den "Early Exit" und durchsuche alle Seiten.');
  }

  // 1. Pagination extrem schnell mit Axios/Cheerio durchsuchen
  while (!stopPagination) {
    console.log(`Scanne Seite ${p} nach neuen Mods...`);
    try {
      const { data } = await axios.get(`${BASE_URL}/mods.php?title=fs2025&page=${p}`, { timeout: 10000 });
      const $ = cheerio.load(data);
      
      const modItems = $('.mod-item');
      if (modItems.length === 0) {
        console.log('Keine Mods mehr gefunden, beende Paginierung.');
        break; // Keine Mods mehr auf dieser Seite
      }

      let newModsOnThisPage = 0;

      modItems.each((_, elem) => {
        const href = $(elem).find('a').attr('href');
        if (href) {
          const match = href.match(/mod_id=([0-9]+)/);
          if (match) {
            const modId = match[1];
            if (!knownModIds.has(modId) && !newModIds.includes(modId)) {
              newModIds.push(modId);
              newModsOnThisPage++;
            }
          }
        }
      });

      console.log(`-> ${newModsOnThisPage} neue Mods auf Seite ${p} gefunden.`);

      if (!isFullScan && newModsOnThisPage === 0 && p > 0) {
        console.log('Alle weiteren Mods auf dieser Seite sind bereits bekannt. Breche Paginierung ab!');
        stopPagination = true;
      }

      p++;
      await delay(200); 
    } catch (err: any) {
      console.error(`Fehler beim Scannen von Seite ${p}:`, err.message);
      break;
    }
  }

  if (newModIds.length === 0) {
    console.log('Keine neuen Mods gefunden. Mod-Mapping ist auf dem neuesten Stand!');
    return;
  }

  console.log(`\nInsgesamt ${newModIds.length} neue Mods gefunden. Starte Detail-Extraktion...`);

  // 2. HTTP Detail Extraction für die neuen Mods
  for (let i = 0; i < newModIds.length; i++) {
    const modId = newModIds[i];
    console.log(`[${i+1}/${newModIds.length}] Extrahiere Infos für Mod-ID ${modId}...`);
    
    try {
      // Lade Detailseite per Axios
      const { data } = await axios.get(`${BASE_URL}/mod.php?mod_id=${modId}`, { timeout: 10000 });
      const $ = cheerio.load(data);
      
      let title = $('h2.title').text().trim();
      if (!title) title = $('h1').text().trim() || 'Unknown';
      
      let author = 'Unknown';
      let category = 'Unknown';

      $('.table-row').each((_, el) => {
        const key = $(el).find('.table-cell').first().text().trim().toLowerCase();
        const val = $(el).find('.table-cell').last().text().trim();
        if (key.includes('author') || key.includes('autor')) author = val;
        if (key.includes('category') || key.includes('kategorie')) category = val;
      });

      // Lese den ZIP-Link aus dem HTML aus! (Ganz einfach, ohne Puppeteer)
      let interceptedZipName = '';
      const downloadHref = $('.download-box a[href$=".zip"]').attr('href');
      
      if (downloadHref) {
        const parts = downloadHref.split('/');
        interceptedZipName = parts[parts.length - 1];
      }
      
      if (interceptedZipName) {
         mapping[interceptedZipName] = {
           modId,
           title,
           category,
           author
         };
         console.log(`  -> ZIP: ${interceptedZipName} | Cat: ${category}`);
         
         if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
           fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
         }
         fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mapping, null, 2), 'utf-8');
      } else {
         console.log(`  -> Fehlschlag: Kein .zip Download-Link auf Detailseite gefunden.`);
      }

    } catch (err: any) {
      console.error(`  -> Fehler bei Mod ${modId}:`, err.message);
    }

    await delay(1000); // 1 Sekunde Pause reicht hier, da reines HTTP
  }

  console.log(`\nScraping beendet! Insgesamt sind nun ${Object.keys(mapping).length} Mods gemappt.`);
}

scrapeModhub();
