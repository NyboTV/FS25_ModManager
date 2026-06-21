import puppeteer from 'puppeteer';

async function test() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.farming-simulator.com/mod.php?mod_id=364803', { waitUntil: 'domcontentloaded' });
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('detail_pup.html', html);
  await browser.close();
}
test();
