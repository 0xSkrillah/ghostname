/**
 * Network write guards.
 *
 * Default posture: GhostName writes ONLY to Sepolia. Mainnet writes are
 * blocked at every write entry point.
 *
 * Guarded mainnet mode (opt-in): when the build sets VITE_ENABLE_MAINNET=true,
 * mainnet writes become *possible* but never silent — every mainnet write must
 * additionally carry an explicit per-action confirmation (`mainnetConfirmed`),
 * which the UI only sets after the user types a confirmation phrase. Both the
 * build flag AND the per-action confirmation are required; either alone blocks.
 *
 * This double gate (build opt-in + typed per-action confirmation) is the whole
 * safety contract. Do not add a code path that reaches a mainnet write without
 * passing `mainnetConfirmed: true` from a deliberate user action.
 */
import { mainnet, sepolia } from 'viem/chains';

export const SEPOLIA_CHAIN_ID: number = sepolia.id; // 11155111
export const MAINNET_CHAIN_ID: number = mainnet.id; // 1

/** Back-compat alias: the always-writable testnet. */
export const WRITABLE_CHAIN_ID = SEPOLIA_CHAIN_ID;

/** True only when the build was compiled with mainnet writes opted in. */
export function isMainnetWriteEnabled(): boolean {
  const fromImportMeta = (import.meta as { env?: Record<string, string | undefined> }).env?.[
    'VITE_ENABLE_MAINNET'
  ];
  // process.env fallback so the test runner (vi.stubEnv) can toggle it; absent in the browser.
  const fromProcess =
    typeof process !== 'undefined' ? process.env?.['VITE_ENABLE_MAINNET'] : undefined;
  return (fromImportMeta ?? fromProcess) === 'true';
}

export class WrongNetworkError extends Error {
  constructor(actual: number | undefined) {
    const mainnetBlocked =
      actual === MAINNET_CHAIN_ID && !isMainnetWriteEnabled()
        ? 'Mainnet writes are disabled in this build (enable with VITE_ENABLE_MAINNET=true). '
        : '';
    super(
      `Writes are only permitted on Sepolia (chain ${SEPOLIA_CHAIN_ID})` +
        (isMainnetWriteEnabled() ? `, or mainnet (chain ${MAINNET_CHAIN_ID}) with confirmation` : '') +
        `. Wallet is on chain ${actual ?? 'unknown'}. ` +
        mainnetBlocked +
        'Switch your wallet to a permitted network and retry.',
    );
    this.name = 'WrongNetworkError';
  }
}

/** Thrown when a mainnet write is attempted without an explicit confirmation. */
export class MainnetConfirmationRequiredError extends Error {
  constructor() {
    super(
      'Mainnet write requires explicit confirmation. This spends real ETH and ' +
        'publicly, permanently links this action to your wallet. Confirm in the UI to proceed.',
    );
    this.name = 'MainnetConfirmationRequiredError';
  }
}

export interface WriteGuardOptions {
  /**
   * Set true ONLY from a deliberate per-action user confirmation (e.g. the
   * user typed the confirmation phrase for THIS mainnet write). Ignored on
   * Sepolia. Never default this to true anywhere.
   */
  mainnetConfirmed?: boolean;
}

/**
 * Hard-fail unless the write is permitted. Call before EVERY write, against
 * both the intended chain and the wallet's actually-reported chain.
 *
 * - Sepolia: always permitted.
 * - Mainnet: permitted only when the build enables it AND this call carries
 *   `mainnetConfirmed: true`.
 * - Anything else: blocked.
 */
export function assertWritableNetwork(
  chainId: number | undefined,
  opts: WriteGuardOptions = {},
): void {
  if (chainId === SEPOLIA_CHAIN_ID) return;
  if (chainId === MAINNET_CHAIN_ID && isMainnetWriteEnabled()) {
    if (!opts.mainnetConfirmed) throw new MainnetConfirmationRequiredError();
    return;
  }
  throw new WrongNetworkError(chainId);
}
