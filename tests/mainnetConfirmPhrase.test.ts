import { describe, expect, it } from 'vitest';
import { MAINNET_CONFIRM_PHRASE, isMainnetConfirmationPhrase } from '../src/components/MainnetConfirm';

describe('mainnet confirmation phrase', () => {
  it('matches only the exact phrase, ignoring surrounding whitespace', () => {
    expect(isMainnetConfirmationPhrase(MAINNET_CONFIRM_PHRASE)).toBe(true);
    expect(isMainnetConfirmationPhrase(`  ${MAINNET_CONFIRM_PHRASE}\n`)).toBe(true);
    expect(isMainnetConfirmationPhrase(MAINNET_CONFIRM_PHRASE.toLowerCase())).toBe(false);
    expect(isMainnetConfirmationPhrase('SEND ON MAINNET!')).toBe(false);
    expect(isMainnetConfirmationPhrase('')).toBe(false);
  });
});
