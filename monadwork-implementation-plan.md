# MonadWork — Complete Hackathon Implementation Plan
### Monad Blitz Delhi 2026 | March 28 | 8-Hour Build Sprint

> **One-liner:** "Hire anyone, verify their credentials on-chain, pay them by the second as they work, with AI-powered dispute resolution."

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Smart Contracts — Full Detail](#3-smart-contracts--full-detail)
4. [Frontend — Every Page Detailed](#4-frontend--every-page-detailed)
5. [Backend — Node.js + Express](#5-backend--nodejs--express)
6. [Complete Dependency List](#6-complete-dependency-list)
7. [Configuration Files](#7-configuration-files)
8. [Deployment Instructions](#8-deployment-instructions)
9. [Build Phases — Time-Boxed for 8 Hours](#9-build-phases--time-boxed-for-8-hours)
10. [Demo Script](#10-demo-script)
11. [Risks & Fallbacks](#11-risks--fallbacks)

---

## 1. Project Overview

### Problem Statement

The global freelance economy is broken in three specific ways:

1. **Payment disputes & fraud** — Freelancers regularly complete work only to be ghosted or underpaid. Clients pay upfront only to receive substandard work. Traditional escrow services are slow, expensive, and require trusted intermediaries.

2. **Credential fraud** — Portfolio fabrication and resume padding are rampant. Platforms like LinkedIn rely on self-reported skills. There is no verifiable, tamper-proof record of professional credentials that a client can trust instantly.

3. **Delayed payments** — Net-30 or Net-60 payment cycles are standard. Freelancers—who often live project to project—wait weeks or months for money they've already earned. This cash flow mismatch is a structural disadvantage for workers.

### Solution: MonadWork

MonadWork is a unified freelancer platform that eliminates all three problems simultaneously using Monad blockchain:

| Problem | MonadWork Solution |
|---------|-------------------|
| Payment disputes | Smart contract escrow — funds locked on-chain, only released when conditions are met or arbitrator rules |
| Credential fraud | On-chain `CredentialRegistry` — credentials issued and signed by authorized issuers, permanently verifiable |
| Delayed payments | Streaming payments — MON flows to the freelancer wallet every single second they are working |

### Why Monad? — Feature-to-Product Mapping

| Monad Feature | Technical Spec | MonadWork Product Impact |
|--------------|---------------|--------------------------|
| **10,000 TPS** | 10,000 transactions per second | Thousands of concurrent streaming jobs, all settling simultaneously without congestion |
| **0.4s block time** | Sub-second finality (~400ms) | The live earnings counter increments in real time — users actually *see* their balance grow. On Ethereum (12s blocks), this UX is impossible |
| **Parallel Execution** | Optimistic parallel tx processing | Multiple escrow deposits, withdrawals, and credential issuances process in parallel — no serial queue bottleneck |
| **Near-Zero Gas** | Negligible gas fees (~$0.001 per tx) | Freelancers can withdraw tiny micro-amounts (e.g., 0.001 MON) without fees eating into earnings — micro-payment streaming is viable |
| **EVM Compatible** | Full EVM equivalence | Zero migration cost — standard Solidity, Hardhat, wagmi, viem all work out of the box |

### The Core Value Proposition

Every other freelance platform (Upwork, Fiverr, Toptal) is built on Web2 trust: centralized escrow, centralized credential verification, centralized dispute arbitration. MonadWork replaces all three trust points with cryptographic guarantees on Monad — the only chain fast enough to make streaming payments feel real to a human user.

---

## 2. Architecture Overview

### ASCII System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MONADWORK SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                    FRONTEND (Next.js 14)                         │  │
│   │                                                                  │  │
│   │  ┌────────────┐  ┌──────────────┐  ┌───────────┐  ┌──────────┐ │  │
│   │  │  Landing   │  │  Employer    │  │Freelancer │  │ Dispute  │ │  │
│   │  │    Page    │  │  Dashboard   │  │ Dashboard │  │   Page   │ │  │
│   │  └─────┬──────┘  └──────┬───────┘  └─────┬─────┘  └────┬─────┘ │  │
│   │        └────────────────┼────────────────┼─────────────┘        │  │
│   │                         │                │                       │  │
│   │         wagmi v2 + viem │                │ useReadContract()     │  │
│   │         useWriteContract│                │ useEffect polling     │  │
│   └─────────────────────────┼────────────────┼───────────────────────┘  │
│                             │                │                          │
│   ┌─────────────────────────▼────────────────▼───────────────────────┐  │
│   │                  MONAD TESTNET (Chain ID: 10143)                  │  │
│   │                                                                  │  │
│   │  ┌─────────────────────────────┐  ┌────────────────────────────┐ │  │
│   │  │    MonadWorkEscrow.sol      │  │  CredentialRegistry.sol    │ │  │
│   │  │                             │  │                            │ │  │
│   │  │  createJob()   approve()    │  │  issueCredential()         │ │  │
│   │  │  acceptJob()   dispute()    │  │  revokeCredential()        │ │  │
│   │  │  startStream() resolve()    │  │  getCredentials()          │ │  │
│   │  │  pauseStream() cancel()     │  │  verifyCredential()        │ │  │
│   │  │  resumeStream()             │  │  addIssuer()               │ │  │
│   │  │  getEarnedAmount()          │  │                            │ │  │
│   │  │  withdraw()                 │  │                            │ │  │
│   │  └────────────┬────────────────┘  └────────────────────────────┘ │  │
│   │               │   10K TPS | 0.4s blocks | Parallel execution      │  │
│   └───────────────┼───────────────────────────────────────────────────┘  │
│                   │                                                       │
│   ┌───────────────▼───────────────────────────────────────────────────┐  │
│   │              BACKEND (Node.js + Express)                          │  │
│   │                                                                   │  │
│   │  POST /api/resolve-dispute                                        │  │
│   │  ┌─────────────────────────────────────────────────────────────┐ │  │
│   │  │  1. Receive { jobId, freelancerEvidence, employerEvidence }  │ │  │
│   │  │  2. Call Gemini API → analyze dispute → get % split          │ │  │
│   │  │  3. Sign & submit resolve() tx to Monad using arbitrator key  │ │  │
│   │  │  4. Return ruling + txHash to frontend                       │ │  │
│   │  └──────────────────────────┬──────────────────────────────────┘ │  │
│   └─────────────────────────────┼─────────────────────────────────────┘  │
│                                 │                                         │
│   ┌─────────────────────────────▼─────────────────────────────────────┐  │
│   │                    AI SERVICE (Gemini API)                        │  │
│   │                    gemini-2.0-flash model                        │  │
│   │                    Returns: { freelancerPercent, employerPercent }│  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Complete Data Flow: Job Lifecycle

```
EMPLOYER                    SMART CONTRACT              FREELANCER
   │                              │                          │
   │  createJob(freelancer,       │                          │
   │    ratePerSecond) + MON ───► │  Job{Created}            │
   │                              │  jobId = 0,1,2...        │
   │                              │                          │
   │                              │ ◄─── acceptJob(jobId) ───│
   │                              │  Job{Active}             │
   │                              │                          │
   │                              │ ◄─── startStream(jobId) ─│
   │                              │  streamStartTime =       │
   │                              │    block.timestamp       │
   │                              │  CLOCK STARTS TICKING    │
   │                              │                          │
   │                              │  [Every 1s on frontend]  │
   │                              │  getEarnedAmount(jobId)  │
   │                              │  = (now - start) * rate  │
   │                              │                          │
   │                              │ ◄── withdraw(jobId) ─────│
   │                              │  Transfer earned - withdrawn
   │                              │  to freelancer wallet    │
   │                              │                          │
   │  ── approve(jobId) ─────────►│  Release remaining MON   │
   │                              │  to freelancer. DONE.    │
   │                              │                          │
   │          ─── OR ─────────────────────────────────────── │
   │                              │                          │
   │  ── dispute(jobId) ─────────►│ Job{Disputed}            │
   │                    OR        │ Stream paused            │
   │                              │ ◄─── dispute(jobId) ─────│
   │                              │                          │
   │                         [BACKEND]                       │
   │                    Gemini analyzes evidence             │
   │                    Returns freelancerPercent            │
   │                              │                          │
   │                    resolve(jobId,                       │
   │                      freelancerPct,                     │
   │                      employerPct) ─────────────────────►│
   │                              │  Funds split & sent      │
   │◄─────────────────────────────│  Job{Resolved}           │
```

---

## 3. Smart Contracts — Full Detail

### Contract 1: `MonadWorkEscrow.sol`

**File:** `contracts/MonadWorkEscrow.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MonadWorkEscrow
 * @notice Streaming payment escrow for MonadWork freelancer platform.
 *         Employer deposits MON, freelancer earns per second they work.
 *         AI arbitrator can resolve disputes.
 * @dev Optimized for Monad's 0.4s block time and near-zero gas environment.
 */
contract MonadWorkEscrow {

    // ─────────────────────────────────────────────────────────────────────────
    // ENUMS & STRUCTS
    // ─────────────────────────────────────────────────────────────────────────

    enum JobStatus {
        Created,    // 0 — Job posted by employer, awaiting freelancer acceptance
        Active,     // 1 — Accepted, stream may or may not be running
        Paused,     // 2 — Stream explicitly paused by freelancer
        Completed,  // 3 — Employer approved, all remaining funds released
        Disputed,   // 4 — Dispute raised, stream paused, awaiting arbitration
        Resolved,   // 5 — Arbitrator resolved, funds distributed
        Cancelled   // 6 — Employer cancelled before job started
    }

    struct Job {
        address employer;           // Wallet that created and funded the job
        address freelancer;         // Wallet assigned to do the work
        uint256 ratePerSecond;      // MON earned per second (in wei)
        uint256 totalDeposit;       // Total MON deposited by employer (in wei)
        uint256 streamStartTime;    // block.timestamp when stream last started
        uint256 accumulatedEarned;  // Earnings accumulated during pauses (in wei)
        uint256 totalWithdrawn;     // Total MON already withdrawn by freelancer (in wei)
        JobStatus status;           // Current lifecycle state
        string description;         // Job description (stored for dispute context)
        bool streamActive;          // Is the stream currently running?
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATE VARIABLES
    // ─────────────────────────────────────────────────────────────────────────

    mapping(uint256 => Job) public jobs;
    uint256 public jobCount;
    address public arbitrator;
    address public owner;

    // ─────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────────────────

    event JobCreated(
        uint256 indexed jobId,
        address indexed employer,
        address indexed freelancer,
        uint256 ratePerSecond,
        uint256 totalDeposit,
        string description
    );
    event JobAccepted(uint256 indexed jobId, address indexed freelancer);
    event StreamStarted(uint256 indexed jobId, uint256 startTime);
    event StreamPaused(uint256 indexed jobId, uint256 earnedSoFar);
    event StreamResumed(uint256 indexed jobId, uint256 resumeTime);
    event Withdrawn(uint256 indexed jobId, address indexed freelancer, uint256 amount);
    event JobApproved(uint256 indexed jobId, uint256 freelancerPayout, uint256 employerRefund);
    event DisputeRaised(uint256 indexed jobId, address indexed raisedBy);
    event DisputeResolved(
        uint256 indexed jobId,
        uint256 freelancerPercent,
        uint256 employerPercent,
        uint256 freelancerAmount,
        uint256 employerAmount
    );
    event JobCancelled(uint256 indexed jobId, uint256 refundAmount);

    // ─────────────────────────────────────────────────────────────────────────
    // MODIFIERS
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyEmployer(uint256 jobId) {
        require(msg.sender == jobs[jobId].employer, "MonadWork: caller is not the employer");
        _;
    }

    modifier onlyFreelancer(uint256 jobId) {
        require(msg.sender == jobs[jobId].freelancer, "MonadWork: caller is not the freelancer");
        _;
    }

    modifier onlyArbitrator() {
        require(msg.sender == arbitrator, "MonadWork: caller is not the arbitrator");
        _;
    }

    modifier inStatus(uint256 jobId, JobStatus expected) {
        require(jobs[jobId].status == expected, "MonadWork: job not in required status");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address _arbitrator) {
        arbitrator = _arbitrator;
        owner = msg.sender;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CORE FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Employer creates a job and deposits MON as escrow.
     * @param freelancer The address of the freelancer to assign this job to.
     * @param ratePerSecond The amount of MON (in wei) earned per second of work.
     * @param description A text description of the job (stored for disputes).
     * @dev msg.value becomes the totalDeposit. ratePerSecond should satisfy:
     *      ratePerSecond * expectedDurationSeconds <= msg.value
     */
    function createJob(
        address freelancer,
        uint256 ratePerSecond,
        string calldata description
    ) external payable returns (uint256 jobId) {
        require(freelancer != address(0), "MonadWork: invalid freelancer address");
        require(freelancer != msg.sender, "MonadWork: employer cannot be freelancer");
        require(ratePerSecond > 0, "MonadWork: rate must be > 0");
        require(msg.value > 0, "MonadWork: must deposit MON");
        require(msg.value >= ratePerSecond, "MonadWork: deposit must cover at least 1 second");

        jobId = jobCount++;

        jobs[jobId] = Job({
            employer: msg.sender,
            freelancer: freelancer,
            ratePerSecond: ratePerSecond,
            totalDeposit: msg.value,
            streamStartTime: 0,
            accumulatedEarned: 0,
            totalWithdrawn: 0,
            status: JobStatus.Created,
            description: description,
            streamActive: false
        });

        emit JobCreated(jobId, msg.sender, freelancer, ratePerSecond, msg.value, description);
    }

    /**
     * @notice Freelancer accepts the job, moving it to Active status.
     * @param jobId The ID of the job to accept.
     */
    function acceptJob(uint256 jobId)
        external
        onlyFreelancer(jobId)
        inStatus(jobId, JobStatus.Created)
    {
        jobs[jobId].status = JobStatus.Active;
        emit JobAccepted(jobId, msg.sender);
    }

    /**
     * @notice Freelancer starts the work stream. Records the start timestamp.
     * @param jobId The ID of the job.
     * @dev Can be called when Active (first start) or after a resume from Paused.
     */
    function startStream(uint256 jobId) external onlyFreelancer(jobId) {
        Job storage job = jobs[jobId];
        require(
            job.status == JobStatus.Active || job.status == JobStatus.Paused,
            "MonadWork: cannot start stream in current status"
        );
        require(!job.streamActive, "MonadWork: stream already active");

        job.streamStartTime = block.timestamp;
        job.streamActive = true;
        job.status = JobStatus.Active;

        emit StreamStarted(jobId, block.timestamp);
    }

    /**
     * @notice Freelancer pauses the stream. Calculates and saves earned amount.
     * @param jobId The ID of the job.
     */
    function pauseStream(uint256 jobId)
        external
        onlyFreelancer(jobId)
        inStatus(jobId, JobStatus.Active)
    {
        Job storage job = jobs[jobId];
        require(job.streamActive, "MonadWork: stream not active");

        // Calculate earnings since stream started and accumulate
        uint256 elapsed = block.timestamp - job.streamStartTime;
        uint256 newlyEarned = elapsed * job.ratePerSecond;
        job.accumulatedEarned += newlyEarned;

        // Cap at total deposit
        if (job.accumulatedEarned > job.totalDeposit) {
            job.accumulatedEarned = job.totalDeposit;
        }

        job.streamActive = false;
        job.streamStartTime = 0;
        job.status = JobStatus.Paused;

        emit StreamPaused(jobId, job.accumulatedEarned);
    }

    /**
     * @notice Freelancer resumes a paused stream.
     * @param jobId The ID of the job.
     */
    function resumeStream(uint256 jobId)
        external
        onlyFreelancer(jobId)
        inStatus(jobId, JobStatus.Paused)
    {
        Job storage job = jobs[jobId];
        require(!job.streamActive, "MonadWork: stream already active");

        job.streamStartTime = block.timestamp;
        job.streamActive = true;
        job.status = JobStatus.Active;

        emit StreamResumed(jobId, block.timestamp);
    }

    /**
     * @notice Returns the total amount earned by the freelancer so far.
     * @param jobId The ID of the job.
     * @return earned Total MON earned (in wei), capped at totalDeposit.
     * @dev This is a view function called every second by the frontend counter.
     *      Safe to call at any time — doesn't modify state.
     */
    function getEarnedAmount(uint256 jobId) public view returns (uint256 earned) {
        Job storage job = jobs[jobId];
        earned = job.accumulatedEarned;

        if (job.streamActive && job.streamStartTime > 0) {
            uint256 elapsed = block.timestamp - job.streamStartTime;
            earned += elapsed * job.ratePerSecond;
        }

        // Never exceed total deposit
        if (earned > job.totalDeposit) {
            earned = job.totalDeposit;
        }
    }

    /**
     * @notice Freelancer withdraws available earned amount (minus already withdrawn).
     * @param jobId The ID of the job.
     * @dev Can be called while stream is running or paused — at any Active/Paused state.
     */
    function withdraw(uint256 jobId) external onlyFreelancer(jobId) {
        Job storage job = jobs[jobId];
        require(
            job.status == JobStatus.Active || job.status == JobStatus.Paused,
            "MonadWork: cannot withdraw in current status"
        );

        uint256 earned = getEarnedAmount(jobId);
        uint256 available = earned - job.totalWithdrawn;
        require(available > 0, "MonadWork: nothing to withdraw");

        job.totalWithdrawn += available;

        (bool success, ) = payable(job.freelancer).call{value: available}("");
        require(success, "MonadWork: transfer failed");

        emit Withdrawn(jobId, job.freelancer, available);
    }

    /**
     * @notice Employer approves job completion, releasing all remaining funds to freelancer.
     * @param jobId The ID of the job.
     * @dev Pauses stream if active, calculates final earnings, sends to freelancer,
     *      refunds any leftover to employer.
     */
    function approve(uint256 jobId) external onlyEmployer(jobId) {
        Job storage job = jobs[jobId];
        require(
            job.status == JobStatus.Active || job.status == JobStatus.Paused,
            "MonadWork: cannot approve in current status"
        );

        // If stream is running, snapshot final earned
        if (job.streamActive) {
            uint256 elapsed = block.timestamp - job.streamStartTime;
            job.accumulatedEarned += elapsed * job.ratePerSecond;
            if (job.accumulatedEarned > job.totalDeposit) {
                job.accumulatedEarned = job.totalDeposit;
            }
            job.streamActive = false;
        }

        job.status = JobStatus.Completed;

        // Freelancer gets all earned minus what's already withdrawn
        uint256 freelancerPayout = job.accumulatedEarned - job.totalWithdrawn;
        // Employer gets back unearned remainder
        uint256 employerRefund = job.totalDeposit - job.accumulatedEarned;

        if (freelancerPayout > 0) {
            (bool s1, ) = payable(job.freelancer).call{value: freelancerPayout}("");
            require(s1, "MonadWork: freelancer transfer failed");
        }

        if (employerRefund > 0) {
            (bool s2, ) = payable(job.employer).call{value: employerRefund}("");
            require(s2, "MonadWork: employer refund failed");
        }

        emit JobApproved(jobId, freelancerPayout, employerRefund);
    }

    /**
     * @notice Either party raises a dispute. Stream is paused, job enters Disputed state.
     * @param jobId The ID of the job.
     */
    function dispute(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(
            msg.sender == job.employer || msg.sender == job.freelancer,
            "MonadWork: caller not party to job"
        );
        require(
            job.status == JobStatus.Active || job.status == JobStatus.Paused,
            "MonadWork: cannot dispute in current status"
        );

        // Snapshot earned amount at time of dispute
        if (job.streamActive) {
            uint256 elapsed = block.timestamp - job.streamStartTime;
            job.accumulatedEarned += elapsed * job.ratePerSecond;
            if (job.accumulatedEarned > job.totalDeposit) {
                job.accumulatedEarned = job.totalDeposit;
            }
            job.streamActive = false;
            job.streamStartTime = 0;
        }

        job.status = JobStatus.Disputed;
        emit DisputeRaised(jobId, msg.sender);
    }

    /**
     * @notice Arbitrator resolves a dispute by specifying the percentage split.
     * @param jobId The ID of the job.
     * @param freelancerPercent Percentage of remaining escrow to send to freelancer (0-100).
     * @param employerPercent Percentage of remaining escrow to send to employer (0-100).
     * @dev freelancerPercent + employerPercent must equal 100.
     *      Distribution is based on (totalDeposit - totalWithdrawn) — the remaining escrow.
     */
    function resolve(
        uint256 jobId,
        uint256 freelancerPercent,
        uint256 employerPercent
    )
        external
        onlyArbitrator
        inStatus(jobId, JobStatus.Disputed)
    {
        require(
            freelancerPercent + employerPercent == 100,
            "MonadWork: percentages must sum to 100"
        );

        Job storage job = jobs[jobId];
        job.status = JobStatus.Resolved;

        // Remaining funds in escrow after prior withdrawals
        uint256 remaining = job.totalDeposit - job.totalWithdrawn;

        uint256 freelancerAmount = (remaining * freelancerPercent) / 100;
        uint256 employerAmount = remaining - freelancerAmount; // avoids rounding dust

        if (freelancerAmount > 0) {
            (bool s1, ) = payable(job.freelancer).call{value: freelancerAmount}("");
            require(s1, "MonadWork: freelancer transfer failed");
        }

        if (employerAmount > 0) {
            (bool s2, ) = payable(job.employer).call{value: employerAmount}("");
            require(s2, "MonadWork: employer transfer failed");
        }

        emit DisputeResolved(jobId, freelancerPercent, employerPercent, freelancerAmount, employerAmount);
    }

    /**
     * @notice Employer cancels a job before the freelancer has started working.
     * @param jobId The ID of the job.
     * @dev Only works in Created or Active (stream not started) status.
     */
    function cancel(uint256 jobId) external onlyEmployer(jobId) {
        Job storage job = jobs[jobId];
        require(
            job.status == JobStatus.Created ||
            (job.status == JobStatus.Active && !job.streamActive && job.accumulatedEarned == 0),
            "MonadWork: cannot cancel after work has started"
        );

        job.status = JobStatus.Cancelled;
        uint256 refund = job.totalDeposit;

        (bool success, ) = payable(job.employer).call{value: refund}("");
        require(success, "MonadWork: refund failed");

        emit JobCancelled(jobId, refund);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VIEW HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the full Job struct for a given jobId.
     */
    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    /**
     * @notice Update the arbitrator address. Only owner.
     */
    function setArbitrator(address _arbitrator) external {
        require(msg.sender == owner, "MonadWork: not owner");
        arbitrator = _arbitrator;
    }

    /**
     * @notice Emergency: allow owner to update arbitrator if backend key is compromised.
     */
    receive() external payable {}
}
```

---

### Contract 2: `CredentialRegistry.sol`

**File:** `contracts/CredentialRegistry.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CredentialRegistry
 * @notice On-chain credential issuance and verification for MonadWork.
 *         Authorized issuers can grant credentials to freelancers.
 *         Anyone can verify credentials without trust assumptions.
 */
contract CredentialRegistry {

    // ─────────────────────────────────────────────────────────────────────────
    // STRUCTS & STATE
    // ─────────────────────────────────────────────────────────────────────────

    struct Credential {
        uint256 id;
        string credentialType;   // e.g. "Solidity Developer", "React Expert", "Audited Project"
        string description;      // Detailed description of the credential
        string issuerName;       // Human-readable issuer name (e.g. "HackerEarth", "ETHGlobal")
        address issuerAddress;   // On-chain address of the issuing entity
        uint256 timestamp;       // block.timestamp when issued
        bool isValid;            // Can be revoked by issuer
    }

    mapping(address => Credential[]) public credentials;
    mapping(address => bool) public authorizedIssuers;
    mapping(address => mapping(uint256 => uint256)) private credentialIndex; // freelancer => credentialId => array index

    address public owner;
    uint256 private nextCredentialId;

    // ─────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────────────────

    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    event CredentialIssued(
        address indexed freelancer,
        uint256 indexed credentialId,
        string credentialType,
        string issuerName,
        address indexed issuerAddress
    );
    event CredentialRevoked(address indexed freelancer, uint256 indexed credentialId);

    // ─────────────────────────────────────────────────────────────────────────
    // MODIFIERS
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "CredentialRegistry: not owner");
        _;
    }

    modifier onlyAuthorizedIssuer() {
        require(authorizedIssuers[msg.sender], "CredentialRegistry: not an authorized issuer");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        // Auto-authorize the deployer as an issuer (for hackathon demo convenience)
        authorizedIssuers[msg.sender] = true;
        emit IssuerAdded(msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ISSUER MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Add a new authorized credential issuer. Only owner.
     * @param issuer Address to authorize as an issuer.
     */
    function addIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "CredentialRegistry: zero address");
        require(!authorizedIssuers[issuer], "CredentialRegistry: already authorized");
        authorizedIssuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    /**
     * @notice Remove an authorized issuer. Only owner.
     * @param issuer Address to deauthorize.
     */
    function removeIssuer(address issuer) external onlyOwner {
        require(authorizedIssuers[issuer], "CredentialRegistry: not an issuer");
        authorizedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CREDENTIAL MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Issue a credential to a freelancer. Only authorized issuers.
     * @param freelancer The address of the freelancer receiving the credential.
     * @param credentialType Short type label (e.g. "Solidity Developer").
     * @param description Detailed description of what the credential represents.
     * @param issuerName Human-readable name of the issuing organization.
     * @return credentialId The unique ID assigned to this credential.
     */
    function issueCredential(
        address freelancer,
        string calldata credentialType,
        string calldata description,
        string calldata issuerName
    ) external onlyAuthorizedIssuer returns (uint256 credentialId) {
        require(freelancer != address(0), "CredentialRegistry: zero address");
        require(bytes(credentialType).length > 0, "CredentialRegistry: empty credential type");

        credentialId = nextCredentialId++;

        Credential memory newCred = Credential({
            id: credentialId,
            credentialType: credentialType,
            description: description,
            issuerName: issuerName,
            issuerAddress: msg.sender,
            timestamp: block.timestamp,
            isValid: true
        });

        uint256 arrayIndex = credentials[freelancer].length;
        credentials[freelancer].push(newCred);
        credentialIndex[freelancer][credentialId] = arrayIndex;

        emit CredentialIssued(freelancer, credentialId, credentialType, issuerName, msg.sender);
    }

    /**
     * @notice Revoke a credential. Only the issuer who issued it can revoke it.
     * @param freelancer The freelancer's address.
     * @param credentialId The ID of the credential to revoke.
     */
    function revokeCredential(address freelancer, uint256 credentialId) external {
        uint256 idx = credentialIndex[freelancer][credentialId];
        Credential storage cred = credentials[freelancer][idx];

        require(cred.id == credentialId, "CredentialRegistry: credential not found");
        require(cred.isValid, "CredentialRegistry: already revoked");
        require(
            msg.sender == cred.issuerAddress || msg.sender == owner,
            "CredentialRegistry: not authorized to revoke"
        );

        cred.isValid = false;
        emit CredentialRevoked(freelancer, credentialId);
    }

    /**
     * @notice Returns all credentials for a given freelancer.
     * @param freelancer The freelancer's address.
     * @return An array of all Credential structs (including revoked ones).
     */
    function getCredentials(address freelancer) external view returns (Credential[] memory) {
        return credentials[freelancer];
    }

    /**
     * @notice Verify a specific credential by ID.
     * @param freelancer The freelancer's address.
     * @param credentialId The credential ID to verify.
     * @return isValid Whether the credential is currently valid (not revoked).
     * @return cred The full Credential struct.
     */
    function verifyCredential(
        address freelancer,
        uint256 credentialId
    ) external view returns (bool isValid, Credential memory cred) {
        uint256 idx = credentialIndex[freelancer][credentialId];
        cred = credentials[freelancer][idx];
        require(cred.id == credentialId, "CredentialRegistry: credential not found");
        isValid = cred.isValid;
    }

    /**
     * @notice Returns the count of credentials for a freelancer (including revoked).
     */
    function getCredentialCount(address freelancer) external view returns (uint256) {
        return credentials[freelancer].length;
    }
}
```

---

### Hardhat Deploy Script

**File:** `scripts/deploy.ts`

```typescript
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON");

  // ── Deploy CredentialRegistry ─────────────────────────────────────────────
  console.log("\n1. Deploying CredentialRegistry...");
  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const registry = await CredentialRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("   CredentialRegistry deployed to:", registryAddress);

  // ── Deploy MonadWorkEscrow ────────────────────────────────────────────────
  // Arbitrator = deployer for hackathon (backend wallet)
  console.log("\n2. Deploying MonadWorkEscrow...");
  const MonadWorkEscrow = await ethers.getContractFactory("MonadWorkEscrow");
  const escrow = await MonadWorkEscrow.deploy(deployer.address);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("   MonadWorkEscrow deployed to:", escrowAddress);

  // ── Seed Demo Credentials ─────────────────────────────────────────────────
  console.log("\n3. Seeding demo credentials for hackathon demo...");
  // Replace with your freelancer demo wallet address
  const DEMO_FREELANCER = "0xYOUR_DEMO_FREELANCER_ADDRESS";

  if (DEMO_FREELANCER !== "0xYOUR_DEMO_FREELANCER_ADDRESS") {
    const tx1 = await registry.issueCredential(
      DEMO_FREELANCER,
      "Solidity Developer",
      "Verified smart contract developer with audited production deployments",
      "MonadWork Verified"
    );
    await tx1.wait();
    console.log("   Credential 1 issued: Solidity Developer");

    const tx2 = await registry.issueCredential(
      DEMO_FREELANCER,
      "React Expert",
      "Frontend developer with React, Next.js, and TypeScript expertise",
      "MonadWork Verified"
    );
    await tx2.wait();
    console.log("   Credential 2 issued: React Expert");

    const tx3 = await registry.issueCredential(
      DEMO_FREELANCER,
      "ETHGlobal Finalist",
      "Hackathon finalist at ETHGlobal 2025 — Starknet track",
      "ETHGlobal"
    );
    await tx3.wait();
    console.log("   Credential 3 issued: ETHGlobal Finalist");
  } else {
    console.log("   ⚠️  Skipping credential seeding — update DEMO_FREELANCER address");
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log("DEPLOYMENT COMPLETE — Copy these to .env:");
  console.log("═══════════════════════════════════════════");
  console.log(`NEXT_PUBLIC_ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`NEXT_PUBLIC_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
  console.log(`REGISTRY_CONTRACT_ADDRESS=${registryAddress}`);
  console.log(`NEXT_PUBLIC_ARBITRATOR_ADDRESS=${deployer.address}`);
  console.log("═══════════════════════════════════════════");
  console.log("\nMonadScan verification commands:");
  console.log(`npx hardhat verify --network monadTestnet ${escrowAddress} "${deployer.address}"`);
  console.log(`npx hardhat verify --network monadTestnet ${registryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

---

## 4. Frontend — Every Page Detailed

### Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Web3:** wagmi v2 + viem
- **State:** @tanstack/react-query
- **Wallet:** RainbowKit (optional) or wagmi's built-in connectors

### Project Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with WagmiProvider
│   ├── page.tsx                # Landing page
│   ├── employer/
│   │   └── page.tsx            # Employer dashboard
│   ├── freelancer/
│   │   └── page.tsx            # Freelancer dashboard
│   ├── job/
│   │   └── [id]/
│   │       └── page.tsx        # Job detail page
│   ├── dispute/
│   │   └── [jobId]/
│   │       └── page.tsx        # Dispute resolution page
│   └── credentials/
│       └── page.tsx            # Credentials page
├── components/
│   ├── WalletButton.tsx
│   ├── JobCard.tsx
│   ├── StreamingCounter.tsx    # THE KEY COMPONENT
│   ├── StatusBadge.tsx
│   └── CredentialBadge.tsx
├── lib/
│   ├── wagmi.ts                # Monad chain config + wagmi setup
│   ├── contracts.ts            # ABI imports and contract addresses
│   └── utils.ts                # formatMON, formatAddress, etc.
├── abis/
│   ├── MonadWorkEscrow.json
│   └── CredentialRegistry.json
└── providers/
    └── Providers.tsx           # WagmiProvider + QueryClientProvider
```

---

### Wagmi Configuration for Monad Testnet

**File:** `lib/wagmi.ts`

```typescript
import { http, createConfig } from 'wagmi';
import { monadTestnet } from 'wagmi/chains'; // viem has this built-in!
import { injected, metaMask, walletConnect } from 'wagmi/connectors';

// monadTestnet is already defined in viem/wagmi:
// { id: 10143, name: 'Monad Testnet', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
//   rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } } }

export const config = createConfig({
  chains: [monadTestnet],
  connectors: [
    injected(),           // MetaMask, Rabby, etc.
    metaMask(),
  ],
  transports: {
    [monadTestnet.id]: http('https://testnet-rpc.monad.xyz'),
  },
});

// Re-export for convenience
export { monadTestnet };
```

**File:** `lib/contracts.ts`

```typescript
import EscrowABI from '@/abis/MonadWorkEscrow.json';
import RegistryABI from '@/abis/CredentialRegistry.json';

export const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_ADDRESS as `0x${string}`;
export const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}`;

export const ESCROW_ABI = EscrowABI;
export const REGISTRY_ABI = RegistryABI;

// Job status enum mapping (mirrors Solidity enum)
export const JOB_STATUS = {
  0: 'Created',
  1: 'Active',
  2: 'Paused',
  3: 'Completed',
  4: 'Disputed',
  5: 'Resolved',
  6: 'Cancelled',
} as const;

export type JobStatusKey = keyof typeof JOB_STATUS;
```

**File:** `providers/Providers.tsx`

```typescript
'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

**File:** `app/layout.tsx`

```typescript
import { Providers } from '@/providers/Providers';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MonadWork — Get Paid Every Second You Work',
  description: 'Freelancer platform with streaming payments, on-chain credentials, and AI arbitration on Monad.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0A0A0F] text-white min-h-screen`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

---

### Page (a): Landing Page — `app/page.tsx`

```typescript
'use client';

import Link from 'next/link';
import { useAccount, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

export default function LandingPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#836EF9] rounded-lg flex items-center justify-center font-bold text-sm">
            MW
          </div>
          <span className="font-semibold text-lg">MonadWork</span>
        </div>
        <div className="flex items-center gap-4">
          {isConnected ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-white/60 font-mono">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <Link href="/employer"
                className="px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition">
                Employer
              </Link>
              <Link href="/freelancer"
                className="px-4 py-2 bg-[#836EF9] rounded-lg text-sm hover:bg-[#6B56E0] transition">
                Freelancer
              </Link>
            </div>
          ) : (
            <button
              onClick={() => connect({ connector: injected() })}
              className="px-6 py-2.5 bg-[#836EF9] hover:bg-[#6B56E0] rounded-lg font-medium transition-colors"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center px-4 py-32">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#836EF9]/10 border border-[#836EF9]/30 rounded-full text-[#836EF9] text-sm mb-8">
          <div className="w-2 h-2 bg-[#836EF9] rounded-full animate-pulse" />
          Built on Monad — 0.4s finality
        </div>

        <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl">
          Get paid for{' '}
          <span className="text-[#836EF9]">every second</span>{' '}
          you work
        </h1>

        <p className="text-xl text-white/60 max-w-2xl mb-12 leading-relaxed">
          MonadWork combines escrow, real-time streaming payments, on-chain credentials,
          and AI-powered dispute resolution — so freelancers get paid instantly and
          clients only pay for work delivered.
        </p>

        <div className="flex items-center gap-4">
          {isConnected ? (
            <>
              <Link href="/employer"
                className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl font-semibold text-lg transition">
                Post a Job
              </Link>
              <Link href="/freelancer"
                className="px-8 py-4 bg-[#836EF9] hover:bg-[#6B56E0] rounded-xl font-semibold text-lg transition">
                Find Work
              </Link>
            </>
          ) : (
            <button
              onClick={() => connect({ connector: injected() })}
              className="px-8 py-4 bg-[#836EF9] hover:bg-[#6B56E0] rounded-xl font-semibold text-lg transition"
            >
              Connect Wallet to Start
            </button>
          )}
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="max-w-6xl mx-auto px-8 py-20">
        <h2 className="text-3xl font-bold text-center mb-16">Why MonadWork?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: '🔒',
              problem: 'Payment disputes',
              solution: 'Smart contract escrow — funds locked on-chain, released by code, not trust',
            },
            {
              icon: '🎓',
              problem: 'Credential fraud',
              solution: 'On-chain CredentialRegistry — verifiable badges from authorized issuers',
            },
            {
              icon: '⏱️',
              problem: 'Delayed payments',
              solution: 'Streaming payments — MON flows to your wallet every second you work',
            },
          ].map((item) => (
            <div key={item.problem}
              className="p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-[#836EF9]/50 transition">
              <div className="text-4xl mb-4">{item.icon}</div>
              <div className="text-red-400 text-sm font-medium mb-2">Problem: {item.problem}</div>
              <div className="text-white/80">{item.solution}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why Monad? */}
      <section className="max-w-6xl mx-auto px-8 py-20 border-t border-white/10">
        <h2 className="text-3xl font-bold text-center mb-4">Why Monad?</h2>
        <p className="text-white/60 text-center mb-16">Every Monad feature maps directly to a product benefit.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { feature: '10,000 TPS', benefit: 'Thousands of streaming jobs settle simultaneously — no congestion' },
            { feature: '0.4s Block Time', benefit: 'The live earnings counter actually ticks — not possible on 12s Ethereum' },
            { feature: 'Parallel Execution', benefit: 'Escrow deposits, withdrawals, credential issuances run in parallel' },
            { feature: 'Near-Zero Gas', benefit: 'Freelancers can withdraw micro-amounts without fees destroying value' },
          ].map((item) => (
            <div key={item.feature} className="flex items-start gap-4 p-6 bg-[#836EF9]/5 border border-[#836EF9]/20 rounded-xl">
              <div className="px-3 py-1 bg-[#836EF9] rounded-lg text-sm font-bold whitespace-nowrap">
                {item.feature}
              </div>
              <p className="text-white/80">{item.benefit}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
```

---

### Page (b): Employer Dashboard — `app/employer/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { ESCROW_ADDRESS, ESCROW_ABI, JOB_STATUS } from '@/lib/contracts';

interface Job {
  employer: string;
  freelancer: string;
  ratePerSecond: bigint;
  totalDeposit: bigint;
  streamStartTime: bigint;
  accumulatedEarned: bigint;
  totalWithdrawn: bigint;
  status: number;
  description: string;
  streamActive: boolean;
}

export default function EmployerDashboard() {
  const { address } = useAccount();

  // Form state
  const [freelancerAddr, setFreelancerAddr] = useState('');
  const [ratePerSec, setRatePerSec] = useState('0.0001'); // MON per second
  const [description, setDescription] = useState('');
  const [depositAmount, setDepositAmount] = useState('1'); // MON to deposit
  const [txPending, setTxPending] = useState(false);
  const [txHash, setTxHash] = useState('');

  const { writeContractAsync } = useWriteContract();

  // Read job count to enumerate employer's jobs
  const { data: jobCount } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'jobCount',
  });

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    try {
      setTxPending(true);
      const rateWei = parseEther(ratePerSec);
      const depositWei = parseEther(depositAmount);

      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'createJob',
        args: [freelancerAddr as `0x${string}`, rateWei, description],
        value: depositWei,
      });

      setTxHash(hash);
      setFreelancerAddr('');
      setDescription('');
      alert(`Job created! Tx: ${hash}`);
    } catch (err: any) {
      console.error('createJob error:', err);
      alert('Failed to create job: ' + err.message);
    } finally {
      setTxPending(false);
    }
  };

  const handleApprove = async (jobId: number) => {
    try {
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'approve',
        args: [BigInt(jobId)],
      });
      alert(`Job approved! Tx: ${hash}`);
    } catch (err: any) {
      alert('Approve failed: ' + err.message);
    }
  };

  const handleDispute = async (jobId: number) => {
    try {
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'dispute',
        args: [BigInt(jobId)],
      });
      alert(`Dispute raised! Tx: ${hash}`);
    } catch (err: any) {
      alert('Dispute failed: ' + err.message);
    }
  };

  const handleCancel = async (jobId: number) => {
    try {
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'cancel',
        args: [BigInt(jobId)],
      });
      alert(`Job cancelled! Tx: ${hash}`);
    } catch (err: any) {
      alert('Cancel failed: ' + err.message);
    }
  };

  const statusColor: Record<string, string> = {
    Created: 'bg-yellow-500/20 text-yellow-300',
    Active: 'bg-green-500/20 text-green-300',
    Paused: 'bg-blue-500/20 text-blue-300',
    Completed: 'bg-gray-500/20 text-gray-300',
    Disputed: 'bg-red-500/20 text-red-300',
    Resolved: 'bg-purple-500/20 text-purple-300',
    Cancelled: 'bg-gray-700/20 text-gray-500',
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white px-8 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Employer Dashboard</h1>
        <p className="text-white/60 mb-10">Post jobs, monitor streams, approve or dispute.</p>

        {/* POST JOB FORM */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-10">
          <h2 className="text-xl font-semibold mb-6">Post a New Job</h2>
          <form onSubmit={handleCreateJob} className="space-y-5">
            <div>
              <label className="block text-sm text-white/60 mb-1">Freelancer Wallet Address</label>
              <input
                type="text"
                value={freelancerAddr}
                onChange={(e) => setFreelancerAddr(e.target.value)}
                placeholder="0x..."
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#836EF9]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Rate Per Second (MON)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={ratePerSec}
                  onChange={(e) => setRatePerSec(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#836EF9]"
                  required
                />
                <p className="text-xs text-white/40 mt-1">
                  = {(parseFloat(ratePerSec) * 3600).toFixed(4)} MON/hour
                </p>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">Total Deposit (MON)</label>
                <input
                  type="number"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#836EF9]"
                  required
                />
                <p className="text-xs text-white/40 mt-1">
                  ≈ {(parseFloat(depositAmount) / parseFloat(ratePerSec) / 3600).toFixed(1)} hours of work
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1">Job Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Build a smart contract for..."
                rows={3}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#836EF9] resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={txPending || !address}
              className="w-full py-4 bg-[#836EF9] hover:bg-[#6B56E0] disabled:opacity-50 rounded-xl font-semibold transition"
            >
              {txPending ? 'Creating Job...' : `Create Job & Deposit ${depositAmount} MON`}
            </button>

            {txHash && (
              <a
                href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-sm text-[#836EF9] hover:underline"
              >
                View transaction on MonadScan →
              </a>
            )}
          </form>
        </div>

        {/* JOB LIST — load jobs 0..jobCount where employer = address */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Jobs</h2>
          <EmployerJobList
            address={address}
            jobCount={jobCount ? Number(jobCount) : 0}
            onApprove={handleApprove}
            onDispute={handleDispute}
            onCancel={handleCancel}
            statusColor={statusColor}
          />
        </div>
      </div>
    </div>
  );
}

// Sub-component to render individual job cards
function EmployerJobList({ address, jobCount, onApprove, onDispute, onCancel, statusColor }: any) {
  const jobIds = Array.from({ length: jobCount }, (_, i) => i);

  return (
    <div className="space-y-4">
      {jobIds.map((id) => (
        <EmployerJobCard
          key={id}
          jobId={id}
          address={address}
          onApprove={onApprove}
          onDispute={onDispute}
          onCancel={onCancel}
          statusColor={statusColor}
        />
      ))}
      {jobCount === 0 && (
        <p className="text-white/40 text-center py-8">No jobs posted yet.</p>
      )}
    </div>
  );
}

function EmployerJobCard({ jobId, address, onApprove, onDispute, onCancel, statusColor }: any) {
  const { data: job } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'getJob',
    args: [BigInt(jobId)],
  }) as { data: Job | undefined };

  if (!job || job.employer.toLowerCase() !== address?.toLowerCase()) return null;

  const statusLabel = JOB_STATUS[job.status as keyof typeof JOB_STATUS] || 'Unknown';

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-sm text-white/60">Job #{jobId}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[statusLabel]}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-white/80">{job.description}</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-white/60">Deposit</div>
          <div className="font-mono font-bold">{formatEther(job.totalDeposit)} MON</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-white/60 mb-4">
        <div>
          <span className="block">Freelancer</span>
          <span className="font-mono text-white/80">
            {job.freelancer.slice(0, 8)}...{job.freelancer.slice(-6)}
          </span>
        </div>
        <div>
          <span className="block">Rate</span>
          <span className="font-mono text-white/80">
            {formatEther(job.ratePerSecond)} MON/sec
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        {(job.status === 1 || job.status === 2) && (
          <>
            <button
              onClick={() => onApprove(jobId)}
              className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm font-medium transition"
            >
              Approve
            </button>
            <button
              onClick={() => onDispute(jobId)}
              className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm font-medium transition"
            >
              Dispute
            </button>
          </>
        )}
        {job.status === 0 && (
          <button
            onClick={() => onCancel(jobId)}
            className="flex-1 py-2 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 rounded-lg text-sm font-medium transition"
          >
            Cancel & Refund
          </button>
        )}
      </div>
    </div>
  );
}
```

---

### Page (c): Freelancer Dashboard — `app/freelancer/page.tsx`

> **Critical feature:** The live streaming balance counter.

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { ESCROW_ADDRESS, ESCROW_ABI, REGISTRY_ADDRESS, REGISTRY_ABI, JOB_STATUS } from '@/lib/contracts';

// ─────────────────────────────────────────────────────────────────────────────
// THE STREAMING COUNTER COMPONENT
// This is the centerpiece of the demo. It polls getEarnedAmount every second.
// ─────────────────────────────────────────────────────────────────────────────

function StreamingCounter({ jobId, ratePerSecond, streamStartTime, accumulatedEarned, streamActive, totalWithdrawn }: {
  jobId: number;
  ratePerSecond: bigint;
  streamStartTime: bigint;
  accumulatedEarned: bigint;
  streamActive: boolean;
  totalWithdrawn: bigint;
}) {
  const [displayAmount, setDisplayAmount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: earnedFromContract, refetch } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'getEarnedAmount',
    args: [BigInt(jobId)],
  }) as { data: bigint | undefined; refetch: () => void };

  useEffect(() => {
    // Poll contract every second for accurate on-chain value
    intervalRef.current = setInterval(() => {
      refetch();
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refetch]);

  // Also do client-side interpolation between polls for smooth display
  useEffect(() => {
    if (!streamActive || !streamStartTime) {
      // If not streaming, just show accumulated
      const accEther = parseFloat(formatEther(accumulatedEarned));
      setDisplayAmount(accEther);
      return;
    }

    const tick = () => {
      const now = BigInt(Math.floor(Date.now() / 1000));
      const elapsed = now - streamStartTime;
      const earned = accumulatedEarned + elapsed * ratePerSecond;
      setDisplayAmount(parseFloat(formatEther(earned)));
    };

    tick();
    const smoothInterval = setInterval(tick, 100); // Update every 100ms for smoothness

    return () => clearInterval(smoothInterval);
  }, [streamActive, streamStartTime, ratePerSecond, accumulatedEarned]);

  // When contract confirms a value, snap to it
  useEffect(() => {
    if (earnedFromContract !== undefined) {
      setDisplayAmount(parseFloat(formatEther(earnedFromContract)));
    }
  }, [earnedFromContract]);

  const available = displayAmount - parseFloat(formatEther(totalWithdrawn));

  return (
    <div className="relative">
      {/* Glow effect */}
      {streamActive && (
        <div className="absolute inset-0 bg-[#836EF9]/20 rounded-2xl blur-xl" />
      )}
      <div className={`relative bg-white/5 border rounded-2xl p-8 text-center ${
        streamActive ? 'border-[#836EF9]/50' : 'border-white/10'
      }`}>
        <div className="text-sm text-white/60 mb-2">
          {streamActive ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Streaming live
            </span>
          ) : 'Total Earned'}
        </div>

        <div className={`font-mono font-bold text-5xl mb-1 transition-colors ${
          streamActive ? 'text-[#836EF9]' : 'text-white'
        }`}>
          {displayAmount.toFixed(6)}
        </div>
        <div className="text-white/60 text-lg mb-6">MON</div>

        {totalWithdrawn > 0n && (
          <div className="text-sm text-white/40 mb-2">
            Already withdrawn: {formatEther(totalWithdrawn)} MON
          </div>
        )}

        <div className="text-sm text-white/60">
          Available to withdraw: <span className="text-white font-mono font-semibold">
            {Math.max(0, available).toFixed(6)} MON
          </span>
        </div>

        {streamActive && (
          <div className="mt-4 text-xs text-white/40">
            Earning {formatEther(ratePerSecond)} MON/second
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FREELANCER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

export default function FreelancerDashboard() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [txPending, setTxPending] = useState<Record<string, boolean>>({});

  const { data: jobCount } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'jobCount',
  });

  const { data: credentials } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getCredentials',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const setPending = (key: string, val: boolean) =>
    setTxPending((prev) => ({ ...prev, [key]: val }));

  const handleAccept = async (jobId: number) => {
    setPending(`accept-${jobId}`, true);
    try {
      await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'acceptJob',
        args: [BigInt(jobId)],
      });
    } catch (err: any) {
      alert('Accept failed: ' + err.message);
    } finally {
      setPending(`accept-${jobId}`, false);
    }
  };

  const handleStart = async (jobId: number) => {
    setPending(`start-${jobId}`, true);
    try {
      await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'startStream',
        args: [BigInt(jobId)],
      });
    } catch (err: any) {
      alert('Start failed: ' + err.message);
    } finally {
      setPending(`start-${jobId}`, false);
    }
  };

  const handlePause = async (jobId: number) => {
    setPending(`pause-${jobId}`, true);
    try {
      await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'pauseStream',
        args: [BigInt(jobId)],
      });
    } catch (err: any) {
      alert('Pause failed: ' + err.message);
    } finally {
      setPending(`pause-${jobId}`, false);
    }
  };

  const handleResume = async (jobId: number) => {
    setPending(`resume-${jobId}`, true);
    try {
      await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'resumeStream',
        args: [BigInt(jobId)],
      });
    } catch (err: any) {
      alert('Resume failed: ' + err.message);
    } finally {
      setPending(`resume-${jobId}`, false);
    }
  };

  const handleWithdraw = async (jobId: number) => {
    setPending(`withdraw-${jobId}`, true);
    try {
      await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'withdraw',
        args: [BigInt(jobId)],
      });
    } catch (err: any) {
      alert('Withdraw failed: ' + err.message);
    } finally {
      setPending(`withdraw-${jobId}`, false);
    }
  };

  const handleDispute = async (jobId: number) => {
    setPending(`dispute-${jobId}`, true);
    try {
      await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'dispute',
        args: [BigInt(jobId)],
      });
    } catch (err: any) {
      alert('Dispute failed: ' + err.message);
    } finally {
      setPending(`dispute-${jobId}`, false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white px-8 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Freelancer Dashboard</h1>
        <p className="text-white/60 mb-10">Accept jobs, stream your work, get paid every second.</p>

        {/* CREDENTIALS SECTION */}
        {credentials && Array.isArray(credentials) && credentials.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-semibold mb-4">Your Verified Credentials</h2>
            <div className="flex flex-wrap gap-3">
              {(credentials as any[])
                .filter((c) => c.isValid)
                .map((cred) => (
                  <div key={cred.id.toString()}
                    className="flex items-center gap-2 px-4 py-2 bg-[#836EF9]/10 border border-[#836EF9]/30 rounded-full">
                    <span className="w-2 h-2 bg-[#836EF9] rounded-full" />
                    <span className="text-sm font-medium">{cred.credentialType}</span>
                    <span className="text-xs text-white/40">• {cred.issuerName}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* JOB CARDS */}
        <h2 className="text-xl font-semibold mb-4">Your Jobs</h2>
        <FreelancerJobList
          address={address}
          jobCount={jobCount ? Number(jobCount) : 0}
          txPending={txPending}
          onAccept={handleAccept}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onWithdraw={handleWithdraw}
          onDispute={handleDispute}
        />
      </div>
    </div>
  );
}

function FreelancerJobList({ address, jobCount, txPending, onAccept, onStart, onPause, onResume, onWithdraw, onDispute }: any) {
  const jobIds = Array.from({ length: jobCount }, (_, i) => i);
  return (
    <div className="space-y-6">
      {jobIds.map((id) => (
        <FreelancerJobCard
          key={id}
          jobId={id}
          address={address}
          txPending={txPending}
          onAccept={onAccept}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onWithdraw={onWithdraw}
          onDispute={onDispute}
        />
      ))}
      {jobCount === 0 && (
        <p className="text-white/40 text-center py-8">No jobs assigned yet.</p>
      )}
    </div>
  );
}

function FreelancerJobCard({ jobId, address, txPending, onAccept, onStart, onPause, onResume, onWithdraw, onDispute }: any) {
  const { data: job, refetch } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'getJob',
    args: [BigInt(jobId)],
    query: { refetchInterval: 2000 }, // Refetch every 2s to stay in sync
  }) as { data: any; refetch: () => void };

  if (!job || job.freelancer.toLowerCase() !== address?.toLowerCase()) return null;

  const statusLabel = JOB_STATUS[job.status as keyof typeof JOB_STATUS] || 'Unknown';

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-sm text-white/60">Job #{jobId}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              statusLabel === 'Active' ? 'bg-green-500/20 text-green-300' :
              statusLabel === 'Paused' ? 'bg-blue-500/20 text-blue-300' :
              statusLabel === 'Created' ? 'bg-yellow-500/20 text-yellow-300' :
              'bg-gray-500/20 text-gray-300'
            }`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-white/80">{job.description}</p>
          <p className="text-sm text-white/40 mt-1">
            Employer: {job.employer.slice(0, 8)}...{job.employer.slice(-6)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-white/60">Escrow</div>
          <div className="font-mono font-bold">{formatEther(job.totalDeposit)} MON</div>
          <div className="text-xs text-white/40">{formatEther(job.ratePerSecond)} MON/s</div>
        </div>
      </div>

      {/* STREAMING COUNTER — shown for active/paused jobs */}
      {(job.status === 1 || job.status === 2) && (
        <div className="mb-6">
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

      {/* ACTION BUTTONS */}
      <div className="flex flex-wrap gap-3">
        {job.status === 0 && (
          <button
            onClick={() => onAccept(jobId)}
            disabled={txPending[`accept-${jobId}`]}
            className="flex-1 py-2.5 bg-[#836EF9] hover:bg-[#6B56E0] disabled:opacity-50 rounded-xl text-sm font-semibold transition"
          >
            {txPending[`accept-${jobId}`] ? 'Accepting...' : 'Accept Job'}
          </button>
        )}

        {job.status === 1 && !job.streamActive && (
          <button
            onClick={() => onStart(jobId)}
            disabled={txPending[`start-${jobId}`]}
            className="flex-1 py-2.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 disabled:opacity-50 rounded-xl text-sm font-semibold transition"
          >
            {txPending[`start-${jobId}`] ? 'Starting...' : '▶ Start Work'}
          </button>
        )}

        {job.status === 1 && job.streamActive && (
          <button
            onClick={() => onPause(jobId)}
            disabled={txPending[`pause-${jobId}`]}
            className="flex-1 py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 disabled:opacity-50 rounded-xl text-sm font-semibold transition"
          >
            {txPending[`pause-${jobId}`] ? 'Pausing...' : '⏸ Pause'}
          </button>
        )}

        {job.status === 2 && (
          <button
            onClick={() => onResume(jobId)}
            disabled={txPending[`resume-${jobId}`]}
            className="flex-1 py-2.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 disabled:opacity-50 rounded-xl text-sm font-semibold transition"
          >
            {txPending[`resume-${jobId}`] ? 'Resuming...' : '▶ Resume'}
          </button>
        )}

        {(job.status === 1 || job.status === 2) && (
          <>
            <button
              onClick={() => onWithdraw(jobId)}
              disabled={txPending[`withdraw-${jobId}`]}
              className="flex-1 py-2.5 bg-[#836EF9]/20 hover:bg-[#836EF9]/30 text-[#836EF9] disabled:opacity-50 rounded-xl text-sm font-semibold transition"
            >
              {txPending[`withdraw-${jobId}`] ? 'Withdrawing...' : 'Withdraw Earned'}
            </button>
            <button
              onClick={() => onDispute(jobId)}
              disabled={txPending[`dispute-${jobId}`]}
              className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-50 rounded-xl text-sm font-semibold transition"
            >
              Dispute
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

---

### Page (d): Job Detail Page — `app/job/[id]/page.tsx`

```typescript
'use client';

import { useParams } from 'next/navigation';
import { useReadContract } from 'wagmi';
import { formatEther } from 'viem';
import { ESCROW_ADDRESS, ESCROW_ABI, JOB_STATUS } from '@/lib/contracts';
import Link from 'next/link';

export default function JobDetailPage() {
  const params = useParams();
  const jobId = parseInt(params.id as string);

  const { data: job } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'getJob',
    args: [BigInt(jobId)],
    query: { refetchInterval: 3000 },
  }) as { data: any };

  const { data: earned } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'getEarnedAmount',
    args: [BigInt(jobId)],
    query: { refetchInterval: 1000, enabled: !!job },
  }) as { data: bigint | undefined };

  if (!job) return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
      <div className="text-white/60">Loading job #{jobId}...</div>
    </div>
  );

  const statusLabel = JOB_STATUS[job.status as keyof typeof JOB_STATUS] || 'Unknown';
  const earnedPct = earned && job.totalDeposit > 0n
    ? Number((earned * 100n) / job.totalDeposit)
    : 0;

  const timeline = [
    { label: 'Created', done: job.status >= 0 },
    { label: 'Accepted', done: job.status >= 1 },
    { label: 'Work Started', done: job.accumulatedEarned > 0n || job.streamActive },
    { label: 'Completed', done: job.status === 3 },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white px-8 py-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-[#836EF9] text-sm hover:underline mb-6 block">← Back</Link>

        <h1 className="text-2xl font-bold mb-1">Job #{jobId}</h1>
        <p className="text-white/60 mb-8">{job.description}</p>

        {/* Status Timeline */}
        <div className="flex items-center gap-2 mb-8">
          {timeline.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                step.done ? 'bg-[#836EF9]/20 text-[#836EF9]' : 'bg-white/5 text-white/30'
              }`}>
                {step.done && <span>✓</span>}
                {step.label}
              </div>
              {i < timeline.length - 1 && (
                <div className={`h-px w-6 ${step.done ? 'bg-[#836EF9]' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Streaming Progress Bar */}
        {job.totalDeposit > 0n && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/60">Streaming Progress</span>
              <span className="font-mono">{earned ? formatEther(earned) : '0'} / {formatEther(job.totalDeposit)} MON</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#836EF9] to-[#A78BFA] rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(earnedPct, 100)}%` }}
              />
            </div>
            <div className="text-xs text-white/40 mt-1">{earnedPct.toFixed(2)}% earned</div>
          </div>
        )}

        {/* Job Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Employer', value: `${job.employer.slice(0, 10)}...${job.employer.slice(-8)}` },
            { label: 'Freelancer', value: `${job.freelancer.slice(0, 10)}...${job.freelancer.slice(-8)}` },
            { label: 'Rate', value: `${formatEther(job.ratePerSecond)} MON/sec` },
            { label: 'Total Deposit', value: `${formatEther(job.totalDeposit)} MON` },
            { label: 'Total Withdrawn', value: `${formatEther(job.totalWithdrawn)} MON` },
            { label: 'Status', value: statusLabel },
          ].map((item) => (
            <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-xs text-white/40 mb-1">{item.label}</div>
              <div className="font-mono text-sm">{item.value}</div>
            </div>
          ))}
        </div>

        {job.status === 4 && (
          <Link
            href={`/dispute/${jobId}`}
            className="block mt-6 text-center py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl font-medium transition"
          >
            Go to Dispute Resolution →
          </Link>
        )}
      </div>
    </div>
  );
}
```

---

### Page (e): Dispute Page — `app/dispute/[jobId]/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useReadContract } from 'wagmi';
import { formatEther } from 'viem';
import { ESCROW_ADDRESS, ESCROW_ABI } from '@/lib/contracts';

interface AIRuling {
  freelancerPercent: number;
  employerPercent: number;
  reasoning: string;
  txHash?: string;
}

export default function DisputePage() {
  const params = useParams();
  const jobId = parseInt(params.jobId as string);

  const [freelancerEvidence, setFreelancerEvidence] = useState('');
  const [employerEvidence, setEmployerEvidence] = useState('');
  const [loading, setLoading] = useState(false);
  const [ruling, setRuling] = useState<AIRuling | null>(null);
  const [error, setError] = useState('');

  const { data: job } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'getJob',
    args: [BigInt(jobId)],
  }) as { data: any };

  const handleSubmitDispute = async () => {
    if (!freelancerEvidence.trim() || !employerEvidence.trim()) {
      setError('Both parties must submit evidence.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3001/api/resolve-dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          freelancerEvidence,
          employerEvidence,
          jobDescription: job?.description || 'No description',
        }),
      });

      if (!response.ok) throw new Error('Backend returned error: ' + response.status);

      const data = await response.json();
      setRuling(data);
    } catch (err: any) {
      setError('AI arbitration failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white px-8 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 bg-red-500 rounded-full" />
          <h1 className="text-2xl font-bold">Dispute Resolution</h1>
        </div>
        <p className="text-white/60 mb-2">Job #{jobId}</p>
        {job && (
          <p className="text-white/40 text-sm mb-8">
            Escrow at stake: {formatEther(job.totalDeposit - job.totalWithdrawn)} MON
          </p>
        )}

        {!ruling ? (
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="font-semibold mb-4 text-[#836EF9]">Freelancer Evidence</h2>
              <textarea
                value={freelancerEvidence}
                onChange={(e) => setFreelancerEvidence(e.target.value)}
                placeholder="Describe the work completed, deliverables provided, any communication history, reasons payment is owed in full..."
                rows={5}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#836EF9] resize-none"
              />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="font-semibold mb-4 text-red-400">Employer Evidence</h2>
              <textarea
                value={employerEvidence}
                onChange={(e) => setEmployerEvidence(e.target.value)}
                placeholder="Describe the issues with deliverables, what was agreed vs. delivered, reasons for withholding payment..."
                rows={5}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-red-500 resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmitDispute}
              disabled={loading}
              className="w-full py-4 bg-[#836EF9] hover:bg-[#6B56E0] disabled:opacity-50 rounded-xl font-semibold text-lg transition"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  AI Arbitrator Analyzing...
                </span>
              ) : 'Submit to AI Arbitrator'}
            </button>
          </div>
        ) : (
          /* RULING DISPLAY */
          <div className="space-y-6">
            <div className="bg-[#836EF9]/10 border border-[#836EF9]/30 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-4">⚖️</div>
              <h2 className="text-xl font-bold mb-6">AI Arbitrator Ruling</h2>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-white/5 rounded-xl p-5">
                  <div className="text-sm text-white/60 mb-1">Freelancer receives</div>
                  <div className="text-4xl font-bold text-[#836EF9]">{ruling.freelancerPercent}%</div>
                  {job && (
                    <div className="text-sm text-white/60 mt-1">
                      ≈ {(parseFloat(formatEther(job.totalDeposit - job.totalWithdrawn)) * ruling.freelancerPercent / 100).toFixed(4)} MON
                    </div>
                  )}
                </div>
                <div className="bg-white/5 rounded-xl p-5">
                  <div className="text-sm text-white/60 mb-1">Employer receives</div>
                  <div className="text-4xl font-bold text-white">{ruling.employerPercent}%</div>
                  {job && (
                    <div className="text-sm text-white/60 mt-1">
                      ≈ {(parseFloat(formatEther(job.totalDeposit - job.totalWithdrawn)) * ruling.employerPercent / 100).toFixed(4)} MON
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-white/80 mb-3">AI Reasoning</h3>
              <p className="text-white/70 leading-relaxed">{ruling.reasoning}</p>
            </div>

            {ruling.txHash && (
              <a
                href={`https://testnet.monadexplorer.com/tx/${ruling.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-[#836EF9] hover:underline transition"
              >
                View resolution transaction on MonadScan →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Page (f): Credentials Page — `app/credentials/page.tsx`

```typescript
'use client';

import { useAccount, useReadContract } from 'wagmi';
import { REGISTRY_ADDRESS, REGISTRY_ABI } from '@/lib/contracts';

export default function CredentialsPage() {
  const { address } = useAccount();

  const { data: credentials } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getCredentials',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  }) as { data: any[] | undefined };

  const validCreds = credentials?.filter((c) => c.isValid) ?? [];
  const revokedCreds = credentials?.filter((c) => !c.isValid) ?? [];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white px-8 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">My Credentials</h1>
        <p className="text-white/60 mb-10">
          Verified on-chain credentials issued by authorized organizations.
        </p>

        {!address ? (
          <p className="text-white/40">Connect your wallet to see credentials.</p>
        ) : validCreds.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">🎓</div>
            <p className="text-white/60">No verified credentials yet.</p>
            <p className="text-sm text-white/40 mt-2">Credentials are issued by authorized organizations and appear here automatically.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {validCreds.map((cred) => {
              const date = new Date(Number(cred.timestamp) * 1000);
              return (
                <div key={cred.id.toString()}
                  className="bg-white/5 border border-[#836EF9]/30 rounded-2xl p-6 hover:border-[#836EF9]/60 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-[#836EF9]/20 rounded-xl flex items-center justify-center text-[#836EF9] font-bold text-lg">
                        ✓
                      </div>
                      <div>
                        <div className="font-semibold text-lg mb-0.5">{cred.credentialType}</div>
                        <div className="text-sm text-white/60 mb-2">{cred.description}</div>
                        <div className="flex items-center gap-3 text-xs text-white/40">
                          <span>Issued by <span className="text-[#836EF9]">{cred.issuerName}</span></span>
                          <span>•</span>
                          <span>{date.toLocaleDateString()}</span>
                          <span>•</span>
                          <span className="font-mono">{cred.issuerAddress.slice(0, 8)}...{cred.issuerAddress.slice(-6)}</span>
                        </div>
                      </div>
                    </div>
                    <a
                      href={`https://testnet.monadexplorer.com/address/${REGISTRY_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#836EF9] hover:underline whitespace-nowrap"
                    >
                      Verify on-chain →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {revokedCreds.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold text-white/40 mb-4">Revoked Credentials ({revokedCreds.length})</h2>
            <div className="space-y-3">
              {revokedCreds.map((cred) => (
                <div key={cred.id.toString()}
                  className="bg-white/3 border border-white/5 rounded-xl p-4 opacity-50">
                  <div className="flex items-center gap-3">
                    <span className="text-red-400 text-xs">✗ REVOKED</span>
                    <span className="text-white/40 text-sm">{cred.credentialType}</span>
                    <span className="text-white/20 text-xs">• {cred.issuerName}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 5. Backend — Node.js + Express

### Full Backend Code

**File:** `backend/server.ts`

```typescript
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { ethers } from 'ethers';

dotenv.config();

const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'https://monadwork.vercel.app'] }));
app.use(express.json());

// ─── Config ──────────────────────────────────────────────────────────────────

const MONAD_RPC = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';
const ARBITRATOR_KEY = process.env.ARBITRATOR_PRIVATE_KEY!;
const ESCROW_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS!;

if (!ARBITRATOR_KEY || !ESCROW_ADDRESS) {
  console.error('Missing ARBITRATOR_PRIVATE_KEY or ESCROW_CONTRACT_ADDRESS in .env');
  process.exit(1);
}

// ─── Blockchain Setup ─────────────────────────────────────────────────────────

const provider = new ethers.JsonRpcProvider(MONAD_RPC);
const arbitratorWallet = new ethers.Wallet(ARBITRATOR_KEY, provider);

// Minimal ABI for the resolve function
const ESCROW_ABI = [
  'function resolve(uint256 jobId, uint256 freelancerPercent, uint256 employerPercent) external',
  'function jobs(uint256) external view returns (address employer, address freelancer, uint256 ratePerSecond, uint256 totalDeposit, uint256 streamStartTime, uint256 accumulatedEarned, uint256 totalWithdrawn, uint8 status, string description, bool streamActive)',
];

const escrowContract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, arbitratorWallet);

// ─── Gemini AI Setup ──────────────────────────────────────────────────────────

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ─── FULL GEMINI PROMPT TEMPLATE ─────────────────────────────────────────────

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
You MUST respond with ONLY valid JSON in this exact format — no markdown, no extra text, no explanation outside the JSON:
{
  "freelancerPercent": <integer 0-100>,
  "employerPercent": <integer 0-100>,
  "reasoning": "<2-3 sentence explanation of your ruling>"
}

IMPORTANT: freelancerPercent + employerPercent MUST equal exactly 100.
IMPORTANT: Be decisive. Do not hedge with exactly 50/50 unless the evidence is genuinely ambiguous.`;
}

// ─── DISPUTE RESOLUTION ENDPOINT ─────────────────────────────────────────────

app.post('/api/resolve-dispute', async (req: Request, res: Response) => {
  const { jobId, freelancerEvidence, employerEvidence, jobDescription } = req.body;

  if (jobId === undefined || !freelancerEvidence || !employerEvidence) {
    return res.status(400).json({ error: 'Missing required fields: jobId, freelancerEvidence, employerEvidence' });
  }

  console.log(`\n[Dispute] Resolving job #${jobId}...`);

  let freelancerPercent = 50;
  let employerPercent = 50;
  let reasoning = 'Default 50/50 split applied as fallback.';
  let aiSuccess = false;

  // ── Step 1: Get job info from chain ──────────────────────────────────────
  let escrowAmount = 'unknown';
  try {
    const job = await escrowContract.jobs(jobId);
    escrowAmount = ethers.formatEther(job.totalDeposit - job.totalWithdrawn);
    console.log(`[Dispute] Escrow remaining: ${escrowAmount} MON`);
  } catch (err) {
    console.warn('[Dispute] Could not fetch job from chain:', err);
  }

  // ── Step 2: Call Gemini AI ────────────────────────────────────────────────
  try {
    const prompt = buildArbitrationPrompt(
      jobDescription || 'No description provided',
      freelancerEvidence,
      employerEvidence,
      escrowAmount
    );

    console.log('[Dispute] Calling Gemini API...');

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3, // Lower temperature for consistent, fair rulings
      },
    });

    const rawText = response.text;
    console.log('[Dispute] Gemini raw response:', rawText);

    // Parse the JSON response
    const parsed = JSON.parse(rawText);

    // Validate
    if (
      typeof parsed.freelancerPercent === 'number' &&
      typeof parsed.employerPercent === 'number' &&
      parsed.freelancerPercent + parsed.employerPercent === 100 &&
      parsed.freelancerPercent >= 0 &&
      parsed.freelancerPercent <= 100
    ) {
      freelancerPercent = Math.round(parsed.freelancerPercent);
      employerPercent = 100 - freelancerPercent;
      reasoning = parsed.reasoning || reasoning;
      aiSuccess = true;
      console.log(`[Dispute] AI ruling: ${freelancerPercent}% / ${employerPercent}%`);
    } else {
      console.warn('[Dispute] Invalid AI response format, using 50/50 fallback');
    }
  } catch (aiError) {
    console.error('[Dispute] Gemini API error, using 50/50 fallback:', aiError);
    // ── FALLBACK: 50/50 split ──────────────────────────────────────────────
    reasoning = 'AI arbitration temporarily unavailable. Default 50/50 split applied for fairness.';
  }

  // ── Step 3: Submit resolve() transaction to Monad ─────────────────────────
  let txHash: string | undefined;
  try {
    console.log(`[Dispute] Submitting resolve(${jobId}, ${freelancerPercent}, ${employerPercent}) to Monad...`);

    const tx = await escrowContract.resolve(
      BigInt(jobId),
      BigInt(freelancerPercent),
      BigInt(employerPercent)
    );

    console.log(`[Dispute] Transaction submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    txHash = receipt.hash;
    console.log(`[Dispute] Confirmed in block ${receipt.blockNumber}`);
  } catch (txError: any) {
    console.error('[Dispute] Transaction failed:', txError);
    return res.status(500).json({
      error: 'Failed to submit resolution to blockchain: ' + txError.message,
      ruling: { freelancerPercent, employerPercent, reasoning },
    });
  }

  // ── Step 4: Return ruling to frontend ─────────────────────────────────────
  return res.json({
    success: true,
    freelancerPercent,
    employerPercent,
    reasoning,
    txHash,
    aiUsed: aiSuccess,
  });
});

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    arbitratorAddress: arbitratorWallet.address,
    escrowContract: ESCROW_ADDRESS,
    rpc: MONAD_RPC,
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\nMonadWork Backend running on port ${PORT}`);
  console.log(`Arbitrator wallet: ${arbitratorWallet.address}`);
  console.log(`Escrow contract: ${ESCROW_ADDRESS}`);
  console.log(`RPC: ${MONAD_RPC}\n`);
});
```

**File:** `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Run the backend:**

```bash
cd backend
npm install
npx ts-node server.ts
# OR for production:
npx tsc && node dist/server.js
```

---

## 6. Complete Dependency List

### Frontend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | `^14.2.0` | React framework with App Router |
| `react` | `^18.3.0` | UI library |
| `react-dom` | `^18.3.0` | React DOM renderer |
| `typescript` | `^5.4.0` | Type safety |
| `tailwindcss` | `^3.4.0` | Utility-first CSS |
| `postcss` | `^8.4.0` | CSS processing (Tailwind dependency) |
| `autoprefixer` | `^10.4.0` | Vendor prefixes (Tailwind dependency) |
| `wagmi` | `^2.14.0` | React hooks for Ethereum |
| `viem` | `^2.21.0` | TypeScript Ethereum interface |
| `@tanstack/react-query` | `^5.59.0` | Async state management (wagmi dependency) |
| `@types/node` | `^20.0.0` | TypeScript Node.js types |
| `@types/react` | `^18.3.0` | TypeScript React types |
| `@types/react-dom` | `^18.3.0` | TypeScript React DOM types |

**Install command:**

```bash
npx create-next-app@latest frontend --typescript --tailwind --app --use-npm
cd frontend
npm install wagmi viem @tanstack/react-query
```

### Backend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | `^4.21.0` | HTTP server framework |
| `cors` | `^2.8.5` | Cross-Origin Resource Sharing |
| `dotenv` | `^16.4.0` | Environment variable loading |
| `ethers` | `^6.13.0` | Ethereum interaction (sign + send txs) |
| `@google/genai` | `^0.7.0` | Google Gemini AI API (latest SDK) |
| `@types/express` | `^4.17.0` | TypeScript types for Express |
| `@types/cors` | `^2.8.0` | TypeScript types for cors |
| `ts-node` | `^10.9.0` | TypeScript execution for Node.js |
| `typescript` | `^5.4.0` | TypeScript compiler |

**Install command:**

```bash
mkdir backend && cd backend
npm init -y
npm install express cors dotenv ethers @google/genai
npm install -D typescript @types/express @types/cors @types/node ts-node
```

### Smart Contract Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `hardhat` | `^2.22.0` | Ethereum development environment |
| `@nomicfoundation/hardhat-toolbox` | `^5.0.0` | Hardhat plugins bundle (ethers, chai, mocha, etc.) |
| `@nomicfoundation/hardhat-verify` | `^2.0.0` | Contract verification on explorers |
| `@types/node` | `^20.0.0` | TypeScript Node.js types |
| `typescript` | `^5.4.0` | TypeScript for Hardhat config |
| `ts-node` | `^10.9.0` | TypeScript execution |
| `dotenv` | `^16.4.0` | Load .env in Hardhat config |

**Install command:**

```bash
mkdir contracts && cd contracts
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-verify typescript ts-node @types/node dotenv
npx hardhat init  # choose TypeScript project
```

---

## 7. Configuration Files

### `hardhat.config.ts`

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    monadTestnet: {
      url: process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
      gasPrice: "auto",
      gas: "auto",
    },
  },
  etherscan: {
    apiKey: {
      monadTestnet: "placeholder", // MonadScan may not require a key on testnet
    },
    customChains: [
      {
        network: "monadTestnet",
        chainId: 10143,
        urls: {
          apiURL: "https://testnet.monadexplorer.com/api",
          browserURL: "https://testnet.monadexplorer.com",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
```

### Wagmi Config (already shown in Section 4, repeated here for reference)

**File:** `frontend/lib/wagmi.ts`

```typescript
import { http, createConfig } from 'wagmi';
import { monadTestnet } from 'wagmi/chains';
import { injected, metaMask } from 'wagmi/connectors';

export const config = createConfig({
  chains: [monadTestnet],
  connectors: [
    injected(),
    metaMask(),
  ],
  transports: {
    [monadTestnet.id]: http('https://testnet-rpc.monad.xyz'),
  },
});

export { monadTestnet };
```

> **Note:** `monadTestnet` (chain ID 10143) is [natively supported in viem/wagmi](https://wagmi.sh/core/api/chains) — no custom chain definition needed.

### `.env.example` — Contracts (Hardhat)

```env
# contracts/.env
DEPLOYER_PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY_HERE
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
```

### `.env.example` — Backend

```env
# backend/.env
GEMINI_API_KEY=AIzaYOUR_GEMINI_API_KEY_HERE
ARBITRATOR_PRIVATE_KEY=0xYOUR_ARBITRATOR_PRIVATE_KEY_HERE
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
ESCROW_CONTRACT_ADDRESS=0xDEPLOYED_ESCROW_ADDRESS
REGISTRY_CONTRACT_ADDRESS=0xDEPLOYED_REGISTRY_ADDRESS
PORT=3001
```

### `.env.local.example` — Frontend (Next.js)

```env
# frontend/.env.local
NEXT_PUBLIC_ESCROW_ADDRESS=0xDEPLOYED_ESCROW_ADDRESS
NEXT_PUBLIC_REGISTRY_ADDRESS=0xDEPLOYED_REGISTRY_ADDRESS
NEXT_PUBLIC_MONAD_RPC=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // No special config needed for wagmi/viem with App Router
  webpack: (config) => {
    // Required for some Web3 packages
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;
```

### `tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        monad: {
          purple: '#836EF9',
          'purple-dark': '#6B56E0',
          bg: '#0A0A0F',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'counter-tick': 'fadeIn 0.1s ease-in',
      },
    },
  },
  plugins: [],
};

export default config;
```

### `globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --monad-purple: #836EF9;
  --monad-bg: #0A0A0F;
}

/* Smooth number transitions for streaming counter */
.counter-value {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}

/* Purple glow for active streaming state */
.stream-active {
  box-shadow: 0 0 40px rgba(131, 110, 249, 0.15);
}

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #0A0A0F; }
::-webkit-scrollbar-thumb { background: #836EF9; border-radius: 3px; }
```

---

## 8. Deployment Instructions

### Step 1: Get Testnet MON from Faucet

1. Go to **https://faucet.monad.xyz**
2. Connect your wallet or enter your address
3. Request MON — you'll receive enough for deployment + testing
4. You need at least **2 wallets funded**:
   - **Deployer / Arbitrator wallet** (used by Hardhat + backend)
   - **Demo employer wallet** (used in the hackathon demo)
   - **Demo freelancer wallet** (second MetaMask account works)

> If the official faucet is slow, try the community faucet at **https://monad-faucet.vercel.app** or ask in the hackathon Discord.

### Step 2: Add Monad Testnet to MetaMask

| Field | Value |
|-------|-------|
| Network Name | Monad Testnet |
| RPC URL | https://testnet-rpc.monad.xyz |
| Chain ID | 10143 |
| Currency Symbol | MON |
| Block Explorer | https://testnet.monadexplorer.com |

### Step 3: Compile Smart Contracts

```bash
cd contracts

# Copy and fill your .env
cp .env.example .env
# Edit .env with your DEPLOYER_PRIVATE_KEY

# Compile
npx hardhat compile

# Expected output:
# Compiled 2 Solidity files successfully (evm target: cancun)
```

### Step 4: Deploy to Monad Testnet

```bash
npx hardhat run scripts/deploy.ts --network monadTestnet
```

**Expected output:**
```
Deploying contracts with account: 0xYOUR_ADDRESS
Account balance: 10.0 MON

1. Deploying CredentialRegistry...
   CredentialRegistry deployed to: 0xABC...
2. Deploying MonadWorkEscrow...
   MonadWorkEscrow deployed to: 0xDEF...
3. Seeding demo credentials...
   Credential 1 issued: Solidity Developer
   ...

═══════════════════════════════════════════
DEPLOYMENT COMPLETE — Copy these to .env:
═══════════════════════════════════════════
NEXT_PUBLIC_ESCROW_ADDRESS=0xDEF...
NEXT_PUBLIC_REGISTRY_ADDRESS=0xABC...
ESCROW_CONTRACT_ADDRESS=0xDEF...
REGISTRY_CONTRACT_ADDRESS=0xABC...
```

**Copy those addresses into both `frontend/.env.local` and `backend/.env`.**

### Step 5: Copy ABIs to Frontend

After compilation, Hardhat generates ABIs in `contracts/artifacts/contracts/`:

```bash
# From the contracts directory:
cp artifacts/contracts/MonadWorkEscrow.sol/MonadWorkEscrow.json ../frontend/abis/
cp artifacts/contracts/CredentialRegistry.sol/CredentialRegistry.json ../frontend/abis/
```

> The ABI files contain both the ABI array and bytecode. In `frontend/lib/contracts.ts`, import the `.json` and use `EscrowABI.abi` if the JSON has a top-level `abi` key, or just `EscrowABI` if it's a flat array.

**Adjust imports:**
```typescript
// If Hardhat artifact format (has .abi property):
import EscrowArtifact from '@/abis/MonadWorkEscrow.json';
export const ESCROW_ABI = EscrowArtifact.abi;
```

### Step 6: Verify on MonadScan (Optional but impressive for demo)

```bash
npx hardhat verify --network monadTestnet 0xDEPLOYED_ESCROW_ADDRESS "0xARBITRATOR_ADDRESS"
npx hardhat verify --network monadTestnet 0xDEPLOYED_REGISTRY_ADDRESS
```

Then visit `https://testnet.monadexplorer.com/address/0xYOUR_ADDRESS` to show verified source code during demo.

### Step 7: Start Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Fill in deployed contract addresses

npm run dev
# Runs on http://localhost:3000
```

### Step 8: Start Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in GEMINI_API_KEY, ARBITRATOR_PRIVATE_KEY, and contract addresses

npx ts-node server.ts
# Runs on http://localhost:3001
# Verify: curl http://localhost:3001/health
```

### Step 9: Deploy Frontend to Vercel (Optional for demo polish)

```bash
cd frontend
npx vercel deploy --prod
# Set environment variables in Vercel dashboard under Settings > Environment Variables
```

---

## 9. Build Phases — Time-Boxed for 8 Hours

### Phase 1 — Hours 0:00 to 2:00: Smart Contracts

**Goal:** Both contracts deployed and manually verified on Monad testnet.

| Time | Task | Notes |
|------|------|-------|
| 0:00–0:15 | Set up Hardhat project, install deps | `npx hardhat init`, choose TypeScript |
| 0:15–0:20 | Configure `hardhat.config.ts` for Monad | Use config from Section 7 |
| 0:20–1:00 | Write `MonadWorkEscrow.sol` | Copy from Section 3, understand the streaming math |
| 1:00–1:20 | Write `CredentialRegistry.sol` | Copy from Section 3 |
| 1:20–1:35 | Compile and fix any errors | `npx hardhat compile` |
| 1:35–1:50 | Deploy both contracts | `npx hardhat run scripts/deploy.ts --network monadTestnet` |
| 1:50–2:00 | Manual test — call `createJob`, confirm on MonadScan | Use Hardhat console or a quick test script |

**Manual test script** (`scripts/quickTest.ts`):
```typescript
import { ethers } from "hardhat";
async function main() {
  const [deployer, freelancer] = await ethers.getSigners();
  const escrow = await ethers.getContractAt("MonadWorkEscrow", "0xDEPLOYED_ADDRESS");
  
  // Create job
  const tx = await escrow.createJob(
    freelancer.address,
    ethers.parseEther("0.001"), // 0.001 MON/sec
    "Test job from quickTest",
    { value: ethers.parseEther("1") } // 1 MON deposit
  );
  await tx.wait();
  console.log("Job created! Job ID: 0");
  
  // Get job
  const job = await escrow.getJob(0);
  console.log("Status:", job.status.toString()); // Should be 0 (Created)
  console.log("Deposit:", ethers.formatEther(job.totalDeposit), "MON");
}
main();
```
```bash
npx hardhat run scripts/quickTest.ts --network monadTestnet
```

---

### Phase 2 — Hours 2:00 to 5:00: Frontend Core

**Goal:** Working employer + freelancer flows with live streaming counter.

| Time | Task | Notes |
|------|------|-------|
| 2:00–2:20 | Create Next.js app, install wagmi/viem | `create-next-app`, `npm install wagmi viem @tanstack/react-query` |
| 2:20–2:35 | Set up wagmi config, Providers, layout | Use Section 7 config, monadTestnet from viem/chains |
| 2:35–2:50 | Copy ABI files, create `lib/contracts.ts` | Match ABI format from Hardhat artifacts |
| 2:50–3:30 | Build Employer Dashboard (post job form + job list) | Copy from Section 4(b) |
| 3:30–4:30 | Build Freelancer Dashboard | Focus on StreamingCounter component first |
| 4:30–4:50 | **Test the streaming counter end-to-end** | Create job, accept, start stream, verify counter ticks |
| 4:50–5:00 | Add withdraw button, test withdrawal | Should see MON arrive in wallet |

**Critical: Streaming Counter checklist**
- [ ] `getEarnedAmount(jobId)` is called via `useReadContract` with `refetchInterval: 1000`
- [ ] Client-side interpolation runs every 100ms using `setInterval`
- [ ] Both `streamStartTime` and `ratePerSecond` are read from the job struct (as BigInt)
- [ ] Display uses `toFixed(6)` for 6 decimal places
- [ ] When `streamActive === false`, counter freezes at `accumulatedEarned`

---

### Phase 3 — Hours 5:00 to 7:00: AI + Credentials + Disputes

**Goal:** AI arbitration working, credentials visible, dispute UI functional.

| Time | Task | Notes |
|------|------|-------|
| 5:00–5:20 | Set up backend: `server.ts`, install deps | Copy from Section 5 |
| 5:20–5:30 | Configure `.env` for backend | GEMINI_API_KEY, ARBITRATOR_KEY, etc. |
| 5:30–5:50 | Test `/api/resolve-dispute` with curl | Verify Gemini responds, tx lands on chain |
| 5:50–6:15 | Build Dispute Page UI | Copy from Section 4(e) |
| 6:15–6:35 | Build Credentials Page | Copy from Section 4(f) |
| 6:35–6:50 | Seed demo credentials via Hardhat script | Run deploy.ts with DEMO_FREELANCER set |
| 6:50–7:00 | Test full dispute flow end-to-end | Raise dispute → submit evidence → see AI ruling → confirm on chain |

**Curl test for backend:**
```bash
curl -X POST http://localhost:3001/api/resolve-dispute \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": 0,
    "freelancerEvidence": "I delivered all agreed deliverables on time. The smart contract was deployed and fully tested. The employer approved the initial draft and then refused to pay.",
    "employerEvidence": "The code had critical bugs. The contract was not audited and failed in production. I lost money due to the bugs.",
    "jobDescription": "Develop and deploy a Solidity smart contract"
  }'
```

Expected response:
```json
{
  "success": true,
  "freelancerPercent": 70,
  "employerPercent": 30,
  "reasoning": "The freelancer delivered the contract as agreed. While the employer raises concerns about bugs, they approved the initial work. A 70/30 split reflects partial fault on both sides.",
  "txHash": "0x...",
  "aiUsed": true
}
```

---

### Phase 4 — Hours 7:00 to 8:00: Polish + Demo Prep

**Goal:** Bug-free, demo-ready application.

| Time | Task | Notes |
|------|------|-------|
| 7:00–7:15 | Fix any broken flows, console errors | Prioritize streaming counter and dispute flow |
| 7:15–7:25 | Add Loading states, error messages | Already coded in templates above |
| 7:25–7:35 | Test complete end-to-end demo script | Follow Section 10 exactly |
| 7:35–7:45 | Add Landing page (copy from Section 4(a)) | The "Why Monad?" section scores judging points |
| 7:45–7:55 | Prepare demo wallet with MON balance | At least 10 MON in employer wallet |
| 7:55–8:00 | Final browser check, confirm contract addresses | Reload fresh, wallet connected |

**Pre-demo checklist:**
- [ ] Employer wallet: funded with 10+ MON testnet
- [ ] Freelancer wallet: separate account in MetaMask
- [ ] Backend running at localhost:3001
- [ ] Frontend running at localhost:3000
- [ ] Both contract addresses in .env.local
- [ ] MonadScan tab open to escrow contract
- [ ] Demo job pre-created if needed (optional fallback)

---

## 10. Demo Script

**Duration:** 4–5 minutes | **Presenter:** Emon

---

**[SLIDE / LIVE APP ON SCREEN]**

**Line 1:**
> "Hi, I'm Emon. Freelancers get paid late, get scammed, and can't prove their credentials. This is MonadWork — get paid for every second you work. And it runs on Monad."

---

**[OPEN LANDING PAGE — show the "Why Monad?" section briefly]**

> "Four features of Monad — 10,000 TPS, 0.4s blocks, parallel execution, near-zero gas — each one unlocks a specific product feature. Let me show you."

---

**[SWITCH TO EMPLOYER DASHBOARD — wallet connected as employer]**

> "I'm an employer. I need a smart contract built. I'll post a job — freelancer's wallet address, a rate of 0.001 MON per second — about 3.6 MON per hour — and I'll deposit 5 MON as escrow."

*[Fill the form, click "Create Job & Deposit 5 MON"]*

> "Transaction confirmed in under a second. The funds are now locked in an auditable smart contract on Monad. Nobody can touch them without cryptographic authorization."

*[Show the job appearing in the employer dashboard with "Created" badge]*

---

**[SWITCH TO FREELANCER DASHBOARD — different wallet account]**

> "Now I'm the freelancer. I can see this job was assigned to me, along with my verified on-chain credentials."

*[Point to credential badges — Solidity Developer, React Expert, ETHGlobal Finalist]*

> "These credentials are issued by authorized organizations and stored permanently on-chain. No one can fake them — not even the platform."

*[Click "Accept Job"]*
> "I accept the job."

---

**[CLICK "START WORK" — START THE STREAM]**

> "And now I start working."

*[The streaming counter begins ticking]*

**[PAUSE FOR EFFECT — let the counter run for 10-15 seconds]**

> "Watch this."

*[Point dramatically at the counter — 0.000000 → 0.001000 → 0.002000 → ...]*

> "That's my wallet balance. Growing. Every. Single. Second. On Ethereum this would be impossible — blocks are 12 seconds apart. Monad's 0.4-second blocks make real-time streaming feel real."

---

**[CLICK "WITHDRAW EARNED" — mid-stream]**

> "And I don't have to wait until the job is done. I can withdraw right now."

*[Click Withdraw]*
> "That MON just landed in my wallet. No platform fee, no 7-day hold, no wire transfer. Near-zero gas on Monad means even micro-withdrawals are viable."

---

**[SWITCH BACK TO EMPLOYER DASHBOARD — trigger a dispute]**

> "Now let's say there's a disagreement. The employer is unhappy."

*[Click "Dispute"]*

> "The stream pauses. Funds are frozen. Nobody can run with the money."

---

**[NAVIGATE TO DISPUTE PAGE]**

> "Both parties submit evidence. I'll type a few lines for each side."

*[Fill freelancer evidence: "Delivered all agreed smart contracts, tested on testnet, employer signed off on week 1."]*
*[Fill employer evidence: "Final deliverable had a critical reentrancy bug that cost us gas."]*

*[Click "Submit to AI Arbitrator"]*

> "Our AI arbitrator — powered by Gemini — reads both sides and returns a verdict."

*[10 seconds pass — ruling appears: e.g., 75% freelancer / 25% employer]*

> "75% to the freelancer, 25% refunded to the employer, with a 3-sentence explanation. And look — that ruling was immediately executed on-chain."

*[Show MonadScan tx link]*

> "The AI isn't just advisory. It directly called the resolve() function on the smart contract. The funds split in the same block."

---

**[BACK TO LANDING PAGE — close the demo]**

> "Escrow. Streaming. Credentials. AI arbitration. Every piece of this settles on Monad in under a second."

*[Pause]*

> "This is what the future of work looks like. Thank you."

---

## 11. Risks & Fallbacks

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| **Streaming math bug** (accumulated earnings off by one) | Medium | Pre-test with known values: 100 seconds × 0.001 MON/s = 0.1 MON. Console.log `getEarnedAmount` at known timestamps. Have hardcoded fallback that just reads `accumulatedEarned` |
| **Gemini API fails or rate-limits** | Low-Medium | Backend always defaults to 50/50 split if AI fails. The `resolve()` tx still goes through. Fallback message: "AI temporarily unavailable — fair 50/50 applied" |
| **Contract deployment fails** (insufficient gas, wrong RPC) | Low | Pre-deploy contracts the night before hackathon. Save deployed addresses in a notes file. If deploy fails, use pre-deployed contract addresses |
| **wagmi wallet connection issues** | Low-Medium | Test MetaMask + Monad Testnet connection before demo. Have Rabby Wallet as fallback. Test `injected()` connector specifically |
| **Counter not ticking** (useEffect not running client-side) | Low | Add `'use client'` directive at top of freelancer page. Verify `streamActive === true` on the job struct. The 100ms interpolation should work even if RPC polling is slow |
| **ABI mismatch** (function signature changed post-compile) | Low | Always re-copy ABI from `artifacts/` after any contract change. Don't manually edit ABI files |
| **Out of testnet MON** | Medium | Fund deployer + 2 demo wallets with 20 MON each before hackathon. Bookmark faucet.monad.xyz |
| **Run out of time** | Medium | **Priority stack:** (1) escrow + streaming counter, (2) employer/freelancer dashboards, (3) credentials display, (4) AI disputes, (5) landing page polish. Cut in reverse order |
| **Backend fails to sign tx** | Low | Check ARBITRATOR_PRIVATE_KEY in .env. Verify arbitrator address matches contract's `arbitrator` state variable. Run `curl /health` to confirm wallet address |
| **Next.js build error** | Low | Keep `next.config.js` webpack fallback for `fs: false`. Use `'use client'` on all wagmi-using components. Ensure no server-side wagmi hooks |

---

## Quick Reference — Key Values

```
Network:         Monad Testnet
Chain ID:        10143
RPC URL:         https://testnet-rpc.monad.xyz
Block Explorer:  https://testnet.monadexplorer.com
Faucet:          https://faucet.monad.xyz
Currency:        MON (18 decimals)
Block Time:      ~400ms
TPS:             10,000

Demo Rate:       0.001 MON/second (= 3.6 MON/hour)
Demo Deposit:    5 MON (= ~1.38 hours of work)

Accent Color:    #836EF9 (Monad Purple)
Background:      #0A0A0F (Near Black)
```

---

## File Structure Reference

```
monadwork/
├── contracts/                    # Hardhat project
│   ├── contracts/
│   │   ├── MonadWorkEscrow.sol
│   │   └── CredentialRegistry.sol
│   ├── scripts/
│   │   ├── deploy.ts
│   │   └── quickTest.ts
│   ├── hardhat.config.ts
│   ├── package.json
│   └── .env                      # DEPLOYER_PRIVATE_KEY, MONAD_RPC_URL
│
├── frontend/                     # Next.js app
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Landing
│   │   ├── employer/page.tsx
│   │   ├── freelancer/page.tsx
│   │   ├── job/[id]/page.tsx
│   │   ├── dispute/[jobId]/page.tsx
│   │   └── credentials/page.tsx
│   ├── abis/
│   │   ├── MonadWorkEscrow.json  # Copied from contracts/artifacts/
│   │   └── CredentialRegistry.json
│   ├── lib/
│   │   ├── wagmi.ts
│   │   └── contracts.ts
│   ├── providers/
│   │   └── Providers.tsx
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── package.json
│   └── .env.local                # Contract addresses
│
└── backend/                      # Express API
    ├── server.ts
    ├── tsconfig.json
    ├── package.json
    └── .env                      # GEMINI_API_KEY, ARBITRATOR_KEY
```

---

*Built for Monad Blitz Delhi 2026 — March 28, 2026*
*Author: Emon | Stack: Solidity + Next.js + Node.js + Gemini AI + Monad Testnet*
