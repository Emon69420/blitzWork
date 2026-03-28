"use client";

import Link from "next/link";
import Image from "next/image";
import monadCoinImg from "../../monad-mon-coin-nedir.webp";
import { useEffect, useRef, useState } from "react";
import { formatEther } from "viem";
import { useChainId, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { AppShell } from "@/components/Shell";
import {
  ESCROW_ABI,
  ESCROW_ADDRESS,
  JOB_STATUS,
  REGISTRY_ABI,
  REGISTRY_ADDRESS,
  type Credential,
  type Job,
} from "@/lib/contracts";
import { monadTestnet } from "@/lib/wagmi";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import { supabase } from "@/lib/supabase";
import type { Engagement, JobApplication, JobListing, Juror } from "@/lib/marketplace";
import { parseSkills } from "@/lib/marketplace";
import { useEscrowJob } from "@/hooks/useEscrowJob";

function StreamingCounter({
  jobId,
  ratePerSecond,
  streamStartTime,
  accumulatedEarned,
  streamActive,
  totalWithdrawn,
}: {
  jobId: number;
  ratePerSecond: bigint;
  streamStartTime: bigint;
  accumulatedEarned: bigint;
  streamActive: boolean;
  totalWithdrawn: bigint;
}) {
  const [displayAmount, setDisplayAmount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: earnedFromContract, refetch } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: "getEarnedAmount",
    args: [BigInt(jobId)],
  });

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      void refetch();
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refetch]);

  useEffect(() => {
    if (!streamActive || streamStartTime === 0n) {
      setDisplayAmount(Number(formatEther(accumulatedEarned)));
      return;
    }

    const tick = () => {
      const now = BigInt(Math.floor(Date.now() / 1000));
      const elapsed = now - streamStartTime;
      const earned = accumulatedEarned + elapsed * ratePerSecond;
      setDisplayAmount(Number(formatEther(earned)));
    };

    tick();
    const smoothInterval = setInterval(tick, 100);
    return () => clearInterval(smoothInterval);
  }, [accumulatedEarned, ratePerSecond, streamActive, streamStartTime]);

  useEffect(() => {
    if (typeof earnedFromContract === "bigint") {
      setDisplayAmount(Number(formatEther(earnedFromContract)));
    }
  }, [earnedFromContract]);

  const available = Math.max(0, displayAmount - Number(formatEther(totalWithdrawn)));

  return (
    <div className={`card-standard p-8 text-center border-2 ${streamActive ? 'border-[var(--accent-primary)] shadow-[0_0_30px_rgba(255,77,41,0.15)] bg-gradient-to-b from-[var(--bg-secondary)] to-black' : 'border-[var(--border-dim)] bg-[var(--bg-secondary)]'}`}>
      <div className="badge badge-accent mb-4 mx-auto">{streamActive ? "Live Stream" : "Escrow Balance"}</div>
      <div className="text-6xl font-bold tracking-tighter text-white mb-2 tabular-nums">
        {displayAmount.toFixed(6)}
      </div>
      <div className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)] mb-8">MON</div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left border-t border-[var(--border-dim)] pt-6">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Available</div>
          <div className="text-lg font-bold text-[var(--accent-primary)]">{available.toFixed(6)} MON</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Withdrawn</div>
          <div className="text-lg font-bold text-white">{formatEther(totalWithdrawn)} MON</div>
        </div>
      </div>
    </div>
  );
}

