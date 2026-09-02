/**
 * User-facing error text that never leaks configuration secrets.
 *
 * viem error messages embed the full request URL ("URL: https://host/v1/<key>")
 * and the JSON-RPC request body. A user who pinned a private RPC endpoint in
 * .env would otherwise see that key on screen, in exported audit JSON, and on
 * a projector. Every catch block that surfaces an error to the UI or to a
 * report goes through this helper.
 */

const URL_PATTERN = /https?:\/\/[^\s"'<>)\]]+/gi;
/** 0x-prefixed 64-hex values are also what a private key looks like. Redact. */
const PRIVATE_KEY_LIKE = /0x[0-9a-f]{64}/gi;
const MAX_LENGTH = 320;

/** Prefer viem's shortMessage (no URL, no request body) when present. */
function rawMessage(err: unknown): string {
  if (err === undefined || err === null) return '';
  if (err instanceof Error) {
    const short = (err as { shortMessage?: unknown }).shortMessage;
    if (typeof short === 'string' && short.trim().length > 0) return short;
    return err.message;
  }
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err) ?? String(err);
  } catch {
    return String(err);
  }
}

export function redactSecrets(text: string): string {
  return text.replace(URL_PATTERN, '[rpc endpoint]').replace(PRIVATE_KEY_LIKE, '[redacted 32-byte value]');
}

/** Short, single-line, secret-free description of any thrown value. */
export function describeError(err: unknown): string {
  const redacted = redactSecrets(rawMessage(err)).replace(/\s+/g, ' ').trim();
  const clipped = redacted.length > MAX_LENGTH ? `${redacted.slice(0, MAX_LENGTH - 1)}…` : redacted;
  return clipped.length > 0 ? clipped : 'Unknown error';
}
