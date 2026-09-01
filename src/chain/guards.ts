/**
 * Network write guards. GhostName writes ONLY to Sepolia. There is no code
 * path that signs or sends a mainnet transaction; these guards enforce that
 * invariant at every write entry point and are covered by tests.
 */
import { sepolia } from 'viem/chains';

export const WRITABLE_CHAIN_ID: number = sepolia.id; // 11155111

export class WrongNetworkError extends Error {
  constructor(actual: number | undefined) {
    super(
      `Writes are only permitted on Sepolia (chain ${WRITABLE_CHAIN_ID}). ` +
        `Wallet is on chain ${actual ?? 'unknown'}. ` +
        (actual === 1
          ? 'Mainnet writes are blocked by design — switch your wallet to Sepolia.'
          : 'Switch your wallet to Sepolia and retry.'),
    );
    this.name = 'WrongNetworkError';
  }
}

/** Hard-fail unless the chain id is exactly Sepolia. Call before EVERY write. */
export function assertWritableNetwork(chainId: number | undefined): void {
  if (chainId !== WRITABLE_CHAIN_ID) {
    throw new WrongNetworkError(chainId);
  }
}
