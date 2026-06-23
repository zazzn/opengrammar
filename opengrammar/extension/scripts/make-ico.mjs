// Build OGrammar.ico (multi-resolution) from the brand mark. Small sizes use the
// bolder 2-hump variant; large sizes use the full master.  Run:  npm run ico
import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, '..', 'public');
const master = readFileSync(join(pub, 'icon.svg'), 'utf8');
const bold = readFileSync(join(here, 'icon-16.svg'), 'utf8');
const png = (svg, size) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

const buffers = [
  png(bold, 16), png(bold, 24), png(bold, 32),
  png(master, 48), png(master, 64), png(master, 128), png(master, 256),
];
const ico = await pngToIco(buffers);

const outDir = join(pub, 'icons');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'OGrammar.ico'), ico);
console.log(`wrote OGrammar.ico (${ico.length} bytes) to public/icons`);
