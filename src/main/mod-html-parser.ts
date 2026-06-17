import * as cheerio from 'cheerio';

export function parseModsFromHtmlCheerio(html: string, serverUrlStr: string): any[] {
  const mods: any[] = [];
  const $ = cheerio.load(html);
  
  let baseUrl = '';
  try {
    const url = new URL(serverUrlStr);
    baseUrl = `${url.protocol}//${url.host}/`;
  } catch(e) {
    baseUrl = 'http://193.111.249.42:8081/';
  }

  // Jeder Mod ist in einem div mit beiden Klassen: container-row UND grid-row
  $('.container-row.grid-row').each((i, rowElem) => {
    const modData: any = {};
    
    // 1. Finde den Dateinamen
    // In FS25 ist der Dateiname in einem inneren div mit title="*.zip" und enthält den Begriff "Filename"
    const filenameDiv = $(rowElem).find('.container-row').filter((_, elem) => {
      const title = $(elem).attr('title');
      return !!(title && title.toLowerCase().endsWith('.zip'));
    }).first();
    
    if (filenameDiv.length > 0) {
      modData.fileName = filenameDiv.attr('title');
    } else {
      // Fallback: Suche einfach nach a[href$=".zip"] Text
      const zipLink = $(rowElem).find('a').filter((_, a) => {
        const text = $(a).text().trim();
        return text.toLowerCase().endsWith('.zip');
      }).first();
      if (zipLink.length > 0) {
        modData.fileName = zipLink.text().trim();
      }
    }
    
    if (!modData.fileName) return; // Kein Mod gefunden in dieser Zeile
    
    // 2. Finde den Download Link
    // Der Download-Link liegt meistens in einem a-Tag, dessen href mit "mods/" beginnt oder auf ".zip" endet
    const downloadA = $(rowElem).find('a[href*="mods/"], a[href$=".zip"]').filter((_, a) => {
      const href = $(a).attr('href');
      // Wenn der Text des Links der Dateiname ist, ist es NICHT der Download-Link, sondern der Filename-Link,
      // ABER manchmal ist der href "mods/..."
      return !!href && href.includes(modData.fileName);
    }).first();
    
    let downloadHref = downloadA.attr('href');
    
    // Generischer Fallback für Download-Link
    if (!downloadHref) {
      const fallbackA = $(rowElem).find('a[href^="mods/"]').first();
      downloadHref = fallbackA.attr('href');
    }
    
    if (downloadHref) {
      if (downloadHref.startsWith('http')) {
        modData.downloadUrl = downloadHref;
      } else {
        if (downloadHref.startsWith('/')) {
            downloadHref = downloadHref.substring(1);
        }
        modData.downloadUrl = `${baseUrl}${downloadHref}`;
      }
    } else {
      // Wenn wir partout keinen Download-Link finden, können wir die Struktur raten
      modData.downloadUrl = `${baseUrl}mods/${modData.fileName}`;
    }
    
    // 3. Name, Version, Autor, Größe
    modData.name = modData.fileName.replace('.zip', '');
    
    // Name
    const nameLabel = $(rowElem).find('b').filter((_, b) => $(b).text().trim() === 'Name');
    if (nameLabel.length > 0) {
      const nameVal = nameLabel.parent().next().text().trim();
      if (nameVal) modData.name = nameVal;
    }
    
    // Version
    const versionLabel = $(rowElem).find('b').filter((_, b) => $(b).text().trim() === 'Version');
    if (versionLabel.length > 0) {
      modData.version = versionLabel.parent().next().text().trim();
    }
    
    // Autor
    const authorLabel = $(rowElem).find('b').filter((_, b) => $(b).text().trim() === 'Author');
    if (authorLabel.length > 0) {
      modData.author = authorLabel.parent().next().text().trim();
    }
    
    // Size
    const sizeLabel = $(rowElem).find('b').filter((_, b) => $(b).text().trim() === 'Size');
    if (sizeLabel.length > 0) {
      modData.fileSize = sizeLabel.parent().next().text().trim();
    }
    
    // Active (Immer true als fallback)
    modData.isActive = true;
    
    if (modData.fileName && modData.downloadUrl) {
      mods.push(modData);
    }
  });
  
  return mods;
}
