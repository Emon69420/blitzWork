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
      
      <div className="mb-12 grid gap-6 lg:grid-cols-3">
        {/* Identity & Overall Stats */}
        <section className="card-standard lg:col-span-2">
          <div className="badge mb-4">Identity</div>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="mb-2 truncate">
                {profileLoading ? "Bootstrapping..." : profile?.display_name || address || "Anonymous"}
              </h2>
              <p className="max-w-xl">
                Your studio manages the transition from project briefs to live on-chain streaming escrow.
              </p>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl bg-[var(--bg-tertiary)] p-6 text-center border border-[var(--border-dim)]">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Funded Jobs</div>
              <div className="text-4xl font-bold text-[var(--accent-primary)]">{metrics.funded}</div>
            </div>
          </div>
        </section>

        {/* Quick Metrics */}
        <div className="grid grid-cols-1 gap-4">
          <MetricCard label="Open Briefs" value={String(metrics.totalJobs)} active />
          <MetricCard label="Total Applicants" value={String(metrics.totalApplicants)} />
        </div>
      </div>

      <div className="mb-12 grid gap-8 xl:grid-cols-2 row-equal-height">
        {/* Post Brief Form */}
        <section className="card-standard">
          <div className="card-header border-b border-[var(--border-dim)] pb-4 mb-6">
            <div className="badge badge-accent mb-2">Briefing</div>
            <h3>Post a Marketplace Brief</h3>
          </div>

          <form onSubmit={postMarketplaceJob} className="flex flex-col gap-4">
            <input
              value={marketplaceForm.title}
              onChange={(e) => setMarketplaceForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Job Title (e.g. Solidity Audit)"
              className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none"
              required
            />
            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={marketplaceForm.category}
                onChange={(e) => setMarketplaceForm(p => ({ ...p, category: e.target.value }))}
                placeholder="Category"
                className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none"
              />
              <input
                value={marketplaceForm.skills}
                onChange={(e) => setMarketplaceForm(p => ({ ...p, skills: e.target.value }))}
                placeholder="Skills (comma separated)"
                className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] ml-2">Rate/sec (MON)</label>
                <input
                  value={marketplaceForm.ratePerSecond}
                  onChange={(e) => setMarketplaceForm(p => ({ ...p, ratePerSecond: e.target.value }))}
                  type="number" step="0.000001"
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] ml-2">Deposit (MON)</label>
                <input
                  value={marketplaceForm.depositTarget}
                  onChange={(e) => setMarketplaceForm(p => ({ ...p, depositTarget: e.target.value }))}
                  type="number" step="0.01"
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none"
                  required
                />
              </div>
            </div>
            <textarea
              value={marketplaceForm.description}
              onChange={(e) => setMarketplaceForm(p => ({ ...p, description: e.target.value }))}
              rows={4}
              placeholder="Deliverables and expectations..."
              className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none resize-none"
              required
            />
            <button type="submit" disabled={busy || !user} className="btn-primary w-full mt-2">
              {busy ? "Publishing..." : "Publish Job Posting"}
            </button>
          </form>
        </section>

        {/* Funding Form */}
        <section className="card-standard">
          <div className="card-header border-b border-[var(--border-dim)] pb-4 mb-6">
            <div className="badge badge-accent mb-2">Escrow</div>
            <h3>Deploy On-Chain Funding</h3>
          </div>

          <form onSubmit={fundSelectedFreelancer} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] ml-2">Freelancer Wallet</label>
              <input
                value={onChainDraft.freelancerWallet}
                onChange={(e) => setOnChainDraft(p => ({ ...p, freelancerWallet: e.target.value }))}
                placeholder="0x..."
                className="font-mono bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none"
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={onChainDraft.ratePerSecond}
                onChange={(e) => setOnChainDraft(p => ({ ...p, ratePerSecond: e.target.value }))}
                type="number" step="0.000001"
                placeholder="Rate per sec"
                className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none"
              />
              <input
                value={onChainDraft.depositAmount}
                onChange={(e) => setOnChainDraft(p => ({ ...p, depositAmount: e.target.value }))}
                type="number" step="0.01"
                placeholder="Deposit Amount"
                className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none"
              />
            </div>
            <textarea
              value={onChainDraft.description}
              onChange={(e) => setOnChainDraft(p => ({ ...p, description: e.target.value }))}
              rows={4}
              placeholder="On-chain job metadata..."
              className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none resize-none"
            />
            <div className="spacer flex-1" />
            <div className="flex flex-col gap-4 mt-2">
              <button type="submit" disabled={busy || !address} className="btn-primary w-full">
                {busy ? "Confirming..." : `Create Escrow (${onChainDraft.depositAmount} MON)`}
              </button>
              {txHash && (
                <a href={`https://testnet.monadexplorer.com/tx/${txHash}`} target="_blank" className="text-xs text-[var(--accent-primary)] text-center hover:underline">
                  View Transaction Receipt
                </a>
              )}
            </div>
          </form>
        </section>
      </div>

      {/* Job List */}
      <section className="mb-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="badge mb-2">Marketplace</div>
            <h2>Active Job Briefs</h2>
          </div>
          <div className="text-sm text-[var(--text-muted)]">{jobs.length} postings</div>
        </div>

        {!jobs.length ? (
          <div className="card-standard border-dashed border-[var(--border-dim)] py-20 text-center">
            <p className="text-lg">No active jobs found in your studio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {jobs.map((job) => (
              <article key={job.id} className="card-standard">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="badge badge-accent">{job.status}</span>
                      <span className="badge">{job.category || "General"}</span>
                    </div>
                    <h4>{job.title}</h4>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">{job.deposit_target_mon} MON</div>
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">Target Escrow</div>
                  </div>
                </div>

                <p className="text-sm line-clamp-3 mb-6 flex-1">{job.description}</p>

                {/* Applications Section */}
                <div className="rounded-xl bg-[var(--bg-tertiary)] p-4 border border-[var(--border-dim)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Applicants</div>
                    <span className="badge">{job.applications.length}</span>
                  </div>
                  
                  <div className="space-y-3">
                    {job.applications.map(app => (
                      <div key={app.id} className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-dim)]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm truncate max-w-[120px]">
                            {app.freelancer_profile?.display_name || "Applicant"}
                          </span>
                          <button onClick={() => prepareFundingDraft(job, app)} className="text-[10px] text-[var(--accent-primary)] hover:underline uppercase font-bold">
                            Select
                          </button>
                        </div>
                        <div className="font-mono text-[10px] text-[var(--text-muted)] truncate mb-2">
                          {app.freelancer?.wallet_address}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => updateApplicationStatus(app.id, 'shortlisted')} className="text-[10px] text-[var(--text-muted)] hover:text-white uppercase font-bold">
                            Shortlist
                          </button>
                          <button onClick={() => updateApplicationStatus(app.id, 'rejected')} className="text-[10px] text-red-900/50 hover:text-red-500 uppercase font-bold ml-auto">
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                    {job.applications.length === 0 && (
                      <div className="text-[10px] text-[var(--text-muted)] text-center py-4">Waiting for proposals...</div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Active Escrow Monitoring */}
      <section>
        <div className="mb-8">
          <div className="badge mb-2">On-Chain</div>
          <h2>Funded Escrows</h2>
          <p className="mt-2">Monitor real-time streams and intervene in disputes.</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
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
            <div className="card-standard py-12 text-center text-[var(--text-muted)]">
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
    <div className={`card-standard !p-5 ${active ? 'border-[var(--accent-primary)] shadow-[0_0_20px_var(--accent-glow)]' : ''}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
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
  const { job } = useEscrowJob(jobId, { refetchInterval: 2000 });
  const { data: earnedContract } = useReadContract({
    address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "getEarnedAmount", args: [BigInt(jobId)],
    query: { refetchInterval: 1000 }
  });

  if (!job || job.employer.toLowerCase() !== walletAddress?.toLowerCase()) return null;

  const earned = typeof earnedContract === "bigint" ? earnedContract : job.accumulatedEarned;
  const remaining = job.totalDeposit > earned ? job.totalDeposit - earned : 0n;
  const statusLabel = JOB_STATUS[job.status as keyof typeof JOB_STATUS] || "Unknown";

  return (
    <div className="card-standard">
      <div className="flex flex-col md:flex-row gap-8 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono text-xs text-[var(--text-muted)]">Job #{jobId}</span>
            <span className="badge badge-accent">{statusLabel}</span>
            {job.streamActive && <div className="flex items-center gap-1.5 ml-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
              <span className="text-[10px] uppercase font-bold text-[var(--accent-primary)]">Streaming</span>
            </div>}
          </div>
          <p className="text-sm mb-6">{job.description}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-dim)]">
              <div className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">Freelancer</div>
              <div className="font-mono text-xs truncate text-wrap-safe">{job.freelancer}</div>
            </div>
            <div className="bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-dim)]">
              <div className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">Rate</div>
              <div className="font-semibold">{formatEther(job.ratePerSecond)} MON/sec</div>
            </div>
          </div>
        </div>
        
        <div className="w-full md:w-[280px] flex flex-col gap-4">
          <EscrowStat label="Total Escrowed" value={`${formatEther(job.totalDeposit)} MON`} />
          <EscrowStat label="Remaining" value={`${formatEther(remaining)} MON`} highlight />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <EscrowMetric label="Earned" value={`${Number(formatEther(earned)).toFixed(6)}`} />
        <EscrowMetric label="Withdrawn" value={`${formatEther(job.totalWithdrawn)}`} />
        <EscrowMetric label="Progress" value={`${((Number(earned) / Number(job.totalDeposit)) * 100).toFixed(1)}%`} progress={Number(earned) / Number(job.totalDeposit)} />
      </div>

      <div className="flex flex-wrap gap-3 pt-6 border-t border-[var(--border-dim)]">
        {(job.status === 1 || job.status === 2) && (
          <>
            <div className="flex flex-col gap-3 w-full sm:w-auto">
              <button 
                onClick={() => runEmployerAction("Complete Job", jobId, "approve")} 
                disabled={busy} 
                className="btn-primary"
                title="Full release of earned funds and close job"
              >
                Approve & Complete
              </button>
              <button 
                onClick={() => runEmployerForceSettle(jobId, job.settlementInterval)} 
                disabled={busy} 
                className="btn-secondary"
                title="Push earned funds to freelancer now"
              >
                Settle Earned Now
              </button>
            </div>
            <button 
              onClick={() => runEmployerAutoSettlement(jobId, !job.autoSettlementEnabled)} 
              disabled={busy} 
              className="btn-secondary"
            >
              {job.autoSettlementEnabled ? "Disable Auto-Payout" : "Enable Auto-Payout (10s)"}
            </button>
            <button 
              onClick={() => runEmployerAction("Pause", jobId, "employerPauseStream")} 
              disabled={busy || !job.streamActive} 
              className="btn-secondary"
            >
              Pause
            </button>
            <button 
              onClick={() => runEmployerAction("Dispute", jobId, "dispute")} 
              disabled={busy} 
              className="btn-ghost text-red-500 hover:bg-red-500/10 hover:text-red-400"
            >
              Dispute
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

function EscrowStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-dim)] flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{label}</span>
      <span className={`font-bold ${highlight ? 'text-[var(--accent-primary)]' : ''}`}>{value}</span>
    </div>
  );
}

function EscrowMetric({ label, value, progress }: { label: string; value: string; progress?: number }) {
  return (
    <div className="bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-dim)]">
      <div className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-2">{label}</div>
      <div className="text-xl font-bold mb-3">{value} {progress === undefined && <span className="text-xs font-normal">MON</span>}</div>
      {progress !== undefined && (
        <div className="h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--accent-primary)]" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
