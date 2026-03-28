export interface WritingStats {
  // Basic counts
  characterCount: number;
  characterCountNoSpaces: number;
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  syllableCount: number;
  
  // Readability scores
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  automatedReadabilityIndex: number;
  
  // Vocabulary metrics
  uniqueWords: number;
  vocabularyDiversity: number;
  averageWordLength: number;
  averageSentenceLength: number;
  
  // Time estimates
  readingTimeSeconds: number;
  speakingTimeSeconds: number;
  
  // Issue breakdown
  grammarIssues: number;
  spellingIssues: number;
  clarityIssues: number;
  styleIssues: number;
  
  // Historical data (optional)
  sessionWordCount?: number;
  dailyAverage?: number;
}

export function calculateWritingStats(text: string, issues?: any[]): WritingStats {
  // Basic counts
  const characterCount = text.length;
  const characterCountNoSpaces = text.replace(/\s/g, '').length;
  
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length || 1;
  
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const paragraphCount = paragraphs.length || 1;
  
  const syllableCount = countSyllables(text);
  
  // Readability scores
  const fleschReadingEase = calculateFleschReadingEase(wordCount, sentenceCount, syllableCount);
  const fleschKincaidGrade = calculateFleschKincaidGrade(wordCount, sentenceCount, syllableCount);
  const automatedReadabilityIndex = calculateARI(characterCount, wordCount, sentenceCount);
  
  // Vocabulary metrics
  const uniqueWordsSet = new Set(words.map(w => w.toLowerCase()));
  const uniqueWords = uniqueWordsSet.size;
  const vocabularyDiversity = wordCount > 0 ? (uniqueWords / wordCount) * 100 : 0;
  const averageWordLength = wordCount > 0 ? words.reduce((acc, w) => acc + w.length, 0) / wordCount : 0;
  const averageSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  
  // Time estimates (average: 200 wpm reading, 150 wpm speaking)
  const readingTimeSeconds = Math.ceil((wordCount / 200) * 60);
  const speakingTimeSeconds = Math.ceil((wordCount / 150) * 60);
  
  // Issue breakdown
  const issueCounts = {
    grammarIssues: 0,
    spellingIssues: 0,
    clarityIssues: 0,
    styleIssues: 0,
  };
  
  if (issues) {
    issues.forEach((issue: any) => {
      if (issue.type === 'grammar') issueCounts.grammarIssues++;
      else if (issue.type === 'spelling') issueCounts.spellingIssues++;
      else if (issue.type === 'clarity') issueCounts.clarityIssues++;
      else if (issue.type === 'style') issueCounts.styleIssues++;
    });
  }
  
  return {
    characterCount,
    characterCountNoSpaces,
    wordCount,
    sentenceCount,
    paragraphCount,
    syllableCount,
    fleschReadingEase,
    fleschKincaidGrade,
    automatedReadabilityIndex,
    uniqueWords,
    vocabularyDiversity,
    averageWordLength,
    averageSentenceLength,
    readingTimeSeconds,
    speakingTimeSeconds,
    ...issueCounts,
  };
}

function countSyllables(text: string): number {
  let count = 0;
  const words = text.toLowerCase().split(/\s+/);
  
  for (const word of words) {
    if (word.length <= 3) {
      count += 1;
      continue;
    }
    
    // Count vowel groups
    const vowelGroups = word.match(/[aeiouy]+/g);
    if (vowelGroups) {
      count += vowelGroups.length;
    }
    
    // Adjust for silent e
    if (word.endsWith('e') && !word.endsWith('le')) {
      count -= 1;
    }
    
    // Minimum 1 syllable per word
    count = Math.max(1, count);
  }
  
  return count;
}

function calculateFleschReadingEase(words: number, sentences: number, syllables: number): number {
  if (words === 0 || sentences === 0) return 0;
  const score = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words));
  return Math.round(score * 10) / 10;
}

function calculateFleschKincaidGrade(words: number, sentences: number, syllables: number): number {
  if (words === 0 || sentences === 0) return 0;
  const score = (0.39 * (words / sentences)) + (11.8 * (syllables / words)) - 15.59;
  return Math.round(score * 10) / 10;
}

function calculateARI(characters: number, words: number, sentences: number): number {
  if (words === 0 || sentences === 0) return 0;
  const score = 4.71 * (characters / words) + 0.5 * (words / sentences) - 21.43;
  return Math.round(score * 10) / 10;
}

