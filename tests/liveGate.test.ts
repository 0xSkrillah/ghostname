/**
 * A plain `npm test` must never spend testnet ETH. The two write suites are
 * gated on RUN_LIVE=1 in addition to the key, and the npm scripts set it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('live write suites require an explicit opt-in', () => {
  it('gate on RUN_LIVE=1 as well as SEPOLIA_PRIVATE_KEY', () => {
    for (const file of ['tests/live.sepolia.test.ts', 'tests/live.sweep.test.ts']) {
      const source = readFileSync(file, 'utf8');
      expect(source).toMatch(/const live = process\.env\.RUN_LIVE === '1' && !!PRIVATE_KEY;/);
    }
  });

  it('npm scripts that intend writes set RUN_LIVE=1 explicitly', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['e2e:sepolia']).toMatch(/^RUN_LIVE=1 /);
    expect(pkg.scripts['sweep:sepolia']).toMatch(/^RUN_LIVE=1 /);
    expect(pkg.scripts['test']).not.toMatch(/RUN_LIVE/);
  });

  it('the identity file is written owner-only by the live suite', () => {
    const source = readFileSync('tests/live.sepolia.test.ts', 'utf8');
    expect(source).toContain("{ mode: 0o600 }");
    expect(source).toContain('mode: 0o700');
  });
});
