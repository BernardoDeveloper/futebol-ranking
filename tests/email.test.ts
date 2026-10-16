import { describe, expect, it } from 'vitest';
import { loginEmail } from '../src/email';

describe('loginEmail (R1.4)', () => {
  describe('where an allowed domain is configured', () => {
    it('appends the domain to the name typed', () => {
      expect(loginEmail('bernardo.gsilva', 'acme.com')).toBe('bernardo.gsilva@acme.com');
    });

    it('keeps only the part before the @, whatever domain was typed', () => {
      expect(loginEmail('bernardo.gsilva@gmail.com', 'acme.com')).toBe('bernardo.gsilva@acme.com');
    });

    it('ignores case and surrounding spaces, in the input and the configured domain', () => {
      expect(loginEmail('  Bernardo.GSilva ', ' @ACME.com ')).toBe('bernardo.gsilva@acme.com');
    });

    it('rejects an empty or malformed name', () => {
      expect(loginEmail('', 'acme.com')).toBeNull();
      expect(loginEmail('@acme.com', 'acme.com')).toBeNull();
      expect(loginEmail('bernardo silva', 'acme.com')).toBeNull();
    });
  });

  describe('where no domain is configured', () => {
    it('accepts a full email, normalised', () => {
      expect(loginEmail(' Ana@Acme.com ')).toBe('ana@acme.com');
      expect(loginEmail('ana@acme.com', '')).toBe('ana@acme.com');
    });

    it('rejects anything that is not an email', () => {
      expect(loginEmail('bernardo.gsilva')).toBeNull();
      expect(loginEmail('ana@acme')).toBeNull();
    });
  });
});
