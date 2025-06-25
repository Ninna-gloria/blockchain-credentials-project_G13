import { ethers, run as hreRun } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  // Gets the deployer's signer
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const TOKEN_NAME = "Group13Token";
  const TOKEN_SYMBOL = "G13TK";
  const INITIAL_SUPPLY = ethers.parseUnits("1000000", 18); // Example: 1,000,000 tokens

  // Define the 3 multi-signature addresses
  //Group members testnet addresses.
  const multiSigAddresses = [
    process.env.MULTISIG1!,
    process.env.MULTISIG2!,
    process.env.MULTISIG3!,
  ].map((address) => address.toLowerCase());
  // For local testing, you can use `ethers.getSigners()` to get test accounts.

  // Gets the ContractFactory for MyToken
  const MyToken = await ethers.getContractFactory("MyToken");

  // Deploys the contract
  const myToken = await MyToken.deploy(
    INITIAL_SUPPLY,
    TOKEN_NAME,
    TOKEN_SYMBOL,
    multiSigAddresses
  );

  await myToken.waitForDeployment(); // Wait for the contract to be deployed

  const contractAddress = await myToken.getAddress();
  console.log(`MyToken deployed to: ${contractAddress}`);

  //might need to wait a few seconds for Etherscan to index the deployment transaction.
  console.log("Waiting for 30 seconds before verifying...");
  await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait for 30 seconds

  try {
    console.log("Verifying contract on Etherscan...");
    await hreRun("verify:verify", {
      address: contractAddress,
      constructorArguments: [
        INITIAL_SUPPLY,
        TOKEN_NAME,
        TOKEN_SYMBOL,
        multiSigAddresses,
      ],
    });
    console.log("Contract verified successfully on Etherscan!");
    console.log(
      `Etherscan link: https://sepolia.etherscan.io/address/${contractAddress}#code`
    );
  } catch (error: any) {
    if (error.message.includes("Reason: Already Verified")) {
      console.log("Contract is already verified!");
    } else {
      console.error("Error verifying contract:", error);
    }
  }
}

// Recommended pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
