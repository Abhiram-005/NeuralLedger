# 🧠 NeuralLedger

> A decentralized marketplace for AI models and services — powered by blockchain smart contracts.

NeuralLedger bridges the gap between AI developers and end-users through a trustless, on-chain marketplace. Creators can list their AI models or services, and buyers can discover, evaluate, and transact — all without intermediaries.

---

## ✨ Features

- **Decentralized AI Marketplace** — Buy and sell AI models/services peer-to-peer using smart contracts
- **Smart Contract–Powered Transactions** — Solidity contracts enforce payments, licensing, and ownership
- **On-Chain Registry** — AI model metadata (name, description, price, creator) stored and verifiable on-chain
- **Web Frontend** — Clean, responsive UI built with vanilla JS, HTML, and CSS
- **Python AI Backend** — Backend utilities for model packaging, validation, or inference integration
- **Trustless & Transparent** — No centralized authority; all transactions are publicly auditable

---

## 🗂️ Project Structure

```
NeuralLedger/
├── ai-marketplace/         # Core application
│   ├── contracts/          # Solidity smart contracts
│   ├── src/                # Frontend (JavaScript, HTML, CSS)
│   ├── scripts/            # Deployment & interaction scripts
│   └── ...                 # Config, tests, etc.
├── .gitignore
└── LICENSE
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity |
| Frontend | JavaScript, HTML, CSS |
| AI / Backend | Python |
| Blockchain Tooling | Hardhat / Ethers.js |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Python](https://www.python.org/) 3.9+
- [MetaMask](https://metamask.io/) or any EVM-compatible wallet
- A local blockchain (e.g. [Hardhat Network](https://hardhat.org/)) or a testnet RPC URL

### 1. Clone the Repository

```bash
git clone https://github.com/Abhiram-005/NeuralLedger.git
cd NeuralLedger/ai-marketplace
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in `ai-marketplace/` and add:

```env
PRIVATE_KEY=your_wallet_private_key
RPC_URL=http://127.0.0.1:8545       # or a testnet RPC URL
```

### 4. Compile & Deploy Smart Contracts

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost
```

### 5. Start the Frontend

```bash
# If using a dev server (e.g. live-server, Vite, etc.)
npm run dev
```

Or simply open `src/index.html` in your browser after pointing it to the deployed contract address.

---

## 📦 Smart Contracts

The core marketplace logic lives in Solidity:

- **`Marketplace.sol`** — Handles listing, purchasing, and delisting of AI models
- **`ModelRegistry.sol`** — Stores on-chain metadata for each listed model
- Payments are settled directly through the contract; creators receive funds on purchase

---

## 🧪 Running Tests

```bash
npx hardhat test
```

---

## 🌐 Deployment

To deploy to a public testnet (e.g. Sepolia):

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Make sure your `.env` contains the correct `RPC_URL` and funded `PRIVATE_KEY` for the target network.

---

## 🤝 Contributing

Contributions are welcome! To get started:

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push and open a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">Built with ❤️ by <a href="https://github.com/Abhiram-005">Abhiram-005</a></p>
