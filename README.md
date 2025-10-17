# LuckyBall - Encrypted Lottery DApp

A fully encrypted, privacy-preserving lottery system built with Zama's FHEVM (Fully Homomorphic Encryption Virtual Machine) on Ethereum Sepolia testnet. LuckyBall demonstrates the power of confidential computing on blockchain, where players' chosen numbers remain encrypted throughout the entire game lifecycle while maintaining fairness and transparency.

## Overview

LuckyBall is an innovative decentralized lottery application that leverages Fully Homomorphic Encryption (FHE) to provide unprecedented privacy guarantees for players. Unlike traditional blockchain lotteries where all data is visible on-chain, LuckyBall ensures that players' chosen numbers remain completely private, even from miners and node operators, while still enabling verifiable computation and fair winner determination.

### Key Innovation

The project addresses a fundamental blockchain limitation: **the inability to maintain data privacy while executing smart contract logic**. Using Zama's FHEVM technology, LuckyBall performs computations on encrypted data without ever decrypting it, creating a trustless lottery where:
- Players' chosen numbers are never revealed publicly
- Smart contracts compute matches and scores on encrypted data
- Privacy is guaranteed by cryptographic proofs, not by trusted parties
- All game logic remains transparent and auditable

## Features

### Core Functionality

- **Encrypted Ticket Purchase**: Players select a number (1-9) that gets encrypted client-side before being submitted to the blockchain
- **Privacy-Preserving Draws**: Winning numbers are generated on-chain using verifiable randomness
- **Confidential Score Tracking**: Player scores are stored as encrypted values (euint32) on-chain
- **Selective Decryption**: Only ticket owners can decrypt their chosen numbers and scores using their private keys
- **Fair Reward Distribution**: Smart contract automatically awards 10 points for winning tickets using FHE comparison operations
- **Multi-Draw Support**: System supports continuous draws with historical tracking
- **Claim System**: Players manually claim rewards after draws are executed, triggering encrypted score updates

### Technical Features

- **Fully Homomorphic Encryption**: All sensitive data operations use Zama's FHE primitives (euint8, euint32, ebool)
- **Client-Side Encryption**: Numbers are encrypted in the browser using Zama's relayer SDK
- **Zero-Knowledge Proofs**: Input proofs ensure encrypted values are within valid ranges
- **Encrypted Comparison**: Winner determination uses FHE equality operations without decryption
- **Conditional Updates**: Score increments use FHE select operations to maintain encryption throughout
- **Access Control**: FHE permissions ensure only authorized addresses can decrypt specific values

## Technology Stack

### Smart Contract Layer

- **Solidity 0.8.27**: Latest Solidity compiler with Cancun EVM support
- **Zama FHEVM**: Fully Homomorphic Encryption library for Solidity
  - `@fhevm/solidity`: Core FHE types and operations (euint8, euint32, ebool)
  - `@zama-fhe/oracle-solidity`: Oracle integration for FHE operations
- **Hardhat**: Development environment and testing framework
  - `@fhevm/hardhat-plugin`: Specialized plugin for FHEVM development
  - `hardhat-deploy`: Deployment management and contract versioning
  - `typechain`: TypeScript bindings generation for smart contracts

### Frontend Layer

- **React 19.1**: Latest React with concurrent rendering features
- **TypeScript 5.8**: Type-safe frontend development
- **Vite**: Modern build tool with fast HMR
- **Wagmi 2.17**: React Hooks for Ethereum
- **RainbowKit 2.2.8**: Beautiful wallet connection UI
- **TanStack Query 5.89**: Powerful async state management for blockchain data
- **Ethers.js 6.15**: Ethereum library for contract interactions
- **Viem 2.37**: Type-safe Ethereum client

### Encryption & Privacy

- **Zama Relayer SDK 0.2.0**: Client-side encryption and decryption utilities
- **EIP-712 Signatures**: Typed data signing for secure decryption requests
- **Keypair Generation**: Client-side key generation for user-controlled decryption
- **Permission System**: Time-bound, contract-specific decryption permissions

### Development Tools

- **ESLint & Prettier**: Code quality and formatting
- **TypeScript ESLint**: Type-aware linting
- **Solhint**: Solidity linting
- **Hardhat Gas Reporter**: Gas usage analysis
- **Solidity Coverage**: Test coverage reporting
- **Mocha & Chai**: Testing framework

## Architecture

### Smart Contract Architecture

The `LuckyBall.sol` contract implements a state machine with three main flows:

