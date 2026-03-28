"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useReadContract, useAccount } from "wagmi";
import Link from "next/link";
import { AppShell } from "@/components/Shell";
import { REGISTRY_ABI, REGISTRY_ADDRESS, type Credential } from "@/lib/contracts";
import { supabase } from "@/lib/supabase";
import { formatEther } from "viem";

type UserProfile = {
  id: string;
  display_name: string;
  username: string;
  bio: string;
  services_offered: string;
  avatar_url: string;
  skills: string[];
  reputation_score: number;
  wallet_address: string;
};

export default function ProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const { address: myAddress } = useAccount();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGiveCred, setShowGiveCred] = useState(false);
  const [form, setForm] = useState({
    type: "Professional Testimonial",
    description: "",
    issuerName: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [txHashes, setTxHashes] = useState<Record<string, string>>({});

  const { data: credentials, refetch: refetchCreds } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "getCredentials",
    args: [address as `0x${string}`],
  });

  useEffect(() => {
    async function loadProfile() {
      if (!supabase || !address) return;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*, users!inner(wallet_address)")
          .eq("users.wallet_address", address.toLowerCase())
          .single();

        if (error) throw error;
        setProfile({
          ...data,
          wallet_address: data.users.wallet_address
        });
      } catch (err) {
        console.error("Profile load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [address]);

  // Fetch transaction hashes for all credentials from Supabase
  useEffect(() => {
    async function loadHashes() {
      if (!supabase) return;
      const { data } = await supabase.from("on_chain_credentials").select("credential_id, tx_hash");
      if (data) {
        const mapping: Record<string, string> = {};
        data.forEach((row: any) => {
          mapping[row.credential_id] = row.tx_hash;
        });
        setTxHashes(mapping);
      }
    }
    loadHashes();
  }, [credentials]);

  const handleIssueCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myAddress) return;
    setSubmitting(true);
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3003";
    try {
      const res = await fetch(`${backendUrl}/api/issue-credential`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freelancerAddress: address,
          credentialType: form.type,
          description: form.description,
          issuerName: form.issuerName || "Verified Employer",
          employerAddress: myAddress
        }),
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response from backend:", text);
        throw new Error(`Backend Error: Expected JSON, got ${contentType || 'nothing'}. Please ensure the backend is running on ${backendUrl}`);
      }

      const result = await res.json();
      if (result.success) {
        // Map the credential ID to the transaction hash in Supabase for persistence
        if (supabase) {
          await supabase.from("on_chain_credentials").insert({
            credential_id: BigInt(result.credentialId).toString(),
            tx_hash: result.txHash
          });
        }
        alert("Credential issued successfully on-chain!");
        setShowGiveCred(false);
        refetchCreds();
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to issue credential");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <AppShell title="Loading Profile">...</AppShell>;

  return (
    <AppShell title={profile?.display_name || "User Profile"} subtitle={address}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Sidebar: Profile Summary */}
        <div className="space-y-6">
          <div className="card-standard text-center pt-10 pb-8">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-orange-600 mx-auto mb-6 flex items-center justify-center text-3xl font-bold shadow-[0_0_30px_rgba(255,77,41,0.3)]">
              {profile?.display_name?.[0] || "?"}
            </div>
            <h2 className="mb-1">{profile?.display_name || "Anonymous"}</h2>
            <p className="text-[var(--text-muted)] text-sm mb-6 font-mono">{address.slice(0, 6)}...{address.slice(-4)}</p>
            
            <div className="flex justify-center gap-4 mb-8">
              <div className="text-center">
                <div className="text-xl font-bold">{profile?.reputation_score || 0}</div>
                <div className="text-[10px] uppercase text-[var(--text-muted)]">Reputation</div>
              </div>
              <div className="w-px h-8 bg-[var(--border-dim)]" />
              <div className="text-center">
                <div className="text-xl font-bold">{(credentials as any[])?.length || 0}</div>
                <div className="text-[10px] uppercase text-[var(--text-muted)]">Credentials</div>
              </div>
            </div>

            {myAddress?.toLowerCase() !== address.toLowerCase() && (
              <button 
                onClick={() => setShowGiveCred(true)}
                className="btn-primary w-full"
              >
                Give Testimonial
              </button>
            )}
            {myAddress?.toLowerCase() === address.toLowerCase() && (
              <Link href="/profile" className="btn-secondary w-full text-center text-xs">
                Edit Professional Info
              </Link>
            )}
          </div>

          <div className="card-standard">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Skills</h4>
            <div className="flex flex-wrap gap-2">
              {profile?.skills?.map(skill => (
                <span key={skill} className="badge bg-[var(--bg-tertiary)]">{skill}</span>
              ))}
              {!profile?.skills?.length && <p className="text-xs text-[var(--text-muted)]">No skills listed.</p>}
            </div>
          </div>
        </div>

        {/* Main Content: Portfolio & Credentials */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Bio Section */}
          <section className="card-standard">
            <h3 className="mb-4">About</h3>
            <p className="text-[var(--text-muted)] leading-relaxed whitespace-pre-wrap">
              {profile?.bio || "No biography provided yet."}
            </p>
          </section>

          {/* On-Chain Credentials Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h3>On-Chain Professional Log</h3>
              <div className="badge badge-accent">Verified Resume</div>
            </div>

            <div className="space-y-4">
              {(credentials as any[])?.length === 0 && (
                <div className="card-standard py-20 text-center border-dashed border-[var(--border-dim)]">
                  <p className="text-[var(--text-muted)]">This user hasn't received any on-chain testimonials yet.</p>
                </div>
              )}

              {(credentials as any[])?.map((cred: any, idx: number) => (
                <div key={idx} className="card-standard hover:border-[var(--accent-primary)] transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="badge badge-accent">{cred.credentialType}</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">ID: {cred.id.toString()}</span>
                      </div>
                      <h4>Work for {cred.issuerName}</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono text-[var(--text-muted)]">
                        {new Date(Number(cred.timestamp) * 1000).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] italic leading-relaxed">
                    "{cred.description}"
                  </p>
                  <div className="mt-4 pt-4 border-t border-[var(--border-dim)] flex items-center justify-between">
                    <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                      Issuer: <span className="text-white font-mono">{cred.issuerAddress.slice(0, 10)}...</span>
                    </div>
                    
                    {txHashes[cred.id.toString()] ? (
                      <a 
                        href={`https://testnet.monadexplorer.com/tx/${txHashes[cred.id.toString()]}`} 
                        target="_blank" 
                        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                        rel="noreferrer"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        <span className="text-[10px] font-bold text-green-500 uppercase underline decoration-green-500/30">View on Explorer</span>
                      </a>
                    ) : (
                      <div className="flex items-center gap-1.5 opacity-50">
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]" />
                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">On-Chain Verified</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Give Credential Modal */}
      {showGiveCred && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowGiveCred(false)} />
          <div className="card-standard w-full max-w-xl relative animate-in fade-in zoom-in duration-300">
            <h3 className="mb-2">Issue Professional Testimonial</h3>
            <p className="text-sm text-[var(--text-muted)] mb-8">
              This will create a permanent, verifiable record on the Monad blockchain for this freelancer.
            </p>

            <form onSubmit={handleIssueCredential} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Service Provided</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Smart Contract Audit, UI/UX Design"
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl w-full p-4 text-sm outline-none focus:border-[var(--accent-primary)]"
                  value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">The Testimonial</label>
                <textarea 
                  required
                  rows={4}
                  placeholder="Describe the freelancer's performance..."
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl w-full p-4 text-sm outline-none focus:border-[var(--accent-primary)] resize-none"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Your Name / Organization</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Monad Labs, Digital Alchemist"
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl w-full p-4 text-sm outline-none focus:border-[var(--accent-primary)]"
                  value={form.issuerName}
                  onChange={e => setForm(p => ({ ...p, issuerName: e.target.value }))}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowGiveCred(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? "Issuing to Monad..." : "Confirm & Push On-Chain"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
