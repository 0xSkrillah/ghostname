/**
 * Demo configuration. These values only PRE-FILL inputs and constrain scans —
 * they never replace live resolution or hard-code cryptographic results.
 */

function env(name: string): string | undefined {
  const value = (import.meta as { env?: Record<string, string | undefined> }).env?.[name];
  return value && value.length > 0 ? value : undefined;
}

/** Established mainnet identity used as READ-ONLY demo input (input pre-fill only). */
export const DEMO_MAINNET_NAME = env('VITE_DEMO_MAINNET_NAME') ?? 'skrillah.eth';

/** Controlled Sepolia test identity with a published stealth record (set after M1 config). */
export const DEMO_SEPOLIA_NAME = env('VITE_DEMO_SEPOLIA_NAME') ?? '';

/** Start block for announcement scanning (never scan from genesis). */
export const SCAN_START_BLOCK = BigInt(env('VITE_SCAN_START_BLOCK') ?? '0') || undefined;

/** Default payment size for the demo. */
export const DEMO_PAYMENT_ETH = env('VITE_DEMO_PAYMENT_ETH') ?? '0.001';

/**
 * Deployed StealthSweepExecutor (EIP-7702 delegate) for the sponsored-sweep
 * demo. Pre-fills the /receive sweep panel. Sepolia deployment below; override
 * per network via VITE_SWEEP_EXECUTOR.
 */
export const SWEEP_EXECUTOR =
  env('VITE_SWEEP_EXECUTOR') ?? '0x94E4C39055fa4a5fCd47E03CbcbCD0503848806b';
