/**
 * Minimal wallet connection over the injected EIP-1193 provider.
 *
 * Targets Sepolia by default. In guarded mainnet mode (VITE_ENABLE_MAINNET),
 * it will also operate on mainnet — but the write guards still require an
 * explicit per-action confirmation before any mainnet transaction.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
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
  switchToSepolia: () => Promise<void>;
  switchToMainnet: () => Promise<void>;
  error: string | null;
}

export function useWallet(): WalletState {
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      setAccount(list[0] ?? null);
    };
    provider.on?.('chainChanged', onChain);
    provider.on?.('accountsChanged', onAccounts);
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
      setAccount(accounts[0] ?? null);
      setChainId(Number(chainHex));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
      setError(err instanceof Error ? err.message : String(err));
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
    switchToSepolia,
    switchToMainnet,
    error,
  };
}
