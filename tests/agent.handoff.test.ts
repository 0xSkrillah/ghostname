/**
 * Receiving side of the secure web handoff: strict parsing, nothing trusted
 * for the privacy result, unknown parameters ignored by name.
 */
import { describe, expect, it } from 'vitest';
import { parseHandoffParams, reauditInstruction } from '../src/agent/handoff';
import { buildHandoffUrl } from '../src/agent/auditForAgent';

const REPORT = `gcr1_${'e'.repeat(32)}`;

function paramsOf(url: string): URLSearchParams {
  return new URLSearchParams(new URL(url).hash.replace(/^#\/create\?/, ''));
}

describe('parseHandoffParams', () => {
  it('is inert for ordinary visits', () => {
    expect(parseHandoffParams(new URLSearchParams(''))).toBeNull();
    expect(parseHandoffParams(new URLSearchParams('name=x.eth&chainId=1'))).toBeNull();
  });

  it('round-trips a URL built by the agent layer', () => {
    const url = buildHandoffUrl('https://ghostname.test/', { name: 'skrillah.eth', chainId: 1, reportId: REPORT });
    const parsed = parseHandoffParams(paramsOf(url));
    expect(parsed).toEqual({
      ok: true,
      params: { source: 'agent', name: 'skrillah.eth', chainId: 1, reportId: REPORT, version: 1 },
      ignored: [],
    });
  });

  it('normalizes the name and rejects invalid names, chains and versions', () => {
    expect(parseHandoffParams(new URLSearchParams('source=agent&name=Skrillah.ETH&chainId=11155111&version=1'))).toMatchObject({
      ok: true,
      params: { name: 'skrillah.eth', chainId: 11155111 },
    });
    expect(parseHandoffParams(new URLSearchParams('source=agent&name=not%20a%20name&chainId=1&version=1'))).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/not a valid ENS name/),
    });
    expect(parseHandoffParams(new URLSearchParams('source=agent&name=x.eth&chainId=137&version=1'))).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/not supported/),
    });
    expect(parseHandoffParams(new URLSearchParams('source=agent&name=x.eth&chainId=1&version=9'))).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/version/),
    });
  });

  it('ignores an audit status, a record value or any other extra parameter by name', () => {
    const parsed = parseHandoffParams(
      new URLSearchParams(
        'source=agent&name=x.eth&chainId=1&version=1&status=private-ready&record=st:eth:0x00&spendingPrivateKey=0x01&reportId=junk',
      ),
    );
    expect(parsed).toMatchObject({ ok: true, params: { reportId: null } });
    expect(parsed && parsed.ignored.sort()).toEqual(['record', 'reportId', 'spendingPrivateKey', 'status']);
  });
});

describe('reauditInstruction', () => {
  it('tells the agent to re-audit with the prior id and status', () => {
    const text = reauditInstruction({ name: 'x.eth', chainId: 1, reportId: REPORT, priorStatus: 'incomplete' });
    expect(text).toContain('ghostname_reaudit_ens_privacy');
    expect(text).toContain(REPORT);
    expect(text).toContain('incomplete');
    expect(text).toContain('from my own wallet');
  });
});
