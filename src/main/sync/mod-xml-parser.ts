import * as cheerio from 'cheerio';
import { decodeHtmlEntities } from '../../common/utils';
import { logger } from '../main';

export function parseModsFromXml(xmlText: string, serverUrlStr: string): any[] {
  const mods: any[] = [];
  try {
    logger.debug(`Parsing XML from URL: ${serverUrlStr}`);
    // Load with xmlMode to support XML casing and tags properly
    const $ = cheerio.load(xmlText, { xmlMode: true });
    
    let baseUrl = '';
    let codeParam = '';
    try {
      const url = new URL(serverUrlStr);
      baseUrl = `${url.protocol}//${url.host}/`;
      codeParam = url.searchParams.get('code') || '';
    } catch (e) {
      logger.warn(`Could not parse base URL from XML source: ${serverUrlStr}`);
    }

    // Match both <Mod> and <mod> tags
    const modElements = $('Mod, mod');
    logger.debug(`Found ${modElements.length} mod elements in XML`);

    modElements.each((_, elem) => {
      const nameAttr = $(elem).attr('name');
      if (!nameAttr) return;

      const name = decodeHtmlEntities(nameAttr);
      // Ensure it ends with .zip
      const fileName = name.toLowerCase().endsWith('.zip') ? name : `${name}.zip`;
      const author = decodeHtmlEntities($(elem).attr('author') || '');
      const version = decodeHtmlEntities($(elem).attr('version') || '');
      const hash = $(elem).attr('hash') || '';

      // Construct download URL
      // If code query parameter exists, we must forward it as: /mods/FILENAME.zip?code=XXX
      const query = codeParam ? `?code=${codeParam}` : '';
      const downloadUrl = `${baseUrl}mods/${fileName}${query}`;

      mods.push({
        name: name.replace(/\.zip$/i, ''),
        fileName,
        author,
        version,
        hash,
        downloadUrl,
        isActive: true,
        isFromServer: true,
        modHub: ''
      });
    });
  } catch (err) {
    logger.error(`Error parsing mods from XML: ${err instanceof Error ? err.message : String(err)}`);
  }
  return mods;
}
