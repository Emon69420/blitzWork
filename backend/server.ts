import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { ethers } from "ethers";

dotenv.config();

const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000", "https://monadwork.vercel.app"],
  })
);
app.use(express.json());

const MONAD_RPC = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const ARBITRATOR_KEY = process.env.ARBITRATOR_PRIVATE_KEY;
const ESCROW_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS;
const REGISTRY_ADDRESS = process.env.REGISTRY_CONTRACT_ADDRESS;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!ARBITRATOR_KEY || !ESCROW_ADDRESS || !REGISTRY_ADDRESS) {
  console.error("Missing ARBITRATOR_PRIVATE_KEY, ESCROW_CONTRACT_ADDRESS, or REGISTRY_CONTRACT_ADDRESS in .env");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(MONAD_RPC);
const arbitratorWallet = new ethers.Wallet(ARBITRATOR_KEY, provider);

const ESCROW_ABI = [
  "function resolve(uint256 jobId, uint256 freelancerPercent, uint256 employerPercent) external",
  "function jobCount() external view returns (uint256)",
  "function getJobCore(uint256 jobId) external view returns (address employer, address freelancer, uint256 ratePerSecond, uint256 totalDeposit, uint8 status, bool streamActive, bool autoSettlementEnabled)",
  "function getJobAccounting(uint256 jobId) external view returns (uint256 streamStartTime, uint256 accumulatedEarned, uint256 totalWithdrawn, uint256 settlementInterval, uint256 lastAutoSettlementTime)",
  "function getClaimableAmount(uint256 jobId) external view returns (uint256)",
  "function settle(uint256 jobId) external returns (uint256 settledAmount)",
];

const REGISTRY_ABI = [
  "function issueCredential(address freelancer, string calldata credentialType, string calldata description, string calldata issuerName) external returns (uint256 credentialId)",
  "function getCredentials(address freelancer) external view returns (tuple(uint256 id, string credentialType, string description, string issuerName, address issuerAddress, uint256 timestamp, bool isValid)[])",
];

const escrowContract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, arbitratorWallet);
const registryContract = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, arbitratorWallet);
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

type ArbitrationInput = {
  jobId: number;
  freelancerEvidence: string;
  employerEvidence: string;
  jobDescription?: string;
};

type ArbitrationOutput = {
  freelancerPercent: number;
  employerPercent: number;
  reasoning: string;
  aiUsed: boolean;
};

type JuryFinalizeInput = {
  jobId: number;
  freelancerPercent: number;
  employerPercent: number;
  reasoning?: string;
};

function buildArbitrationPrompt(
  jobDescription: string,
  freelancerEvidence: string,
  employerEvidence: string,
  escrowAmount: string
): string {
  return `You are a professional freelance dispute arbitrator. Your job is to analyze evidence from both parties in a freelance contract dispute and determine a fair percentage split of the escrowed funds.

## CONTRACT DETAILS
Job Description: ${jobDescription}
Total Escrowed Amount: ${escrowAmount} MON

## FREELANCER'S EVIDENCE
${freelancerEvidence}

## EMPLOYER'S EVIDENCE
${employerEvidence}

## YOUR TASK
Carefully analyze both sides. Consider:
1. Was the work completed as described in the job description?
2. Did the freelancer communicate clearly and professionally?
3. Did the employer provide clear requirements and timely feedback?
4. What is the most fair outcome given the evidence provided?
5. If evidence is unclear, default to a split that reflects partial completion.

## RESPONSE FORMAT
You MUST respond with ONLY valid JSON in this exact format:
{
  "freelancerPercent": <integer 0-100>,
  "employerPercent": <integer 0-100>,
  "reasoning": "<2-3 sentence explanation of your ruling>"
}

IMPORTANT: freelancerPercent + employerPercent MUST equal exactly 100.
IMPORTANT: Be decisive. Do not hedge with exactly 50/50 unless the evidence is genuinely ambiguous.`;
}

function normalizeRuling(parsed: unknown): ArbitrationOutput | null {
  if (!parsed || typeof parsed !== "object") return null;

  const candidate = parsed as {
    freelancerPercent?: number;
    employerPercent?: number;
    reasoning?: string;
  };

  if (
    typeof candidate.freelancerPercent !== "number" ||
    typeof candidate.employerPercent !== "number" ||
    candidate.freelancerPercent < 0 ||
    candidate.freelancerPercent > 100 ||
    candidate.freelancerPercent + candidate.employerPercent !== 100
  ) {
    return null;
  }

  return {
    freelancerPercent: Math.round(candidate.freelancerPercent),
    employerPercent: 100 - Math.round(candidate.freelancerPercent),
    reasoning: candidate.reasoning || "AI arbitration completed.",
    aiUsed: true,
  };
}