export default function FreelancerPage() {
  const { address, user, profile, loading: profileLoading, error: profileError, configured } = useWalletProfile();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [openJobs, setOpenJobs] = useState<JobListing[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [applyDrafts, setApplyDrafts] = useState<Record<string, string>>({});

  const { data: jobCount } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: "jobCount",
  });

  const { data: credentialData } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "getCredentials",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const credentials = (credentialData as Credential[] | undefined)?.filter((item) => item.isValid) ?? [];

  async function loadMarketplaceState() {
    if (!supabase || !user) return;

    const [{ data: jobRows }, { data: applicationRows }, { data: engagementRows }] = await Promise.all([
      supabase.from("jobs").select("*").eq("status", "open").order("created_at", { ascending: false }),
      supabase.from("job_applications").select("*").eq("freelancer_user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("engagements").select("*").eq("freelancer_user_id", user.id).order("created_at", { ascending: false }),
    ]);

    setOpenJobs((jobRows ?? []) as JobListing[]);
    setApplications((applicationRows ?? []) as JobApplication[]);
    setEngagements((engagementRows ?? []) as Engagement[]);
  }

  useEffect(() => {
    if (user) void loadMarketplaceState();
  }, [user]);

  const run = async (
    key: string,
    jobId: number,
    functionName: "acceptJob" | "startStream" | "pauseStream" | "resumeStream" | "withdraw" | "dispute"
  ) => {
    try {
      setPending((prev) => ({ ...prev, [key]: true }));
      if (chainId !== monadTestnet.id) {
        await switchChainAsync({ chainId: monadTestnet.id });
      }
      await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName,
        args: [BigInt(jobId)],
      });
    } catch (runError) {
      alert(runError instanceof Error ? runError.message : `Failed to run ${functionName}`);
    } finally {
      setPending((prev) => ({ ...prev, [key]: false }));
    }
  };

  const applyToJob = async (jobId: string) => {
    if (!supabase || !user) return;

    try {
      const coverLetter = applyDrafts[jobId] || "I can deliver this quickly and keep communication clear throughout the job.";
      const { error } = await supabase.from("job_applications").upsert(
        {
          job_id: jobId,
          freelancer_user_id: user.id,
          cover_letter: coverLetter,
          status: "submitted",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "job_id,freelancer_user_id" }
      );

      if (error) throw error;
      await loadMarketplaceState();
    } catch (applyError) {
      alert(applyError instanceof Error ? applyError.message : "Failed to apply to job");
    }
  };


  return (
    <AppShell title="Freelancer Lounge" subtitle="Bid on marketplace briefs and manage your streaming escrow payments.">
      {!configured && (
        <div className="card-standard mb-6 border-red-900/50 bg-red-900/10 text-red-400">
          Supabase is not configured. Add credentials to your environment.
        </div>
      )}
      
      <div className="mb-12 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Profile & Credentials */}
        <section className="card-standard">
          <div className="badge mb-4">Identity</div>
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="mb-2 truncate">
                {profileLoading ? "Bootstrapping..." : profile?.display_name || address || "Anonymous"}
              </h2>
              <p className="max-w-xl text-[var(--text-muted)]">
                Your professional profile on Monad. Bid on jobs and build your reputation through on-chain proofs.
              </p>
              <div className="flex gap-4 mt-6">
                <Link href="/profile" className="btn-secondary px-6">
                  Edit Profile
                </Link>
                <div className="flex flex-col justify-center">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Credentials</div>
                  <div className="font-bold text-[var(--accent-primary)]">{credentials.length} Valid Proofs</div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 md:max-w-[200px] justify-end">
              {credentials.map((c, i) => (
                <span key={i} className="badge badge-accent text-[10px] whitespace-nowrap">
                  {c.credentialType}
                </span>
              ))}
              {!credentials.length && <div className="text-[10px] text-[var(--text-muted)] italic">No proofs found.</div>}
            </div>
          </div>
        </section>

        {/* Prominent Visual Branding container */}
        <section className="card-standard border border-[var(--border-dim)] rounded-2xl overflow-hidden relative min-h-[250px] !p-0 bg-transparent flex items-center justify-center">
          <Image 
            src={monadCoinImg} 
            alt="Monad Coin Branding" 
            fill
            className="object-cover object-center"
            priority /* load quickly for LCP */
          />
        </section>
      </div>

      <section className="mb-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="badge mb-2">Marketplace</div>
            <h2>Open Briefs</h2>
          </div>
          <div className="text-sm text-[var(--text-muted)]">{openJobs.length} opportunities</div>
        </div>

        {!openJobs.length ? (
          <div className="card-standard border-dashed border-[var(--border-dim)] py-20 text-center">
            <p className="text-lg">No active briefs available right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {openJobs.map((job) => {
              const alreadyApplied = applications.some(app => app.job_id === job.id);
              return (
                <article key={job.id} className="card-standard flex flex-col">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="badge badge-accent">Open</span>
                        <span className="badge">{job.category || "General"}</span>
                      </div>
                      <h4>{job.title}</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">{job.deposit_target_mon} MON</div>
                      <div className="text-[10px] uppercase text-[var(--text-muted)]">Target</div>
                    </div>
                  </div>

                  <p className="text-sm line-clamp-4 mb-6 flex-1 text-[var(--text-muted)] leading-relaxed">
                    {job.description}
                  </p>

                  <div className="space-y-4 pt-6 border-t border-[var(--border-dim)]">
                    <textarea
                      value={applyDrafts[job.id] ?? ""}
                      onChange={(e) => setApplyDrafts(prev => ({ ...prev, [job.id]: e.target.value }))}
                      placeholder="Why are you the best fit for this stream?"
                      className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none resize-none text-sm"
                      rows={3}
                    />
                    <button 
                      onClick={() => void applyToJob(job.id)} 
                      disabled={alreadyApplied || !user || !configured} 
                      className="btn-primary w-full"
                    >
                      {alreadyApplied ? "Proposal Sent" : "Submit Proposal"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-8 xl:grid-cols-[0.8fr_1.2fr] row-equal-height">
        {/* Applications */}
        <section className="card-standard">
          <div className="badge mb-4">Proposals</div>
          <h2 className="mb-6">Your Applications</h2>
          {!applications.length ? (
            <div className="py-12 text-center text-[var(--text-muted)] border border-dashed border-[var(--border-dim)] rounded-2xl">
              No active applications.
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((app) => (
                <div key={app.id} className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">ID: {app.job_id.slice(0, 8)}</span>
                    <span className="badge badge-accent uppercase text-[9px]">{app.status}</span>
                  </div>
                  <p className="text-sm line-clamp-2 text-[var(--text-muted)]">{app.cover_letter}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Live Work Tracking */}
        <section className="card-standard">
          <div className="badge mb-4">Operations</div>
          <h2 className="mb-6">Active On-Chain Work</h2>

          <div className="grid grid-cols-1 gap-6">
            {jobCount ? (
              Array.from({ length: Number(jobCount) }, (_, i) => (
                <FreelancerJobCard key={i} jobId={i} walletAddress={address} pending={pending} run={run} />
              ))
            ) : (
              <div className="py-20 text-center text-[var(--text-muted)] border border-dashed border-[var(--border-dim)] rounded-2xl">
                No active streams found.
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function FreelancerJobCard({
  jobId, walletAddress, pending, run
}: {
  jobId: number; walletAddress?: string; pending: Record<string, boolean>;
  run: (k: string, j: number, f: "acceptJob" | "startStream" | "pauseStream" | "resumeStream" | "withdraw" | "dispute") => Promise<void>;
}) {
  const { job } = useEscrowJob(jobId, { refetchInterval: 2000 });
  if (!job || job.freelancer.toLowerCase() !== walletAddress?.toLowerCase()) return null;

  const statusLabel = JOB_STATUS[job.status as keyof typeof JOB_STATUS] || "Unknown";

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-dim)] rounded-2xl p-6">
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono text-[10px] text-[var(--text-muted)]">Job #{jobId}</span>
            <span className="badge badge-accent">{statusLabel}</span>
            {job.streamActive && (
              <div className="flex items-center gap-1.5 ml-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
                <span className="text-[10px] uppercase font-bold text-[var(--accent-primary)]">Streaming</span>
              </div>
            )}
          </div>
          <p className="text-sm mb-4 leading-relaxed">{job.description}</p>
          <div className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)]">
            Employer: <span className="font-mono text-white ml-2">{job.employer}</span>
          </div>
        </div>
        
        <div className="w-full md:w-[200px] bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-dim)] text-center">
          <div className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">Escrow Total</div>
          <div className="text-xl font-bold text-white">{formatEther(job.totalDeposit)} MON</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">{formatEther(job.ratePerSecond)}/sec</div>
        </div>
      </div>

      {(job.status === 1 || job.status === 2) && (
        <div className="mb-8">
          <StreamingCounter
            jobId={jobId}
            ratePerSecond={job.ratePerSecond}
            streamStartTime={job.streamStartTime}
            accumulatedEarned={job.accumulatedEarned}
            streamActive={job.streamActive}
            totalWithdrawn={job.totalWithdrawn}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-6 border-t border-[var(--border-dim)]">
        {job.status === 0 && <ActionButton label="Accept Job" pending={pending[`acc-${jobId}`]} onClick={() => run(`acc-${jobId}`, jobId, "acceptJob")} />}
        {job.status === 1 && !job.streamActive && <ActionButton label="Start Stream" pending={pending[`start-${jobId}`]} onClick={() => run(`start-${jobId}`, jobId, "startStream")} />}
        {job.status === 1 && job.streamActive && <ActionButton label="Pause Stream" pending={pending[`pause-${jobId}`]} onClick={() => run(`pause-${jobId}`, jobId, "pauseStream")} />}
        {job.status === 2 && <ActionButton label="Resume Stream" pending={pending[`resume-${jobId}`]} onClick={() => run(`resume-${jobId}`, jobId, "resumeStream")} />}
        
        {(job.status === 1 || job.status === 2) && (
          <>
            <button onClick={() => run(`disp-${jobId}`, jobId, "dispute")} className="btn-secondary text-red-500 border-red-900/50 hover:bg-red-900/20">
              {pending[`disp-${jobId}`] ? "Opening..." : "Raise Dispute"}
            </button>
          </>
        )}
        
        {job.status === 4 && (
          <Link href={`/dispute/${jobId}`} className="btn-primary">
            Dispute Workspace
          </Link>
        )}
      </div>
    </div>
  );
}

function ActionButton({ label, pending, secondary, onClick }: { label: string; pending?: boolean; secondary?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={pending} className={secondary ? "btn-secondary" : "btn-primary"}>
      {pending ? "Transacting..." : label}
    </button>
  );
}
