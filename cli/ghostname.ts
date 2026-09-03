/**
 * GhostName CLI. Calls exactly the same service functions as the MCP tools
 * and emits the same schema versions, so a JSON report from the CLI and a
 * structuredContent block from MCP are interchangeable.
 *
 *   ghostname audit <name> --chain <id> [--json] [--evidence]
 *   ghostname plan <name> --chain <id> [--json] [--report-id <gcr1_...>]
 *   ghostname verify-payment <paymentTx> <announcementTx> --chain <id> [--json]
 *   ghostname verify-exit <sweepTx> --chain <id> [--json] [--executor <address>]
 *
 * Read-only. No key is ever read, requested or accepted.
 */
import { auditForAgent, DEFAULT_WEB_BASE_URL } from '../src/agent/auditForAgent';
import {
  envClientFactory,
  isSupportedChainId,
  rpcUrlsFor,
  SUPPORTED_CHAIN_IDS,
  type ClientFactory,
  type EnvLike,
  type SupportedChainId,
} from '../src/agent/chains';
import { auditText, evidenceText, planText } from '../src/agent/format';
import { prepareUpgradePlan } from '../src/agent/upgradePlan';
import { verifyPaymentForAgent, verifySponsoredExitForAgent } from '../src/agent/verify';
import type { AgentObservation } from '../src/agent/types';

export const CLI_VERSION = '0.1.0';

export const USAGE = `ghostname ${CLI_VERSION}: read-only ENS privacy adviser

Usage:
  ghostname audit <name> --chain <id> [--json] [--evidence] [--strict]
  ghostname plan <name> --chain <id> [--json] [--report-id <gcr1_...>]
  ghostname verify-payment <paymentTx> <announcementTx> --chain <id> [--json] [--strict]
  ghostname verify-exit <sweepTx> --chain <id> [--json] [--executor <address>] [--strict]

Options:
  --chain <id>       1 (Ethereum mainnet) or 11155111 (Sepolia). Required.
  --json             Print the versioned JSON report instead of text.
  --evidence         Include escaped public record values (audit only).
  --report-id <id>   Echo a prior report id in the plan (never trusted).
  --executor <addr>  Expected EIP-7702 executor (required on mainnet).
  --web-base <url>   Base URL of the GhostName web app for the handoff.
  --strict           Exit 1 unless the name is private-ready or the evidence verified.
  --help             Show this help.

Environment:
  GHOSTNAME_MAINNET_RPC_URL, GHOSTNAME_SEPOLIA_RPC_URL   comma-separated RPC endpoints
  GHOSTNAME_WEB_BASE_URL                                 handoff base URL

Exit codes: 0 success, 1 strict check failed, 2 usage error, 3 runtime error.
This tool never asks for, reads or accepts a private key, viewing key, seed
phrase or passphrase, and it never writes to a chain.`;

export interface CliIo {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  env: EnvLike;
  /** Injected client factory (tests). Defaults to env-configured read-only clients. */
  getClient?: ClientFactory;
  now?: () => Date;
}

interface ParsedArgs {
  command: string | undefined;
  positional: string[];
  flags: Record<string, string | true>;
}

const VALUE_FLAGS = new Set(['chain', 'report-id', 'executor', 'web-base']);
const BOOLEAN_FLAGS = new Set(['json', 'evidence', 'strict', 'help', 'version']);

export function parseArgs(argv: string[]): ParsedArgs | { error: string } {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    const key = rawKey!;
    if (BOOLEAN_FLAGS.has(key)) {
      flags[key] = true;
    } else if (VALUE_FLAGS.has(key)) {
      const value = inlineValue ?? argv[++i];
      if (value === undefined || value.startsWith('--')) return { error: `--${key} needs a value.` };
      flags[key] = value;
    } else {
      return { error: `Unknown option --${key}.` };
    }
  }
  const [command, ...rest] = positional;
  return { command, positional: rest, flags };
}

