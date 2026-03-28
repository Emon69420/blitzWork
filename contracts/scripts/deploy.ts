import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MON");

  console.log("\n1. Deploying CredentialRegistry...");
  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const registry = await CredentialRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("   CredentialRegistry deployed to:", registryAddress);

  console.log("2. Deploying MonadWorkEscrow...");
  const MonadWorkEscrow = await ethers.getContractFactory("MonadWorkEscrow");
  const escrow = await MonadWorkEscrow.deploy(deployer.address);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("   MonadWorkEscrow deployed to:", escrowAddress);

  const demoFreelancer = process.env.DEMO_FREELANCER;
  if (demoFreelancer) {
    console.log("3. Seeding demo credentials...");
    const tx1 = await registry.issueCredential(
      demoFreelancer,
      "Solidity Developer",
      "Built and shipped Solidity smart contracts for production-grade dApps.",
      "MonadWork Demo Issuer"
    );
    await tx1.wait();
    console.log("   Credential 1 issued: Solidity Developer");

    const tx2 = await registry.issueCredential(
      demoFreelancer,
      "React Expert",
      "Demonstrated advanced frontend implementation skills using React and Next.js.",
      "MonadWork Demo Issuer"
    );
    await tx2.wait();
    console.log("   Credential 2 issued: React Expert");

    const tx3 = await registry.issueCredential(
      demoFreelancer,
      "ETHGlobal Finalist",
      "Recognized for shipping a high-quality hackathon project under time pressure.",
      "MonadWork Demo Issuer"
    );
    await tx3.wait();
    console.log("   Credential 3 issued: ETHGlobal Finalist");
  }

  console.log("\n===========================================");
  console.log("DEPLOYMENT COMPLETE - Copy these to .env:");
  console.log("===========================================");
  console.log(`NEXT_PUBLIC_ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`NEXT_PUBLIC_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
  console.log(`REGISTRY_CONTRACT_ADDRESS=${registryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
