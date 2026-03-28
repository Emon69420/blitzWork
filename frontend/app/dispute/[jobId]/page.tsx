"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/Shell";
import { useMarketplaceRole } from "@/hooks/useMarketplaceRole";
import { type Job } from "@/lib/contracts";
import { supabase } from "@/lib/supabase";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import { normalizeWalletAddress } from "@/lib/marketplace";
import type { DisputeJuror, DisputeRecord, Engagement, JurorVote } from "@/lib/marketplace";
import { useEscrowJob } from "@/hooks/useEscrowJob";

type ResolutionResponse = {
  success: boolean;
  freelancerPercent: number;
  employerPercent: number;
  reasoning: string;
  txHash?: string;
  aiUsed?: boolean;
  error?: string;
};

export default function DisputePage() {
  const params = useParams<{ jobId: string }>();
  const escrowJobId = Number(params.jobId);
  const { user, address, configured } = useWalletProfile();
  const { role } = useMarketplaceRole();
  const [myEvidence, setMyEvidence] = useState("");
  const [loading, setLoading] = useState(false);
  const [voteLoading, setVoteLoading] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [resolution, setResolution] = useState<ResolutionResponse | null>(null);
  const [disputeRecord, setDisputeRecord] = useState<DisputeRecord | null>(null);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [joinedJurors, setJoinedJurors] = useState<DisputeJuror[]>([]);
  const [jurorVotes, setJurorVotes] = useState<JurorVote[]>([]);
  const [voteChoice, setVoteChoice] = useState<"freelancer" | "employer">("freelancer");
  const [voteReasoning, setVoteReasoning] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const autoFinalizedRef = useRef(false);

  const { job } = useEscrowJob(escrowJobId, { refetchInterval: 3000 });

  async function hydrateState() {
    if (!supabase) return;

    const [{ data: disputeRow }, { data: engagementRow }] = await Promise.all([
      supabase.from("disputes").select("*").eq("escrow_job_id", escrowJobId).maybeSingle(),
      supabase.from("engagements").select("*").eq("escrow_job_id", escrowJobId).maybeSingle(),
    ]);

    const typedDispute = (disputeRow as DisputeRecord | null) ?? null;
    setDisputeRecord(typedDispute);
    setEngagement((engagementRow as Engagement | null) ?? null);

    if (typedDispute) {
      const [{ data: assignments }, { data: votes }] = await Promise.all([
        supabase.from("dispute_jurors").select("*").eq("dispute_id", typedDispute.id),
        supabase.from("juror_votes").select("*").eq("dispute_id", typedDispute.id),
      ]);
      setJoinedJurors((assignments ?? []) as DisputeJuror[]);
      setJurorVotes((votes ?? []) as JurorVote[]);
    } else {
      setJoinedJurors([]);
      setJurorVotes([]);
    }
  }

  useEffect(() => {
    void hydrateState();
  }, [escrowJobId]);

  const partySide = useMemo<"employer" | "freelancer" | null>(() => {
    // On-chain data is the canonical source of truth for roles
    if (address && job) {
      const wallet = normalizeWalletAddress(address);
      if (normalizeWalletAddress(job.employer) === wallet) return "employer";
      if (normalizeWalletAddress(job.freelancer) === wallet) return "freelancer";
    }
    // Fall back to Supabase engagement only if on-chain data hasn't loaded yet
    if (user && engagement) {
      if (engagement.employer_user_id === user.id) return "employer";
      if (engagement.freelancer_user_id === user.id) return "freelancer";
    }
    return null;
  }, [address, engagement, job, user]);

  const isParty = Boolean(partySide);
  const isJuror = useMemo(() => Boolean(user && disputeRecord && joinedJurors.find((entry) => entry.juror_user_id === user.id)), [disputeRecord, joinedJurors, user]);
  const myJurorEntry = useMemo(() => (user ? joinedJurors.find((entry) => entry.juror_user_id === user.id) ?? null : null), [joinedJurors, user]);
  const myVote = useMemo(() => (user ? jurorVotes.find((vote) => vote.juror_user_id === user.id) ?? null : null), [jurorVotes, user]);

  useEffect(() => {
    if (!disputeRecord || !partySide) {
      setMyEvidence("");
      return;
    }

    setMyEvidence(partySide === "employer" ? disputeRecord.employer_claim ?? "" : disputeRecord.freelancer_claim ?? "");
  }, [disputeRecord, partySide]);

  useEffect(() => {
    if (!disputeRecord?.expires_at) {
      setSecondsLeft(null);
      return;
    }

    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(disputeRecord.expires_at!).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [disputeRecord?.expires_at]);

  const tally = useMemo(() => {
    const freelancerVotes = jurorVotes.filter((vote) => vote.freelancer_percent > vote.employer_percent).length;
    const employerVotes = jurorVotes.filter((vote) => vote.employer_percent > vote.freelancer_percent).length;
    const totalJoined = joinedJurors.length;
    // Majority is simply more than half of the total joined jurors
    const majority = totalJoined > 0 ? Math.floor(totalJoined / 2) + 1 : 1;
    const winner = freelancerVotes >= majority ? "freelancer" : employerVotes >= majority ? "employer" : null;
    return {
      freelancerVotes,
      employerVotes,
      totalJoined,
      majority,
      winner,
      freelancerPercent: winner === "freelancer" ? 100 : winner === "employer" ? 0 : null,
      employerPercent: winner === "employer" ? 100 : winner === "freelancer" ? 0 : null,
      reasoning:
        winner === "freelancer"
          ? `Jury majority awarded the full escrow to the freelancer (${freelancerVotes} votes).`
          : winner === "employer"
            ? `Jury majority awarded the full escrow back to the employer (${employerVotes} votes).`
            : totalJoined > 0 
              ? "Voting in progress. Majority not yet reached." 
              : "Waiting for jurors to join.",
    };
  }, [joinedJurors.length, jurorVotes]);

  const votingOpen = Boolean(disputeRecord?.open_for_jury && disputeRecord?.expires_at && new Date(disputeRecord.expires_at).getTime() > Date.now());
  const votingExpired = Boolean(disputeRecord?.open_for_jury && disputeRecord?.expires_at && new Date(disputeRecord.expires_at).getTime() <= Date.now());

  async function submitPartyEvidence() {
    if (!supabase || !user || !partySide || !job) return;

    try {
      setLoading(true);

      const now = new Date().toISOString();

      // Re-fetch the latest dispute record to avoid overwriting the other party's evidence
      const { data: latestRecord } = await supabase
        .from("disputes")
        .select("*")
        .eq("escrow_job_id", escrowJobId)
        .maybeSingle();
      const latest = latestRecord as DisputeRecord | null;

      const currentFreelancerClaim = partySide === "freelancer" ? myEvidence : latest?.freelancer_claim ?? null;
      const currentEmployerClaim = partySide === "employer" ? myEvidence : latest?.employer_claim ?? null;
      const freelancerSubmitted = partySide === "freelancer" ? true : latest?.freelancer_evidence_submitted ?? false;
      const employerSubmitted = partySide === "employer" ? true : latest?.employer_evidence_submitted ?? false;
      const bothSubmitted = freelancerSubmitted && employerSubmitted;
      const expiresAt = bothSubmitted
        ? latest?.expires_at || new Date(Date.now() + 60_000).toISOString()
        : latest?.expires_at || null;

      const payload = {
        engagement_id: engagement?.id ?? latest?.engagement_id ?? null,
        job_id: engagement?.job_id ?? latest?.job_id ?? null,
        escrow_job_id: escrowJobId,
        raised_by_user_id: latest?.raised_by_user_id ?? user.id,
        raised_by_role: latest?.raised_by_role ?? partySide,
        status: bothSubmitted ? "voting" : "awaiting_evidence",
        summary: job.description ?? "Escrow dispute",
        freelancer_claim: currentFreelancerClaim,
        employer_claim: currentEmployerClaim,
        freelancer_evidence_submitted: freelancerSubmitted,
        employer_evidence_submitted: employerSubmitted,
        open_for_jury: bothSubmitted,
        expires_at: expiresAt,
        updated_at: now,
      };

      const { data: dispute, error } = await supabase
        .from("disputes")
        .upsert(payload, { onConflict: "escrow_job_id" })
        .select("*")
        .single();

      if (error || !dispute) {
        throw error || new Error("Failed to save dispute");
      }

      await supabase.from("dispute_evidence").insert({
        dispute_id: dispute.id,
        submitted_by_user_id: user.id,
        side: partySide,
        evidence_type: "text",
        content_text: myEvidence,
      });

      await hydrateState();
    } catch (submitError) {
      console.error(submitError);
      alert(submitError instanceof Error ? submitError.message : "Failed to submit evidence");
    } finally {
      setLoading(false);
    }
  }

  async function joinAsJuror() {
    if (!supabase || !user || !disputeRecord || !job || !address) return;

    try {
      setVoteLoading(true);
      
      const myWallet = normalizeWalletAddress(address);
      const isEmployer = normalizeWalletAddress(job.employer) === myWallet;
      const isFreelancer = normalizeWalletAddress(job.freelancer) === myWallet;

      if (isEmployer || isFreelancer) {
        throw new Error("Direct parties (Employer/Freelancer) are prohibited from joining the jury.");
      }

      const { error } = await supabase.from("dispute_jurors").upsert(
        {
          dispute_id: disputeRecord.id,
          juror_user_id: user.id,
          status: "joined",
        },
        { onConflict: "dispute_id,juror_user_id" }
      );

      if (error) throw error;
      await hydrateState();
    } catch (joinError) {
      alert(joinError instanceof Error ? joinError.message : "Failed to join dispute as juror");
    } finally {
      setVoteLoading(false);
    }
  }

  async function submitJurorVote() {
    if (!supabase || !user || !disputeRecord || !myJurorEntry) return;

    try {
      setVoteLoading(true);
      const freelancerPercent = voteChoice === "freelancer" ? 100 : 0;
      const employerPercent = voteChoice === "employer" ? 100 : 0;

      const { error: voteError } = await supabase.from("juror_votes").upsert(
        {
          dispute_id: disputeRecord.id,
          juror_user_id: user.id,
          freelancer_percent: freelancerPercent,
          employer_percent: employerPercent,
          reasoning: voteReasoning || `Juror voted in favor of the ${voteChoice}.`,
        },
        { onConflict: "dispute_id,juror_user_id" }
      );
      if (voteError) throw voteError;

      const { error: jurorError } = await supabase
        .from("dispute_jurors")
        .update({
          status: "voted",
          responded_at: new Date().toISOString(),
        })
        .eq("dispute_id", disputeRecord.id)
        .eq("juror_user_id", user.id);

      if (jurorError) throw jurorError;
      await hydrateState();
    } catch (submitError) {
      alert(submitError instanceof Error ? submitError.message : "Failed to submit juror vote");
    } finally {
      setVoteLoading(false);
    }
  }

  async function finalizeVerdict() {
    if (!disputeRecord || tally.freelancerPercent === null || tally.employerPercent === null || !job) return;

    // Strict on-chain status check before proceeding
    if (job.status !== 4) {
      console.warn(`[Finalize] On-chain status is ${job.status}, expected 4 (Disputed). Aborting.`);
      return;
    }

    try {
      setFinalizeLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"}/api/finalize-jury-dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: escrowJobId,
          freelancerPercent: tally.freelancerPercent,
          employerPercent: tally.employerPercent,
          reasoning: tally.reasoning,
        }),
      });

      const json = (await response.json()) as ResolutionResponse;
      if (!response.ok || !json.success) {
        // If the backend says it's already resolved, we should just refresh and move on
        if (json.error?.includes("Already resolved") || response.status === 400) {
          await hydrateState();
          return;
        }
        throw new Error(json.error || "Failed to finalize jury verdict");
      }

      setResolution(json);
      await supabase
        ?.from("disputes")
        .update({
          status: "resolved",
          final_freelancer_percent: json.freelancerPercent,
          final_employer_percent: json.employerPercent,
          final_reasoning: json.reasoning,
          resolution_tx_hash: json.txHash ?? null,
          finalized_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", disputeRecord.id);

      await hydrateState();
    } catch (finalizeError) {
      // Avoid showing alert for expected status mismatches that were already caught
      if (finalizeError instanceof Error && finalizeError.message.includes("status")) {
        console.warn(finalizeError.message);
        return;
      }
      alert(finalizeError instanceof Error ? finalizeError.message : "Failed to finalize verdict");
    } finally {
      setFinalizeLoading(false);
    }
  }

  useEffect(() => {
    if (!disputeRecord || !votingExpired || !tally.winner || autoFinalizedRef.current || disputeRecord.status === "resolved" || job?.status !== 4) return;
    autoFinalizedRef.current = true;
    void finalizeVerdict();
  }, [disputeRecord, tally.winner, votingExpired, job?.status]);

  return (
    <AppShell title={`Dispute #${escrowJobId}`} subtitle="Decentralized conflict resolution with high-precision evidence submission.">
      {!configured && (
        <div className="card-standard mb-6 border-red-900/50 bg-red-900/10 text-red-400">
          Supabase is not configured. Add credentials to your environment.
        </div>
      )}

      <div className="mb-12 grid gap-6 md:grid-cols-4">
        <PanelStat label="Mode" value={role === "employer" ? "Employer" : "Freelancer"} active />
        <PanelStat label="Identity" value={partySide || (isJuror ? "Juror" : "Observer")} />
        <PanelStat label="Score" value={`${tally.freelancerVotes} - ${tally.employerVotes}`} highlight={tally.totalJoined > 0} />
        <PanelStat label="Time Left" value={secondsLeft === null ? "--" : `${secondsLeft}s`} highlight={secondsLeft !== null && secondsLeft < 60} />
      </div>

      <div className="grid gap-12 xl:grid-cols-[1.1fr_0.9fr] row-equal-height">
        {/* Party Evidence */}
        <section className="card-standard">
          <div className="card-header border-b border-[var(--border-dim)] pb-4 mb-6">
            <div className="badge badge-accent mb-2">Evidence</div>
            <h3>Conflict Context</h3>
          </div>
          
          <div className="grid gap-3 mb-8">
            <StatusRow label="Originator" value={disputeRecord?.raised_by_role || "Unknown"} />
            <StatusRow label="Employer Status" value={disputeRecord?.employer_evidence_submitted ? "Evidence Locked" : "Awaiting Submission"} active={disputeRecord?.employer_evidence_submitted} />
            <StatusRow label="Freelancer Status" value={disputeRecord?.freelancer_evidence_submitted ? "Evidence Locked" : "Awaiting Submission"} active={disputeRecord?.freelancer_evidence_submitted} />
          </div>

          {isParty ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between ml-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Your Statement ({partySide})
                </div>
                {(partySide === "employer" ? disputeRecord?.employer_evidence_submitted : disputeRecord?.freelancer_evidence_submitted) && (
                  <div className="badge badge-accent text-[9px]">Record Locked</div>
                )}
              </div>

              {((partySide === "employer" && !disputeRecord?.employer_evidence_submitted) || 
                (partySide === "freelancer" && !disputeRecord?.freelancer_evidence_submitted)) ? (
                <>
                  <textarea
                    value={myEvidence}
                    onChange={(e) => setMyEvidence(e.target.value)}
                    rows={6}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none resize-none text-sm leading-relaxed"
                    placeholder="Detail the case for your claim..."
                  />
                  <button 
                    onClick={submitPartyEvidence} 
                    disabled={loading || !myEvidence.trim()} 
                    className="btn-primary w-full py-4 text-xs font-bold uppercase tracking-widest"
                  >
                    {loading ? "Locking Evidence..." : "Commit Statement to Record"}
                  </button>
                </>
              ) : (
                <div className="p-6 bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl text-center border-dashed">
                  <p className="text-sm text-[var(--accent-primary)] font-bold italic">Statement submitted and locked.</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1 uppercase tracking-tight">You can no longer modify your claim for this dispute.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl text-center">
              <p className="text-sm text-[var(--text-muted)]">You are observing this case as a non-party.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pt-8 border-t border-[var(--border-dim)]">
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Freelancer Claim</div>
              <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl text-sm leading-relaxed">
                {disputeRecord?.freelancer_claim || "No statement yet."}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Employer Claim</div>
              <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl text-sm leading-relaxed">
                {disputeRecord?.employer_claim || "No statement yet."}
              </div>
            </div>
          </div>
          {job ? (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-dim)] rounded-xl p-6 mt-8">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Registry Context</div>
              <p className="text-sm leading-relaxed">{job.description}</p>
            </div>
          ) : null}
        </section>

        {/* Jury Floor */}
        <section className="card-standard">
          <div className="card-header border-b border-[var(--border-dim)] pb-4 mb-6">
            <div className="badge badge-accent mb-2">Jury Floor</div>
            <h3>Decentralized Deliberation</h3>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-8">
            Outside wallets join to review evidence. Majority consensus triggers final on-chain settlement.
          </p>

          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <PanelStat label="Seats Filled" value={`${joinedJurors.length}`} active={joinedJurors.length > 0} />
            <PanelStat label="Quorum" value={String(tally.majority)} />
            <PanelStat label="Consensus" value={tally.winner || "Forming"} highlight={Boolean(tally.winner)} />
          </div>

          <div className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-6 mb-8">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4">Juror Record</div>
            <div className="space-y-3">
              {joinedJurors.length ? (
                joinedJurors.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] border border-[var(--border-dim)] rounded-lg">
                    <Link href={`/profile/${entry.juror_user_id}`} className="font-mono text-xs truncate max-w-[200px] hover:text-[var(--accent-primary)] transition-colors">
                      {entry.juror_user_id}
                    </Link>
                    <span className={`badge ${entry.status === 'voted' ? 'badge-accent' : ''} text-[9px]`}>{entry.status}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-[var(--text-muted)] italic text-center py-4">Waiting for jurors to step forward...</div>
              )}
            </div>

            {!isParty ? (
              <button
                onClick={isJuror ? submitJurorVote : joinAsJuror}
                disabled={voteLoading || (!isJuror && (!disputeRecord?.open_for_jury || votingExpired))}
                className="btn-primary w-full mt-6 text-xs font-bold uppercase tracking-widest"
              >
                {voteLoading ? "Synchronizing..." : isJuror ? "Lock Vote" : "Join Jury Pool"}
              </button>
            ) : (
              <div className="mt-6 p-4 bg-red-900/10 border border-red-900/30 rounded-lg text-center">
                <p className="text-[10px] text-red-400 font-bold uppercase">Restricted</p>
                <p className="text-xs text-red-500/70 mt-1">Direct parties are excluded from jury duty.</p>
              </div>
            )}
          </div>

          {isJuror && (
            <div className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-6 mb-8">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4">Your Verdict</div>
              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => setVoteChoice("freelancer")}
                  className={`flex-1 py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${voteChoice === 'freelancer' ? 'bg-[var(--accent-primary)] text-black border-transparent shadow-[0_0_15px_rgba(255,77,41,0.2)]' : 'bg-[var(--bg-secondary)] border border-[var(--border-dim)] text-[var(--text-muted)]'}`}
                >
                  Freelancer
                </button>
                <button
                  onClick={() => setVoteChoice("employer")}
                  className={`flex-1 py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${voteChoice === 'employer' ? 'bg-[var(--accent-primary)] text-black border-transparent shadow-[0_0_15px_rgba(255,77,41,0.2)]' : 'bg-[var(--bg-secondary)] border border-[var(--border-dim)] text-[var(--text-muted)]'}`}
                >
                  Employer
                </button>
              </div>
              <textarea
                value={voteReasoning}
                onChange={(e) => setVoteReasoning(e.target.value)}
                rows={3}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-dim)] rounded-xl p-4 text-white focus:border-[var(--accent-primary)] outline-none resize-none text-sm leading-relaxed"
                placeholder="Briefly justify your decision..."
              />
              {myVote && (
                <div className="mt-4 pt-4 border-t border-[var(--border-dim)]">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-primary)] mb-1">
                    On-Chain Intent Record
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">Saved Decision:</span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {myVote.freelancer_percent > myVote.employer_percent ? "Freelancer" : "Employer"}
                    </span>
                  </div>
                  {((voteChoice === 'freelancer' && myVote.employer_percent > 0) || (voteChoice === 'employer' && myVote.freelancer_percent > 0)) && (
                    <div className="mt-2 text-[9px] text-[var(--text-muted)] italic">
                      * You have a pending change. Click "Lock Vote" to update.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl p-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4">Finalization</div>
            <p className="text-sm leading-relaxed mb-6">{tally.reasoning}</p>
            
            {votingOpen ? (
              <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--accent-primary)] rounded-lg text-center mb-6">
                <div className="text-[10px] font-bold uppercase text-[var(--accent-primary)] mb-1">Window Closing</div>
                <div className="text-2xl font-bold tabular-nums text-white">{secondsLeft ?? 0}s</div>
              </div>
            ) : disputeRecord?.open_for_jury ? (
              <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-dim)] rounded-lg text-center mb-6">
                <span className="text-xs font-bold text-white uppercase italic">Consensus reached. executing settlement via keeper.</span>
              </div>
            ) : null}

            {finalizeLoading && (
              <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--accent-primary)] rounded-lg text-center">
                <span className="text-xs font-bold text-white uppercase animate-pulse">Synchronizing on-chain state...</span>
              </div>
            )}
          </div>

          {(resolution || disputeRecord?.finalized_at) && (
            <div className="mt-8 pt-8 border-t border-[var(--border-dim)] space-y-6">
              <div className="badge badge-accent">On-Chain Resolution Locked</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-dim)]">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">Freelancer</div>
                  <div className="text-xl font-bold text-white">{resolution?.freelancerPercent ?? disputeRecord?.final_freelancer_percent}%</div>
                </div>
                <div className="bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-dim)]">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">Employer</div>
                  <div className="text-xl font-bold text-white">{resolution?.employerPercent ?? disputeRecord?.final_employer_percent}%</div>
                </div>
              </div>
              <p className="text-sm text-[var(--text-muted)] italic leading-relaxed">{resolution?.reasoning ?? disputeRecord?.final_reasoning}</p>
              {(resolution?.txHash ?? disputeRecord?.resolution_tx_hash) && (
                <a
                  href={`https://testnet.monadexplorer.com/tx/${resolution?.txHash ?? disputeRecord?.resolution_tx_hash}`}
                  target="_blank"
                  className="btn-secondary w-full text-center text-xs"
                >
                  View Receipt
                </a>
              )}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function PanelStat({ label, value, active, highlight }: { label: string; value: string; active?: boolean; highlight?: boolean }) {
  return (
    <div className={`card-standard !p-5 ${active ? 'border-[var(--accent-primary)] shadow-[0_0_20px_rgba(255,77,41,0.1)]' : ''}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? 'text-[var(--accent-primary)]' : 'text-white'}`}>{value}</div>
    </div>
  );
}

function StatusRow({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] border border-[var(--border-dim)] rounded-xl text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={`font-bold ${active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}>{value}</span>
    </div>
  );
}