function chainFrom(flags: Record<string, string | true>): SupportedChainId | { error: string } {
  const raw = flags['chain'];
  if (raw === undefined || raw === true) {
    return { error: `--chain is required (${SUPPORTED_CHAIN_IDS.join(' or ')}).` };
  }
  const id = Number(raw);
  if (!isSupportedChainId(id)) {
    return { error: `Chain ${raw} is not supported. Use ${SUPPORTED_CHAIN_IDS.join(' or ')}.` };
  }
  return id;
}

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  const parsed = parseArgs(argv);
  if ('error' in parsed) {
    io.stderr(`${parsed.error}\n\n${USAGE}`);
    return 2;
  }
  const { command, positional, flags } = parsed;
  if (flags['version']) {
    io.stdout(CLI_VERSION);
    return 0;
  }
  if (flags['help'] || !command) {
    io.stdout(USAGE);
    return command ? 0 : 2;
  }

  const chain = chainFrom(flags);
  if (typeof chain !== 'number') {
    io.stderr(`${chain.error}\n\n${USAGE}`);
    return 2;
  }
  const json = flags['json'] === true;
  const strict = flags['strict'] === true;
  const getClient = io.getClient ?? envClientFactory(io.env);
  const observation: Partial<AgentObservation> = {
    mode: 'local',
    rpcSource: io.getClient ? 'injected' : rpcUrlsFor(chain, io.env).source,
  };
  const webBaseUrl =
    (typeof flags['web-base'] === 'string' ? flags['web-base'] : undefined) ??
    io.env['GHOSTNAME_WEB_BASE_URL'] ??
    DEFAULT_WEB_BASE_URL;
  const emit = (text: string, structured: object) =>
    io.stdout(json ? JSON.stringify(structured, null, 2) : text);

  try {
    switch (command) {
      case 'audit': {
        const name = positional[0];
        if (!name) {
          io.stderr(`audit needs an ENS name.\n\n${USAGE}`);
          return 2;
        }
        const report = await auditForAgent(getClient(chain), name, {
          chainId: chain,
          technicalEvidence: flags['evidence'] === true,
          observation,
          webBaseUrl,
          now: io.now,
        });
        emit(auditText(report), report);
        return strict && report.status !== 'private-ready' ? 1 : 0;
      }
      case 'plan': {
        const name = positional[0];
        if (!name) {
          io.stderr(`plan needs an ENS name.\n\n${USAGE}`);
          return 2;
        }
        const plan = await prepareUpgradePlan(getClient(chain), name, {
          chainId: chain,
          reportId: typeof flags['report-id'] === 'string' ? flags['report-id'] : undefined,
          observation,
          webBaseUrl,
          now: io.now,
        });
        emit(planText(plan), plan);
        return 0;
      }
      case 'verify-payment': {
        const [paymentTxHash, announcementTxHash] = positional;
        if (!paymentTxHash || !announcementTxHash) {
          io.stderr(`verify-payment needs <paymentTx> <announcementTx>.\n\n${USAGE}`);
          return 2;
        }
        const ev = await verifyPaymentForAgent(getClient(chain), {
          chainId: chain,
          paymentTxHash,
          announcementTxHash,
          now: io.now,
        });
        emit(evidenceText(ev), ev);
        return strict && !ev.verified ? 1 : 0;
      }
      case 'verify-exit': {
        const txHash = positional[0];
        if (!txHash) {
          io.stderr(`verify-exit needs <sweepTx>.\n\n${USAGE}`);
          return 2;
        }
        const ev = await verifySponsoredExitForAgent(getClient(chain), {
          chainId: chain,
          txHash,
          expectedExecutor: typeof flags['executor'] === 'string' ? flags['executor'] : undefined,
          now: io.now,
        });
        emit(evidenceText(ev), ev);
        return strict && !ev.verified ? 1 : 0;
      }
      default:
        io.stderr(`Unknown command "${command}".\n\n${USAGE}`);
        return 2;
    }
  } catch (err) {
    io.stderr(`ghostname: ${err instanceof Error ? err.message : String(err)}`);
    return 3;
  }
}
