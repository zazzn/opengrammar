import nlp from 'compromise';

export class NLPEngine {
  /**
   * Parses the text into an NLP document to analyze parts of speech, syntax, and sentence structure.
   */
  static parse(text: string) {
    return nlp(text);
  }

  /**
   * Helper to find specific parts of speech patterns in the parsed text.
   * Uses compromise's match syntax (e.g., '#Verb #Adjective')
   */
  static findPattern(text: string, pattern: string) {
    const doc = this.parse(text);
    return doc.match(pattern);
  }
}
