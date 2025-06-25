import { ethers } from "hardhat";
import hre from "hardhat";

/**
 * Script to deploy the UBaEducationCredentialsStore contract.
 * - Reads the ERC20 token address and credential fee from environment variables for flexibility and security.
 * - Validates all critical inputs before deployment.
 * - Waits for deployment confirmation and then verifies the contract on Etherscan.
 * - Never exposes or hardcodes sensitive information.
 */
async function main() {
  // Retrieve the deployer account from Hardhat's signers.
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying UBaEducationCredentialsStore with the account:",
    deployer.address
  );

  // Require the ERC20 token contract address from environment variables.
  const MY_TOKEN_CONTRACT_ADDRESS = process.env.MY_TOKEN_CONTRACT_ADDRESS;
  if (
    !MY_TOKEN_CONTRACT_ADDRESS ||
    !ethers.isAddress(MY_TOKEN_CONTRACT_ADDRESS)
  ) {
    throw new Error(
      "MY_TOKEN_CONTRACT_ADDRESS is missing or invalid! Set it in your environment variables."
    );
  }

  // Require the initial credential fee from environment variables.
  const INITIAL_CREDENTIAL_FEE_STRING = process.env.INITIAL_CREDENTIAL_FEE;
  if (!INITIAL_CREDENTIAL_FEE_STRING) {
    throw new Error(
      "INITIAL_CREDENTIAL_FEE is missing! Set it in your environment variables."
    );
  }
  const INITIAL_CREDENTIAL_FEE = ethers.parseUnits(
    INITIAL_CREDENTIAL_FEE_STRING,
    18
  );

  console.log(
    "Deploying with:",
    MY_TOKEN_CONTRACT_ADDRESS,
    INITIAL_CREDENTIAL_FEE.toString()
  );

  // Get the contract factory for UBaEducationCredentialsStore.
  const UBaEducationCredentialsStore = await ethers.getContractFactory(
    "UBaEducationCredentialsStore"
  );

  // Deploy the contract with the token address and initial fee as constructor arguments.
  const credentialsStore = await UBaEducationCredentialsStore.deploy(
    MY_TOKEN_CONTRACT_ADDRESS,
    INITIAL_CREDENTIAL_FEE
  );

  // Wait for the deployment transaction to be mined.
  await credentialsStore.waitForDeployment();

  // Retrieve and log the deployed contract address.
  const contractAddress = await credentialsStore.getAddress();
  console.log(`UBaEducationCredentialsStore deployed to: ${contractAddress}`);

  // Wait for a short period to ensure the contract is indexed before verification.
  console.log("Waiting for 30 seconds before verifying...");
  await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait for 30 seconds

  // Attempt to verify the contract on Etherscan using Hardhat's verify task.
  try {
    console.log(
      "Verifying UBaEducationCredentialsStore contract on Etherscan..."
    );
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [MY_TOKEN_CONTRACT_ADDRESS, INITIAL_CREDENTIAL_FEE],
    });
    console.log(
      "UBaEducationCredentialsStore contract verified successfully on Etherscan!"
    );
    console.log(
      `Etherscan link: https://sepolia.etherscan.io/address/${contractAddress}#code`
    );
  } catch (error: any) {
    if (error.message.includes("Reason: Already Verified")) {
      console.log("UBaEducationCredentialsStore contract is already verified!");
    } else {
      console.error(
        "Error verifying UBaEducationCredentialsStore contract:",
        error
      );
    }
  }
}

// Execute the deployment script and handle any uncaught errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
