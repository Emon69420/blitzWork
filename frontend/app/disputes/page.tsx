"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import { AppShell } from "@/components/Shell";
import { useMarketplaceRole } from "@/hooks/useMarketplaceRole";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import { ESCROW_ABI, ESCROW_ADDRESS, type Job } from "@/lib/contracts";
import { normalizeWalletAddress } from "@/lib/marketplace";
import { supabase } from "@/lib/supabase";
import type { DisputeJuror, DisputeRecord, Engagement, JobListing } from "@/lib/marketplace";

type DisputeListItem = DisputeRecord & {
  engagement: Engagement | null;
  job: JobListing | null;
  jurorAssignment: DisputeJuror | null;
  partySide: "employer" | "freelancer" | null;
};

export default function DisputesInboxPage() {
  const { user, address, configured, error } = useWalletProfile();
  const { role } = useMarketplaceRole();
  const publicClient = usePublicClient();
  const [ongoingItems, setOngoingItems] = useState<DisputeListItem[]>([]);
  const [exploreItems, setExploreItems] = useState<DisputeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    async function loadDisputes() {
      if (!supabase || !user) return;
      try {
        setLoading(true);
        setMessage("");

        const [{ data: engagementRows, error: engagementError }, { data: jurorAssignments, error: jurorError }, { data: disputeRows, error: disputeError }, { data: jobRows }] =
          await Promise.all([
            supabase.from("engagements").select("*").or(`employer_user_id.eq.${user.id},freelancer_user_id.eq.${user.id}`),
            supabase.from("dispute_jurors").select("*").eq("juror_user_id", user.id),
            supabase.from("disputes").select("*").order("updated_at", { ascending: false }),
            supabase.from("jobs").select("*"),
          ]);

        if (engagementError) throw engagementError;
        if (jurorError) throw jurorError;
        if (disputeError) throw disputeError;

        const engagements = (engagementRows ?? []) as Engagement[];
        const jurorMap = new Map(((jurorAssignments ?? []) as DisputeJuror[]).map((assignment) => [assignment.dispute_id, assignment]));
        const disputes = (disputeRows ?? []) as DisputeRecord[];
        const jobs = (jobRows ?? []) as JobListing[];
        const engagementMap = new Map(engagements.map((engagement) => [engagement.escrow_job_id, engagement]));
        const jobMap = new Map(jobs.map((job) => [job.id, job]));
        const wallet = address ? normalizeWalletAddress(address) : null;

        const onChainJobMap = new Map<number, Job>();
        const allEscrowIds = [...new Set(disputes.map((dispute) => dispute.escrow_job_id))];

        if (publicClient && allEscrowIds.length) {
          const results = await Promise.all(
            allEscrowIds.map(async (escrowId) => {
              try {
                const onChainJob = (await publicClient.readContract({
                  address: ESCROW_ADDRESS,
                  abi: ESCROW_ABI,
                  functionName: "getJobCore",
                  args: [BigInt(escrowId)],
                })) as readonly [`0x${string}`, `0x${string}`, bigint, bigint, number, boolean, boolean];
                return [
                  escrowId,
                  {
                    employer: onChainJob[0],
                    freelancer: onChainJob[1],
                    ratePerSecond: onChainJob[2],
                    totalDeposit: onChainJob[3],
                    streamStartTime: 0n,
                    accumulatedEarned: 0n,
                    totalWithdrawn: 0n,
                    settlementInterval: 0n,
                    lastAutoSettlementTime: 0n,
                    status: onChainJob[4],
                    description: "",
                    streamActive: onChainJob[5],
                    autoSettlementEnabled: onChainJob[6],
                  } satisfies Job,
                ] as const;
              } catch {
                return null;
              }
            })
          );

          results.forEach((entry) => {
            if (entry) onChainJobMap.set(entry[0], entry[1]);
          });
        }

        const linkedItems: DisputeListItem[] = disputes.map((dispute) => {
          const linkedEngagement = engagementMap.get(dispute.escrow_job_id) ?? null;
          const onChainJob = onChainJobMap.get(dispute.escrow_job_id);
          const partySide =
            // On-chain data is the canonical source of truth
            wallet && onChainJob
              ? normalizeWalletAddress(onChainJob.employer) === wallet
                ? "employer"
                : normalizeWalletAddress(onChainJob.freelancer) === wallet
                  ? "freelancer"
                  : null
              // Fall back to Supabase engagement if on-chain data unavailable
              : linkedEngagement && user
                ? linkedEngagement.employer_user_id === user.id
                  ? "employer"
                  : linkedEngagement.freelancer_user_id === user.id
                    ? "freelancer"
                    : null
                : null;
          return {
            ...dispute,
            engagement: linkedEngagement,
            job: dispute.job_id ? jobMap.get(dispute.job_id) ?? null : null,
            jurorAssignment: jurorMap.get(dispute.id) ?? null,
            partySide,
          };
        });

        const ongoing = linkedItems.filter((item) => item.partySide !== null);

        const explore = linkedItems.filter((item) => {
          const isParty = item.partySide !== null;
          return item.open_for_jury && !isParty;
        });

        setOngoingItems(ongoing);
        setExploreItems(explore);
      } catch (loadError) {
        setMessage(loadError instanceof Error ? loadError.message : "Failed to load disputes");
      } finally {
        setLoading(false);
      }
    }

    void loadDisputes();
  }, [address, publicClient, user]);

  const pendingEvidenceCount = useMemo(
    () =>
      ongoingItems.filter((item) => {
        const isEmployer = item.partySide === "employer";
        return isEmployer ? !item.employer_evidence_submitted : !item.freelancer_evidence_submitted;
      }).length,
    [ongoingItems, user]
  );

  const joinDispute = async (item: DisputeListItem) => {
    if (!supabase || !user) return;
    if (item.jurorAssignment) return;

    try {
      setJoiningId(item.id);
      const { data: existingAssignments } = await supabase.from("dispute_jurors").select("*").eq("dispute_id", item.id);
      const assignments = (existingAssignments ?? []) as DisputeJuror[];
      if (assignments.length >= 3) {
        throw new Error("This dispute already has 3 jurors.");
      }

      const { error } = await supabase.from("dispute_jurors").insert({
        dispute_id: item.id,
        juror_user_id: user.id,
        status: "joined",
      });
      if (error) throw error;

      setExploreItems((prev) =>
        prev.map((entry) => (entry.id === item.id ? { ...entry, jurorAssignment: { id: "pending", dispute_id: item.id, juror_user_id: user.id, status: "joined", assigned_at: new Date().toISOString(), responded_at: null } } : entry))
      );
    } catch (joinError) {
      alert(joinError instanceof Error ? joinError.message : "Failed to join dispute");
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <AppShell title="Disputes Hub" subtitle="Track on-chain conflicts and participate in the Decentralized Jury.">
      {!configured && (
        <div className="card-standard mb-6 border-red-900/50 bg-red-900/10 text-red-400">
          Supabase is not configured. Add credentials to your environment.
        </div>
      )}
      
      <div className="mb-12 grid gap-6 md:grid-cols-3">
        <StatusCard label="Current Role" value={role === "employer" ? "Employer" : "Freelancer"} active />
        <StatusCard label="Ongoing Cases" value={String(ongoingItems.length)} />
        <StatusCard label="Pending Action" value={String(pendingEvidenceCount)} highlight={pendingEvidenceCount > 0} />
      </div>

      <div className="grid gap-12 xl:grid-cols-2 row-equal-height">
        {/* Party-side Disputes */}
        <section className="card-standard">
          <div className="card-header border-b border-[var(--border-dim)] pb-4 mb-6">
            <div className="badge badge-accent mb-2">My Cases</div>
            <h3>Active Party Disputes</h3>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-8">
            Disputes where you are a direct party. You must submit evidence to protect your stake.
          </p>

          {loading ? (
            <div className="py-12 text-center text-[var(--text-muted)]">Synchronizing cases...</div>
          ) : !ongoingItems.length ? (
            <div className="py-20 text-center text-[var(--text-muted)] border border-dashed border-[var(--border-dim)] rounded-2xl">
              No active disputes found for this wallet.
            </div>
          ) : (
            <div className="space-y-4">
              {ongoingItems.map((item) => {
                const isEmployer = item.partySide === "employer";
                const waitingOnMe = isEmployer ? !item.employer_evidence_submitted : !item.freelancer_evidence_submitted;
                return (
                  <DisputeCard
                    key={item.id}
                    item={item}
                    statusText={waitingOnMe ? "Evidence Required" : "Processing"}
                    isActionRequired={waitingOnMe}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Public Jury Exploration */}
        <section className="card-standard">
          <div className="card-header border-b border-[var(--border-dim)] pb-4 mb-6">
            <div className="badge badge-accent mb-2">Exploration</div>
            <h3>Open Jury Pool</h3>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-8">
            Browse public disputes and join as a juror to earn reputation and rewards.
          </p>

          {!exploreItems.length ? (
            <div className="py-20 text-center text-[var(--text-muted)] border border-dashed border-[var(--border-dim)] rounded-2xl">
              No public jury cases available right now.
            </div>
          ) : (
            <div className="space-y-6">
              {exploreItems.map((item) => (
                <div key={item.id} className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-2xl p-6">
                  <div className="flex flex-col gap-4">
                    <div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="badge">{item.status}</span>
                        <span className="badge badge-accent uppercase text-[9px]">Job #{item.escrow_job_id}</span>
                      </div>
                      <h4 className="text-lg leading-tight mb-2">{item.job?.title || item.summary || "Public Dispute"}</h4>
                      <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                        {item.job?.description || item.summary || "No description provided."}
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 mt-2">
                      <Link href={`/dispute/${item.escrow_job_id}`} className="btn-secondary text-xs flex-1 text-center">
                        Workspace
                      </Link>
                      <button 
                        onClick={() => void joinDispute(item)} 
                        disabled={Boolean(item.jurorAssignment) || joiningId === item.id} 
                        className="btn-primary text-xs flex-1 px-4"
                      >
                        {item.jurorAssignment ? "Joined" : joiningId === item.id ? "Joining..." : "Join Jury"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function StatusCard({ label, value, active, highlight }: { label: string; value: string; active?: boolean; highlight?: boolean }) {
  return (
    <div className={`card-standard !p-5 ${active ? 'border-[var(--accent-primary)] shadow-[0_0_20px_rgba(255,77,41,0.1)]' : ''}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? 'text-[var(--accent-primary)]' : 'text-white'}`}>{value}</div>
    </div>
  );
}

function DisputeCard({ item, statusText, isActionRequired }: { item: DisputeListItem; statusText: string; isActionRequired: boolean }) {
  return (
    <div className={`bg-[var(--bg-tertiary)] border rounded-2xl p-6 ${isActionRequired ? 'border-[var(--accent-primary)] bg-gradient-to-r from-[var(--bg-tertiary)] to-black' : 'border-[var(--border-dim)]'}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className={`h-1.5 w-1.5 rounded-full ${isActionRequired ? 'bg-[var(--accent-primary)] animate-pulse' : 'bg-white/20'}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{statusText}</span>
          </div>
          <h4 className="text-lg mb-1 leading-tight">{item.job?.title || item.summary || "Case Summary"}</h4>
          <div className="text-[10px] font-mono text-[var(--text-muted)]">Job ID: {item.escrow_job_id}</div>
        </div>
        <Link href={`/dispute/${item.escrow_job_id}`} className={`btn-secondary text-xs px-6 py-2 ${isActionRequired ? 'border-[var(--accent-primary)] text-white' : ''}`}>
          Enter Workspace
        </Link>
      </div>
    </div>
  );
}
