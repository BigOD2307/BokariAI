/**
 * @module discover/language.test
 * @description Tests for the language detector.
 *
 * Strategy: small, fast unit tests covering each supported language
 * and the "unknown" fallback.  No network, no I/O.
 */
import { describe, it, expect } from 'vitest';
import { detectLanguage } from '@/lib/discover/language';

describe('detectLanguage', () => {
  describe('French', () => {
    it('detects French from common stopwords', () => {
      expect(detectLanguage('Le président du Sénégal a visité le Mali aujourd\'hui.')).toBe('fr');
    });

    it('detects French from accent-heavy text', () => {
      expect(detectLanguage('La Côte d\'Ivoire a organisé une élection présidentielle.')).toBe('fr');
    });
  });

  describe('English', () => {
    it('detects English from common stopwords', () => {
      expect(detectLanguage('The president of Kenya visited Tanzania this morning.')).toBe('en');
    });

    it('detects English even with African names', () => {
      expect(detectLanguage('Lagos-based startup raises $10M from Silicon Valley investors.')).toBe('en');
    });
  });

  describe('Bambara (bm)', () => {
    it('detects Bambara from common words', () => {
      // "I ni ce" = "good morning", "ka kɛnɛ" = "how are you", "n ye" = "I am"
      expect(detectLanguage('I ni ce, ka kɛnɛ? N ye Moussa ye, Bamako.')).toBe('bm');
    });

    it('detects Bambara from "n ye"', () => {
      expect(detectLanguage('N\'yɛ dɔrɔmɛ kɔnɔ.')).toBe('bm');
    });
  });

  describe('Wolof (wo)', () => {
    it('detects Wolof from common greetings', () => {
      // "Nanga def" = "how are you", "dëgg dëgg" = "truly"
      expect(detectLanguage('Nanga def? Maa ngi dem Dakar.')).toBe('wo');
    });
  });

  describe('Hausa (ha)', () => {
    it('detects Hausa from common words', () => {
      // "Sannu" = hello, "yaya" = how, "Kai" = you
      expect(detectLanguage('Sannu, yaya kai? Ina Kano.')).toBe('ha');
    });
  });

  describe('Swahili (sw)', () => {
    it('detects Swahili from common words', () => {
      // "Habari" = news/hello, "yako" = your, "nairobi" = city
      expect(detectLanguage('Habari yako? Ninatoka Nairobi, Kenya.')).toBe('sw');
    });
  });

  describe('Fallback', () => {
    it('returns "other" for empty input', () => {
      expect(detectLanguage('')).toBe('other');
    });

    it('returns "other" for whitespace only', () => {
      expect(detectLanguage('   \n\t  ')).toBe('other');
    });

    it('returns "other" for unrecognized text', () => {
      // mix of currency symbols and numbers
      expect(detectLanguage('$$$$ 1234 5678')).toBe('other');
    });

    it('returns "other" for very short input', () => {
      // Less than 3 chars shouldn't be classified confidently
      expect(detectLanguage('hi')).toBe('other');
    });
  });
});
