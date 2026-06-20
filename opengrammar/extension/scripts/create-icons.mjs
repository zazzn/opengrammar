// Rasterize the OGrammar mark into the extension's PNG icon set.
// 48 + 128 render from the full master (public/icon.svg); 16 renders from a
// bolder 2-hump variant (scripts/icon-16.svg) so it stays legible on a toolbar.
//   npm run icons
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, '..', 'public');

function render(svgPath, size, outName) {
  const svg = readFileSync(svgPath, 'utf8');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  const out = join(pub, outName);
  writeFileSync(out, png);
  console.log(`  ${outName.padEnd(14)} ${size}x${size}  ${png.length} bytes`);
}

console.log('Rendering OGrammar icons...');
render(join(pub, 'icon.svg'), 128, 'icon-128.png');
render(join(pub, 'icon.svg'), 48, 'icon-48.png');
render(join(here, 'icon-16.svg'), 16, 'icon-16.png');
console.log('Done.');