async function getAiRuling(input: ArbitrationInput, escrowAmount: string): Promise<ArbitrationOutput> {
  if (!ai) {
    return {
      freelancerPercent: 50,
      employerPercent: 50,
      reasoning: "AI arbitration is not configured. Default 50/50 split applied for fairness.",
      aiUsed: false,
    };
  }

  try {
    const prompt = buildArbitrationPrompt(
      input.jobDescription || "No description provided",
      input.freelancerEvidence,
      input.employerEvidence,
      escrowAmount
    );

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error("Gemini returned an empty response");
    }
    const parsed = JSON.parse(rawText);
    const normalized = normalizeRuling(parsed);
    if (normalized) {
      return normalized;
    }
  } catch (error) {
    console.error("[Dispute] Gemini API error, using fallback:", error);
  }

  return {
    freelancerPercent: 50,
    employerPercent: 50,
    reasoning: "AI arbitration temporarily unavailable. Default 50/50 split applied for fairness.",
    aiUsed: false,
  };
}

app.post("/api/resolve-dispute", async (req: Request, res: Response) => {
  const body = req.body as Partial<ArbitrationInput>;
  const jobId = typeof body.jobId === "number" ? body.jobId : Number(body.jobId);

  if (
    !Number.isFinite(jobId) ||
    !body.freelancerEvidence ||
    !body.employerEvidence
  ) {
    return res.status(400).json({
      error: "Missing required fields: jobId, freelancerEvidence, employerEvidence",
    });
  }

  console.log(`\n[Dispute] Resolving job #${jobId}...`);

  let escrowAmount = "unknown";
  try {
    const core = await escrowContract.getJobCore(BigInt(jobId));
    const accounting = await escrowContract.getJobAccounting(BigInt(jobId));
    escrowAmount = ethers.formatEther(core.totalDeposit - accounting.totalWithdrawn);
    console.log(`[Dispute] Escrow remaining: ${escrowAmount} MON`);
  } catch (error) {
    console.warn("[Dispute] Could not fetch job from chain:", error);
  }

  const ruling = await getAiRuling(
    {
      jobId,
      freelancerEvidence: body.freelancerEvidence,
      employerEvidence: body.employerEvidence,
      jobDescription: body.jobDescription,
    },
    escrowAmount
  );

  try {
    console.log(
      `[Dispute] Submitting resolve(${jobId}, ${ruling.freelancerPercent}, ${ruling.employerPercent}) to Monad...`
    );

    const tx = await escrowContract.resolve(
      BigInt(jobId),
      BigInt(ruling.freelancerPercent),
      BigInt(ruling.employerPercent)
    );
    const receipt = await tx.wait();

    return res.json({
      success: true,
      freelancerPercent: ruling.freelancerPercent,
      employerPercent: ruling.employerPercent,
      reasoning: ruling.reasoning,
      txHash: receipt?.hash || tx.hash,
      aiUsed: ruling.aiUsed,
    });
  } catch (error) {
    console.error("[Dispute] Transaction failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to submit resolution transaction",
      ruling,
    });
  }
});

app.post("/api/finalize-jury-dispute", async (req: Request, res: Response) => {
  const body = req.body as Partial<JuryFinalizeInput>;
  const jobId = typeof body.jobId === "number" ? body.jobId : Number(body.jobId);
  const freelancerPercent =
    typeof body.freelancerPercent === "number" ? body.freelancerPercent : Number(body.freelancerPercent);
  const employerPercent =
    typeof body.employerPercent === "number" ? body.employerPercent : Number(body.employerPercent);

  if (
    !Number.isFinite(jobId) ||
    !Number.isFinite(freelancerPercent) ||
    !Number.isFinite(employerPercent) ||
    freelancerPercent < 0 ||
    employerPercent < 0 ||
    freelancerPercent + employerPercent !== 100
  ) {
    return res.status(400).json({
      error: "Missing or invalid fields: jobId, freelancerPercent, employerPercent",
    });
  }

  try {
    // 1. Check current on-chain status
    console.log(`[Jury] Verifying on-chain status for job #${jobId}...`);
    const core = await escrowContract.getJobCore(BigInt(jobId));
    const currentStatus = Number(core.status);
    
    console.log(`[Jury] Job #${jobId} on-chain status: ${currentStatus}`);

    // Status 5 = Resolved
    if (currentStatus === 5) {
      console.log(`[Jury] Job #${jobId} already resolved on-chain. Returning success.`);
      return res.json({
        success: true,
        freelancerPercent: Math.round(freelancerPercent),
        employerPercent: Math.round(employerPercent),
        reasoning: body.reasoning || "Already resolved on-chain.",
        txHash: null,
      });
    }

    // Status 4 = Disputed
    if (currentStatus !== 4) {
      console.warn(`[Jury] Job #${jobId} is not in Disputed status (Status: ${currentStatus}). Resolution aborted.`);
      return res.status(400).json({
        success: false,
        error: `On-chain job status is '${currentStatus}', but 'Disputed' (4) is required for resolution.`,
      });
    }

    console.log(
      `[Jury] Finalizing resolve(${jobId}, ${freelancerPercent}, ${employerPercent}) to Monad...`
    );

    const tx = await escrowContract.resolve(
      BigInt(jobId),
      BigInt(Math.round(freelancerPercent)),
      BigInt(Math.round(employerPercent))
    );
    const receipt = await tx.wait();

    return res.json({
      success: true,
      freelancerPercent: Math.round(freelancerPercent),
      employerPercent: Math.round(employerPercent),
      reasoning: body.reasoning || "Finalized from jury majority vote.",
      txHash: receipt?.hash || tx.hash,
      aiUsed: false,
    });
  } catch (error) {
    console.error("[Jury] Transaction failed:", error);
    const revertReason = (error as any)?.reason || (error as any)?.data?.message || "";
    return res.status(500).json({
      error: revertReason ? `Contract Revert: ${revertReason}` : (error instanceof Error ? error.message : "Failed to submit jury resolution transaction"),
    });
  }
});