```
┌─────────────────┐
│  Buy Ticket     │──▶ Encrypts number (euint8)
│  (Player)       │──▶ Stores in ticket array
└─────────────────┘    Initializes player score (euint32)

┌─────────────────┐
│  Execute Draw   │──▶ Generates random winning number
│  (Anyone)       │──▶ Closes current draw
└─────────────────┘    Opens new draw

┌─────────────────┐
│  Claim Ticket   │──▶ FHE comparison: ticket == winning
│  (Player)       │──▶ FHE conditional: add 10 if match
└─────────────────┘    Update encrypted score
```

**Key Data Structures**:

```solidity
struct Ticket {
    euint8 number;      // Encrypted player choice (1-9)
    uint256 drawId;     // Associated draw identifier
    bool claimed;       // Claim status
}

struct Draw {
    uint8 winningNumber;  // Publicly visible winning number
    uint256 executedAt;   // Execution timestamp
    bool executed;        // Execution status
}
```

**FHE Operations**:
- `FHE.fromExternal()`: Import encrypted client-side data
- `FHE.asEuint8()`, `FHE.asEuint32()`: Type conversions
- `FHE.eq()`: Encrypted equality comparison
- `FHE.add()`: Encrypted addition
- `FHE.select()`: Encrypted conditional (ternary)
- `FHE.allow()`: Grant decryption permissions

### Frontend Architecture

**Component Hierarchy**:
```
App
├── Header (Wallet connection via RainbowKit)
└── LuckyBallApp (Main game interface)
    ├── Score Display & Decryption
    ├── Ticket Purchase Interface
    ├── Ticket List & Management
    └── Draw Control Panel
```

**State Management**:
- TanStack Query for blockchain data caching and synchronization
- React hooks for local UI state
- Optimistic updates with query invalidation after transactions

**Data Flow**:
1. **Purchase**: Client encrypts → Submit to contract → Refresh tickets query
2. **Decrypt**: Generate keypair → Sign EIP-712 request → Call relayer → Display result
3. **Claim**: Submit transaction → Wait for confirmation → Refresh queries
4. **Draw**: Execute transaction → Invalidate all draw-related queries

## Problem Solved

### Traditional Blockchain Lottery Limitations

1. **Privacy Violation**: All data on traditional blockchains is public, meaning players' choices are visible to everyone
2. **Front-Running**: Bots and miners can see pending transactions and exploit this information
3. **Fairness Concerns**: Winners can be predicted or manipulated based on visible on-chain data
4. **Trust Issues**: Centralized lotteries require trust in operators; decentralized ones sacrifice privacy

### LuckyBall's Solution

1. **Cryptographic Privacy**: FHE ensures numbers remain encrypted throughout the entire lifecycle
2. **Computation on Encrypted Data**: Smart contracts determine winners without seeing the underlying data
3. **User-Controlled Decryption**: Only players with private keys can decrypt their own data
4. **Transparent Fairness**: All logic is open-source and auditable, while maintaining data privacy
5. **No Trusted Third Party**: Privacy is enforced by mathematics, not by trusting operators

## Installation & Setup

### Prerequisites

- **Node.js**: Version 20 or higher
- **npm**: Version 7.0.0 or higher
- **MetaMask**: Or any Web3 wallet
- **Sepolia ETH**: For testnet deployment and testing

### Smart Contract Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd LuckyBall
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Create .env file
   cp .env.example .env

   # Set your private key for deployment
   export PRIVATE_KEY="your-private-key-here"

   # Set Infura API key
   npx hardhat vars set INFURA_API_KEY

   # Optional: Set Etherscan API key for verification
   npx hardhat vars set ETHERSCAN_API_KEY
   ```

4. **Compile contracts**
   ```bash
   npm run compile
   ```

5. **Run tests**
   ```bash
   npm run test
   ```

6. **Deploy to Sepolia**
   ```bash
   npm run deploy:sepolia
   ```

7. **Verify contract (optional)**
   ```bash
   npm run verify:sepolia
   ```

### Frontend Setup

1. **Navigate to UI directory**
   ```bash
   cd ui
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Configure contract address**

   Update `ui/src/config/contracts.ts` with your deployed contract address:
   ```typescript
   export const CONTRACT_ADDRESS: `0x${string}` = '0xYourContractAddress';
   ```

