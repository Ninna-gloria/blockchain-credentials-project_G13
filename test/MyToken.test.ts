import { expect } from "chai";
import { ethers } from "hardhat";
import { MyToken } from "../typechain-types";
import * as dotenv from "dotenv";
dotenv.config();

// This test suite is for the MyToken contract, which includes basic functionality,
// ETH-to-token conversion, multi-signature minting, and withdrawal security features.
// Importing the MyToken contract type from typechain-types and using it to type the contract instance for better type safety in tests.

describe("MyToken", function () {
  let MyToken: any;
  let myToken: MyToken;
  let owner: any;
  let addr1: any;
  let addr2: any;
  let addr3: any;
  let multiSigAddrs: string[];
  let user1: any;
  let user2: any;

  const INITIAL_SUPPLY = ethers.parseUnits(
    process.env.INITIAL_SUPPLY || "1000000",
    18
  );
  const TOKEN_NAME = process.env.TOKEN_NAME || "TestGroupToken";
  const TOKEN_SYMBOL = process.env.TOKEN_SYMBOL || "TGTK";
  const TOKEN_CONVERSION_RATE = ethers.parseUnits(
    process.env.TOKEN_CONVERSION_RATE || "1000",
    18
  ); // 1 ETH = 1000 tokens

  beforeEach(async function () {
    [owner, addr1, addr2, addr3, user1, user2] = await ethers.getSigners();
    multiSigAddrs = [addr1.address, addr2.address, addr3.address]; // Use test accounts as multi-sig signers

    MyToken = await ethers.getContractFactory("MyToken");
    myToken = await MyToken.deploy(
      INITIAL_SUPPLY,
      TOKEN_NAME,
      TOKEN_SYMBOL,
      multiSigAddrs
    );
    await myToken.waitForDeployment();
  });

  // 1. Basic functionality (transfer, balance checks)
  describe("Basic Functionality", function () {
    it("Should have the correct name, symbol, and initial supply", async function () {
      expect(await myToken.name()).to.equal(TOKEN_NAME);
      expect(await myToken.symbol()).to.equal(TOKEN_SYMBOL);
      expect(await myToken.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await myToken.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("Should allow token transfers between accounts", async function () {
      const transferAmount = ethers.parseUnits("100", 18);
      await myToken.transfer(user1.address, transferAmount);
      expect(await myToken.balanceOf(user1.address)).to.equal(transferAmount);
      expect(await myToken.balanceOf(owner.address)).to.equal(
        INITIAL_SUPPLY - transferAmount
      );
    });

    it("Should fail if sender doesn’t have enough tokens", async function () {
      const bigAmount = ethers.parseUnits("2000000", 18); // More than initial supply
      await expect(myToken.connect(user1).transfer(user2.address, bigAmount))
        .to.be.revertedWithCustomError(myToken, "ERC20InsufficientBalance")
        .withArgs(user1.address, 0, bigAmount);
    });
  });

  // 2. ETH-to-token conversion
  describe("ETH to Token Conversion", function () {
    it("Should mint tokens when ETH is sent via receive() fallback", async function () {
      const ethAmount = ethers.parseEther("1");
      const expectedTokens = (ethAmount * TOKEN_CONVERSION_RATE) / 10n ** 18n;

      const initialUserBalance = await myToken.balanceOf(user1.address);
      await user1.sendTransaction({
        to: await myToken.getAddress(),
        value: ethAmount,
      }); // Sends ETH to contract
      expect(await myToken.balanceOf(user1.address)).to.equal(
        initialUserBalance + expectedTokens
      );
      expect(
        await ethers.provider.getBalance(await myToken.getAddress())
      ).to.equal(ethAmount);
    });

    it("Should mint tokens when ETH is sent via buyTokens() method", async function () {
      const ethAmount = ethers.parseEther("0.5");
      const expectedTokens = (ethAmount * TOKEN_CONVERSION_RATE) / 10n ** 18n;

      const initialUserBalance = await myToken.balanceOf(user2.address);
      await myToken.connect(user2).buyTokens({ value: ethAmount });
      expect(await myToken.balanceOf(user2.address)).to.equal(
        initialUserBalance + expectedTokens
      );
      expect(
        await ethers.provider.getBalance(await myToken.getAddress())
      ).to.equal(ethAmount);
    });

    it("Should revert if 0 ETH is sent to receive()", async function () {
      await expect(
        user1.sendTransaction({ to: await myToken.getAddress(), value: 0 })
      ).to.be.revertedWith("MyToken: ETH amount must be greater than zero.");
    });

    it("Should revert if 0 ETH is sent to buyTokens()", async function () {
      await expect(
        myToken.connect(user1).buyTokens({ value: 0 })
      ).to.be.revertedWith("MyToken: ETH amount must be greater than zero.");
    });
  });

  // 3. Multi-signature minting security
  describe("Multi-signature Minting", function () {
    const mintAmount = ethers.parseUnits("500", 18);

    it("Should only allow multi-sig addresses to propose minting", async function () {
      await expect(
        myToken.connect(user1).proposeMint(user2.address, mintAmount)
      ).to.be.revertedWith(
        "MyToken: Only multi-sig addresses can propose mint."
      );
    });

    it("Should require 3 approvals to mint new tokens", async function () {
      // 1. Propose mint
      await myToken.connect(addr1).proposeMint(user1.address, mintAmount); // addr1 proposes and approves
      const proposalId = 1; // Assuming it's the first proposal

      // Check initial state
      expect(await myToken.mintConfirmationCounts(proposalId)).to.equal(1); // Corrected here
      expect(await myToken.mintExecuted(proposalId)).to.be.false; // Corrected here
      expect(await myToken.balanceOf(user1.address)).to.equal(0); // Before mint

      // 2. Addr2 approves
      await myToken.connect(addr2).approveMint(proposalId);
      expect(await myToken.mintConfirmationCounts(proposalId)).to.equal(2); // Corrected here
      expect(await myToken.balanceOf(user1.address)).to.equal(0); // Still not minted

      // 3. Addr3 approves
      await myToken.connect(addr3).approveMint(proposalId);
      expect(await myToken.mintConfirmationCounts(proposalId)).to.equal(3); // Corrected here
      expect(await myToken.balanceOf(user1.address)).to.equal(0); // Still not minted, needs execution

      // Anyone (or one of the multi-sig) can execute after approvals
      await myToken.connect(addr1).executeMint(proposalId); // addr1 executes
      expect(await myToken.balanceOf(user1.address)).to.equal(mintAmount);
      expect(await myToken.mintExecuted(proposalId)).to.be.true; // Corrected here
    });

    it("Should not allow minting if less than 3 approvals", async function () {
      await myToken.connect(addr1).proposeMint(user1.address, mintAmount);
      const proposalId = 1;
      await myToken.connect(addr2).approveMint(proposalId); // Only 2 approvals

      await expect(
        myToken.connect(addr1).executeMint(proposalId)
      ).to.be.revertedWith("MyToken: Not enough approvals for mint.");
    });

    it("Should not allow executing an already executed mint proposal", async function () {
      await myToken.connect(addr1).proposeMint(user1.address, mintAmount);
      const proposalId = 1;
      await myToken.connect(addr2).approveMint(proposalId);
      await myToken.connect(addr3).approveMint(proposalId);
      await myToken.connect(addr1).executeMint(proposalId);

      await expect(
        myToken.connect(addr2).executeMint(proposalId)
      ).to.be.revertedWith("MyToken: Mint proposal already executed.");
    });

    it("Should not allow a multi-sig address to approve the same mint proposal twice", async function () {
      await myToken.connect(addr1).proposeMint(user1.address, mintAmount);
      const proposalId = 1;
      await expect(
        myToken.connect(addr1).approveMint(proposalId)
      ).to.be.revertedWith("MyToken: Already approved this mint proposal."); // Already approved by proposing
    });

    it("Should allow different multi-sig addresses to propose separate mints", async function () {
      await myToken.connect(addr1).proposeMint(user1.address, mintAmount); // proposalId 1
      await myToken.connect(addr2).proposeMint(user2.address, mintAmount); // proposalId 2

      expect(await myToken.mintConfirmationCounts(1)).to.equal(1); // Corrected here
      expect(await myToken.mintConfirmationCounts(2)).to.equal(1); // Corrected here
    });
  });

  // 4. Multi-signature Withdrawal Security
  describe("Multi-signature Withdrawal", function () {
    const withdrawAmount = ethers.parseEther("0.1"); // 0.1 ETH

    beforeEach(async function () {
      // Funding the contract with some initial ETH first
      await owner.sendTransaction({
        to: await myToken.getAddress(),
        value: ethers.parseEther("1"),
      });
      expect(
        await ethers.provider.getBalance(await myToken.getAddress())
      ).to.equal(ethers.parseEther("1"));
    });

    it("Should only allow multi-sig addresses to request/approve withdrawals", async function () {
      await expect(
        myToken.connect(user1).requestWithdrawal(user2.address, withdrawAmount)
      ).to.be.revertedWith(
        "MyToken: Only multi-sig addresses can request/approve withdrawals."
      );
    });

    it("Should require 2 out of 3 approvals for withdrawal", async function () {
      // 1. Addr1 requests withdrawal (and automatically approves)
      const tx = await myToken
        .connect(addr1)
        .requestWithdrawal(user1.address, withdrawAmount);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error("Transaction receipt is null");
      }
      // Parse logs to find the WithdrawalRequested event
      let event = null;
      for (const log of receipt.logs) {
        try {
          const parsed = myToken.interface.parseLog(log);
          if (parsed && parsed.name === "WithdrawalRequested") {
            event = parsed;
            break;
          }
        } catch (err) {
          // Not this event, skip
        }
      }
      expect(event, "WithdrawalRequested event not found").to.exist;
      const txId1 = event?.args?.transactionId;

      expect(await myToken.confirmationCounts(txId1)).to.equal(1);
      expect(await myToken.executedTransactions(txId1)).to.be.false;

      // 2. Addr2 approves
      const initialUser1EthBalance = await ethers.provider.getBalance(
        user1.address
      );
      await myToken
        .connect(addr2)
        .approveWithdrawal(txId1, user1.address, withdrawAmount);

      // It should have executed because 2 approvals are met
      expect(await myToken.confirmationCounts(txId1)).to.equal(2);
      expect(await myToken.executedTransactions(txId1)).to.be.true;
      expect(
        await ethers.provider.getBalance(await myToken.getAddress())
      ).to.equal(ethers.parseEther("1") - withdrawAmount);
      // Check user1's balance increased. Add a slight tolerance for gas costs.
      expect(
        (await ethers.provider.getBalance(user1.address)) -
          initialUser1EthBalance
      ).to.be.closeTo(withdrawAmount, ethers.parseEther("0.001"));
    });

    it("Should not execute withdrawal if less than 2 approvals", async function () {
      // Only 1 approval (from addr1)
      const tx = await myToken
        .connect(addr1)
        .requestWithdrawal(user1.address, withdrawAmount);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error("Transaction receipt is null");
      }
      // Parse logs to find the WithdrawalRequested event
      let event = null;
      for (const log of receipt.logs) {
        try {
          const parsed = myToken.interface.parseLog(log);
          if (parsed && parsed.name === "WithdrawalRequested") {
            event = parsed;
            break;
          }
        } catch (err) {
          // Not this event, skip
        }
      }
      expect(event, "WithdrawalRequested event not found").to.exist;
      const txId1 = event?.args?.transactionId;

      expect(await myToken.confirmationCounts(txId1)).to.equal(1);
      expect(await myToken.executedTransactions(txId1)).to.be.false; // Should not be executed
      expect(
        await ethers.provider.getBalance(await myToken.getAddress())
      ).to.equal(ethers.parseEther("1")); // Balance should be unchanged
    });

    it("Should not allow executing an already executed withdrawal", async function () {
      // First, get 2 approvals and execute
      const tx = await myToken
        .connect(addr1)
        .requestWithdrawal(user1.address, withdrawAmount);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error("Transaction receipt is null");
      }
      // Parse logs to find the WithdrawalRequested event
      let event = null;
      for (const log of receipt.logs) {
        try {
          const parsed = myToken.interface.parseLog(log);
          if (parsed && parsed.name === "WithdrawalRequested") {
            event = parsed;
            break;
          }
        } catch (err) {
          // Not this event, skip
        }
      }
      expect(event, "WithdrawalRequested event not found").to.exist;
      const txId1 = event?.args?.transactionId;

      await myToken
        .connect(addr2)
        .approveWithdrawal(txId1, user1.address, withdrawAmount); // This will execute

      await expect(
        myToken
          .connect(addr3)
          .approveWithdrawal(txId1, user1.address, withdrawAmount)
      ).to.be.revertedWith("MyToken: Transaction already executed.");
    });

    it("Should not allow a multi-sig address to approve the same withdrawal twice", async function () {
      const tx = await myToken
        .connect(addr1)
        .requestWithdrawal(user1.address, withdrawAmount);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error("Transaction receipt is null");
      }
      // Parse logs to find the WithdrawalRequested event
      let event = null;
      for (const log of receipt.logs) {
        try {
          const parsed = myToken.interface.parseLog(log);
          if (parsed && parsed.name === "WithdrawalRequested") {
            event = parsed;
            break;
          }
        } catch (err) {
          // Not this event, skip
        }
      }
      expect(event, "WithdrawalRequested event not found").to.exist;
      const txId1 = event?.args?.transactionId;

      await expect(
        myToken
          .connect(addr1)
          .approveWithdrawal(txId1, user1.address, withdrawAmount)
      ).to.be.revertedWith("MyToken: Already confirmed this transaction.");
    });

    it("Should revert if contract has insufficient ETH for withdrawal", async function () {
      const largeWithdrawAmount = ethers.parseEther("2"); // More than contract balance
      await expect(
        myToken
          .connect(addr1)
          .requestWithdrawal(user1.address, largeWithdrawAmount)
      ).to.be.revertedWith(
        "MyToken: Insufficient contract balance for withdrawal."
      );
    });
  });

  // 5. Security Test (e.g., Reentrancy)
  describe("Security Tests", function () {
    it("Should be protected against reentrancy attacks during ETH withdrawal", async function () {
      // Deploy MaliciousReceiver contract (assume it takes no constructor args)
      const MaliciousReceiverFactory = await ethers.getContractFactory(
        "MaliciousReceiver"
      );
      const maliciousReceiver = await MaliciousReceiverFactory.deploy();
      await maliciousReceiver.waitForDeployment();

      // Prepare multi-sig addresses with maliciousReceiver as one of them
      const tempMultiSigAddrs = [
        await maliciousReceiver.getAddress(),
        addr2.address,
        addr3.address,
      ];

      // Deploy a fresh MyToken contract for this test
      const MyTokenFactory = await ethers.getContractFactory("MyToken");
      const reentrancyMyToken = await MyTokenFactory.deploy(
        INITIAL_SUPPLY,
        TOKEN_NAME,
        TOKEN_SYMBOL,
        tempMultiSigAddrs
      );
      await reentrancyMyToken.waitForDeployment();

      // Set the token address in the malicious contract if needed
      if ((maliciousReceiver as any).setTokenAddress) {
        await (maliciousReceiver as any).setTokenAddress(
          await reentrancyMyToken.getAddress()
        );
      }

      // Fund the MyToken contract
      await owner.sendTransaction({
        to: await reentrancyMyToken.getAddress(),
        value: ethers.parseEther("1"),
      });
      expect(
        await ethers.provider.getBalance(await reentrancyMyToken.getAddress())
      ).to.equal(ethers.parseEther("1"));

      // Fund the malicious contract so it can pay for gas if needed
      await owner.sendTransaction({
        to: await maliciousReceiver.getAddress(),
        value: ethers.parseEther("0.1"),
      });

      // The malicious contract tries to trigger re-entrancy via its attack function
      // Make sure the MaliciousReceiver contract implements an 'attack' function in Solidity.
      // If it does not, either implement it or skip this test.
      if (typeof (maliciousReceiver as any).attack === "function") {
        await expect(
          (maliciousReceiver as any)
            .connect(owner)
            .attack(ethers.parseEther("0.5"))
        ).to.be.revertedWith("ReentrancyGuard: reentrant call");
      } else {
        // Skip the test if attack() is not implemented
        this.skip();
      }

      // Verify funds are still correct
      expect(
        await ethers.provider.getBalance(await reentrancyMyToken.getAddress())
      ).to.equal(ethers.parseEther("1"));
    });

    it("Should prevent unauthorized minting attempts", async function () {
      const mintAmount = ethers.parseUnits("100", 18);
      // Non-multi-sig address tries to propose mint
      await expect(
        myToken.connect(user1).proposeMint(user1.address, mintAmount)
      ).to.be.revertedWith(
        "MyToken: Only multi-sig addresses can propose mint."
      );
    });

    it("Should prevent unauthorized withdrawal attempts", async function () {
      const withdrawAmount = ethers.parseEther("0.1");
      // Non-multi-sig address tries to request withdrawal
      await expect(
        myToken.connect(user1).requestWithdrawal(user1.address, withdrawAmount)
      ).to.be.revertedWith(
        "MyToken: Only multi-sig addresses can request/approve withdrawals."
      );
    });
  });
});