app.get("/health", async (_req: Request, res: Response) => {
  try {
    const balance = await provider.getBalance(arbitratorWallet.address);
    return res.json({
      status: "ok",
      arbitratorAddress: arbitratorWallet.address,
      arbitratorBalance: ethers.formatEther(balance),
      escrowContract: ESCROW_ADDRESS,
      registryContract: REGISTRY_ADDRESS,
      rpc: MONAD_RPC,
      aiConfigured: Boolean(GEMINI_API_KEY),
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Health check failed",
    });
  }
});

app.post("/api/issue-credential", async (req: Request, res: Response) => {
  const { freelancerAddress, credentialType, description, issuerName, employerAddress } = req.body;

  if (!freelancerAddress || !credentialType || !description || !issuerName || !employerAddress) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    console.log(`[Credential] Issuing for ${freelancerAddress} from ${employerAddress}...`);

    // In a real production app, we would verify the signature of the employerAddress here.
    // For the hackathon, we proceed if employerAddress is provided.

    const tx = await registryContract.issueCredential(
      freelancerAddress,
      credentialType,
      description,
      issuerName
    );
    const receipt = await tx.wait();

    return res.json({
      success: true,
      credentialId: receipt.logs[0]?.topics[2], // CredentialIssued event
      txHash: receipt.hash,
    });
  } catch (error) {
    console.error("[Credential] Transaction failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to issue on-chain credential",
    });
  }
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`\nMonadWork backend running on port ${PORT}`);
  console.log(`Arbitrator wallet: ${arbitratorWallet.address}`);
  console.log(`Escrow contract: ${ESCROW_ADDRESS}`);
  console.log(`RPC: ${MONAD_RPC}`);
  console.log(`AI configured: ${Boolean(GEMINI_API_KEY)}\n`);
});

async function autoSettleStreams() {
  try {
    const count = await escrowContract.jobCount();
    for (let jobId = 0n; jobId < count; jobId++) {
      try {
        const core = await escrowContract.getJobCore(jobId);
        const accounting = await escrowContract.getJobAccounting(jobId);

        const activeOrPaused = core.status === 1n || core.status === 2n;
        if (!core.autoSettlementEnabled || !activeOrPaused) continue;

        const claimable = await escrowContract.getClaimableAmount(jobId);
        if (claimable <= 0n) continue;

        if (core.streamActive) {
          const now = BigInt(Math.floor(Date.now() / 1000));
          const reference = accounting.lastAutoSettlementTime > 0n ? accounting.lastAutoSettlementTime : accounting.streamStartTime;
          if (reference === 0n || now < reference + accounting.settlementInterval) continue;
        }

        const tx = await escrowContract.settle(jobId);
        await tx.wait();
        console.log(`[AutoSettle] Settled job #${jobId.toString()} with tx ${tx.hash}`);
      } catch (jobError) {
        console.warn(`[AutoSettle] Skipped job #${jobId.toString()}:`, jobError instanceof Error ? jobError.message : jobError);
      }
    }
  } catch (error) {
    console.warn("[AutoSettle] Sweep failed:", error instanceof Error ? error.message : error);
  }
}

setInterval(() => {
  void autoSettleStreams();
}, 5000);
