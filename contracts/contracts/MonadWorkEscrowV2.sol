// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MonadWorkEscrowV2
 * @notice Monad-optimized freelancer escrow with optional employer-controlled auto settlement.
 * @dev Keeps the original create/accept/start/pause/withdraw/approve/dispute flow,
 *      while adding:
 *      - employer-controlled auto streaming
 *      - keeper-friendly settle() calls
 *      - optional top-ups for longer-than-expected work
 *      - employer pause support
 */
contract MonadWorkEscrowV2 {
    enum JobStatus {
        Created,
        Active,
        Paused,
        Completed,
        Disputed,
        Resolved,
        Cancelled
    }

    uint256 public constant DEFAULT_SETTLEMENT_INTERVAL = 30;

    struct Job {
        address employer;
        address freelancer;
        uint256 ratePerSecond;
        uint256 totalDeposit;
        uint256 streamStartTime;
        uint256 accumulatedEarned;
        uint256 totalWithdrawn;
        uint256 settlementInterval;
        uint256 lastAutoSettlementTime;
        JobStatus status;
        string description;
        bool streamActive;
        bool autoSettlementEnabled;
    }

    mapping(uint256 => Job) internal jobs;
    uint256 public jobCount;
    address public arbitrator;
    address public owner;

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
    event StreamPausedByEmployer(uint256 indexed jobId, uint256 earnedSoFar);
    event Withdrawn(uint256 indexed jobId, address indexed freelancer, uint256 amount);
    event AutoSettled(uint256 indexed jobId, uint256 amount, uint256 settledAt);
    event AutoSettlementUpdated(uint256 indexed jobId, bool enabled, uint256 settlementInterval);
    event JobToppedUp(uint256 indexed jobId, uint256 amount, uint256 newTotalDeposit);
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

    modifier onlyEmployer(uint256 jobId) {
        require(msg.sender == jobs[jobId].employer, "MonadWork: caller is not the employer");
        _;
    }

    modifier onlyFreelancer(uint256 jobId) {
        require(msg.sender == jobs[jobId].freelancer, "MonadWork: caller is not the freelancer");
        _;
    }

    modifier onlyParty(uint256 jobId) {
        require(
            msg.sender == jobs[jobId].employer || msg.sender == jobs[jobId].freelancer,
            "MonadWork: caller not party to job"
        );
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

    constructor() {
        arbitrator = 0x6db6f137Ef6119Cf02EE71061C6Ac1FcBbAA0B61;
        owner = msg.sender;
    }

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
        Job storage job = jobs[jobId];
        job.employer = msg.sender;
        job.freelancer = freelancer;
        job.ratePerSecond = ratePerSecond;
        job.totalDeposit = msg.value;
        job.streamStartTime = 0;
        job.accumulatedEarned = 0;
        job.totalWithdrawn = 0;
        job.settlementInterval = DEFAULT_SETTLEMENT_INTERVAL;
        job.lastAutoSettlementTime = 0;
        job.status = JobStatus.Created;
        job.description = description;
        job.streamActive = false;
        job.autoSettlementEnabled = false;

        emit JobCreated(jobId, msg.sender, freelancer, ratePerSecond, msg.value, description);
    }

    function acceptJob(uint256 jobId)
        external
        onlyFreelancer(jobId)
        inStatus(jobId, JobStatus.Created)
    {
        jobs[jobId].status = JobStatus.Active;
        emit JobAccepted(jobId, msg.sender);
    }

    function startStream(uint256 jobId) external onlyFreelancer(jobId) {
        Job storage job = jobs[jobId];
        require(
            job.status == JobStatus.Active || job.status == JobStatus.Paused,
            "MonadWork: cannot start stream in current status"
        );
        require(!job.streamActive, "MonadWork: stream already active");
        require(job.totalWithdrawn < job.totalDeposit, "MonadWork: escrow exhausted");

        job.streamStartTime = block.timestamp;
        job.streamActive = true;
        job.status = JobStatus.Active;

        if (job.autoSettlementEnabled) {
            job.lastAutoSettlementTime = block.timestamp;
        }

        emit StreamStarted(jobId, block.timestamp);
    }

    function pauseStream(uint256 jobId)
        external
        onlyFreelancer(jobId)
        inStatus(jobId, JobStatus.Active)
    {
        _pauseStream(jobId, false);
    }

    function employerPauseStream(uint256 jobId)
        external
        onlyEmployer(jobId)
        inStatus(jobId, JobStatus.Active)
    {
        _pauseStream(jobId, true);
    }

    function resumeStream(uint256 jobId) external onlyParty(jobId) inStatus(jobId, JobStatus.Paused) {
        Job storage job = jobs[jobId];
        require(!job.streamActive, "MonadWork: stream already active");
        require(getEarnedAmount(jobId) < job.totalDeposit, "MonadWork: escrow exhausted");

        job.streamStartTime = block.timestamp;
        job.streamActive = true;
        job.status = JobStatus.Active;

        if (job.autoSettlementEnabled) {
            job.lastAutoSettlementTime = block.timestamp;
        }

        emit StreamResumed(jobId, block.timestamp);
    }

    function setAutoSettlement(
        uint256 jobId,
        bool enabled,
        uint256 settlementInterval
    ) external onlyEmployer(jobId) {
        Job storage job = jobs[jobId];
        require(
            job.status == JobStatus.Created || job.status == JobStatus.Active || job.status == JobStatus.Paused,
            "MonadWork: cannot change auto settlement now"
        );

        uint256 intervalToUse = settlementInterval == 0 ? DEFAULT_SETTLEMENT_INTERVAL : settlementInterval;
        require(intervalToUse >= 5, "MonadWork: interval too short");

        if (enabled) {
            uint256 claimable = getClaimableAmount(jobId);
            if (claimable > 0) {
                _payoutToFreelancer(jobId, claimable, false);
            }
            job.lastAutoSettlementTime = block.timestamp;
        }

        job.autoSettlementEnabled = enabled;
        job.settlementInterval = intervalToUse;

        emit AutoSettlementUpdated(jobId, enabled, intervalToUse);
    }

    function settle(uint256 jobId) external returns (uint256 settledAmount) {
        Job storage job = jobs[jobId];
        require(job.autoSettlementEnabled, "MonadWork: auto settlement disabled");
        require(
            job.status == JobStatus.Active || job.status == JobStatus.Paused,
            "MonadWork: cannot settle in current status"
        );

        if (job.streamActive) {
            uint256 referenceTime = job.lastAutoSettlementTime > 0
                ? job.lastAutoSettlementTime
                : job.streamStartTime;
            require(
                block.timestamp >= referenceTime + job.settlementInterval,
                "MonadWork: settlement interval not reached"
            );
        }

        settledAmount = getClaimableAmount(jobId);
        require(settledAmount > 0, "MonadWork: nothing to settle");

        _payoutToFreelancer(jobId, settledAmount, true);
    }

    function topUp(uint256 jobId) external payable onlyEmployer(jobId) {
        Job storage job = jobs[jobId];
        require(msg.value > 0, "MonadWork: top up must be > 0");
        require(
            job.status == JobStatus.Created || job.status == JobStatus.Active || job.status == JobStatus.Paused,
            "MonadWork: cannot top up in current status"
        );

        job.totalDeposit += msg.value;

        emit JobToppedUp(jobId, msg.value, job.totalDeposit);
    }

    function getEarnedAmount(uint256 jobId) public view returns (uint256 earned) {
        Job storage job = jobs[jobId];
        earned = job.accumulatedEarned;

        if (job.streamActive && job.streamStartTime > 0) {
            uint256 elapsed = block.timestamp - job.streamStartTime;
            earned += elapsed * job.ratePerSecond;
        }

        if (earned > job.totalDeposit) {
            earned = job.totalDeposit;
        }
    }

    function getClaimableAmount(uint256 jobId) public view returns (uint256) {
        uint256 earned = getEarnedAmount(jobId);
        Job storage job = jobs[jobId];
        return earned - job.totalWithdrawn;
    }

    function withdraw(uint256 jobId) external onlyFreelancer(jobId) {
        Job storage job = jobs[jobId];
        require(
            job.status == JobStatus.Active || job.status == JobStatus.Paused,
            "MonadWork: cannot withdraw in current status"
        );

        uint256 available = getClaimableAmount(jobId);
        require(available > 0, "MonadWork: nothing to withdraw");

        _payoutToFreelancer(jobId, available, false);
    }

    function approve(uint256 jobId) external onlyEmployer(jobId) {
        Job storage job = jobs[jobId];
        require(
            job.status == JobStatus.Active || job.status == JobStatus.Paused,
            "MonadWork: cannot approve in current status"
        );

        if (job.streamActive) {
            job.accumulatedEarned = getEarnedAmount(jobId);
            job.streamActive = false;
            job.streamStartTime = 0;
        }

        job.status = JobStatus.Completed;

        uint256 freelancerPayout = job.accumulatedEarned - job.totalWithdrawn;
        uint256 employerRefund = job.totalDeposit - job.accumulatedEarned;

        if (freelancerPayout > 0) {
            job.totalWithdrawn += freelancerPayout;
            (bool s1, ) = payable(job.freelancer).call{value: freelancerPayout}("");
            require(s1, "MonadWork: freelancer transfer failed");
        }

        if (employerRefund > 0) {
            (bool s2, ) = payable(job.employer).call{value: employerRefund}("");
            require(s2, "MonadWork: employer refund failed");
        }

        emit JobApproved(jobId, freelancerPayout, employerRefund);
    }

    function dispute(uint256 jobId) external onlyParty(jobId) {
        Job storage job = jobs[jobId];
        require(
            job.status == JobStatus.Active || job.status == JobStatus.Paused,
            "MonadWork: cannot dispute in current status"
        );

        if (job.streamActive) {
            job.accumulatedEarned = getEarnedAmount(jobId);
            job.streamActive = false;
            job.streamStartTime = 0;
        }

        job.autoSettlementEnabled = false;
        job.status = JobStatus.Disputed;

        emit DisputeRaised(jobId, msg.sender);
    }

    function resolve(
        uint256 jobId,
        uint256 freelancerPercent,
        uint256 employerPercent
    ) external onlyArbitrator inStatus(jobId, JobStatus.Disputed) {
        require(
            freelancerPercent + employerPercent == 100,
            "MonadWork: percentages must sum to 100"
        );

        Job storage job = jobs[jobId];
        job.status = JobStatus.Resolved;
        job.streamActive = false;
        job.streamStartTime = 0;
        job.autoSettlementEnabled = false;

        uint256 remaining = job.totalDeposit - job.totalWithdrawn;
        uint256 freelancerAmount = (remaining * freelancerPercent) / 100;
        uint256 employerAmount = remaining - freelancerAmount;

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

    function cancel(uint256 jobId) external onlyEmployer(jobId) {
        Job storage job = jobs[jobId];
        require(
            job.status == JobStatus.Created ||
                (job.status == JobStatus.Active && !job.streamActive && job.accumulatedEarned == 0),
            "MonadWork: cannot cancel after work has started"
        );

        job.status = JobStatus.Cancelled;
        uint256 refund = job.totalDeposit;
        job.totalDeposit = 0;

        (bool success, ) = payable(job.employer).call{value: refund}("");
        require(success, "MonadWork: refund failed");

        emit JobCancelled(jobId, refund);
    }

    function getJobCore(
        uint256 jobId
    )
        external
        view
        returns (
            address employer,
            address freelancer,
            uint256 ratePerSecond,
            uint256 totalDeposit,
            JobStatus status,
            bool streamActive,
            bool autoSettlementEnabled
        )
    {
        Job storage job = jobs[jobId];
        return (
            job.employer,
            job.freelancer,
            job.ratePerSecond,
            job.totalDeposit,
            job.status,
            job.streamActive,
            job.autoSettlementEnabled
        );
    }

    function getJobAccounting(
        uint256 jobId
    )
        external
        view
        returns (
            uint256 streamStartTime,
            uint256 accumulatedEarned,
            uint256 totalWithdrawn,
            uint256 settlementInterval,
            uint256 lastAutoSettlementTime
        )
    {
        Job storage job = jobs[jobId];
        return (
            job.streamStartTime,
            job.accumulatedEarned,
            job.totalWithdrawn,
            job.settlementInterval,
            job.lastAutoSettlementTime
        );
    }

    function getJobDescription(uint256 jobId) external view returns (string memory) {
        return jobs[jobId].description;
    }

    function setArbitrator(address _arbitrator) external {
        require(msg.sender == owner, "MonadWork: not owner");
        require(_arbitrator != address(0), "MonadWork: invalid arbitrator");
        arbitrator = _arbitrator;
    }

    receive() external payable {}

    function _pauseStream(uint256 jobId, bool byEmployer) internal {
        Job storage job = jobs[jobId];
        require(job.streamActive, "MonadWork: stream not active");

        job.accumulatedEarned = getEarnedAmount(jobId);
        job.streamActive = false;
        job.streamStartTime = 0;
        job.status = JobStatus.Paused;

        if (byEmployer) {
            emit StreamPausedByEmployer(jobId, job.accumulatedEarned);
        } else {
            emit StreamPaused(jobId, job.accumulatedEarned);
        }
    }

    function _payoutToFreelancer(
        uint256 jobId,
        uint256 amount,
        bool isAutoSettlement
    ) internal {
        Job storage job = jobs[jobId];
        job.totalWithdrawn += amount;

        if (job.streamActive && job.autoSettlementEnabled) {
            job.lastAutoSettlementTime = block.timestamp;
        }

        (bool success, ) = payable(job.freelancer).call{value: amount}("");
        require(success, "MonadWork: transfer failed");

        if (isAutoSettlement) {
            emit AutoSettled(jobId, amount, block.timestamp);
        } else {
            emit Withdrawn(jobId, job.freelancer, amount);
        }
    }
}
