/**
 * Constants describing the StealthSweepExecutor interface: its EIP-712 domain,
 * the Sweep typed-data layout, and the ABI of the entry point a sponsor calls.
 *
 * This module is deliberately free of any signing or key-handling code so that
 * read-only verifiers (src/relay/proof.ts, the agent and MCP layers) can decode
 * and check a sweep without ever importing the signing path in sweep.ts.
 */

/** EIP-712 domain of StealthSweepExecutor. */
export const SWEEP_DOMAIN_NAME = 'GhostNameSweep';
export const SWEEP_DOMAIN_VERSION = '1';

export const SWEEP_TYPES = {
  Sweep: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

/** Minimal ABI of the executor entry point the sponsor calls. */
export const EXECUTOR_SWEEP_ABI = [
  {
    name: 'sweep',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;
