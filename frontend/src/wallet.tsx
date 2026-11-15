import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import { BrowserProvider, HDNodeWallet, JsonRpcProvider, Mnemonic, Signer } from "ethers";
import deployment from "./contracts/deployment.json";

const HARDHAT_MNEMONIC = "test test test test test test test test test test test junk";

export const RPC_URL: string =
  (import.meta.env.VITE_RPC_URL as string | undefined) ?? "http://127.0.0.1:8545";
export const DEV_WALLETS_ENABLED = import.meta.env.VITE_DEV_WALLETS === "true";

/** Hardhat's well-known funded accounts #0-#9 (dev mode only; never use on a real network). */
export function listDevWallets(enabled: boolean): HDNodeWallet[] {
  if (!enabled) return [];
  const mnemonic = Mnemonic.fromPhrase(HARDHAT_MNEMONIC);
  return Array.from({ length: 10 }, (_, i) =>
    HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${i}`)
  );
}

interface WalletState {
  address?: string;
  signer?: Signer;
  /** Read-only provider for fetching polls without a wallet. */
  readProvider: JsonRpcProvider;
  chainOk: boolean;
  error?: string;
  devWallets: HDNodeWallet[];
  devIndex?: number;
  connect: () => Promise<void>;
  selectDev: (index: number) => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);
const readProvider = new JsonRpcProvider(RPC_URL);
const devWallets = listDevWallets(DEV_WALLETS_ENABLED);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string>();
  const [signer, setSigner] = useState<Signer>();
  const [chainOk, setChainOk] = useState(true);
  const [error, setError] = useState<string>();
  const [devIndex, setDevIndex] = useState<number>();

  const selectDev = useCallback(async (index: number) => {
    const w = devWallets[index].connect(readProvider);
    setSigner(w);
    setAddress(w.address);
    setDevIndex(index);
    setChainOk(true);
    setError(undefined);
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(undefined);
      const eth = (window as any).ethereum;
      if (!eth) {
        if (DEV_WALLETS_ENABLED) return selectDev(0);
        throw new Error("No wallet found. Install MetaMask.");
      }
      const provider = new BrowserProvider(eth);
      await provider.send("eth_requestAccounts", []);
      let network = await provider.getNetwork();
      if (Number(network.chainId) !== deployment.chainId) {
        try {
          await provider.send("wallet_switchEthereumChain", [
            { chainId: "0x" + deployment.chainId.toString(16) },
          ]);
          network = await provider.getNetwork();
        } catch {
          /* user declined or chain unknown; surfaced via chainOk below */
        }
      }
      const s = await new BrowserProvider(eth).getSigner();
      setSigner(s);
      setAddress(await s.getAddress());
      setDevIndex(undefined);
      setChainOk(Number(network.chainId) === deployment.chainId);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [selectDev]);

  const value = useMemo<WalletState>(
    () => ({ address, signer, readProvider, chainOk, error, devWallets, devIndex, connect, selectDev }),
    [address, signer, chainOk, error, devIndex, connect, selectDev]
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
