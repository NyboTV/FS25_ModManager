// Hilfsmodul für HTML-Parsing mit cheerio
import * as cheerio from 'cheerio';

export function parseModsFromHtmlCheerio(html: string): any[] {
  const mods: any[] = [];
  const $ = cheerio.load(html);
  // Jeder Mod ist ein <div class="container-row grid-row">
  $('.container-row.grid-row').each((i, elem) => {
    const modData: any = {};
    // Name
    const nameDiv = $(elem).find('div[title]').filter((_, d) => $(d).find('b').text().trim() === 'Name');
    modData.name = nameDiv.find('a').text().trim();
    // Version
    const versionDiv = $(elem).find('div[title]').filter((_, d) => $(d).find('b').text().trim() === 'Version');
    modData.version = versionDiv.find('.col-lg-12,.col-xs-9').text().trim();
    // Author
    const authorDiv = $(elem).find('div[title]').filter((_, d) => $(d).find('b').text().trim() === 'Author');
    modData.author = authorDiv.find('.col-lg-12,.col-xs-9').text().trim();
    // Filename
    const fileDiv = $(elem).find('div[title]').filter((_, d) => $(d).find('b').text().trim() === 'Filename');
    modData.fileName = fileDiv.find('a').text().trim();
    // Size
    const sizeDiv = $(elem).find('div[title]').filter((_, d) => $(d).find('b').text().trim() === 'Size');
    modData.fileSize = sizeDiv.find('.col-lg-12,.col-xs-9').text().trim();
    // ModHub (fix: explizit <span> extrahieren, nicht nur Text)
    const modHubDiv = $(elem).find('div[title]').filter((_, d) => $(d).find('b').text().trim() === 'ModHub');
    const modHubSpan = modHubDiv.find('span');
    modData.modHub = modHubSpan.length ? modHubSpan.text().trim() : modHubDiv.find('.col-lg-12,.col-xs-9').text().trim();
    // Active
    const activeDiv = $(elem).find('div[title]').filter((_, d) => $(d).find('b').text().trim() === 'Active');
    modData.isActive = activeDiv.find('.col-lg-12,.col-xs-9').text().trim().toLowerCase() === 'yes';
    // Download-Link
    const downloadA = $(elem).find('a[title^="Download "]');
    modData.downloadUrl = downloadA.attr('href') ? (downloadA.attr('href')!.startsWith('http') ? downloadA.attr('href') : `http://193.111.249.39:8080/${downloadA.attr('href')}`) : '';
    // Detail-URL (Name-Link)
    const detailA = nameDiv.find('a');
    modData.detailUrl = detailA.attr('href') ? (detailA.attr('href')!.startsWith('http') ? detailA.attr('href') : `http://193.111.249.39:8080/${detailA.attr('href')}`) : '';
    // Roh-HTML für Debugging (nur temporär, nicht ins Profil speichern)
    modData._rawHtml = $.html(elem);
    // Nur speichern, wenn Filename und Download vorhanden
    if (modData.fileName && modData.downloadUrl) {
      // _rawHtml NICHT ins Profil übernehmen, sondern nur für Debugging zurückgeben
      const { _rawHtml, ...profileMod } = modData;
      mods.push(profileMod);
      // _rawHtml kann separat geloggt werden, z.B. logger.debug(...)
      // NICHT an das Mod-Objekt anhängen!
    }
  });
  return mods;
}
