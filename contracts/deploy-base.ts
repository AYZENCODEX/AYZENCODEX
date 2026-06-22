/**
 * AZN Token Deployment Script — Base Network
 *
 * Usage:
 *   1. Install: npm install --save-dev hardhat @nomicfoundation/hardhat-ethers ethers @openzeppelin/contracts
 *   2. Set env vars: PRIVATE_KEY, BASE_RPC_URL (or use default), BASESCAN_API_KEY
 *   3. Run: npx hardhat run contracts/deploy-base.ts --network base
 *
 * Network: Base Mainnet (Chain ID: 8453)
 * RPC: https://mainnet.base.org
 */

import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AZN Token with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // ── Allocation addresses ── configure these before deploying ──
  const TREASURY = process.env.TREASURY_ADDRESS ?? deployer.address;
  const TEAM     = process.env.TEAM_ADDRESS     ?? deployer.address;
  const LIQUIDITY = process.env.LIQUIDITY_ADDRESS ?? deployer.address;
  const ECOSYSTEM = process.env.ECOSYSTEM_ADDRESS ?? deployer.address;

  console.log("\nAllocation addresses:");
  console.log("  Treasury :", TREASURY);
  console.log("  Team     :", TEAM);
  console.log("  Liquidity:", LIQUIDITY);
  console.log("  Ecosystem:", ECOSYSTEM);

  const AZNToken = await ethers.getContractFactory("AZNToken");
  console.log("\nDeploying AZNToken...");

  const token = await AZNToken.deploy(TREASURY, TEAM, LIQUIDITY, ECOSYSTEM);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("\n✅ AZN Token deployed to:", address);
  console.log("   Network: Base (8453)");
  console.log("   Name   : AYZEN Token");
  console.log("   Symbol : AZN");
  console.log("   Supply : 1,000,000,000 AZN");
  console.log("\n🔗 View on BaseScan: https://basescan.org/address/" + address);
  console.log("\nNext steps:");
  console.log("  1. Verify: npx hardhat verify --network base", address, TREASURY, TEAM, LIQUIDITY, ECOSYSTEM);
  console.log("  2. Enable trading: call enableTrading() from owner");
  console.log("  3. Add liquidity on Uniswap V3 on Base");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
