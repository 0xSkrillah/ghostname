/**
 * Static MCP resources: the privacy model, output schemas, finding codes and
 * the implementation status. All text is fixed and contains no chain data.
 */
import type { McpServer } from '@modelcontextprotocol/server';
import { ACTION_CATALOGUE, ACTION_CODES, FINDING_CATALOGUE, FINDING_CODES } from '../src/agent/findings';
import { NEVER_IN_AGENT_OUTPUT } from '../src/agent/sanitize';
import { AgentPrivacyReportSchema, UpgradePlanSchema, jsonSchemaFor } from './schemas';
import { TOOL_NAMES } from './tools';

export const RESOURCE_URIS = {
  privacyModel: 'ghostname://privacy-model',
  auditSchema: 'ghostname://schemas/agent-audit-v1',
  planSchema: 'ghostname://schemas/upgrade-plan-v1',
  findingCodes: 'ghostname://finding-codes',
  implementationStatus: 'ghostname://implementation-status',
} as const;

export const PRIVACY_MODEL_TEXT = `# GhostName privacy model

GhostName gives an ENS name FORWARD RECIPIENT-ADDRESS PRIVACY and nothing more.

## What a private-ready result means

- The name publishes a valid ERC-5564 scheme-1 stealth meta-address under the ENS
  stealth-resolution convention, and a sender client can derive distinct one-time
  destinations from it locally.
- Privacy applies ONLY to payments from COMPATIBLE SENDER SOFTWARE: software that
  resolves the stealth record and derives the one-time address in the sender client.
  A sender who pays the static address gets no privacy benefit.

## What remains public, always

- Historical activity. Nothing can delete blockchain history.
- ENS name ownership and control, and the stealth record itself.
- Sender identity, when the sender pays from a public wallet.
- Ordinary transfer amounts.
- Timing, network and RPC metadata. The RPC endpoint sees which names you query.

## Re-linking risk

- An unsafe withdrawal re-links the recipient: funding gas for a stealth address
  from a public wallet, or sweeping to a destination already linked to the
  recipient. Use a sponsored exit (EIP-7702 or EIP-3009) to an unlinked destination.
- A verified exit proves the mechanics of the sweep. It never proves that the
  destination is unrelated to the recipient.

## Words GhostName does not use

Anonymous, untraceable, mixer, zero-knowledge, delete history. A GhostName audit
never establishes anonymity, and an agent must never describe it that way.

## What the agent tools never do

They never accept, generate, return or store spending keys, viewing keys, seed
phrases or passphrases; never sign; never write an ENS record; never execute a
payment or sweep; never derive a payment destination on request. Every upgrade
happens in the human's browser with the human's wallet approval.
`;

export function implementationStatusText(): string {
  return `# GhostName agent implementation status

Tools (all read-only, non-destructive, idempotent apart from chain state and time):
${TOOL_NAMES.map((t) => `- ${t}`).join('\n')}

Chains: Ethereum mainnet (1) and Sepolia (11155111) only, through server-configured
RPC endpoints. No tool accepts an RPC URL.

Modes:
- local stdio (recommended): user RPC, no GhostName API call, no analytics, no
  query history, diagnostics on stderr only.
- remote Streamable HTTP (convenience): stateless, same tools, the operator and
  its RPC provider can observe queried names.

Implemented:
- ERC-5564 scheme-1 core, byte-identical to the reference SDK.
- GhostCheck audit with record precedence, malformed and conflicting record
  detection, local derivation trials, explicit unknowns.
- Read-only verification of a live payment and announcement, and of a live
  sponsored EIP-7702 exit, from public chain data.
- Secure web handoff for the human-signed upgrade.

Not implemented, by design:
- Agent key custody, agent-controlled ENS writes, any autonomous wallet.
- A remote payment-destination derivation tool.
- Continuous monitoring, accounts, databases, payments between agents.

Known limitations:
- Resolver provenance (direct versus wildcard or inherited) is reported as unknown.
- The ENS stealth-resolution convention is a current RFC proposal, not a ratified
  standard. ENSIP-26 agent records are a draft.
- Announcement scanning uses bounded log queries over public RPCs.

Never present in any output: ${NEVER_IN_AGENT_OUTPUT.join('; ')}.
`;
}

export function findingCodesDocument() {
  return {
    schemaVersion: 1,
    findings: FINDING_CODES.map((code) => ({ code, ...FINDING_CATALOGUE[code] })),
    actions: ACTION_CODES.map((code) => ({ code, ...ACTION_CATALOGUE[code] })),
    severityOrder: ['critical', 'warning', 'info'],
    evidenceMeaning: {
      observed: 'Read from public chain data during this audit.',
      model: 'Follows from the privacy model regardless of chain state.',
      unknown: 'Could not be established. Never treated as a pass.',
    },
    note: 'No numeric privacy score exists or will exist.',
  };
}

export function registerGhostNameResources(server: McpServer): void {
  server.registerResource(
    'privacy-model',
    RESOURCE_URIS.privacyModel,
    {
      title: 'GhostName privacy model',
      description: 'What a private-ready result does and does not mean.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: PRIVACY_MODEL_TEXT }] }),
  );

  server.registerResource(
    'schema-agent-audit-v1',
    RESOURCE_URIS.auditSchema,
    {
      title: 'AgentPrivacyReport v1 JSON Schema',
      description: 'Output schema of ghostname_audit_ens_privacy.',
      mimeType: 'application/schema+json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/schema+json',
          text: JSON.stringify(jsonSchemaFor(AgentPrivacyReportSchema), null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    'schema-upgrade-plan-v1',
    RESOURCE_URIS.planSchema,
    {
      title: 'UpgradePlan v1 JSON Schema',
      description: 'Output schema of ghostname_prepare_upgrade.',
      mimeType: 'application/schema+json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/schema+json',
          text: JSON.stringify(jsonSchemaFor(UpgradePlanSchema), null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    'finding-codes',
    RESOURCE_URIS.findingCodes,
    {
      title: 'GhostName finding and action codes',
      description: 'Every stable code with its severity, evidence class and meaning.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        { uri: uri.href, mimeType: 'application/json', text: JSON.stringify(findingCodesDocument(), null, 2) },
      ],
    }),
  );

  server.registerResource(
    'implementation-status',
    RESOURCE_URIS.implementationStatus,
    {
      title: 'GhostName implementation status',
      description: 'What is implemented, what is not, and known limitations.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: implementationStatusText() }],
    }),
  );
}
