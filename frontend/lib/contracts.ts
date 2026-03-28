import type { Abi } from "viem";
import registryArtifact from "@/abis/CredentialRegistry.json";

const maybeAbi = (artifact: unknown) => {
  if (artifact && typeof artifact === "object" && "abi" in artifact) {
    return (artifact as { abi: unknown }).abi;
  }
  return artifact;
};

export const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_ADDRESS as `0x${string}`;
export const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}`;

export const ESCROW_ABI = [
  {
    type: "function",
    name: "jobCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "createJob",
    stateMutability: "payable",
    inputs: [
      { name: "freelancer", type: "address" },
      { name: "ratePerSecond", type: "uint256" },
      { name: "description", type: "string" },
    ],
    outputs: [{ name: "jobId", type: "uint256" }],
  },
  {
    type: "function",
    name: "acceptJob",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "startStream",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "pauseStream",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resumeStream",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "employerPauseStream",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "dispute",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resolve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "freelancerPercent", type: "uint256" },
      { name: "employerPercent", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "topUp",
    stateMutability: "payable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setAutoSettlement",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "enabled", type: "bool" },
      { name: "settlementInterval", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [{ name: "settledAmount", type: "uint256" }],
  },
  {
    type: "function",
    name: "getEarnedAmount",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [{ name: "earned", type: "uint256" }],
  },
  {
    type: "function",
    name: "getClaimableAmount",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getJobCore",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      { name: "employer", type: "address" },
      { name: "freelancer", type: "address" },
      { name: "ratePerSecond", type: "uint256" },
      { name: "totalDeposit", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "streamActive", type: "bool" },
      { name: "autoSettlementEnabled", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "getJobAccounting",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      { name: "streamStartTime", type: "uint256" },
      { name: "accumulatedEarned", type: "uint256" },
      { name: "totalWithdrawn", type: "uint256" },
      { name: "settlementInterval", type: "uint256" },
      { name: "lastAutoSettlementTime", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getJobDescription",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "event",
    name: "JobCreated",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "employer", type: "address", indexed: true },
      { name: "freelancer", type: "address", indexed: true },
      { name: "ratePerSecond", type: "uint256", indexed: false },
      { name: "totalDeposit", type: "uint256", indexed: false },
      { name: "description", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "freelancer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AutoSettled",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "settledAt", type: "uint256", indexed: false },
    ],
  },
] as const satisfies Abi;

export const REGISTRY_ABI = maybeAbi(registryArtifact) as Abi;

export const JOB_STATUS = {
  0: "Created",
  1: "Active",
  2: "Paused",
  3: "Completed",
  4: "Disputed",
  5: "Resolved",
  6: "Cancelled",
} as const;

export type Credential = {
  id: bigint;
  credentialType: string;
  description: string;
  issuerName: string;
  issuerAddress: string;
  timestamp: bigint;
  isValid: boolean;
};

export type Job = {
  employer: string;
  freelancer: string;
  ratePerSecond: bigint;
  totalDeposit: bigint;
  streamStartTime: bigint;
  accumulatedEarned: bigint;
  totalWithdrawn: bigint;
  settlementInterval: bigint;
  lastAutoSettlementTime: bigint;
  status: number;
  description: string;
  streamActive: boolean;
  autoSettlementEnabled: boolean;
};
