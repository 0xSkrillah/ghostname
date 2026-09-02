/**
 * Demo configuration. These values only PRE-FILL inputs and constrain scans;
 * they never replace live resolution or hard-code cryptographic results.
 */

function env(name: string): string | undefined {
  const fromImportMeta = (import.meta as { env?: Record<string, string | undefined> }).env?.[name];
  // process.env fallback so the test runner (vi.stubEnv) can toggle values; absent in the browser.
  const fromProcess = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  const value = fromImportMeta ?? fromProcess;
  return value && value.length > 0 ? value : undefined;
}

/**
 * Optional established mainnet identity used as READ-ONLY demo input. It only
 * pre-fills the audit input and is never queried automatically. There is
 * deliberately no built-in default: set VITE_DEMO_MAINNET_NAME in a local,
 * uncommitted .env if you want a pre-fill for a presentation.
 */
export const DEMO_MAINNET_NAME = env('VITE_DEMO_MAINNET_NAME') ?? '';

/** Controlled Sepolia test identity with a published stealth record (set after M1 config). */
export const DEMO_SEPOLIA_NAME = env('VITE_DEMO_SEPOLIA_NAME') ?? '';

/** Whole-number block or undefined; a deployment typo must not white-screen the app. */
function parseBlockNumber(value: string | undefined): bigint | undefined {
  if (!value || !/^[0-9]+$/.test(value.trim())) return undefined;
  const block = BigInt(value.trim());
  return block > 0n ? block : undefined;
}

/** Start block for announcement scanning (never scan from genesis). */
export const SCAN_START_BLOCK = parseBlockNumber(env('VITE_SCAN_START_BLOCK'));

/** Default payment size for the demo. */
export const DEMO_PAYMENT_ETH = env('VITE_DEMO_PAYMENT_ETH') ?? '0.001';

/**
 * The StealthSweepExecutor (EIP-7702 delegate) deployed on Sepolia for the
 * sponsored-sweep demo. Pinned so historical evidence keeps verifying.
 */
export const SEPOLIA_DEMO_SWEEP_EXECUTOR = '0x94E4C39055fa4a5fCd47E03CbcbCD0503848806b';

/**
 * Executor used to pre-fill the /receive sweep panel. Defaults to the Sepolia
 * demo deployment; override per network via VITE_SWEEP_EXECUTOR.
 */
export const SWEEP_EXECUTOR = env('VITE_SWEEP_EXECUTOR') ?? SEPOLIA_DEMO_SWEEP_EXECUTOR;
