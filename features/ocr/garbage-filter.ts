import { findLexiconMatch } from '@/data/ingredients-lexicon';

/**
 * OCR Garbage Text Filter & Validator
 *
 * Prevents nonsensical OCR artifacts (e.g., "XD", "ngodies'", "H rb MAG msl", "!@#$%",
 * random punctuation or isolated consonants) from polluting ingredient or product fields.
 */

export interface TextQualityAssessment {
  isValid: boolean;
  score: number; // 0 to 1
  reason?: string;
  cleanText: string;
}

const COMMON_GARBAGE_PATTERNS = [
  /^[A-Z]{1,2}$/i, // Single or two random letters like "XD"
  /^[^a-zA-Z0-9]+$/, // Only symbols
  /[~`@#$%^&*_=+[\]{}|<>]{3,}/, // Symbol mash
];

export function isLikelyGarbageText(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 3) return true;

  // Direct regex garbage check
  for (const pattern of COMMON_GARBAGE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  // Count letters, numbers, punctuation, spaces
  const lettersOnly = trimmed.replace(/[^a-zA-Z]/g, '');
  if (lettersOnly.length === 0) return true;

  const letterRatio = lettersOnly.length / trimmed.length;
  // If more than 50% is weird symbols
  if (letterRatio < 0.45 && trimmed.length > 5) return true;

  // Check vowel ratio in alphabet portions
  const vowels = lettersOnly.match(/[aeiouyAEIOUY]/g) || [];
  const vowelRatio = vowels.length / lettersOnly.length;
  // English/Latin text usually has vowel ratio between 25% and 60%
  if (lettersOnly.length >= 6 && (vowelRatio < 0.15 || vowelRatio > 0.85)) {
    return true;
  }

  // Check average word length and valid token count
  const words = trimmed.split(/[\s,;.-]+/).filter((w) => w.length > 0);
  if (words.length === 0) return true;

  let recognizedOrPlausibleWords = 0;
  for (const w of words) {
    // If word contains at least 1 vowel and reasonable length
    if (w.length >= 2 && /[aeiouy]/i.test(w)) {
      recognizedOrPlausibleWords++;
    }
  }

  const plausibleWordRatio = recognizedOrPlausibleWords / words.length;
  if (words.length >= 3 && plausibleWordRatio < 0.4) {
    return true;
  }

  return false;
}

export function evaluateIngredientTextQuality(raw: string): TextQualityAssessment {
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      isValid: false,
      score: 0,
      reason: 'Empty text',
      cleanText: '',
    };
  }

  if (trimmed.length < 5 || isLikelyGarbageText(trimmed)) {
    return {
      isValid: false,
      score: 0.1,
      reason: 'Text does not match food ingredient formatting (unreadable or noisy OCR)',
      cleanText: '',
    };
  }

  // Check how many items match food lexicon or common words
  const segments = trimmed
    .split(/[,;\n•·]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

  if (segments.length === 0) {
    return {
      isValid: false,
      score: 0.2,
      reason: 'No separable ingredients identified',
      cleanText: '',
    };
  }

  let matchedInLexicon = 0;
  let plausibleItems = 0;

  for (const segment of segments) {
    const lex = findLexiconMatch(segment);
    if (lex) {
      matchedInLexicon++;
      plausibleItems++;
    } else if (!isLikelyGarbageText(segment) && /[aeiouy]/i.test(segment)) {
      plausibleItems++;
    }
  }

  const score = (plausibleItems / segments.length) * 0.7 + (matchedInLexicon > 0 ? 0.3 : 0);

  if (score < 0.35 && segments.length <= 4) {
    return {
      isValid: false,
      score,
      reason: 'OCR confidence too low to construct reliable ingredient list',
      cleanText: '',
    };
  }

  return {
    isValid: true,
    score: Math.min(1, score),
    cleanText: trimmed,
  };
}
