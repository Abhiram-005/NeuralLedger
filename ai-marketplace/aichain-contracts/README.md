# AIChain Smart Contracts

## Setup (one time only)

```bash
# 1. Go into this folder
cd aichain-contracts

# 2. Install everything
npm install

# 3. Compile the Solidity contract
npx hardhat compile
```

## Run the local blockchain + deploy

Open TWO terminal windows:

**Terminal 1 — start the local blockchain:**
```bash
npx hardhat node
```
This prints 20 test accounts each with 10,000 fake ETH.
Copy one of the private keys — you'll import it into MetaMask.

**Terminal 2 — deploy the contract:**
```bash
npx hardhat run scripts/deploy.js --network localhost
```
This prints the contract address and saves contract-config.json.

## Run tests

```bash
npx hardhat test
```

## Add MetaMask local network

1. Open MetaMask → Settings → Networks → Add Network
2. Fill in:
   - Network name: Hardhat Local
   - RPC URL:      http://127.0.0.1:8545
   - Chain ID:     31337
   - Currency:     ETH
3. Import a test account:
   - MetaMask → Import Account → paste a private key from `npx hardhat node` output

## Contract features

| Feature | Function | Who can call |
|---|---|---|
| Register AI model as NFT | registerModel() | Anyone |
| Buy a listed model | buyModel() | Anyone |
| List model for sale | listForSale() | Model owner |
| Remove from sale | delistFromSale() | Model owner |
| Leave a star review | addReview() | Anyone |
| Create auction | createAuction() | Model owner |
| Place a bid | placeBid() | Anyone |
| End auction | endAuction() | Anyone (after time) |
| Withdraw ETH earned | withdraw() | Sellers/creators |

## Payment flow (on every sale)

```
Sale price
  ├── 2%  → Platform (AIChain)
  ├── 5%  → Original creator (royalty, only on resales)
  └── 93% → Current seller
```
