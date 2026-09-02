/**
 * GhostCheck: audit an arbitrary ENS name for privacy readiness against the
 * emerging ENS stealth-resolution convention.
 *
 * The audit is read-only and produces a structured, versioned report that
 * contains no secret material. Where a property cannot be established from
 * on-chain evidence it is reported as unknown rather than guessed.
 */
import type { Address } from 'viem';
import {
  AUDIT_SCHEMA_VERSION,
  type LocalDerivationTest,
  type MetaAddressValidation,
  type OverallStatus,
  type PrivacyAuditReport,
  type RecordSource,
  type ResolverInfo,
} from './types';
import { recordKeyPlan, selectByPrecedence } from './records';
import { normalizeEnsName } from '../ens/resolve';
import { parseStealthMetaAddress } from '../crypto/metaAddress';
import { generateStealthAddress } from '../crypto/stealth';
import { bytesToHex } from 'viem';
import { describeError } from '../lib/describeError';

const DERIVATION_TRIALS = 3;

const PROVES_NOTE =
  'A pass proves this name publishes a well-formed scheme-1 meta-address and that ' +
  'a sender client can derive distinct one-time destinations from it. It does not ' +
  'prove anonymity, amount privacy, sender privacy, or that past activity is hidden.';

/** Structural client interface, so tests can inject fakes. */
export interface AuditClient {
  getEnsAddress(args: { name: string }): Promise<Address | null>;
  getEnsText(args: { name: string; key: string }): Promise<string | null>;
  getEnsResolver?(args: { name: string }): Promise<Address>;
}

export interface AuditOptions {
  chainId: number;
  /** How the app resolves records. Reported so the trust path is visible. */
  derivationPath?: LocalDerivationTest['derivationPath'];
  /** Injectable clock for deterministic reports in tests. */
  now?: () => Date;
}

function baseTrustBoundaries() {
  return {
    protected: [
      'Local sender derivation: one-time addresses are computed in the sender client.',
      'No address-generation gateway learns the derived destination.',
      'Future recipient address reuse is avoided.',
    ],
    notProtected: [
      'Old transaction history, which cannot be erased.',
      'ENS name ownership, which stays public.',
      'Ordinary transfer amounts, which are visible on-chain.',
      'Sender identity, when the sender pays from a public wallet.',
      'Timing and RPC metadata.',
      'Unsafe withdrawal destinations, which can re-link the recipient.',
    ],
  };
}

