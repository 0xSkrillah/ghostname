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
