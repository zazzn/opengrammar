import type { Issue } from '../../shared-types.js';
import { createRegexRule, type Rule } from '../types.js';

/**
 * ═══════════════════════════════════════════════════
 *  Numbers, Formatting & Idioms (NF + IE)
 *  Number rules, common idiom errors, malapropisms
 * ═══════════════════════════════════════════════════
 */
export const formattingIdiomRules: Rule[] = [
  // ═══ Numbers at Sentence Start (NF_002) ═══
  {
    id: 'NF_sentence_number',
    type: 'regex',
    category: 'style',
    pattern: /(?:^|[.!?]\s+)(\d+)\s+/g,
    reason: 'Avoid starting a sentence with a numeral. Spell it out or restructure.',
    suggestion: 'Spell out the number or restructure',
    check: (text: string): Issue[] => {
      const issues: Issue[] = [];
      const regex = /(?:^|[.!?]\s+)(\d+)\s+/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const num = match[1] || '';
        const offset = match.index + match[0].indexOf(num);
        if ((parseInt(num) > 0 && offset < 3) || text[offset - 2] === '.') {
          issues.push({
            id: `NF_sentence_number-${offset}`,
            type: 'style',
            original: num,
            suggestion: `Spell out "${num}" or restructure the sentence`,
            reason: 'Avoid starting a sentence with a numeral.',
            offset,
            length: num.length,
          });
        }
      }
      return issues;
    },
  },

  // ═══ Common Idiom Errors (IE) ═══
  createRegexRule({
    id: 'IE_intensive_purposes',
    category: 'grammar',
    pattern: /\bfor\s+all\s+intensive\s+purposes\b/i,
    suggestion: 'for all intents and purposes',
    reason: 'The correct idiom is "for all intents and purposes".',
  }),
  createRegexRule({
    id: 'IE_nip_butt',
    category: 'grammar',
    pattern: /\bnip\s+it\s+in\s+the\s+butt\b/i,
    suggestion: 'nip it in the bud',
    reason: 'The correct idiom is "nip it in the bud" (stop early, like a flower bud).',
  }),
  createRegexRule({
    id: 'IE_case_and_point',
    category: 'grammar',
    pattern: /\bcase\s+and\s+point\b/i,
    suggestion: 'case in point',
    reason: 'The correct idiom is "case in point".',
  }),
  createRegexRule({
    id: 'IE_i_could_care',
    category: 'grammar',
    pattern: /\bI\s+could\s+care\s+less\b/i,
    suggestion: "I couldn't care less",
    reason: 'The correct idiom is "I couldn\'t care less" (meaning you care zero).',
  }),
  createRegexRule({
    id: 'IE_one_in_the_same',
    category: 'grammar',
    pattern: /\bone\s+in\s+the\s+same\b/i,
    suggestion: 'one and the same',
    reason: 'The correct idiom is "one and the same".',
  }),
  createRegexRule({
    id: 'IE_statue_limitations',
    category: 'grammar',
    pattern: /\bstatue\s+of\s+limitations\b/i,
    suggestion: 'statute of limitations',
    reason: 'The correct term is "statute of limitations" (statute = law).',
  }),
  createRegexRule({
    id: 'IE_extract_revenge',
    category: 'grammar',
    pattern: /\bextract\s+revenge\b/i,
    suggestion: 'exact revenge',
    reason: 'The correct idiom is "exact revenge" (exact = to inflict).',
  }),
  createRegexRule({
    id: 'IE_beckon_call',
    category: 'grammar',
    pattern: /\bbeckon\s+call\b/i,
    suggestion: 'beck and call',
    reason: 'The correct idiom is "beck and call" (beck = a gesture of summoning).',
  }),
  createRegexRule({
    id: 'IE_piece_of_mind',
    category: 'grammar',
    pattern: /\bgive\s+(him|her|you|them|me|us)\s+a\s+piece\s+of\s+mind\b/i,
    suggestion: (m) => `give ${m[1]} a piece of my mind`,
    reason: 'The correct idiom is "give [someone] a piece of my mind" (express anger).',
  }),
  createRegexRule({
    id: 'IE_peace_of_mind',
    category: 'grammar',
    pattern: /\bpeice\s+of\s+mind\b/i,
    suggestion: 'peace of mind',
    reason:
      '"Peice" is misspelled. Did you mean "peace of mind" (calm) or "piece of my mind" (anger)?',
  }),
  createRegexRule({
    id: 'IE_deep_seeded',
    category: 'grammar',
    pattern: /\bdeep[\s-]+seeded\b/i,
    suggestion: 'deep-seated',
    reason: 'The correct form is "deep-seated" (deeply established), not "deep-seeded".',
  }),
  createRegexRule({
    id: 'IE_sneak_peak',
    category: 'grammar',
    pattern: /\bsneak\s+peak\b/i,
    suggestion: 'sneak peek',
    reason:
      'The correct form is "sneak peek" (peek = a look), not "sneak peak" (peak = a mountain).',
  }),
  createRegexRule({
    id: 'IE_bated_breath',
    category: 'grammar',
    pattern: /\bbaited\s+breath\b/i,
    suggestion: 'bated breath',
    reason: 'The correct form is "bated breath" (bated = restrained), not "baited".',
  }),
  createRegexRule({
    id: 'IE_wet_appetite',
    category: 'grammar',
    pattern: /\bwet\s+(your|my|his|her|their|our|the)\s+appetite\b/i,
    suggestion: (m) => `whet ${m[1]} appetite`,
    reason: 'The correct form is "whet your appetite" (whet = sharpen/stimulate).',
  }),
  createRegexRule({
    id: 'IE_tow_line',
    category: 'grammar',
    pattern: /\btow\s+the\s+line\b/i,
    suggestion: 'toe the line',
    reason: 'The correct idiom is "toe the line" (comply with rules).',
  }),
  createRegexRule({
    id: 'IE_mute_point',
    category: 'grammar',
    pattern: /\bmute\s+point\b/i,
    suggestion: 'moot point',
    reason: 'The correct form is "moot point" (moot = debatable/irrelevant).',
  }),
  createRegexRule({
    id: 'IE_chock_full',
    category: 'grammar',
    pattern: /\bchalk\s+full\b/i,
    suggestion: 'chock-full',
    reason: 'The correct form is "chock-full" (completely full).',
  }),
  createRegexRule({
    id: 'IE_right_of_passage',
    category: 'grammar',
    pattern: /\bright\s+of\s+passage\b/i,
    suggestion: 'rite of passage',
    reason: 'The correct form is "rite of passage" (rite = ceremony).',
  }),
  createRegexRule({
    id: 'IE_use_to',
    category: 'grammar',
    pattern:
      /\buse\s+to\s+(be|go|have|do|live|work|play|eat|drink|say|think|know|come|get|make|take|like|want|love|see|hear|feel|run|walk)\b/i,
    suggestion: (m) => `used to ${m[1]}`,
    reason: 'The correct form is "used to" (past habit), not "use to".',
  }),
  createRegexRule({
    id: 'IE_suppose_to',
    category: 'grammar',
    pattern: /\bsuppose\s+to\b/i,
    suggestion: 'supposed to',
    reason: 'The correct form is "supposed to", not "suppose to".',
  }),
  createRegexRule({
    id: 'IE_would_of',
    category: 'grammar',
    pattern: /\b(would|could|should|might|must)\s+of\b/i,
    suggestion: (m) => `${m[1]} have`,
    reason: '"Would of" is a mishearing. The correct form is "would have".',
  }),
  createRegexRule({
    id: 'IE_irregardless',
    category: 'grammar',
    pattern: /\birregardless\b/i,
    suggestion: 'regardless',
    reason: '"Irregardless" is nonstandard. Use "regardless".',
  }),
  createRegexRule({
    id: 'IE_alright',
    category: 'style',
    pattern: /\balright\b/i,
    suggestion: 'all right',
    reason: '"Alright" is informal. Standard English prefers "all right" (two words).',
  }),
  createRegexRule({
    id: 'IE_conversate',
    category: 'grammar',
    pattern: /\bconversate\b/i,
    suggestion: 'converse',
    reason: '"Conversate" is nonstandard. The correct verb is "converse".',
  }),
  createRegexRule({
    id: 'IE_orientate',
    category: 'grammar',
    pattern: /\borientate\b/i,
    suggestion: 'orient',
    reason: '"Orientate" is a back-formation. The standard form is "orient".',
  }),
  createRegexRule({
    id: 'IE_preventative',
    category: 'style',
    pattern: /\bpreventative\b/i,
    suggestion: 'preventive',
    reason: '"Preventative" is accepted but "preventive" is preferred in formal writing.',
  }),
  createRegexRule({
    id: 'IE_firstly',
    category: 'style',
    pattern: /\bfirstly\b/i,
    suggestion: 'first',
    reason: '"Firstly" is acceptable but "first" is preferred in modern English.',
  }),
  createRegexRule({
    id: 'IE_secondly',
    category: 'style',
    pattern: /\bsecondly\b/i,
    suggestion: 'second',
    reason: '"Secondly" is acceptable but "second" is preferred.',
  }),
  createRegexRule({
    id: 'IE_thirdly',
    category: 'style',
    pattern: /\bthirdly\b/i,
    suggestion: 'third',
    reason: '"Thirdly" is acceptable but "third" is preferred.',
  }),

  // ═══ Tautologies (saying the same thing twice) ═══
  createRegexRule({
    id: 'IE_ATM_machine',
    category: 'clarity',
    pattern: /\bATM\s+machine\b/i,
    suggestion: 'ATM',
    reason:
      '"ATM" already stands for "Automated Teller Machine". Saying "ATM machine" is redundant.',
  }),
  createRegexRule({
    id: 'IE_PIN_number',
    category: 'clarity',
    pattern: /\bPIN\s+number\b/i,
    suggestion: 'PIN',
    reason:
      '"PIN" already stands for "Personal Identification Number". Saying "PIN number" is redundant.',
  }),
  createRegexRule({
    id: 'IE_HIV_virus',
    category: 'clarity',
    pattern: /\bHIV\s+virus\b/i,
    suggestion: 'HIV',
    reason: '"HIV" already contains "virus". Saying "HIV virus" is redundant.',
  }),
  createRegexRule({
    id: 'IE_LCD_display',
    category: 'clarity',
    pattern: /\bLCD\s+display\b/i,
    suggestion: 'LCD',
    reason: '"LCD" already contains "display". Saying "LCD display" is redundant.',
  }),
  createRegexRule({
    id: 'IE_GPS_system',
    category: 'clarity',
    pattern: /\bGPS\s+system\b/i,
    suggestion: 'GPS',
    reason: '"GPS" already contains "system". Saying "GPS system" is redundant.',
  }),
  createRegexRule({
    id: 'IE_PDF_format',
    category: 'clarity',
    pattern: /\bPDF\s+format\b/i,
    suggestion: 'PDF',
    reason: '"PDF" already contains "format". Saying "PDF format" is redundant.',
  }),
  createRegexRule({
    id: 'IE_SAT_test',
    category: 'clarity',
    pattern: /\bSAT\s+test\b/i,
    suggestion: 'SAT',
    reason: '"SAT" already contains "test". Saying "SAT test" is redundant.',
  }),
  createRegexRule({
    id: 'IE_VIN_number',
    category: 'clarity',
    pattern: /\bVIN\s+number\b/i,
    suggestion: 'VIN',
    reason: '"VIN" already contains "number". Saying "VIN number" is redundant.',
  }),
  createRegexRule({
    id: 'IE_ISBN_number',
    category: 'clarity',
    pattern: /\bISBN\s+number\b/i,
    suggestion: 'ISBN',
    reason: '"ISBN" already contains "number". Saying "ISBN number" is redundant.',
  }),
  createRegexRule({
    id: 'IE_UPC_code',
    category: 'clarity',
    pattern: /\bUPC\s+code\b/i,
    suggestion: 'UPC',
    reason: '"UPC" already contains "code". Saying "UPC code" is redundant.',
  }),
];
