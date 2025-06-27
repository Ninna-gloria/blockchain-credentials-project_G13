# UBaEducationCredentialsStore & MyToken

This project is a blockchain-based credential verification and token system built with Solidity and Hardhat for the University of Bamenda's Distributed Systems and Blockchains Security course (CYBE 6223).

It consists of two main smart contracts:

- **MyToken.sol**: A custom ERC20 token with multi-signature minting and withdrawal, ETH-to-token conversion, and secure payment features.
- **UBaEducationCredentialsStore.sol**: A credential verification contract that stores document hashes on-chain and requires payment in MyToken for credential verification.

---

## Project Features

- **Custom ERC20 Token (MyToken)**

  - Implements the ERC20 standard (OpenZeppelin).
  - Unique name and symbol for your group.
  - Users can buy tokens by sending ETH or calling a purchase function.
  - Multi-signature minting (3 specified addresses required).
  - Multi-signature withdrawal (2 out of 3 specified addresses required).
  - Secure error handling and access control.

- **Credential Store**
  - Stores only the hash of credential JSON documents (not plaintext) for privacy and efficiency.
  - Users pay in MyToken to verify credentials.
  - Only the owner can add credentials or withdraw funds.
  - Emits events for all major actions.

---

## Why Store Only Hashes of Credentials?

1. **Privacy**: Storing only the hash ensures that sensitive student data is not publicly visible on the blockchain.
2. **Efficiency**: Hashes are fixed-size and much smaller than full documents, reducing storage costs and improving performance.

---

## Setup Instructions

1. **Clone the repository**

   ```sh
   git clone https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   cd YOUR-REPO-NAME
   ```

2. **Install dependencies**

   ```sh
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory with:

   ```
   SEPOLIA_RPC_URL=YOUR_ALCHEMY_OR_INFURA_URL
   PRIVATE_KEY=YOUR_DEPLOYER_PRIVATE_KEY
   MY_TOKEN_CONTRACT_ADDRESS=YOUR_DEPLOYED_TOKEN_ADDRESS
   INITIAL_CREDENTIAL_FEE=5
   ```

4. **Compile contracts**
   ```sh
   npx hardhat compile
   ```

---

## Deployment

1. **Deploy MyToken**

   ```sh
   npx hardhat run scripts/deployMyToken.ts --network sepolia
   ```

2. **Deploy UBaEducationCredentialsStore**

   ```sh
   npx hardhat run scripts/deployCredentialsStore.ts --network sepolia
   ```

3. **Verify contracts on Etherscan**
   ```sh
   npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS "constructor arguments"
   ```

---

## Deployed Contract Addresses

- **MyToken.sol**:  
  Address: `0x...`  
  Etherscan link https://sepolia.etherscan.io/address/0x0FCebfeB4cbFaD5b7e3C526eca48937C52e5aacf#code

- **UBaEducationCredentialsStore.sol**:  
  Address: `0x...`  
  Etherscan link https://sepolia.etherscan.io/address/0xa42e334d6fB51FCa403584c14E833eeB15b3D2F5#code

---

## Unit Testing

Run all tests:

```sh
npx hardhat test
```

Tests cover:

- Token transfers and balance checks
- ETH-to-token conversion
- Multi-signature minting and withdrawal security
- Credential storage and verification
- Security checks (e.g., unauthorized access)

---

## MetaMask Integration

- Add the deployed MyToken contract address to MetaMask.
- [Insert screenshot of token balance in MetaMask here]

---

## Hardhat Usage

Try running some of the following tasks:

```sh
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deployMyToken.ts --network sepolia
npx hardhat run scripts/deployCredentialsStore.ts --network sepolia
```

---

## Useful VS Code Extensions

- Hardhat for Visual Studio Code
- Solidity
- Prettier
- ESLint
- GitLens

## Authors

- Group 13 Token:G13TK

## License

MIT
