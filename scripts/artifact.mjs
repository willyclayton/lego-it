// Turn the Vite build (dist/) into a claude.ai-hosted page: the host wraps the
// page in its own <html>/<head>/<body>, so we emit only the page content and
// reference the bundled assets by relative path.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const js = html.match(/<script[^>]*type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"/)?.[1];
const css = html.match(/<link[^>]*rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"/)?.[1];
const fonts = html.match(/<link href="(https:\/\/fonts\.googleapis\.com[^"]+)"/)?.[1];
if (!js || !css || !fonts) throw new Error('Could not find the entry script, stylesheet or fonts in dist/index.html');

const page = `<title>Lego It</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<link rel="stylesheet" href="${css}">
<div id="root"></div>
<script type="module" src="${js}"></script>
`;
writeFileSync('dist/artifact.html', page);
const assets = readdirSync('dist/assets').map((f) => `assets/${f}`);
// The host refuses files containing a literal U+FFFD (the SDK's text decoder has
// one in a template literal). The \uFFFD escape means the same thing in JS.
for (const a of assets.filter((x) => x.endsWith('.js'))) {
  const src = readFileSync(`dist/${a}`, 'utf8');
  if (src.includes('\uFFFD')) writeFileSync(`dist/${a}`, src.replaceAll('\uFFFD', '\\uFFFD'));
}
writeFileSync('dist/artifact-files.json', JSON.stringify(Object.fromEntries(assets.map((a) => [a, `dist/${a}`])), null, 2));
console.log('dist/artifact.html written with', assets.length, 'asset files');