4. **Configure wallet connection**

   Update `ui/src/config/wagmi.ts` with your WalletConnect project ID:
   ```typescript
   const projectId = 'your-walletconnect-project-id';
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Build for production**
   ```bash
   npm run build
   ```

## Usage Guide

### For Players

1. **Connect Wallet**: Click "Connect Wallet" and select your Web3 wallet
2. **Purchase Ticket**:
   - Select a number (1-9) from the grid
   - Click "Buy Ticket" to submit encrypted purchase (costs 0.001 ETH)
   - Wait for transaction confirmation
3. **View Tickets**: Your tickets appear in the "Your Tickets" section with encrypted handles
4. **Decrypt Numbers**: Click "Decrypt Ticket" to reveal your chosen number (only you can see it)
5. **Execute Draw**: Any player can trigger a draw execution
6. **Claim Rewards**: After draw execution, click "Claim Reward" on winning tickets
7. **Check Score**: View and decrypt your accumulated score

### For Developers

**Local Testing**:
```bash
# Start local Hardhat node
npm run chain

# Deploy to localhost
npm run deploy:localhost

# Run tests
npm run test

# Run with coverage
npm run coverage
```

**Custom Tasks**:
```bash
# View available accounts
npx hardhat accounts

# Interact with deployed contract
npx hardhat <task-name> --network sepolia
```

**Frontend Development**:
```bash
cd ui
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Advantages

### Security & Privacy

- **End-to-End Encryption**: Data encrypted client-side, never exposed in plaintext
- **Zero-Knowledge**: Contract determines winners without seeing player choices
- **Cryptographic Guarantees**: Privacy protected by mathematical proofs, not trust
- **Front-Running Protection**: Encrypted transactions prevent MEV exploitation
- **Auditable Code**: All logic open-source and verifiable

### User Experience

- **Intuitive Interface**: Clean, responsive design with clear status feedback
- **Wallet Integration**: Seamless connection via RainbowKit
- **Real-Time Updates**: Automatic data synchronization with blockchain
- **Selective Decryption**: Users control when to reveal their private data
- **Gas Efficient**: Optimized FHE operations minimize transaction costs

### Technical Innovation

- **Novel Use Case**: Demonstrates practical FHE application in gaming/gambling
- **Composability**: Can be integrated with other DeFi protocols
- **Scalability**: Efficient FHE operations suitable for production use
- **Developer Friendly**: Clear code structure with TypeScript support
- **Modern Stack**: Latest tools and best practices throughout

### Decentralization

- **Permissionless**: Anyone can play, execute draws, or deploy instances
- **Censorship Resistant**: No central authority can block participation
- **Transparent Rules**: All game logic visible and unchangeable
- **Fair Randomness**: Uses block data for verifiable random generation
- **Community Driven**: Open-source and community-governed

## Gas Costs & Performance

**Estimated Gas Usage** (Sepolia testnet):

- **Buy Ticket**: ~250,000 gas (~$2-5 at typical gas prices)
- **Execute Draw**: ~100,000 gas
- **Claim Ticket**: ~150,000 gas
- **Decrypt Operations**: Free (off-chain via relayer)

**Performance Characteristics**:

- FHE operations are more expensive than regular EVM operations
- Costs are justified by privacy guarantees
- Batch operations can reduce per-ticket costs
- Zama network optimizations continuously improving efficiency

## Future Roadmap

### Phase 1 (Current)
- ✅ Core encrypted lottery functionality
- ✅ Single-number ticket system (1-9)
- ✅ Basic reward distribution
- ✅ Frontend with wallet integration

### Phase 2 (Q2 2025)
- 🔄 Multi-number lottery (choose multiple numbers)
- 🔄 Dynamic ticket pricing based on pool size
- 🔄 Automated draw execution using Chainlink Automation
- 🔄 Prize pool accumulation with jackpot system
- 🔄 Referral rewards program

### Phase 3 (Q3 2025)
- 📅 Cross-chain deployment (Polygon, Arbitrum)
- 📅 Advanced analytics dashboard
- 📅 Social features (groups, tournaments)
- 📅 NFT integration for special tickets
- 📅 DAO governance for game parameters

### Phase 4 (Q4 2025)
- 📅 Layer 2 optimization for lower fees
- 📅 Mobile application (iOS/Android)
- 📅 Integration with prediction markets
- 📅 Advanced FHE operations (encrypted payout calculations)
- 📅 Mainnet deployment

### Research & Development
- Exploring verifiable delay functions (VDF) for randomness
- Investigating zk-SNARK integration for additional privacy layers
- Researching batch decryption optimizations
- Studying cross-chain FHE communication protocols
- Developing formal verification for smart contract security

## Security Considerations

### Current Measures

