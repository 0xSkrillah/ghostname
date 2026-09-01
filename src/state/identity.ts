/**
 * Local receive-identity storage. Keys are generated client-side and stored
 * ONLY in this browser's localStorage so /receive can recognise payments.
 * Nothing here is ever transmitted; this is a hackathon-demo custody model
 * and the UI says so explicitly.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { generateStealthKeys, type StealthKeys } from '../crypto/stealth';

const STORAGE_KEY = 'ghostname.identity.v1';

let cache: StealthKeys | null | undefined;
const listeners = new Set<() => void>();

function read(): StealthKeys | null {
  if (cache !== undefined) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as StealthKeys) : null;
  } catch {
    cache = null;
  }
  return cache;
}

function notify() {
  for (const listener of listeners) listener();
}

export function saveIdentity(keys: StealthKeys): void {
  cache = keys;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Storage unavailable (private mode): identity lives in memory only.
  }
  notify();
}

export function clearIdentity(): void {
  cache = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  notify();
}

export function useIdentity(): {
  identity: StealthKeys | null;
  create: () => StealthKeys;
  clear: () => void;
} {
  const identity = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => null,
  );
  const create = useCallback(() => {
    const keys = generateStealthKeys();
    saveIdentity(keys);
    return keys;
  }, []);
  return { identity, create, clear: clearIdentity };
}
