/**
 * Minimal wallet connection over the injected EIP-1193 provider.
 *
 * Targets Sepolia by default. In guarded mainnet mode (VITE_ENABLE_MAINNET),
 * it will also operate on mainnet — but the write guards still require an
 * explicit per-action confirmation before any mainnet transaction.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createWalletClient,
  custom,
  type Address,
  type Chain,
  type EIP1193Provider,
  type WalletClient,
} from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID, isMainnetWriteEnabled } from '../chain/guards';
import { describeError } from '../lib/describeError';

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

/**
 * Remembered across reloads so a wallet the user disconnected in the app is not
 * silently re-attached on the next page load. Cleared by an explicit connect.
 */
const DISCONNECTED_KEY = 'ghostname.wallet.disconnected';

function readDisconnected(): boolean {
  try {
    return localStorage.getItem(DISCONNECTED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDisconnected(value: boolean): void {
  try {
    if (value) localStorage.setItem(DISCONNECTED_KEY, '1');
    else localStorage.removeItem(DISCONNECTED_KEY);
  } catch {
    // Storage unavailable: the in-memory state still applies for this page.
  }
}

/** The viem Chain for a chain id we support writing on, or null. */
function chainFor(chainId: number | null): Chain | null {
  if (chainId === SEPOLIA_CHAIN_ID) return sepolia;
  if (chainId === MAINNET_CHAIN_ID && isMainnetWriteEnabled()) return mainnet;
  return null;
}

export interface WalletState {
  available: boolean;
  account: Address | null;
  chainId: number | null;
  /** viem Chain matching the wallet's current network, or null if unsupported. */
  chain: Chain | null;
  /** True when connected to a network GhostName can write on. */
  onWritableNetwork: boolean;
  /** True when this build permits guarded mainnet writes. */
  mainnetEnabled: boolean;
  client: WalletClient | null;
  connect: () => Promise<void>;
  /**
   * Forget the connected account and, where the wallet supports it, revoke the
   * site's account permission so the next connect shows the account picker.
   */
  disconnect: () => Promise<void>;
  switchToSepolia: () => Promise<void>;
  switchToMainnet: () => Promise<void>;
  error: string | null;
}

export function useWallet(): WalletState {
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // True after an in-app disconnect until the user connects again explicitly.
  const disconnectedRef = useRef(readDisconnected());
  const available = typeof window !== 'undefined' && !!window.ethereum;
  const mainnetEnabled = isMainnetWriteEnabled();

  const chain = useMemo(() => chainFor(chainId), [chainId]);

  // The wallet client is bound to the currently-detected chain so viem's own
  // chain check matches the wallet; writes still pass through assertWritableNetwork.
  const client = useMemo<WalletClient | null>(() => {
    if (!available || !window.ethereum || !chain) return null;
    return createWalletClient({ chain, transport: custom(window.ethereum) });
  }, [available, chain]);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    const onChain = (id: unknown) => setChainId(Number(id));
    const onAccounts = (accounts: unknown) => {
      const list = accounts as Address[];
      // A wallet that still holds the site permission keeps emitting account
      // changes; after an in-app disconnect they must not re-attach the wallet.
      setAccount(disconnectedRef.current ? null : (list[0] ?? null));
    };
    provider.on?.('chainChanged', onChain);
    provider.on?.('accountsChanged', onAccounts);
    // Restore an already-authorised connection after a reload without
    // prompting: eth_accounts never opens a wallet dialog.
    void (async () => {
      if (disconnectedRef.current) return;
      try {
        const accounts = (await provider.request({ method: 'eth_accounts' })) as Address[];
        if (accounts.length > 0) {
          const chainHex = (await provider.request({ method: 'eth_chainId' })) as string;
          setAccount(accounts[0] ?? null);
          setChainId(Number(chainHex));
        }
      } catch {
        // Not connected yet; the user can connect explicitly.
      }
    })();
    return () => {
      provider.removeListener?.('chainChanged', onChain);
      provider.removeListener?.('accountsChanged', onAccounts);
    };
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    const provider = window.ethereum;
    if (!provider) {
      setError('No browser wallet detected. Install MetaMask (or similar) to continue.');
      return;
    }
    try {
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as Address[];
      const chainHex = (await provider.request({ method: 'eth_chainId' })) as string;
      disconnectedRef.current = false;
      writeDisconnected(false);
      setAccount(accounts[0] ?? null);
      setChainId(Number(chainHex));
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  const disconnect = useCallback(async () => {
    setError(null);
    disconnectedRef.current = true;
    writeDisconnected(true);
    setAccount(null);
    const provider = window.ethereum;
    if (!provider) return;
    try {
      // EIP-2255 permission revocation (MetaMask and compatible wallets). A
      // wallet without it keeps the site permission, but the app still treats
      // itself as disconnected until the user connects again.
      await provider.request({
        method: 'wallet_revokePermissions' as never,
        params: [{ eth_accounts: {} }] as never,
      });
    } catch {
      // Unsupported or refused: nothing else to do, the local state is already cleared.
    }
  }, []);

  const switchTo = useCallback(async (id: number) => {
    const provider = window.ethereum;
    if (!provider) return;
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${id.toString(16)}` }],
      });
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  const switchToSepolia = useCallback(() => switchTo(SEPOLIA_CHAIN_ID), [switchTo]);
  const switchToMainnet = useCallback(() => switchTo(MAINNET_CHAIN_ID), [switchTo]);

  return {
    available,
    account,
    chainId,
    chain,
    onWritableNetwork: chain !== null,
    mainnetEnabled,
    client,
    connect,
    disconnect,
    switchToSepolia,
    switchToMainnet,
    error,
  };
}
