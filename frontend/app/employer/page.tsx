"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { decodeEventLog, formatEther, parseEther } from "viem";
import { useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { AppShell } from "@/components/Shell";
import {
  type AppUser,
  type EmployerJobWithApplications,
  type JobApplication,
  type JobListing,
  type Profile,
  normalizeWalletAddress,
  parseSkills,
} from "@/lib/marketplace";
import { ESCROW_ABI, ESCROW_ADDRESS, JOB_STATUS, type Job } from "@/lib/contracts";
import { supabase } from "@/lib/supabase";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import { monadTestnet } from "@/lib/wagmi";
import { useEscrowJob } from "@/hooks/useEscrowJob";

type OnChainDraft = {
  freelancerWallet: string;
  ratePerSecond: string;
  depositAmount: string;
  description: string;
  dbJobId?: string;
  applicationId?: string;
};

const initialDraft: OnChainDraft = {
  freelancerWallet: "",
  ratePerSecond: "0.001",
  depositAmount: "1",
  description: "",
};

export default function EmployerPage() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { address, user, profile, loading: profileLoading, error: profileError, configured } = useWalletProfile();
  const { data: jobCount } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: "jobCount",
  });

  const [marketplaceForm, setMarketplaceForm] = useState({
    title: "",
    description: "",
    category: "",
    skills: "",
    ratePerSecond: "0.001",
    depositTarget: "1",
  });
  const [onChainDraft, setOnChainDraft] = useState<OnChainDraft>(initialDraft);
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [jobs, setJobs] = useState<EmployerJobWithApplications[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  async function loadEmployerJobs(currentUser: AppUser) {
    if (!supabase) return;

    setJobsLoading(true);
    setJobsError(null);

    try {
      const { data: jobRows, error: jobsFetchError } = await supabase
        .from("jobs")
        .select("*")
        .eq("employer_user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (jobsFetchError) throw jobsFetchError;

      const typedJobs = (jobRows ?? []) as JobListing[];
      const jobIds = typedJobs.map((job) => job.id);

      const { data: applicationRows, error: applicationError } = jobIds.length
        ? await supabase.from("job_applications").select("*").in("job_id", jobIds).order("created_at", { ascending: true })
        : { data: [], error: null };

      if (applicationError) throw applicationError;

      const applications = (applicationRows ?? []) as JobApplication[];
      const freelancerIds = [...new Set(applications.map((application) => application.freelancer_user_id))];

      const { data: freelancerRows, error: freelancerError } = freelancerIds.length
        ? await supabase.from("users").select("*").in("id", freelancerIds)
        : { data: [], error: null };

      if (freelancerError) throw freelancerError;

      const { data: freelancerProfileRows, error: freelancerProfileError } = freelancerIds.length
        ? await supabase.from("profiles").select("*").in("user_id", freelancerIds)
        : { data: [], error: null };

      if (freelancerProfileError) throw freelancerProfileError;

      const freelancerMap = new Map((freelancerRows as AppUser[]).map((row) => [row.id, row]));
      const freelancerProfileMap = new Map((freelancerProfileRows as Profile[]).map((row) => [row.user_id, row]));

      setJobs(
        typedJobs.map((job) => ({
          ...job,
          applications: applications
            .filter((application) => application.job_id === job.id)
            .map((application) => ({
              ...application,
              freelancer: freelancerMap.get(application.freelancer_user_id) ?? null,
              freelancer_profile: freelancerProfileMap.get(application.freelancer_user_id) ?? null,
            })),
        }))
      );
    } catch (loadError) {
      setJobsError(loadError instanceof Error ? loadError.message : "Failed to load marketplace jobs");
    } finally {
      setJobsLoading(false);
    }
  }

  useEffect(() => {
    if (user) void loadEmployerJobs(user);
  }, [user]);

  const estimatedHours = useMemo(() => {
    const deposit = Number(onChainDraft.depositAmount || 0);
    const rate = Number(onChainDraft.ratePerSecond || 0);
    if (!deposit || !rate) return "0";
    return (deposit / rate / 3600).toFixed(2);
  }, [onChainDraft.depositAmount, onChainDraft.ratePerSecond]);

  const metrics = useMemo(() => {
    const totalApplicants = jobs.reduce((sum, job) => sum + job.applications.length, 0);
    const funded = jobs.filter((job) => job.status === "funded").length;
    return { totalApplicants, funded, totalJobs: jobs.length };
  }, [jobs]);

  const postMarketplaceJob = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !user) return;

    try {
      setBusy(true);
      const payload = {
        employer_user_id: user.id,
        title: marketplaceForm.title,
        description: marketplaceForm.description,
        category: marketplaceForm.category || null,
        skills_required: parseSkills(marketplaceForm.skills),
        budget_type: "streaming",
        rate_per_second_mon: Number(marketplaceForm.ratePerSecond),
        deposit_target_mon: Number(marketplaceForm.depositTarget),
        status: "open",
        visibility: "public",
      };

      const { error } = await supabase.from("jobs").insert(payload);
      if (error) throw error;

      setMarketplaceForm({
        title: "",
        description: "",
        category: "",
        skills: "",
        ratePerSecond: "0.001",
        depositTarget: "1",
      });
      await loadEmployerJobs(user);
    } catch (submitError) {
      alert(submitError instanceof Error ? submitError.message : "Failed to post marketplace job");
    } finally {
      setBusy(false);
    }
  };

  const fundSelectedFreelancer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!address || !user || !supabase || !publicClient) return;

    try {
      setBusy(true);
      if (chainId !== monadTestnet.id) {
        await switchChainAsync({ chainId: monadTestnet.id });
      }

      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "createJob",
        args: [onChainDraft.freelancerWallet as `0x${string}`, parseEther(onChainDraft.ratePerSecond), onChainDraft.description],
        value: parseEther(onChainDraft.depositAmount),
      });

      setTxHash(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const createdLog = receipt.logs.find((log) => {
        try {
          const decoded = decodeEventLog({ abi: ESCROW_ABI, data: log.data, topics: log.topics });
          return decoded.eventName === "JobCreated";
        } catch {
          return false;
        }
      });

      let escrowJobId: number | null = null;
      if (createdLog) {
        const decoded = decodeEventLog({
          abi: ESCROW_ABI,
          data: createdLog.data,
          topics: createdLog.topics,
        }) as { eventName: string; args?: { jobId?: bigint } };
        if (decoded.eventName === "JobCreated" && decoded.args?.jobId !== undefined) {
          escrowJobId = Number(decoded.args.jobId);
        }
      }

      if (onChainDraft.dbJobId && onChainDraft.applicationId) {
        const selectedApplication = jobs
          .find((job) => job.id === onChainDraft.dbJobId)
          ?.applications.find((application) => application.id === onChainDraft.applicationId);

        if (selectedApplication) {
          const now = new Date().toISOString();

          const { error: engagementError } = await supabase.from("engagements").upsert(
            {
              job_id: onChainDraft.dbJobId,
              employer_user_id: user.id,
              freelancer_user_id: selectedApplication.freelancer_user_id,
              application_id: onChainDraft.applicationId,
              escrow_job_id: escrowJobId,
              escrow_contract_address: ESCROW_ADDRESS,
              status: "funded",
              updated_at: now,
            },
            { onConflict: "job_id" }
          );
          if (engagementError) throw engagementError;

          const { error: jobError } = await supabase
            .from("jobs")
            .update({
              status: "funded",
              selected_application_id: onChainDraft.applicationId,
              escrow_job_id: escrowJobId,
              escrow_contract_address: ESCROW_ADDRESS,
              updated_at: now,
            })
            .eq("id", onChainDraft.dbJobId);
          if (jobError) throw jobError;

          const { error: acceptAppError } = await supabase
            .from("job_applications")
            .update({ status: "accepted", updated_at: now })
            .eq("id", onChainDraft.applicationId);
          if (acceptAppError) throw acceptAppError;

          const rejectOthers = jobs
            .find((job) => job.id === onChainDraft.dbJobId)
            ?.applications.filter((application) => application.id !== onChainDraft.applicationId)
            .map((application) => application.id);

          if (rejectOthers?.length) {
            await supabase.from("job_applications").update({ status: "rejected", updated_at: now }).in("id", rejectOthers);
          }
        }
      }

      setOnChainDraft(initialDraft);
      await loadEmployerJobs(user);
    } catch (submitError) {
      alert(submitError instanceof Error ? submitError.message : "Failed to fund selected freelancer");
    } finally {
      setBusy(false);
    }
  };

  const updateApplicationStatus = async (applicationId: string, status: "shortlisted" | "accepted" | "rejected") => {
    if (!supabase || !user) return;

    try {
      const { error } = await supabase.from("job_applications").update({ status, updated_at: new Date().toISOString() }).eq("id", applicationId);
      if (error) throw error;
      await loadEmployerJobs(user);
    } catch (updateError) {
      alert(updateError instanceof Error ? updateError.message : "Failed to update application");
    }
  };

  const prepareFundingDraft = (job: EmployerJobWithApplications, application: EmployerJobWithApplications["applications"][number]) => {
    const wallet = application.freelancer?.wallet_address ?? "";
    setOnChainDraft({
      freelancerWallet: wallet,
      ratePerSecond: String(job.rate_per_second_mon ?? 0.001),
      depositAmount: String(job.deposit_target_mon ?? 1),
      description: job.description,
      dbJobId: job.id,
      applicationId: application.id,
    });
  };

  const runEmployerAction = async (
    label: string,
    jobId: number,
    functionName: "approve" | "dispute" | "employerPauseStream"
  ) => {
    try {
      setBusy(true);
      if (chainId !== monadTestnet.id) {
        await switchChainAsync({ chainId: monadTestnet.id });
      }

      await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName,
        args: [BigInt(jobId)],
      });
    } catch (actionError) {
      alert(actionError instanceof Error ? actionError.message : `Failed to ${label} this escrow job`);
    } finally {
      setBusy(false);
    }
  };

  const runEmployerForceSettle = async (jobId: number, interval?: bigint) => {
    try {
      setBusy(true);
      if (chainId !== monadTestnet.id) {
        await switchChainAsync({ chainId: monadTestnet.id });
      }

      await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "setAutoSettlement",
        args: [BigInt(jobId), true, interval || 10n],
      });
    } catch (actionError) {
      alert(actionError instanceof Error ? actionError.message : "Failed to settle payout");
    } finally {
      setBusy(false);
    }
  };

  const runEmployerAutoSettlement = async (jobId: number, enabled: boolean) => {
    try {
      setBusy(true);
      if (chainId !== monadTestnet.id) {
        await switchChainAsync({ chainId: monadTestnet.id });
      }

      await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "setAutoSettlement",
        args: [BigInt(jobId), enabled, 10n],
      });
    } catch (actionError) {
      alert(actionError instanceof Error ? actionError.message : "Failed to update auto-stream setting");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell 
      title="Employer Studio" 
      subtitle="Post briefs, manage applicants, and fund escrow with high-precision streaming."
    >
      {!configured && (
        <div className="card-standard mb-6 border-red-900/50 bg-red-900/10 text-red-400">
          Supabase is not configured. Add credentials to your environment.
        </div>
      )}
      
      {/* Master Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-12 border-b-[1.5px] border-[var(--border-dim)] pb-12 items-start">
        
        {/* Left Column (25%) */}
        <div className="xl:col-span-3 flex flex-col gap-6 sticky top-8">
          <section className="card-standard">
            <div className="mb-4">
              <span className="badge">Identity</span>
            </div>
            <h2 className="mb-4 truncate">
              {profileLoading ? "Bootstrapping..." : profile?.display_name || (address ? address.slice(0, 8) + '...' : "Anonymous")}
            </h2>
            <p className="text-sm mb-8">
              Your studio manages the transition from project briefs to live on-chain streaming escrow.
            </p>
            <div className="pt-6 border-t-[1.5px] border-[var(--border-dim)]">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Funded Escrows</div>
              <div className="text-5xl text-[var(--text-primary)] font-fjalla tracking-normal">{metrics.funded}</div>
            </div>
          </section>

          <MetricCard label="Open Briefs" value={String(metrics.totalJobs)} active />
          <MetricCard label="Total Applicants" value={String(metrics.totalApplicants)} />
        </div>

        {/* Center Column (45%) */}
        <div className="xl:col-span-5 flex flex-col gap-8">
          <section className="card-standard">
            <div className="border-b-[1.5px] border-[var(--border-dim)] pb-4 mb-6">
              <span className="badge badge-accent mb-2">Briefing</span>
              <h3>Post a Market Brief</h3>
            </div>
            <form onSubmit={postMarketplaceJob} className="flex flex-col gap-4">
              <input
                value={marketplaceForm.title}
                onChange={(e) => setMarketplaceForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Job Title (e.g. Solidity Audit)"
                required
              />
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={marketplaceForm.category}
                  onChange={(e) => setMarketplaceForm(p => ({ ...p, category: e.target.value }))}
                  placeholder="Category"
                />
                <input
                  value={marketplaceForm.skills}
                  onChange={(e) => setMarketplaceForm(p => ({ ...p, skills: e.target.value }))}
                  placeholder="Skills (CSV)"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] ml-1">Rate/sec (MON)</label>
                  <input
                    value={marketplaceForm.ratePerSecond}
                    onChange={(e) => setMarketplaceForm(p => ({ ...p, ratePerSecond: e.target.value }))}
                    type="number" step="0.000001"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] ml-1">Deposit (MON)</label>
                  <input
                    value={marketplaceForm.depositTarget}
                    onChange={(e) => setMarketplaceForm(p => ({ ...p, depositTarget: e.target.value }))}
                    type="number" step="0.01"
                    required
                  />
                </div>
              </div>
              <textarea
                value={marketplaceForm.description}
                onChange={(e) => setMarketplaceForm(p => ({ ...p, description: e.target.value }))}
                rows={4}
                placeholder="Deliverables and expectations..."
                required
              />
              <button type="submit" disabled={busy || !user} className="btn-primary w-full mt-4">
                {busy ? "Publishing..." : "Publish Job Posting"}
              </button>
            </form>
          </section>

          <section className="card-standard">
            <div className="border-b-[1.5px] border-[var(--border-dim)] pb-4 mb-6">
              <span className="badge badge-accent mb-2">Escrow</span>
              <h3>Direct Assignment</h3>
            </div>
            <form onSubmit={fundSelectedFreelancer} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] ml-1">Freelancer Wallet</label>
                <input
                  value={onChainDraft.freelancerWallet}
                  onChange={(e) => setOnChainDraft(p => ({ ...p, freelancerWallet: e.target.value }))}
                  placeholder="0x..."
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={onChainDraft.ratePerSecond}
                  onChange={(e) => setOnChainDraft(p => ({ ...p, ratePerSecond: e.target.value }))}
                  type="number" step="0.000001"
                  placeholder="Rate per sec"
                />
                <input
                  value={onChainDraft.depositAmount}
                  onChange={(e) => setOnChainDraft(p => ({ ...p, depositAmount: e.target.value }))}
                  type="number" step="0.01"
                  placeholder="Deposit Amount"
                />
              </div>
              <textarea
                value={onChainDraft.description}
                onChange={(e) => setOnChainDraft(p => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="On-chain job metadata..."
              />
              <div className="flex flex-col gap-4 mt-4">
                <button type="submit" disabled={busy || !address} className="btn-primary w-full bg-[var(--text-primary)] !text-black border-transparent hover:!bg-transparent hover:!text-[var(--text-primary)] hover:border-[var(--text-primary)]">
                  {busy ? "Confirming..." : `Create Escrow (${onChainDraft.depositAmount} MON)`}
                </button>
                {txHash && (
                  <a href={`https://testnet.monadexplorer.com/tx/${txHash}`} target="_blank" className="font-mono text-[10px] text-center text-white hover:underline">
                    View Receipt: {txHash.slice(0, 10)}...
                  </a>
                )}
              </div>
            </form>
          </section>
        </div>

        {/* Right Column (30%) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <div className="flex items-end justify-between border-b-[1.5px] border-[var(--border-dim)] pb-4">
            <div>
              <span className="badge mb-2">Marketplace</span>
              <h2 className="!text-3xl">Active Briefs</h2>
            </div>
            <span className="text-xl font-fjalla">{jobs.length}</span>
          </div>

          {!jobs.length ? (
            <div className="card-standard border-dashed py-20 text-center text-[var(--text-secondary)]">
              No active briefs in your studio.
            </div>
          ) : (
            <div className="flex flex-col gap-6 overflow-y-auto max-h-[800px] pr-2">
              {jobs.map((job) => (
                <article key={job.id} className="card-standard !p-5">
                  <div className="flex flex-wrap gap-2 mb-4 border-b-[1.5px] border-[var(--border-dim)] pb-4">
                    <span className="badge badge-accent">{job.status}</span>
                    <span className="badge">{job.category || "General"}</span>
                  </div>
                  <h4 className="mb-2 line-clamp-2">{job.title}</h4>
                  <div className="text-[10px] uppercase text-[var(--text-muted)] font-bold mb-4">
                    {job.deposit_target_mon} MON ESCROW
                  </div>
                  <p className="text-sm line-clamp-2 mb-6">{job.description}</p>
                  
                  <div className="border-[1.5px] border-[var(--border-dim)] rounded-[20px] p-4 bg-transparent">
                    <div className="flex items-center justify-between mb-4 border-b-[1.5px] border-[var(--border-dim)] pb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Applicants</span>
                      <span className="badge">{job.applications.length}</span>
                    </div>
                    <div className="space-y-4">
                      {job.applications.map(app => (
                        <div key={app.id} className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <Link href={`/profile/${app.freelancer?.wallet_address}`} className="font-semibold text-sm truncate max-w-[120px] hover:text-[#909090]">
                              {app.freelancer_profile?.display_name || "Applicant"}
                            </Link>
                            <button onClick={() => prepareFundingDraft(job, app)} className="btn-base !h-6 !px-2 border-[1.5px] border-[var(--border-dim)] text-[10px] hover:bg-white hover:text-black">
                              Select
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => updateApplicationStatus(app.id, 'shortlisted')} className="text-[10px] uppercase font-bold text-[#909090] hover:text-white">Shortlist</button>
                            <button onClick={() => updateApplicationStatus(app.id, 'rejected')} className="text-[10px] uppercase font-bold text-red-500 hover:text-red-400">Decline</button>
                          </div>
                        </div>
                      ))}
                      {job.applications.length === 0 && (
                        <div className="text-[10px] text-[#909090] text-center">Waiting for proposals...</div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Funded Escrows */}
      <section className="bg-white text-black p-8 lg:p-12 mb-12 rounded-[40px]">
        <div className="mb-8">
          <h2 className="!text-black mb-1">Funded Escrows:</h2>
          <p className="font-fjalla text-sm uppercase tracking-wide text-black">Monitor real-time streams and intervene in disputes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {jobCount ? (
            Array.from({ length: Number(jobCount) }, (_, i) => (
              <EmployerJobCard
                key={i}
                jobId={i}
                walletAddress={address}
                busy={busy}
                runEmployerAction={runEmployerAction}
                runEmployerForceSettle={runEmployerForceSettle}
                runEmployerAutoSettlement={runEmployerAutoSettlement}
              />
            ))
          ) : (
            <div className="card-standard bg-[#0e0e0e] text-white py-12 text-center text-[#909090] col-span-2 border-transparent">
              No active on-chain escrows detected.
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function MetricCard({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className={`card-standard !flex-row font-fjalla items-center justify-between !py-4 px-6 ${active ? 'bg-white !text-black' : ''}`}>
      <div className={`text-xl uppercase ${active ? 'text-black' : 'text-[#909090]'}`}>{label}</div>
      <div className="text-3xl font-light">{value}</div>
    </div>
  );
}

function EmployerJobCard({
  jobId, walletAddress, busy, runEmployerAction, runEmployerAutoSettlement, runEmployerForceSettle
}: {
  jobId: number; walletAddress?: string; busy: boolean;
  runEmployerAction: (l: string, j: number, f: "approve" | "dispute" | "employerPauseStream") => Promise<void>;
  runEmployerForceSettle: (j: number, i?: bigint) => Promise<void>;
  runEmployerAutoSettlement: (j: number, e: boolean) => Promise<void>;
}) {
  const { job, isLoading } = useEscrowJob(jobId, { refetchInterval: 2000 });
  const { data: earnedContract } = useReadContract({
    address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "getEarnedAmount", args: [BigInt(jobId)],
    query: { refetchInterval: 1000 }
  });

  if (isLoading && !job) {
    return <div className="bg-[#1c1c1c] animate-pulse rounded-[40px] min-h-[300px] w-full border border-transparent" />;
  }

  if (!job || job.employer.toLowerCase() !== walletAddress?.toLowerCase()) return null;

  const earned = typeof earnedContract === "bigint" ? earnedContract : job.accumulatedEarned;
  const remaining = job.totalDeposit > earned ? job.totalDeposit - earned : 0n;
  const statusLabel = JOB_STATUS[job.status as keyof typeof JOB_STATUS] || "Unknown";

  return (
    <div className="card-standard bg-white text-black flex flex-col gap-4 !p-8 border-[2px] border-black rounded-[40px]">
      <div className="flex items-center gap-4 mb-4">
        <h3 className="font-fjalla !text-4xl m-0 leading-none text-white bg-black px-4 py-1 rounded-[20px] border-[1.5px] border-black">Job #{jobId}</h3>
        <span className="badge bg-black !text-white uppercase text-[10px] px-3 py-1 font-bold">{statusLabel}</span>
        {job.streamActive && <span className="badge bg-white text-black border-[1.5px] border-black animate-pulse">Streaming</span>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <EscrowStat label="Total Escrowed" value={`${formatEther(job.totalDeposit)} MON`} />
        <EscrowStat label="Remaining" value={`${formatEther(remaining)} MON`} />
      </div>
      
      <EscrowStat label="Freelancer" value={job.freelancer} linkHref={`/profile/${job.freelancer}`} />
      
      <div className="grid grid-cols-2 gap-4">
        <EscrowStat label="Rate" value={`${formatEther(job.ratePerSecond)} MON/S`} />
        <EscrowStat label="Progress" value={`${((Number(earned) / Number(job.totalDeposit)) * 100).toFixed(1)}%`} progress={Number(earned) / Number(job.totalDeposit)} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-2">
        <EscrowStat label="Earned" value={Number(formatEther(earned)).toFixed(4)} />
        <EscrowStat label="Withdrawn" value={formatEther(job.totalWithdrawn)} />
      </div>

      <div className="flex flex-wrap gap-2 w-full pt-4 mt-2 border-t-[1.5px] border-black/20">
        {(job.status === 1 || job.status === 2) && (
          <>
            <button onClick={() => runEmployerAction("Pause", jobId, "employerPauseStream")} disabled={busy || !job.streamActive} className="btn-base bg-white border-[1.5px] border-black text-black hover:bg-black hover:text-white text-[10px] font-bold px-5 !h-12 !rounded-[20px] transition-colors">
              Pause Stream
            </button>
            <button onClick={() => runEmployerForceSettle(jobId)} disabled={busy || Number(formatEther(earned)) <= Number(formatEther(job.totalWithdrawn))} className="btn-base bg-white border-[1.5px] border-black text-black hover:bg-black hover:text-white text-[10px] font-bold px-5 !h-12 !rounded-[20px] transition-colors">
              Settle & Pay
            </button>
            <button onClick={() => runEmployerAutoSettlement(jobId, !job.autoSettlementEnabled)} disabled={busy} className={`btn-base bg-white border-[1.5px] ${job.autoSettlementEnabled ? 'border-green-600 text-green-600 hover:bg-green-600 hover:text-white' : 'border-black text-black hover:bg-black hover:text-white'} text-[10px] font-bold px-5 !h-12 !rounded-[20px] transition-colors`}>
              {job.autoSettlementEnabled ? "Disable Auto-Pay" : "Enable Auto-Pay"}
            </button>
            <button onClick={() => runEmployerAction("Dispute", jobId, "dispute")} disabled={busy} className="btn-base bg-white border-[1.5px] border-[#ff6b6b] text-[#ff6b6b] hover:bg-[#ff6b6b] hover:text-white text-[10px] font-bold px-5 !h-12 !rounded-[20px] transition-colors ml-auto">
              Dispute
            </button>
            <button onClick={() => runEmployerAction("Complete", jobId, "approve")} disabled={busy} className="btn-base bg-black border-[1.5px] border-black text-white hover:bg-[#333] hover:text-white text-[10px] font-bold px-5 !h-12 !rounded-[20px] transition-colors">
              Approve
            </button>
          </>
        )}
        {job.status === 4 && (
          <Link href={`/dispute/${jobId}`} className="btn-base bg-black border border-black text-white text-[10px] font-bold px-6 !h-12 !rounded-[20px] hover:bg-[#333] ml-auto">
            Enter Dispute
          </Link>
        )}
      </div>
    </div>
  );
}

function EscrowStat({ label, value, progress, linkHref }: { label: string; value: string; progress?: number; linkHref?: string }) {
  const content = (
    <div className="bg-white border-[2px] border-black text-black px-6 py-3 rounded-[30px] flex flex-col justify-center min-h-[70px]">
      <span className="text-[10px] font-figtree font-bold uppercase tracking-wider mb-1 leading-none">{label}</span>
      <span className={`font-fjalla text-xl truncate leading-none ${linkHref ? 'hover:underline cursor-pointer border-b border-black/20 pb-1' : ''}`}>{value}</span>
      {progress !== undefined && (
        <div className="h-1 w-full bg-gray-200 rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-black" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
  
  return linkHref ? <Link href={linkHref}>{content}</Link> : content;
}
