import nlp from 'compromise';

/**
 * Parses the text into an NLP document to analyze parts of speech, syntax, and sentence structure.
 */
export function parseNLP(text: string) {
  return nlp(text);
}

/**
 * Helper to find specific parts of speech patterns in the parsed text.
 * Uses compromise's match syntax (e.g., '#Verb #Adjective')
 */
export function findNLPPattern(text: string, pattern: string) {
  const doc = parseNLP(text);
  return doc.match(pattern);
}
