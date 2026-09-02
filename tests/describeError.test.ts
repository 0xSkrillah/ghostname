/**
 * Error text shown to users or written into exported reports must never carry
 * a pinned RPC URL (which may embed an API key) or anything shaped like a
 * private key, and must stay short and single-line.
 */
import { describe, expect, it } from 'vitest';
import { HttpRequestError } from 'viem';
import { describeError, redactSecrets } from '../src/lib/describeError';

const SECRET_URL = 'https://rpc.example.com/v1/sk_live_SUPERSECRET';

describe('describeError', () => {
  it('strips URLs from plain errors', () => {
    const text = describeError(new Error(`fetch failed for ${SECRET_URL} after 3 tries`));
    expect(text).not.toContain('SUPERSECRET');
    expect(text).not.toContain('https://');
    expect(text).toContain('[rpc endpoint]');
  });

  it('prefers viem shortMessage, which carries no URL or request body', () => {
    const err = new HttpRequestError({
      url: SECRET_URL,
      body: { method: 'eth_call', params: ['0x01'] },
      details: 'ECONNRESET',
    });
    // viem's full message includes the URL; the short form must not.
    expect(err.message).toContain('rpc.example.com');
    const text = describeError(err);
    expect(text).not.toContain('SUPERSECRET');
    expect(text).not.toContain('rpc.example.com');
    expect(text.length).toBeGreaterThan(0);
  });

  it('redacts 32-byte hex values that look like private keys', () => {
    const key = `0x${'ab'.repeat(32)}`;
    expect(describeError(new Error(`bad key ${key}`))).not.toContain(key);
    expect(redactSecrets(`x ${key} y`)).toContain('[redacted 32-byte value]');
  });

  it('collapses whitespace and caps length', () => {
    const long = new Error(`line one\n\nline two ${'x'.repeat(2000)}`);
    const text = describeError(long);
    expect(text).not.toContain('\n');
    expect(text.length).toBeLessThanOrEqual(320);
  });

  it('handles non-Error throwables', () => {
    expect(describeError('plain string')).toBe('plain string');
    expect(describeError({ code: -32000, url: SECRET_URL })).not.toContain('SUPERSECRET');
    expect(describeError(undefined)).toBe('Unknown error');
    expect(describeError('')).toBe('Unknown error');
  });
});