export function getReadabilityLevel(score: number): string {
  if (score >= 90) return 'Very Easy (5th grade)';
  if (score >= 80) return 'Easy (6th grade)';
  if (score >= 70) return 'Fairly Easy (7th grade)';
  if (score >= 60) return 'Standard (8th-9th grade)';
  if (score >= 50) return 'Fairly Difficult (10th-12th grade)';
  if (score >= 30) return 'Difficult (College)';
  return 'Very Difficult (College Graduate+)';
}

/**
 * D3: Composite Writing Score (0 – 100)
 *
 * Scored on four pillars, inspired by the Grammarly circle:
 *  - Correctness (0–40): fewer issues → higher score
 *  - Readability (0–30): Flesch Reading Ease mapped to [0,30]
 *  - Engagement  (0–15): vocabulary diversity
 *  - Delivery    (0–15): sentence-length variation
 */
export interface WritingScoreBreakdown {
  overall: number;
  correctness: number;   // 0-40
  readability: number;   // 0-30
  engagement: number;    // 0-15
  delivery: number;      // 0-15
  label: string;
  color: string;
}

export function calculateWritingScore(stats: WritingStats): WritingScoreBreakdown {
  const totalIssues = stats.grammarIssues + stats.spellingIssues + stats.clarityIssues + stats.styleIssues;

  // 1. Correctness (40 pts)
  //    0 issues → 40, 1 issue per 20 words → 0
  const issuesPerHundred = stats.wordCount > 0 ? (totalIssues / stats.wordCount) * 100 : 0;
  const correctness = Math.round(Math.max(0, Math.min(40, 40 - (issuesPerHundred * 8))));

  // 2. Readability (30 pts)
  //    Flesch score 0-100 mapped to 0-30 (sweet spot: 60-80 = full marks)
  let readability: number;
  if (stats.fleschReadingEase >= 60 && stats.fleschReadingEase <= 80) {
    readability = 30; // sweet spot for general writing
  } else if (stats.fleschReadingEase > 80) {
    readability = Math.round(30 - ((stats.fleschReadingEase - 80) / 20) * 10); // too simple
  } else {
    readability = Math.round(Math.max(0, (stats.fleschReadingEase / 60) * 30)); // too complex
  }
  readability = Math.max(0, Math.min(30, readability));

  // 3. Engagement (15 pts)
  //    Vocabulary diversity: unique/total words ratio [0.3-0.8 is good]
  let engagement: number;
  if (stats.wordCount < 10) {
    engagement = 10; // not enough data, give benefit of the doubt
  } else {
    const diversity = stats.vocabularyDiversity / 100; // 0-1
    if (diversity >= 0.4 && diversity <= 0.75) {
      engagement = 15; // sweet spot
    } else if (diversity > 0.75) {
      engagement = 12; // very diverse but may be scattered
    } else {
      engagement = Math.round(Math.max(0, (diversity / 0.4) * 15));
    }
  }
  engagement = Math.max(0, Math.min(15, engagement));

  // 4. Delivery (15 pts)
  //    Sentence length variation (std dev of sentence lengths)
  let delivery: number;
  if (stats.sentenceCount < 3) {
    delivery = 10; // not enough data
  } else {
    // Good writing has varied sentence lengths (avg 12-20 words, std dev 5-10)
    const avgLen = stats.averageSentenceLength;
    const lenScore = avgLen >= 10 && avgLen <= 22 ? 8 : Math.max(0, 8 - Math.abs(avgLen - 16) * 0.5);
    // Bonus for having more than 1 sentence (shows structure)
    const structureBonus = Math.min(7, stats.sentenceCount);
    delivery = Math.round(lenScore + structureBonus);
  }
  delivery = Math.max(0, Math.min(15, delivery));

  const overall = correctness + readability + engagement + delivery;

  return {
    overall,
    correctness,
    readability,
    engagement,
    delivery,
    label: getScoreLabel(overall),
    color: getScoreColor(overall),
  };
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Great';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Needs Work';
  return 'Poor';
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#16A34A'; // green
  if (score >= 60) return '#F59E0B'; // amber
  if (score >= 40) return '#EA580C'; // orange
  return '#DC2626'; // red
}

