/**
 * Minimal wallet connection over the injected EIP-1193 provider, targeting
 * Sepolia only. No mainnet wallet client is ever constructed.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  createWalletClient,
  custom,
  type Address,
  type EIP1193Provider,
  type WalletClient,
} from 'viem';
import { sepolia } from 'viem/chains';

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export interface WalletState {
  available: boolean;
  account: Address | null;
  chainId: number | null;
  client: WalletClient | null;
  connect: () => Promise<void>;
  switchToSepolia: () => Promise<void>;
  error: string | null;
}

export function useWallet(): WalletState {
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [client, setClient] = useState<WalletClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const available = typeof window !== 'undefined' && !!window.ethereum;

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
      setClient(createWalletClient({ chain: sepolia, transport: custom(provider) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const switchToSepolia = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) return;
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${sepolia.id.toString(16)}` }],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return { available, account, chainId, client, connect, switchToSepolia, error };
}
