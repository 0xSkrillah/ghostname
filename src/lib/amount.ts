/**
 * Strict ETH amount parsing for user input. Rejects empty, non-numeric, zero
 * and negative amounts with messages a user can act on, instead of letting
 * parseEther throw or a 0-value transaction reach the wallet.
 */
import { parseEther } from 'viem';

export interface ParsedAmount {
  wei: bigint;
  error: string | null;
}

const DECIMAL = /^(\d+\.?\d*|\.\d+)$/;

export function parseAmountEth(text: string): ParsedAmount {
  const trimmed = text.trim();
  if (trimmed === '') return { wei: 0n, error: 'Enter an amount in ETH.' };
  if (!DECIMAL.test(trimmed)) {
    return { wei: 0n, error: 'Amount must be a positive number in ETH, for example 0.001.' };
  }
  let wei: bigint;
  try {
    wei = parseEther(trimmed);
  } catch {
    return { wei: 0n, error: 'Amount must be a positive number in ETH, for example 0.001.' };
  }
  if (wei <= 0n) return { wei, error: 'Amount must be greater than zero.' };
  return { wei, error: null };
}
