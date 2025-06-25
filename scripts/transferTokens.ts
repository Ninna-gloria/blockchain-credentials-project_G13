import { ethers } from "hardhat";

async function main() {
  const tokenAddress = "0x0FCebfeB4cbFaD5b7e3C526eca48937C52e5aacf"; // Your deployed token contract address
  const recipientAddress = "0x0874207411f712D90edd8ded353fdc6f9a417903";
  const amountToTransfer = ethers.parseUnits("10", 18);

  const [deployer] = await ethers.getSigners();
  console.log("tokenAddress:", tokenAddress);
  console.log("recipientAddress:", recipientAddress);
  console.log(`Transferring tokens from: ${deployer.address}`);

  // Import the ABI of your token contract
  const tokenAbi = [
    "function transfer(address to, uint256 amount) public returns (bool)",
  ];
  const myToken = new ethers.Contract(tokenAddress, tokenAbi, deployer);

  console.log(
    `Attempting to transfer ${ethers.formatUnits(
      amountToTransfer,
      18
    )} tokens to ${recipientAddress}...`
  );
  const tx = await myToken.transfer(recipientAddress, amountToTransfer);
  await tx.wait();

  console.log(`Token transfer successful!`);
  console.log(`Transaction Hash: ${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
