/**
 * The production bundle must carry a restrictive Content-Security-Policy, and
 * the policy must never loosen to eval, inline scripts or arbitrary script
 * origins.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CSP_DIRECTIVES, CSP_POLICY, cspMetaTag } from '../src/security/csp';

describe('Content-Security-Policy', () => {
  it('locks scripts to self with no inline or eval', () => {
    expect(CSP_DIRECTIVES['script-src']).toBe("'self'");
    expect(CSP_POLICY).not.toMatch(/unsafe-eval/);
    expect(CSP_POLICY).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(CSP_POLICY).not.toMatch(/script-src[^;]*\*/);
  });

  it('forbids plugins, base hijacking and form submission', () => {
    expect(CSP_DIRECTIVES['object-src']).toBe("'none'");
    expect(CSP_DIRECTIVES['base-uri']).toBe("'self'");
    expect(CSP_DIRECTIVES['form-action']).toBe("'none'");
    expect(CSP_DIRECTIVES['default-src']).toBe("'self'");
  });

  it('allows only https connections (RPC, Mobula), no plain http', () => {
    expect(CSP_DIRECTIVES['connect-src']).toBe('https:');
    expect(CSP_POLICY).toContain('upgrade-insecure-requests');
  });

  it('renders as a single meta tag', () => {
    const tag = cspMetaTag();
    expect(tag.startsWith('<meta http-equiv="Content-Security-Policy"')).toBe(true);
    expect(tag).toContain(CSP_POLICY);
  });

  it('is present in the production index.html when a build exists', () => {
    const built = 'dist/index.html';
    if (!existsSync(built)) return; // built artefact is optional in unit runs
    const html = readFileSync(built, 'utf8');
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain("script-src 'self'");
    expect(html).not.toMatch(/<script[^>]*>[^<]+<\/script>/); // no inline scripts
  });
});
