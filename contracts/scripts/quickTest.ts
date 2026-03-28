import { ethers } from "hardhat";

async function main() {
  const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS;
  if (!escrowAddress) {
    throw new Error("ESCROW_CONTRACT_ADDRESS is required in the environment");
  }

  const signers = await ethers.getSigners();
  if (signers.length < 2) {
    throw new Error("quickTest requires at least two funded signers");
  }

  const [deployer, freelancer] = signers;
  const escrow = await ethers.getContractAt("MonadWorkEscrow", escrowAddress);

  const tx = await escrow.createJob(
    freelancer.address,
    ethers.parseEther("0.001"),
    "Test job from quickTest",
    { value: ethers.parseEther("1") }
  );
  await tx.wait();

  console.log("Job created by:", deployer.address);
  console.log("Freelancer:", freelancer.address);
  console.log("Job created! Job ID: 0");

  const job = await escrow.getJob(0);
  console.log("Status:", job.status.toString());
  console.log("Deposit:", ethers.formatEther(job.totalDeposit), "MON");
  console.log("Rate/sec:", ethers.formatEther(job.ratePerSecond), "MON");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
