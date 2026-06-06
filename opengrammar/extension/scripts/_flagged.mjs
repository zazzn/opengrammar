// Reads fp-harness.mjs JSON from stdin, prints only texts that produced issues
// (i.e. what the user would actually see) — used to hunt residual false positives.
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(0, 'utf8'));
console.log('SUMMARY ' + JSON.stringify(d.summary));
for (const r of d.results) {
  if (r.issues && r.issues.length) {
    const issues = r.issues.map((x) => `${x.original}->${x.suggestion} [${x.route}/${x.type}]`).join('  |  ');
    console.log('FLAG: ' + JSON.stringify(r.text));
    console.log('      ' + issues);
    if (r.expect) console.log('      expect: ' + JSON.stringify(r.expect));
  }
}
