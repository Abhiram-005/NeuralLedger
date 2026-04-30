// scripts/deploy.js
// Run with: npx hardhat run scripts/deploy.js --network localhost

const hre = require("hardhat");
const fs  = require("fs");
const path = require("path");

async function main() {
  console.log("\n🚀 Deploying AIModelMarketplace to local Hardhat network...\n");

  // Get the list of test accounts Hardhat gives us
  const accounts = await hre.ethers.getSigners();
  console.log("📋 Available accounts:");
  accounts.slice(0, 5).forEach((a, i) => {
    console.log(`   Account ${i}: ${a.address}`);
  });

  const deployer = accounts[0];
  console.log(`\n🔑 Deploying from: ${deployer.address}`);

  // Deploy the contract
  const AIMarketplace = await hre.ethers.getContractFactory("AIModelMarketplace");
  const marketplace   = await AIMarketplace.deploy();
  await marketplace.waitForDeployment();

  const contractAddress = await marketplace.getAddress();
  console.log(`\n✅ Contract deployed at: ${contractAddress}`);

  // ── Save the contract address + ABI so React can use it ──
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/AIModelMarketplace.sol/AIModelMarketplace.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Write a config file that your React app will import
  const config = {
    contractAddress,
    abi: artifact.abi,
    network: "localhost",
    chainId: 31337,
    deployedAt: new Date().toISOString(),
    accounts: accounts.slice(0, 5).map((a, i) => ({
      index: i,
      address: a.address,
      role: i === 0 ? "Platform Owner / Admin"
          : i === 1 ? "Test Seller"
          : i === 2 ? "Test Buyer"
          : `Test Account ${i}`
    }))
  };

  // Save to the contracts folder
  fs.writeFileSync(
    path.join(__dirname, "../contract-config.json"),
    JSON.stringify(config, null, 2)
  );

  // Also save to your React src folder if it exists
  const reactSrcPath = path.join(__dirname, "../../src/contract-config.json");
  if (fs.existsSync(path.join(__dirname, "../../src"))) {
    fs.writeFileSync(reactSrcPath, JSON.stringify(config, null, 2));
    console.log(`📁 Config saved to React src/contract-config.json`);
  }

  console.log(`📁 Config saved to contract-config.json`);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ DEPLOYMENT COMPLETE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   Contract : ${contractAddress}`);
  console.log(`   Network  : Hardhat Local (chainId 31337)`);
  console.log(`   Owner    : ${deployer.address}`);
  console.log("\n📌 Next steps:");
  console.log("   1. Add this network to MetaMask:");
  console.log("      RPC URL  : http://127.0.0.1:8545");
  console.log("      Chain ID : 31337");
  console.log("      Currency : ETH");
  console.log("   2. Import a test account into MetaMask using its private key");
  console.log("      (shown when you run: npx hardhat node)");
  console.log("   3. Start your React app: npm start\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
