// Pre-render the Chicago catalog thumbnails into public/thumbs/<id>.webp so the
// landing page appears instantly. Run with the dev server up:  npm run dev  then
//   node scripts/thumbs.cjs [http://127.0.0.1:5173]
// Re-run whenever a model changes (the app falls back to rendering live if a file is missing).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const base = process.argv[2] || 'http://127.0.0.1:5173';
const out = path.join(__dirname, '..', 'public', 'thumbs');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  await page.goto(`${base}/dev/thumbs.html#list`);
  const ids = await page.waitForFunction(() => window.__ids).then((h) => h.jsonValue());
  for (const id of ids) {
    const p = await browser.newPage();
    await p.goto(`${base}/dev/thumbs.html#${id}`);
    const url = await p.waitForFunction(() => window.__thumb, null, { timeout: 180000 }).then((h) => h.jsonValue());
    const buf = Buffer.from(url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(out, `${id}.webp`), buf);
    console.log(`${id}.webp  ${(buf.length / 1024).toFixed(0)} KB`);
    await p.close();
  }
  await browser.close();
})();