/** Run the full privacy-readiness audit for one ENS name. */
export async function auditEnsName(
  client: AuditClient,
  rawName: string,
  options: AuditOptions,
): Promise<PrivacyAuditReport> {
  const now = options.now ?? (() => new Date());
  const warnings: string[] = [];
  const unknowns: string[] = [];

  let name: string;
  try {
    name = normalizeEnsName(rawName);
  } catch (err) {
    return {
      schemaVersion: AUDIT_SCHEMA_VERSION,
      generatedAt: now().toISOString(),
      name: rawName,
      chainId: options.chainId,
      overallStatus: 'unknown',
      conventionalAddress: null,
      conventionalAddressStatus: 'failed',
      staticMappingNote: 'Name could not be normalized, so nothing was resolved.',
      resolver: {
        address: null,
        provenance: 'unknown',
        provenanceNote: 'Not determined: the name is invalid.',
      },
      recordSources: [],
      selectedRecord: null,
      metaAddressValidation: { checked: false, valid: false, scheme: 1 },
      localDerivationTest: {
        ran: false,
        trials: 0,
        addresses: [],
        allDistinct: false,
        derivationPath: options.derivationPath ?? 'local-client',
        proves: PROVES_NOTE,
      },
      trustBoundaries: baseTrustBoundaries(),
      warnings: [describeError(err)],
      unknowns: ['Every property: the name could not be normalized.'],
    };
  }

  // 1. Conventional address: the static identity-to-wallet mapping.
  let conventionalAddress: Address | null = null;
  let resolutionFailed = false;
  try {
    conventionalAddress = await client.getEnsAddress({ name });
  } catch (err) {
    resolutionFailed = true;
    unknowns.push(
      `Conventional address could not be resolved: ${describeError(err)}`,
    );
  }

  const staticMappingNote = conventionalAddress
    ? 'This name resolves to a single static address, so every payment to it is publicly linkable to the name.'
    : resolutionFailed
      ? 'Not determined: address resolution failed.'
      : 'No address record is set, so there is no static mapping from this record type.';

  // 2. Resolver. Provenance is reported as unknown unless proven, never guessed.
  const resolver: ResolverInfo = {
    address: null,
    provenance: 'unknown',
    provenanceNote:
      'Direct versus inherited/wildcard resolver control is not established. ' +
      'Proving it needs registry evidence that is not uniformly available across ' +
      'ENS v1 and v2, so it is reported as unknown rather than guessed.',
  };
  if (client.getEnsResolver) {
    try {
      const address = await client.getEnsResolver({ name });
      resolver.address =
        address && address !== '0x0000000000000000000000000000000000000000' ? address : null;
    } catch {
      resolver.address = null;
    }
  }
  if (!resolver.address) {
    unknowns.push('Active resolver address could not be read.');
  }

  // 3. Read every candidate record key, in precedence order.
  const plan = recordKeyPlan(options.chainId);
  const recordSources: RecordSource[] = [];
  for (const entry of plan) {
    let value: string | null = null;
    try {
      value = await client.getEnsText({ name, key: entry.key });
    } catch (err) {
      unknowns.push(
        `Record ${entry.key} could not be read: ${describeError(err)}`,
      );
      recordSources.push({ ...entry, value: null, status: 'absent' });
      continue;
    }
    if (value === null || value.trim() === '') {
      recordSources.push({ ...entry, value: null, status: 'absent' });
      continue;
    }
    try {
      parseStealthMetaAddress(value);
      recordSources.push({ ...entry, value, status: 'present-valid' });
    } catch (err) {
      recordSources.push({
        ...entry,
        value,
        status: 'present-invalid',
        error: describeError(err),
      });
    }
  }

  // 4. Precedence: chain-specific first, then default. Diagnostics never win.
  const selected = selectByPrecedence(recordSources);
  const selectedRecord = selected
    ? {
        key: selected.key,
        kind: selected.kind,
        value: selected.value as string,
        precedenceNote:
          selected.kind === 'chain-specific'
            ? 'Chain-specific record selected; it takes precedence over the all-chain default.'
            : 'All-chain default record selected; no valid chain-specific record was found.',
      }
    : null;

  // Conflicting configuration is worth surfacing even when one record is usable.
  const validNormative = recordSources.filter((s) => s.normative && s.status === 'present-valid');
  const invalidAny = recordSources.filter((s) => s.status === 'present-invalid');
  if (validNormative.length > 1) {
    const distinctValues = new Set(validNormative.map((s) => s.value));
    if (distinctValues.size > 1) {
      warnings.push(
        'Multiple valid records publish DIFFERENT meta-addresses. Senders may resolve ' +
          'different destinations depending on which key they read.',
      );
    }
  }
  for (const bad of invalidAny) {
    warnings.push(
      `Record ${bad.key} is present but malformed and will be ignored by conforming senders.`,
    );
  }
  const legacyOnly =
    !selected && recordSources.some((s) => !s.normative && s.status === 'present-valid');
  if (legacyOnly) {
    warnings.push(
      'Only a non-normative legacy record was found. It is reported as a diagnostic and ' +
        'is not treated as conforming.',
    );
  }

  // 5. Validate key material and run local derivation trials.
  const metaAddressValidation: MetaAddressValidation = {
    checked: false,
    valid: false,
    scheme: 1,
  };
  const localDerivationTest: LocalDerivationTest = {
    ran: false,
    trials: 0,
    addresses: [],
    allDistinct: false,
    derivationPath: options.derivationPath ?? 'local-client',
    proves: PROVES_NOTE,
  };

  if (selectedRecord) {
    metaAddressValidation.checked = true;
    try {
      const parsed = parseStealthMetaAddress(selectedRecord.value);
      metaAddressValidation.valid = true;
      // Public keys only. No private material is ever read or emitted here.
      metaAddressValidation.spendingPublicKey = bytesToHex(parsed.spendingPublicKey);
      metaAddressValidation.viewingPublicKey = bytesToHex(parsed.viewingPublicKey);
      if (metaAddressValidation.spendingPublicKey === metaAddressValidation.viewingPublicKey) {
        warnings.push(
          'Single-key meta-address: the viewing key equals the spending key, so anyone who can ' +
            'detect payments to this name can also spend them. EIP-5564 permits this form; ' +
            'GhostName-generated identities always use separate keys.',
        );
      }

      const addresses: Address[] = [];
      for (let i = 0; i < DERIVATION_TRIALS; i++) {
        // Fresh ephemeral randomness each trial; the ephemeral secret is never
        // retained or reported.
        addresses.push(generateStealthAddress(selectedRecord.value).stealthAddress);
      }
      localDerivationTest.ran = true;
      localDerivationTest.trials = DERIVATION_TRIALS;
      localDerivationTest.addresses = addresses;
      localDerivationTest.allDistinct = new Set(addresses.map((a) => a.toLowerCase())).size === addresses.length;
      if (!localDerivationTest.allDistinct) {
        warnings.push('Local derivation produced a repeated destination. This must not happen.');
      }
    } catch (err) {
      metaAddressValidation.valid = false;
      metaAddressValidation.error = describeError(err);
      localDerivationTest.error = metaAddressValidation.error;
    }
  }

  // 6. Overall status. No numeric score.
  let overallStatus: OverallStatus;
  const nothingFound =
    !resolver.address && conventionalAddress === null && recordSources.every((s) => s.status === 'absent');
  if (resolutionFailed && recordSources.every((s) => s.status === 'absent')) {
    overallStatus = 'unknown';
  } else if (nothingFound) {
    // No resolver, no address, no records: the name is not configured on this
    // chain at all. Calling that 'incomplete' would imply a static mapping
    // that does not exist; the honest answer is that nothing is known here.
    overallStatus = 'unknown';
    unknowns.push(
      `No resolver and no records were found for this name on chain ${options.chainId}. ` +
        'It may be unregistered here, mistyped, or registered on a different network ' +
        '(mainnet names do not exist on Sepolia and vice versa).',
    );
  } else if (selectedRecord && metaAddressValidation.valid && localDerivationTest.allDistinct) {
    overallStatus = 'private-ready';
  } else if (invalidAny.length > 0 || legacyOnly || (selectedRecord && !metaAddressValidation.valid)) {
    overallStatus = 'misconfigured';
  } else if (!selectedRecord) {
    overallStatus = 'incomplete';
  } else {
    overallStatus = 'misconfigured';
  }

  const conventionalAddressStatus: PrivacyAuditReport['conventionalAddressStatus'] = conventionalAddress
    ? 'resolved'
    : resolutionFailed
      ? 'failed'
      : 'absent';

  if (overallStatus === 'incomplete') {
    warnings.push(
      'No stealth meta-address is published, so future payments to this name remain ' +
        'linkable to its static address.',
    );
  }

  return {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    generatedAt: now().toISOString(),
    name,
    chainId: options.chainId,
    overallStatus,
    conventionalAddress,
    conventionalAddressStatus,
    staticMappingNote,
    resolver,
    recordSources,
    selectedRecord,
    metaAddressValidation,
    localDerivationTest,
    trustBoundaries: baseTrustBoundaries(),
    warnings,
    unknowns,
  };
}
