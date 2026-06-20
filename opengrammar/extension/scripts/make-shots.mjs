// Generate 1280x800 Chrome Web Store screenshots from the real popup UI.
//   npm run shots   -> writes store-screenshots/shot-1..3.png
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'store-screenshots');
mkdirSync(out, { recursive: true });

const F = 'DejaVu Sans, Arial, Helvetica, sans-serif';

// The product popup, drawn faithfully in the new green identity.
function card(x, y) {
  return `
  <g transform="translate(${x},${y})">
    <rect width="408" height="372" rx="20" fill="#FBFCFB" stroke="#DDE2DD" stroke-width="1"/>
    <g transform="translate(26,28)">
      <rect width="32" height="32" rx="8" fill="#16191D"/>
      <circle cx="16" cy="13" r="7" fill="none" stroke="#F4F6F4" stroke-width="2.9"/>
      <path d="M7.5 23.3 q1.7 -2.8 3.5 0 t3.5 0 t3.5 0 t3.5 0" fill="none" stroke="#34C77F" stroke-width="2.1" stroke-linecap="round"/>
      <text x="46" y="22" font-family="${F}" font-size="18" font-weight="600" fill="#16191D">OGrammar</text>
    </g>
    <g transform="translate(26,82)">
      <circle cx="27" cy="27" r="23" fill="none" stroke="#DDE2DD" stroke-width="5"/>
      <circle cx="27" cy="27" r="23" fill="none" stroke="#1FA463" stroke-width="5" stroke-linecap="round" stroke-dasharray="127 145" transform="rotate(-90 27 27)"/>
      <text x="27" y="33" text-anchor="middle" font-family="${F}" font-size="17" font-weight="600" fill="#127A48">88</text>
      <text x="70" y="22" font-family="${F}" font-size="16" font-weight="600" fill="#16191D">Looking good</text>
      <text x="70" y="44" font-family="${F}" font-size="13" fill="#6B7178">Writing score</text>
    </g>
    <g transform="translate(28,158)" font-family="${F}" font-size="13.5" fill="#474D54">
      <circle cx="6" cy="-4" r="5" fill="#D1495B"/><text x="18" y="0">2 grammar</text>
      <circle cx="124" cy="-4" r="5" fill="#3D7DCA"/><text x="136" y="0">3 style</text>
      <circle cx="218" cy="-4" r="5" fill="#C7821A"/><text x="230" y="0">1 clarity</text>
    </g>
    <rect x="26" y="180" width="356" height="42" rx="10" fill="#1FA463"/>
    <text x="204" y="206" text-anchor="middle" font-family="${F}" font-size="15" font-weight="600" fill="#FFFFFF">Fix all 6</text>
    <rect x="26" y="238" width="356" height="50" rx="10" fill="#F2F4F2"/>
    <text x="44" y="261" font-family="${F}" font-size="13.5" font-weight="600" fill="#16191D">AI engine</text>
    <text x="44" y="280" font-family="${F}" font-size="12.5" fill="#6B7178">Local (Ollama) - nothing leaves your device</text>
    <rect x="26" y="304" width="9" height="9" rx="2.5" fill="#1FA463"/>
    <text x="44" y="313" font-family="${F}" font-size="13" fill="#127A48">Runs on your machine. Nothing leaves it.</text>
  </g>`;
}

function logo(x, y, s = 1) {
  return `<g transform="translate(${x},${y}) scale(${s})">
    <circle cx="20" cy="16" r="14" fill="none" stroke="#F4F6F4" stroke-width="5.5"/>
    <path d="M2 48 q9 -14 18 0 t18 0" fill="none" stroke="#34C77F" stroke-width="5.5" stroke-linecap="round"/>
  </g>`;
}

function shot(lines, sub) {
  return `<svg width="1280" height="800" viewBox="0 0 1280 800" xmlns="http://www.w3.org/2000/svg">
    <rect width="1280" height="800" fill="#0F1215"/>
    <rect x="0" y="0" width="1280" height="6" fill="#1FA463"/>
    ${logo(80, 70, 0.92)}
    <text x="146" y="104" font-family="${F}" font-size="26" font-weight="600" fill="#F4F6F4">OGrammar</text>
    <text x="80" y="312" font-family="${F}" font-size="37" font-weight="700" fill="#F4F6F4">${lines[0]}</text>
    <text x="80" y="362" font-family="${F}" font-size="37" font-weight="700" fill="#F4F6F4">${lines[1]}</text>
    <text x="82" y="420" font-family="${F}" font-size="18" fill="#B6BDBE">${sub[0]}</text>
    <text x="82" y="446" font-family="${F}" font-size="18" fill="#B6BDBE">${sub[1]}</text>
    ${card(792, 214)}
  </svg>`;
}

const shots = [
  shot(['Private grammar, spelling,', 'and style. Everywhere you type.'],
       ['On-device checking in any text field,', 'on any site. No account, no tracking.']),
  shot(['Bring your own AI,', 'or run it 100% local.'],
       ['Advanced rewrites with your own key:', 'OpenAI, Groq, or a local Ollama model.']),
  shot(['Your words never', 'leave your machine.'],
       ['There are no servers. Open source,', 'Apache-2.0. Privacy by design.']),
];

shots.forEach((svg, i) => {
  const png = new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng();
  const p = join(out, `shot-${i + 1}.png`);
  writeFileSync(p, png);
  console.log(`  shot-${i + 1}.png  ${png.length} bytes`);
});
console.log('done');
