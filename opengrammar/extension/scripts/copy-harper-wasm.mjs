// Copies Harper's WASM into public/wasm/ so CRXJS/Vite ships it verbatim and
// chrome.runtime.getURL('wasm/harper_wasm_bg.wasm') resolves at runtime.
// Runs on predev/prebuild. The 17MB binary is gitignored (regenerated here).
import { existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const src = join(root, 'node_modules/harper.js/dist/harper_wasm_bg.wasm');
const destDir = join(root, 'public/wasm');
const dest = join(destDir, 'harper_wasm_bg.wasm');

if (!existsSync(src)) {
  console.error('[copy-harper-wasm] harper.js wasm not found — run `npm install` first:', src);
  process.exit(1);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-harper-wasm] ${(statSync(dest).size / 1048576).toFixed(1)} MiB -> public/wasm/harper_wasm_bg.wasm`);
