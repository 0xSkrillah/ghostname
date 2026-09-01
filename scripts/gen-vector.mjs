// One-off: generate the known-answer vector for tests/interop.test.ts from
// fixed private keys, printing values from BOTH our implementation and the SDK.
import { secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex } from 'viem';

const spend = '0000000000000000000000000000000000000000000000000000000000000002';
const view = '0000000000000000000000000000000000000000000000000000000000000003';
const eph = '0000000000000000000000000000000000000000000000000000000000000004';

const spendPub = bytesToHex(secp256k1.getPublicKey(spend, true));
const viewPub = bytesToHex(secp256k1.getPublicKey(view, true));
const ephPub = bytesToHex(secp256k1.getPublicKey(eph, true));
const meta = `st:eth:0x${spendPub.slice(2)}${viewPub.slice(2)}`;
console.log(JSON.stringify({ spendPub, viewPub, ephPub, meta }, null, 2));

const ours = await import('../src/crypto/stealth.ts').catch(() => null);
if (ours) {
  console.log('ours:', ours.generateStealthAddress(meta, { ephemeralPrivateKey: `0x${eph}` }));
}