- **Audited FHE Library**: Using Zama's battle-tested FHEVM implementation
- **Input Validation**: Encrypted inputs validated via zero-knowledge proofs
- **Reentrancy Protection**: Following checks-effects-interactions pattern
- **Access Controls**: FHE permission system prevents unauthorized decryption
- **Time-Locked Permissions**: Decryption permissions expire after 7 days

### Known Limitations

- Smart contract has not undergone professional audit (recommended before mainnet)
- Randomness uses block variables (suitable for low-stakes lottery, not high-value applications)
- FHE operations are computationally expensive
- Relayer availability critical for decryption operations
- Front-end encryption keys stored in browser memory

### Best Practices

- Only use for entertainment/educational purposes on testnet
- Never invest more than you can afford to lose
- Verify contract addresses before interacting
- Use hardware wallets for large amounts
- Report security issues responsibly

## Contributing

We welcome contributions from the community! Here's how you can help:

### Ways to Contribute

- **Bug Reports**: Open issues for any bugs you encounter
- **Feature Requests**: Suggest new features or improvements
- **Code Contributions**: Submit pull requests with enhancements
- **Documentation**: Improve guides, tutorials, or code comments
- **Testing**: Help test on different networks and configurations
- **Design**: Contribute UI/UX improvements

### Development Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- Follow existing code style and conventions
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting
- Use meaningful commit messages

## Testing

### Smart Contract Tests

```bash
# Run all tests
npm run test

# Run specific test file
npx hardhat test test/LuckyBall.test.ts

# Run with coverage
npm run coverage

# Run on Sepolia testnet
npm run test:sepolia
```

### Frontend Tests

```bash
cd ui
npm run lint        # Linting
npm run build       # Build test
```

### Integration Testing

1. Deploy contract to local network
2. Start frontend with local configuration
3. Test complete user flows
4. Verify encryption/decryption cycles
5. Monitor gas usage and performance

## License

This project is licensed under the **BSD-3-Clause-Clear License**.

Key points:
- Free to use, modify, and distribute
- Must retain copyright notices
- No patent grant
- No trademark rights
- No warranty provided

See the [LICENSE](LICENSE) file for full details.

## Resources & Documentation

### Project Resources

- **Smart Contract**: `contracts/LuckyBall.sol`
- **Deployment Scripts**: `deploy/`
- **Frontend**: `ui/src/`
- **Tests**: `test/`
- **Tasks**: `tasks/LuckyBall.ts`

### Zama FHEVM Documentation

- [FHEVM Overview](https://docs.zama.ai/fhevm)
- [Solidity API Reference](https://docs.zama.ai/fhevm/solidity-api)
- [Hardhat Plugin Guide](https://docs.zama.ai/protocol/solidity-guides/development-guide/hardhat)
- [Client-Side Encryption](https://docs.zama.ai/fhevm/client-side-encryption)
- [Security Best Practices](https://docs.zama.ai/fhevm/security)

### Web3 Tools Documentation

- [Hardhat Docs](https://hardhat.org/docs)
- [Wagmi Documentation](https://wagmi.sh/)
- [RainbowKit Docs](https://www.rainbowkit.com/docs)
- [TanStack Query](https://tanstack.com/query/latest)
- [Ethers.js Docs](https://docs.ethers.org/)

## Support & Community

### Get Help

- **GitHub Issues**: [Report bugs or ask questions](https://github.com/your-org/LuckyBall/issues)
- **Discussions**: [Join community discussions](https://github.com/your-org/LuckyBall/discussions)
- **Zama Discord**: [Join the Zama community](https://discord.gg/zama)
- **Email**: Contact the team at support@luckyball.xyz

### Stay Updated

- **Follow Development**: Watch this repository for updates
- **Twitter**: [@LuckyBallFHE](https://twitter.com/LuckyBallFHE)
- **Blog**: [Medium articles](https://medium.com/@luckyball)
- **Newsletter**: Subscribe for monthly updates

## Acknowledgments

### Built With

- **Zama**: For pioneering FHE technology and providing FHEVM
- **Ethereum Foundation**: For the robust blockchain infrastructure
- **Hardhat Team**: For excellent development tools
- **RainbowKit**: For beautiful wallet connection UX
- **Open Source Community**: For the incredible ecosystem of tools

### Special Thanks

- Zama team for technical support and documentation
- Early testers who provided valuable feedback
- Contributors who helped improve the codebase
- Ethereum community for fostering innovation

---

**Built with privacy in mind using Zama FHEVM** 🔐

*LuckyBall demonstrates the future of privacy-preserving decentralized applications, where users don't have to choose between transparency and confidentiality.*
