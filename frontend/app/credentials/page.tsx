"use client";

import { useAccount, useReadContract } from "wagmi";
import { AppShell } from "@/components/Shell";
import { REGISTRY_ABI, REGISTRY_ADDRESS, type Credential } from "@/lib/contracts";

export default function CredentialsPage() {
  const { address } = useAccount();
  const { data } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "getCredentials",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 3000 },
  });

  const credentials = (data as Credential[] | undefined) ?? [];

  return (
    <AppShell title="Credentials" subtitle="Verifiable freelancer credentials issued by authorized on-chain issuers.">
      {!address ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/50">Connect a wallet to read credentials.</div>
      ) : credentials.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-white/40">No credentials found for this wallet yet.</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {credentials.map((credential) => (
            <article
              key={credential.id.toString()}
              className={`rounded-3xl border p-6 ${credential.isValid ? "border-monad-purple/25 bg-monad-purple/5" : "border-white/10 bg-white/5 opacity-70"}`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">{credential.credentialType}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${credential.isValid ? "bg-green-500/15 text-green-300" : "bg-red-500/15 text-red-300"}`}>
                  {credential.isValid ? "Valid" : "Revoked"}
                </span>
              </div>
              <p className="mb-4 text-white/75">{credential.description}</p>
              <div className="space-y-2 text-sm text-white/55">
                <div>Issuer: <span className="text-white/85">{credential.issuerName}</span></div>
                <div>Issuer wallet: <span className="font-mono text-white/85">{credential.issuerAddress}</span></div>
                <div>Issued at: <span className="text-white/85">{new Date(Number(credential.timestamp) * 1000).toLocaleString()}</span></div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
