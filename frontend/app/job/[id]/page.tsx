"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { formatEther } from "viem";
import { useReadContract } from "wagmi";
import { AppShell } from "@/components/Shell";
import { ESCROW_ABI, ESCROW_ADDRESS, JOB_STATUS } from "@/lib/contracts";
import { useEscrowJob } from "@/hooks/useEscrowJob";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = Number(params.id);

  const { job } = useEscrowJob(jobId, { refetchInterval: 2000 });

  const { data: earned } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: "getEarnedAmount",
    args: [BigInt(jobId)],
    query: { refetchInterval: 1000 },
  });

  return (
    <AppShell title={`Job #${jobId}`} subtitle="Deep link for demo narration and dispute status.">
      {!job ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/50">Loading job...</div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
            <div className="mb-2 text-sm text-white/45">Status</div>
            <div className="mb-4 text-3xl font-semibold">{JOB_STATUS[job.status as keyof typeof JOB_STATUS] || "Unknown"}</div>
            <p className="text-white/75">{job.description}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard label="Employer" value={job.employer} />
            <MetricCard label="Freelancer" value={job.freelancer} />
            <MetricCard label="Rate" value={`${formatEther(job.ratePerSecond)} MON/s`} />
            <MetricCard label="Escrow" value={`${formatEther(job.totalDeposit)} MON`} />
            <MetricCard label="Withdrawn" value={`${formatEther(job.totalWithdrawn)} MON`} />
            <MetricCard label="Earned so far" value={`${earned ? formatEther(earned as bigint) : "0"} MON`} />
          </div>

          {job.status === 4 ? (
            <Link href={`/dispute/${jobId}`} className="inline-flex rounded-2xl bg-red-500/20 px-5 py-3 font-semibold text-red-300 transition hover:bg-red-500/30">
              Open dispute resolution
            </Link>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="mb-1 text-xs uppercase tracking-[0.2em] text-white/40">{label}</div>
      <div className="font-mono text-sm text-white/85">{value}</div>
    </div>
  );
}
