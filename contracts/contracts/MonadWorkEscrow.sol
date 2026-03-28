// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MonadWorkEscrow
 * @notice Streaming payment escrow for MonadWork freelancer platform.
 *         Employer deposits MON, freelancer earns per second they work.
 *         AI arbitrator can resolve disputes.
 * @dev Optimized for Monad's fast block times and low fees.
 */
contract MonadWorkEscrow {
    enum JobStatus {
        Created,
        Active,
        Paused,
        Completed,
        Disputed,
        Resolved,
        Cancelled
    }

    struct Job {
        address employer;
        address freelancer;
        uint256 ratePerSecond;
        uint256 totalDeposit;
        uint256 streamStartTime;
        uint256 accumulatedEarned;
        uint256 totalWithdrawn;
        JobStatus status;
        string description;
        bool streamActive;
    }

    mapping(uint256 => Job) public jobs;
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

        emit StreamStarted(jobId, block.timestamp);
    }

    function pauseStream(uint256 jobId)
        external
        onlyFreelancer(jobId)
        inStatus(jobId, JobStatus.Active)
    {
        Job storage job = jobs[jobId];
        require(job.streamActive, "MonadWork: stream not active");

        uint256 elapsed = block.timestamp - job.streamStartTime;
        uint256 newlyEarned = elapsed * job.ratePerSecond;
        job.accumulatedEarned += newlyEarned;

        if (job.accumulatedEarned > job.totalDeposit) {
            job.accumulatedEarned = job.totalDeposit;
        }

        job.streamActive = false;
        job.streamStartTime = 0;
        job.status = JobStatus.Paused;

        emit StreamPaused(jobId, job.accumulatedEarned);
    }

    function resumeStream(uint256 jobId)
        external
        onlyFreelancer(jobId)
        inStatus(jobId, JobStatus.Paused)
    {
        Job storage job = jobs[jobId];
        require(!job.streamActive, "MonadWork: stream already active");
        require(getEarnedAmount(jobId) < job.totalDeposit, "MonadWork: escrow exhausted");

        job.streamStartTime = block.timestamp;
        job.streamActive = true;
        job.status = JobStatus.Active;

        emit StreamResumed(jobId, block.timestamp);
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

    function approve(uint256 jobId) external onlyEmployer(jobId) {
        Job storage job = jobs[jobId];
        require(
            job.status == JobStatus.Active || job.status == JobStatus.Paused,
            "MonadWork: cannot approve in current status"
        );

        if (job.streamActive) {
            uint256 elapsed = block.timestamp - job.streamStartTime;
            job.accumulatedEarned += elapsed * job.ratePerSecond;
            if (job.accumulatedEarned > job.totalDeposit) {
                job.accumulatedEarned = job.totalDeposit;
            }
            job.streamActive = false;
            job.streamStartTime = 0;
        }

        job.status = JobStatus.Completed;

        uint256 freelancerPayout = job.accumulatedEarned - job.totalWithdrawn;
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

        (bool success, ) = payable(job.employer).call{value: refund}("");
        require(success, "MonadWork: refund failed");

        emit JobCancelled(jobId, refund);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    function setArbitrator(address _arbitrator) external {
        require(msg.sender == owner, "MonadWork: not owner");
        require(_arbitrator != address(0), "MonadWork: invalid arbitrator");
        arbitrator = _arbitrator;
    }

    receive() external payable {}
}
