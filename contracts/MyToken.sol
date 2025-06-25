// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol"; // Imports the standard ERC20 contract
import "@openzeppelin/contracts/access/Ownable.sol"; // Imports Ownable for owner-specific functions
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // Guards against reentrancy attacks

/*
 @title MyToken
 @dev An ERC20 token with custom functionalities including:
 - ETH to token conversion (automatic and via buy method)
 - Multi-signature control for minting new tokens
 - Multi-signature control for withdrawing ETH from the contract
 */
contract MyToken is ERC20, Ownable, ReentrancyGuard {

    string private _name;
    string private _symbol;

    // Conversion rate: 1 ETH = TOKEN_CONVERSION_RATE tokens
    // Example: 1 ETH = 1000 tokens. Adjust as needed.
    uint256 public constant TOKEN_CONVERSION_RATE = 1000 * (10 ** 18); // Example: 1 ETH = 1000 tokens (with 18 decimals)

    // Multi-signature addresses for minting and withdrawal 
    address[] public multiSigAddresses;
    uint256 public constant MIN_MINT_SIGNATURES = 3; // Requires 3 out of 3 signatures for minting 
    uint256 public constant MIN_WITHDRAW_SIGNATURES = 2; // Requires 2 out of 3 signatures for withdrawal 

    // Mapping to track confirmations for withdrawal
    mapping(bytes32 => mapping(address => bool)) public confirmations;
    mapping(bytes32 => uint256) public confirmationCounts;
    mapping(bytes32 => bool) public executedTransactions;

    // Add a nonce for uniqueness
    uint256 public withdrawalNonce;

    // Events
    event TokensReceivedViaEth(address indexed user, uint256 ethAmount, uint256 tokenAmount); 
    event TokensBought(address indexed user, uint256 ethAmount, uint256 tokenAmount);
    event MintRequested(address indexed minter, uint256 amount);
    event MintApproved(address indexed approver, uint256 amount);
    event TokensMinted(address indexed to, uint256 amount, address indexed initiator);
    event WithdrawalRequested(bytes32 indexed transactionId, address indexed receiver, uint256 amount);
    event WithdrawalApproved(bytes32 indexed transactionId, address indexed approver);
    event FundsWithdrawn(bytes32 indexed transactionId, address indexed receiver, uint256 amount);


    /*
      @dev Constructor to initialize the ERC20 token and multi-signature addresses.
      @param initialSupply Initial supply of tokens to mint and assign to the deployer.
      @param tokenName The unique name of your token (e.g., "Group 1 Token").
      @param tokenSymbol The unique symbol of your token (e.g., "GITK").
      @param _multiSigAddrs An array of 3 addresses that will control multi-signature operations. 
     */
    constructor(
        uint256 initialSupply,
        string memory tokenName,
        string memory tokenSymbol,
        address[] memory _multiSigAddrs
    ) ERC20(tokenName, tokenSymbol) Ownable(msg.sender) {
        require(_multiSigAddrs.length == 3, "MyToken: Must provide exactly 3 multi-sig addresses."); 
        multiSigAddresses = _multiSigAddrs;

        _mint(msg.sender, initialSupply); // Mint initial supply to the deployer
    }

    /*
      @dev Fallback function to allow users to receive tokens by sending ETH to the contract. 
      Automatically converts received ETH to tokens at a predefined rate.
      Guards against reentrancy attacks.
     */
    receive() external payable nonReentrant {
        require(msg.value > 0, "MyToken: ETH amount must be greater than zero."); //  Proper error handling
        uint256 tokensToMint = (msg.value * TOKEN_CONVERSION_RATE) / (10 ** 18); // Convert ETH to tokens
        _mint(msg.sender, tokensToMint);
        emit TokensReceivedViaEth(msg.sender, msg.value, tokensToMint);
    }

    /*
      @dev Allows users to buy tokens by explicitly calling this method, sending ETH. 
      Guards against reentrancy attacks.
     */
    function buyTokens() external payable nonReentrant {
        require(msg.value > 0, "MyToken: ETH amount must be greater than zero."); //  Proper error handling
        uint256 tokensToMint = (msg.value * TOKEN_CONVERSION_RATE) / (10 ** 18); // Convert ETH to tokens
        _mint(msg.sender, tokensToMint);
        emit TokensBought(msg.sender, msg.value, tokensToMint);
    }

    /*
     @dev Internal helper to check if an address is one of the multi-sig addresses.
     */
    function _isMultiSigAddress(address _addr) internal view returns (bool) {
        for (uint i = 0; i < multiSigAddresses.length; i++) {
            if (multiSigAddresses[i] == _addr) {
                return true;
            }
        }
        return false;
    }

    /*
     @dev Initiates or approves a minting operation. 
     Requires approval from 3 specified addresses to mint new tokens.
     implementing a simplified multi-sig for minting that relies on 3 separate calls.
     */
    mapping(uint256 => mapping(address => bool)) private mintApprovals;
    mapping(uint256 => uint256) public mintConfirmationCounts;
    mapping(uint256 => bool) public mintExecuted;
    uint256 private nextMintProposalId = 1;

    struct MintProposal {
        address to;
        uint256 amount;
        bool exists;
    }
    mapping(uint256 => MintProposal) private mintProposals;

    /*
      @dev Proposes a new minting operation. Callable by any multi-sig address.
      @param _to The address to mint tokens to.
      @param _amount The amount of tokens to mint.
     */
    function proposeMint(address _to, uint256 _amount) public {
        require(_isMultiSigAddress(msg.sender), "MyToken: Only multi-sig addresses can propose mint.");
        require(_amount > 0, "MyToken: Mint amount must be greater than zero.");

        uint256 proposalId = nextMintProposalId++;
        mintProposals[proposalId] = MintProposal(_to, _amount, true);
        mintApprovals[proposalId][msg.sender] = true;
        mintConfirmationCounts[proposalId]++;

        emit MintRequested(msg.sender, _amount);
    }

    /*
      @dev Approves an existing minting proposal. Callable by any multi-sig address.
      @param proposalId The ID of the minting proposal to approve.
     */
    function approveMint(uint256 proposalId) public {
        require(_isMultiSigAddress(msg.sender), "MyToken: Only multi-sig addresses can approve mint.");
        MintProposal storage proposal = mintProposals[proposalId];
        require(proposal.exists, "MyToken: Proposal does not exist.");
        require(!mintExecuted[proposalId], "MyToken: Mint proposal already executed.");
        require(!mintApprovals[proposalId][msg.sender], "MyToken: Already approved this mint proposal.");

        mintApprovals[proposalId][msg.sender] = true;
        mintConfirmationCounts[proposalId]++;

        emit MintApproved(msg.sender, proposal.amount);
    }

    /*
      @dev Executes a minting proposal once enough approvals are gathered. Callable by any multi-sig address.
      @param proposalId The ID of the minting proposal to execute.
     */
    function executeMint(uint256 proposalId) public {
        require(_isMultiSigAddress(msg.sender), "MyToken: Only multi-sig addresses can execute mint.");
        MintProposal storage proposal = mintProposals[proposalId];
        require(proposal.exists, "MyToken: Proposal does not exist.");
        require(!mintExecuted[proposalId], "MyToken: Mint proposal already executed.");
        require(mintConfirmationCounts[proposalId] >= MIN_MINT_SIGNATURES, "MyToken: Not enough approvals for mint."); // 

        mintExecuted[proposalId] = true;
        _mint(proposal.to, proposal.amount);
        emit TokensMinted(proposal.to, proposal.amount, msg.sender);
    }

    /*
      @dev Initiates or approves a withdrawal of ETH from the contract. 
      Requires approval from 2 out of 3 specified addresses. 
      Guards against reentrancy attacks during withdrawal.
      @param _receiver The address to send ETH to.
      @param _amount The amount of ETH to withdraw (in wei).
     @return bytes32 The unique transaction ID for this withdrawal request.
     */
    function requestWithdrawal(address _receiver, uint256 _amount)
        public
        nonReentrant
        returns (bytes32 transactionId)
    {
        require(_isMultiSigAddress(msg.sender), "MyToken: Only multi-sig addresses can request/approve withdrawals.");
        require(_amount > 0, "MyToken: Withdrawal amount must be greater than zero.");
        require(address(this).balance >= _amount, "MyToken: Insufficient contract balance for withdrawal."); // 

        // Generates a unique transaction ID based on parameters to prevent replay attacks and ensure uniqueness
        transactionId = keccak256(abi.encodePacked(_receiver, _amount, withdrawalNonce));
        withdrawalNonce++;

        require(!executedTransactions[transactionId], "MyToken: Transaction already executed.");
        require(!confirmations[transactionId][msg.sender], "MyToken: Already confirmed this transaction.");

        confirmations[transactionId][msg.sender] = true;
        confirmationCounts[transactionId]++;

        emit WithdrawalRequested(transactionId, _receiver, _amount);

        // If enough confirmations are met immediately, execute. Otherwise, wait for more approvals.
        if (confirmationCounts[transactionId] >= MIN_WITHDRAW_SIGNATURES) {
            executeWithdrawal(transactionId, _receiver, _amount);
        }
        return transactionId;
    }
    /*
     @dev Executes a withdrawal request once enough approvals are gathered.
     This function is internal or only callable by another function that checks approvals.
     @param transactionId The ID of the withdrawal request.
     @param _receiver The address to send ETH to.
     @param _amount The amount of ETH to withdraw (in wei).
     */
    function executeWithdrawal(bytes32 transactionId, address _receiver, uint256 _amount) internal {
        require(!executedTransactions[transactionId], "MyToken: Transaction already executed.");
        require(confirmationCounts[transactionId] >= MIN_WITHDRAW_SIGNATURES, "MyToken: Not enough approvals for withdrawal."); // 
        require(address(this).balance >= _amount, "MyToken: Insufficient contract balance for withdrawal execution."); // 

        executedTransactions[transactionId] = true; // Mark as executed
        (bool success, ) = payable(_receiver).call{value: _amount}("");
        require(success, "MyToken: ETH transfer failed."); // 

        emit FundsWithdrawn(transactionId, _receiver, _amount);
    }
    function approveWithdrawal(bytes32 transactionId, address _receiver, uint256 _amount)
        public
        nonReentrant
    {
        require(_isMultiSigAddress(msg.sender), "MyToken: Only multi-sig addresses can approve withdrawals.");
        require(!executedTransactions[transactionId], "MyToken: Transaction already executed.");
        
        // bytes32 expectedTxId = keccak256(abi.encodePacked(_receiver, _amount, block.timestamp - 1, msg.sender));

        require(!confirmations[transactionId][msg.sender], "MyToken: Already confirmed this transaction."); // Keep this one
        confirmations[transactionId][msg.sender] = true;
        confirmationCounts[transactionId]++;

        emit WithdrawalApproved(transactionId, msg.sender);

        if (confirmationCounts[transactionId] >= MIN_WITHDRAW_SIGNATURES) {
            executeWithdrawal(transactionId, _receiver, _amount);
        }
    }

    // Fallback to prevent accidental ETH transfers without triggering token minting
    fallback() external payable {
        revert("MyToken: Direct ETH transfers without calling functions are not allowed, use receive() or buyTokens().");
    }
}