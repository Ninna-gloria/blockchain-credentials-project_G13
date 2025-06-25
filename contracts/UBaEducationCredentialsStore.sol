// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title UBaEducationCredentialsStore
 * @dev This contract allows users to store and verify education credential hashes on-chain.
 * Users must pay a fee in a specified ERC20 token to store a credential.
 * The contract owner can update the credential fee and withdraw collected funds.
 */
contract UBaEducationCredentialsStore is Ownable {
    // Emitted when a credential hash is stored
    event CredentialHashStored(bytes32 indexed credentialHash, address indexed user);
    // Emitted when a credential is verified
    event CredentialVerified(bytes32 indexed credentialHash, address indexed verifier, uint256 feePaid);
    // Emitted when the credential fee is updated
    event CredentialFeeUpdated(uint256 oldFee, uint256 newFee);
    // Emitted when funds are withdrawn by the owner
    event FundsWithdrawn(address indexed to, uint256 amount);

    IERC20 public myToken; // ERC20 token used for payments
    uint256 public credentialFee; // Fee required to store a credential
    mapping(bytes32 => bool) public credentialExists; // Tracks stored credential hashes

    /**
     * @dev Initializes the contract with the ERC20 token address and initial credential fee.
     * @param _myTokenAddress Address of the ERC20 token used for payments.
     * @param _initialCredentialFee Fee (in token's smallest unit) required to store a credential.
     */
    constructor(address _myTokenAddress, uint256 _initialCredentialFee) Ownable(msg.sender) {
        require(_myTokenAddress != address(0), "UBaEducationCredentialsStore: Invalid MyToken address.");
        require(_initialCredentialFee > 0, "UBaEducationCredentialsStore: Initial fee must be greater than zero.");
        myToken = IERC20(_myTokenAddress);
        credentialFee = _initialCredentialFee;
    }

    /**
     * @dev Stores the hash of a credential JSON string on-chain.
     * Requires the user to approve this contract to spend the credential fee in MyToken.
     * @param _credentialJsonString The JSON string representing the credential.
     * Emits CredentialHashStored event on success.
     */
    function storeCredentialHash(string calldata _credentialJsonString) external {
        bytes32 credentialHash = keccak256(abi.encodePacked(_credentialJsonString));
        require(!credentialExists[credentialHash], "UBaEducationCredentialsStore: Credential hash already exists.");

        // Transfer credential fee from user to contract
        bool success = myToken.transferFrom(msg.sender, address(this), credentialFee);
        require(success, "UBaEducationCredentialsStore: Token transfer failed. Ensure you have approved enough tokens.");

        credentialExists[credentialHash] = true;
        emit CredentialHashStored(credentialHash, msg.sender);
    }

    /**
     * @dev Checks if a credential hash exists on-chain.
     * No fee is charged for verification.
     * @param _credentialJsonString The JSON string representing the credential to verify.
     * @return bool True if the credential hash exists, false otherwise.
     * Emits CredentialVerified event.
     */
    function verifyCredential(string calldata _credentialJsonString) external returns (bool) {
        bytes32 credentialHash = keccak256(abi.encodePacked(_credentialJsonString));
        emit CredentialVerified(credentialHash, msg.sender, 0);
        return credentialExists[credentialHash];
    }

    /**
     * @dev Allows the contract owner to update the credential fee.
     * @param _newFee The new fee amount (in MyToken's smallest unit).
     * Emits CredentialFeeUpdated event.
     */
    function updateCredentialFee(uint256 _newFee) external onlyOwner {
        require(_newFee > 0, "UBaEducationCredentialsStore: Fee must be greater than zero.");
        emit CredentialFeeUpdated(credentialFee, _newFee);
        credentialFee = _newFee;
    }

    /**
     * @dev Allows the contract owner to withdraw collected token funds.
     * @param to The address to send withdrawn funds to.
     * @param amount The amount of tokens to withdraw.
     * Emits FundsWithdrawn event.
     */
    function withdrawFunds(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "UBaEducationCredentialsStore: Invalid recipient address.");
        require(myToken.transfer(to, amount), "UBaEducationCredentialsStore: Withdrawal failed.");
        emit FundsWithdrawn(to, amount);
    }
}