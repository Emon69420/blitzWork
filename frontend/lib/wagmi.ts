import { createConfig, http } from "wagmi";
import { metaMask } from "wagmi/connectors";
import { monadTestnet } from "wagmi/chains";

const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC || "https://testnet-rpc.monad.xyz";

export const config = createConfig({
  chains: [monadTestnet],
  connectors: [metaMask()],
  transports: {
    [monadTestnet.id]: http(rpcUrl),
  },
});

export { monadTestnet };
