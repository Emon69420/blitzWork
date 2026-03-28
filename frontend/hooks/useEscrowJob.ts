"use client";

import { useMemo, useRef } from "react";
import { useReadContracts } from "wagmi";
import { ESCROW_ABI, ESCROW_ADDRESS, type Job } from "@/lib/contracts";

type UseEscrowJobOptions = {
  enabled?: boolean;
  refetchInterval?: number;
};

export function useEscrowJob(jobId: number, options?: UseEscrowJobOptions) {
  const enabled = options?.enabled ?? Number.isFinite(jobId);
  const refetchInterval = options?.refetchInterval ?? 2000;

  const query = useReadContracts({
    contracts: [
      {
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "getJobCore",
        args: [BigInt(jobId)],
      },
      {
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "getJobAccounting",
        args: [BigInt(jobId)],
      },
      {
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "getJobDescription",
        args: [BigInt(jobId)],
      },
    ],
    query: {
      enabled,
      refetchInterval,
    },
  });

  const prevJob = useRef<Job | undefined>(undefined);
  
  const job = useMemo<Job | undefined>(() => {
    const [core, accounting, description] = query.data ?? [];
    if (core?.status !== "success" || accounting?.status !== "success" || description?.status !== "success") {
      return prevJob.current;
    }

    const [employer, freelancer, ratePerSecond, totalDeposit, status, streamActive, autoSettlementEnabled] =
      core.result as readonly [`0x${string}`, `0x${string}`, bigint, bigint, number, boolean, boolean];
    const [streamStartTime, accumulatedEarned, totalWithdrawn, settlementInterval, lastAutoSettlementTime] =
      accounting.result as readonly [bigint, bigint, bigint, bigint, bigint];
    const jobDescription = description.result as string;

    const newJob = {
      employer,
      freelancer,
      ratePerSecond,
      totalDeposit,
      streamStartTime,
      accumulatedEarned,
      totalWithdrawn,
      settlementInterval,
      lastAutoSettlementTime,
      status,
      description: jobDescription,
      streamActive,
      autoSettlementEnabled,
    };
    
    prevJob.current = newJob;
    return newJob;
  }, [query.data]);

  return {
    ...query,
    job,
  };
}
