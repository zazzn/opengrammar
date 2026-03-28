import { RuleBasedAnalyzer } from './src/analyzer.js';
import { CORE_RULES } from './src/rules/index.js';

console.log(`\n╔══════════════════════════════════════════════════╗`);
console.log(`║  OpenGrammar Giant Engine — FINAL Test Suite       ║`);
console.log(`╠══════════════════════════════════════════════════╣`);
console.log(`║  Total Rules Loaded: ${CORE_RULES.length.toString().padStart(4)}                          ║`);
console.log(`║  Category Modules:     22                          ║`);
console.log(`╚══════════════════════════════════════════════════╝\n`);

const tests = [
  // Phase 1-2 Grammar
  { label: ' 1. SVA + Irregular Verbs', text: 'He buyed it. Everyone are happy. There is many reasons.' },
  { label: ' 2. Modal Perfect + have+pp', text: 'Should have went. Has ate lunch. Have broke it.' },
  { label: ' 3. Adj/Adv + Comparatives', text: 'She sings beautiful. This is more better. Plays good.' },
  { label: ' 4. Prepositions + Redundancy', text: 'Discuss about it. Return back. Walked in the room.' },
  // Phase 3 Style
  { label: ' 5. Confused Words', text: 'Will effect mood. Will loose keys. More taller then him.' },
  { label: ' 6. Idioms + Tautologies', text: 'Mute point. Sneak peak. ATM machine. PIN number.' },
  { label: ' 7. Nominalizations + Clichés', text: 'Make a decision. Think outside the box. Touch base.' },
  { label: ' 8. Formality + Slang', text: 'Gonna go. Lemme know btw. Lotsa stuff lol.' },
  // Phase 4 — NEW TESTS
  { label: ' 9. Academic Weasel Words', text: 'Some people say its true. Studies show it works. I think that this is correct.' },
  { label: '10. Academic Hedging', text: 'It could be argued that the results are sort of important. Obviously this matters.' },
  { label: '11. Business Email Openers', text: 'I am writing to inform you that we need to utilize this. Please advise. Per our discussion.' },
  { label: '12. Business Bloat Verbs', text: 'We must facilitate the process and commence operations. Lets ameliorate the situation.' },
  { label: '13. Inclusive: Gendered Titles', text: 'The chairman and fireman discussed manpower. The policeman saved mankind.' },
  { label: '14. Inclusive: Ableist Language', text: 'That is a lame excuse. She suffers from autism. Falling on deaf ears.' },
  { label: '15. Inclusive: Person-First', text: 'The disabled person is wheelchair bound. The elderly need help. The handicapped entrance.' },
  { label: '16. Readability: Complex Words', text: 'We must utilize approximately sufficient methodology to ameliorate the ubiquitous paradigm.' },
  { label: '17. Readability: Long Sentence', text: 'The extremely long and detailed report that was submitted by the committee on Thursday afternoon after the lengthy discussion about the project timeline and budget allocation was finally reviewed by the board of directors who decided to postpone the decision until next month.' },
  { label: '18. Business Double Negatives', text: 'It is not uncommon and not unreasonable. The results are not insignificant.' },
  { label: '19. Redundant Modifiers', text: 'Future plans and past history with a free gift. An unexpected surprise and added bonus.' },
  { label: '20. Full Combo', text: 'I personally believe that gonna make a decision and utilize the paradigm. The chairman said the childs are basicaly awesome btw.' },
];

let totalIssues = 0;
for (const test of tests) {
  console.log(`\n━━━${test.label} ━━━`);
  console.log(`  In: "${test.text.substring(0, 80)}${test.text.length > 80 ? '...' : ''}"`);
  const issues = RuleBasedAnalyzer.analyze(test.text);
  totalIssues += issues.length;
  if (issues.length === 0) {
    console.log('  ⚠ No issues found');
  } else {
    issues.slice(0, 8).forEach((issue, i) => {
      console.log(`  ${(i+1).toString().padStart(2)}. [${issue.type.padEnd(8)}] "${issue.original.substring(0, 30)}" → "${(issue.suggestion || '').substring(0, 35)}"`);
    });
    if (issues.length > 8) console.log(`  ... +${issues.length - 8} more`);
  }
}

console.log(`\n╔══════════════════════════════════════════════════╗`);
console.log(`║  ✅ ALL ${tests.length} TESTS COMPLETED                       ║`);
console.log(`║  📏 ${CORE_RULES.length.toString().padStart(4)} rules active across 22 modules          ║`);
console.log(`║  🔍 ${totalIssues.toString().padStart(4)} total issues detected                    ║`);
console.log(`║                                                    ║`);
console.log(`║  🎉 GIANT GRAMMARLY ENGINE — COMPLETE              ║`);
console.log(`╚══════════════════════════════════════════════════╝\n`);
