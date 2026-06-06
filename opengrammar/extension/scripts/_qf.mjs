// Reads fp-harness.mjs JSON from stdin, prints only issues on the DESTRUCTIVE
// quick-fix route — those on an `expect:"clean"` text are residual false positives.
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(0, 'utf8'));
for (const r of d.results) {
  const qf = (r.issues || []).filter((x) => x.route === 'quick-fix');
  if (qf.length) {
    const tag = r.expect === 'clean' ? ' <<< FP' : '';
    for (const x of qf) {
      console.log(`QF[${r.expect || '?'}] ${x.original}->${x.suggestion} (${x.type})${tag}  ::  ${JSON.stringify(r.text).slice(0, 70)}`);
    }
  }
}
