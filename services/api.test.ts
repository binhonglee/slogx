import { describe, it, expect } from 'vitest';
import { validateWsUrl } from './api';

describe('validateWsUrl', () => {
  describe('valid URLs', () => {
    it('accepts localhost:port format', () => {
      const result = validateWsUrl('localhost:8080');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('ws://localhost:8080');
      }
    });

    it('accepts ws:// protocol', () => {
      const result = validateWsUrl('ws://example.com:8080');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('ws://example.com:8080');
      }
    });

    it('accepts wss:// protocol', () => {
      const result = validateWsUrl('wss://secure.example.com');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('wss://secure.example.com');
      }
    });

    it('converts http:// to ws://', () => {
      const result = validateWsUrl('http://example.com:8080');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('ws://example.com:8080');
      }
    });

    it('converts https:// to wss://', () => {
      const result = validateWsUrl('https://secure.example.com');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('wss://secure.example.com');
      }
    });

    it('accepts relative paths', () => {
      const result = validateWsUrl('/slogx');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('/slogx');
      }
    });

    it('accepts IP addresses', () => {
      const result = validateWsUrl('192.168.1.1:8080');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('ws://192.168.1.1:8080');
      }
    });

    it('trims whitespace', () => {
      const result = validateWsUrl('  localhost:8080  ');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('ws://localhost:8080');
      }
    });
  });

  describe('invalid URLs', () => {
    it('rejects empty string', () => {
      const result = validateWsUrl('');
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.error).toBe('URL cannot be empty');
      }
    });

    it('rejects whitespace-only string', () => {
      const result = validateWsUrl('   ');
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.error).toBe('URL cannot be empty');
      }
    });

    it('rejects URLs with internal whitespace', () => {
      const result = validateWsUrl('local host:8080');
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.error).toBe('URL cannot contain whitespace');
      }
    });

    it('rejects invalid URL format', () => {
      const result = validateWsUrl('not a valid url');
      expect(result.valid).toBe(false);
    });
  });
});
