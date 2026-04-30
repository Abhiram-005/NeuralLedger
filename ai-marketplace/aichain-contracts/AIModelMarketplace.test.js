// test/AIModelMarketplace.test.js
// Run with: npx hardhat test

const { expect }       = require("chai");
const { ethers }       = require("hardhat");

describe("AIModelMarketplace", function () {
  let marketplace, owner, seller, buyer, other;

  // Deploy a fresh contract before each test
  beforeEach(async function () {
    [owner, seller, buyer, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AIModelMarketplace");
    marketplace   = await Factory.deploy();
    await marketplace.waitForDeployment();
  });

  // ── Helper: register a model as the seller ──────────────────
  async function registerModel(price = ethers.parseEther("0.01")) {
    return marketplace.connect(seller).registerModel(
      "Test Model",
      "A great AI model",
      "sha256:abc123",
      price,
      85,   // quality score
      0     // plagiarism risk: LOW
    );
  }

  // ── 1. Deployment ────────────────────────────────────────────
  describe("Deployment", function () {
    it("sets the platform owner correctly", async function () {
      expect(await marketplace.platformOwner()).to.equal(owner.address);
    });

    it("starts with zero models", async function () {
      expect(await marketplace.getTotalModels()).to.equal(0);
    });
  });

  // ── 2. Model Registration ────────────────────────────────────
  describe("registerModel", function () {
    it("mints an NFT and stores model data", async function () {
      await registerModel();
      const model = await marketplace.models(1);

      expect(model.id).to.equal(1);
      expect(model.name).to.equal("Test Model");
      expect(model.creator).to.equal(seller.address);
      expect(model.currentOwner).to.equal(seller.address);
      expect(model.isForSale).to.be.true;
      expect(model.qualityScore).to.equal(85);
    });

    it("emits ModelRegistered event", async function () {
      const tx = registerModel();
      await expect(tx).to.emit(marketplace, "ModelRegistered")
        .withArgs(1, "Test Model", seller.address,
                  ethers.parseEther("0.01"), 85, expect.anything());
    });

    it("rejects empty name", async function () {
      await expect(
        marketplace.connect(seller).registerModel("", "desc", "hash", 100, 80, 0)
      ).to.be.revertedWith("Name required");
    });

    it("rejects quality score over 100", async function () {
      await expect(
        marketplace.connect(seller).registerModel("M","d","h",100,101,0)
      ).to.be.revertedWith("Quality score max 100");
    });
  });

  // ── 3. Buying ────────────────────────────────────────────────
  describe("buyModel", function () {
    beforeEach(async function () {
      await registerModel(ethers.parseEther("0.1"));
    });

    it("transfers NFT to buyer", async function () {
      await marketplace.connect(buyer).buyModel(1, {
        value: ethers.parseEther("0.1")
      });
      const model = await marketplace.models(1);
      expect(model.currentOwner).to.equal(buyer.address);
    });

    it("reverts if not enough ETH sent", async function () {
      await expect(
        marketplace.connect(buyer).buyModel(1, { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Not enough ETH sent");
    });

    it("reverts if buyer already owns it", async function () {
      await marketplace.connect(buyer).buyModel(1, { value: ethers.parseEther("0.1") });
      await expect(
        marketplace.connect(buyer).buyModel(1, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWith("Not for sale");
    });

    it("seller can withdraw payment after sale", async function () {
      await marketplace.connect(buyer).buyModel(1, { value: ethers.parseEther("0.1") });
      const pending = await marketplace.getPendingBalance(seller.address);
      expect(pending).to.be.gt(0);
    });

    it("pays royalty on resale", async function () {
      // First sale: seller → buyer
      await marketplace.connect(buyer).buyModel(1, { value: ethers.parseEther("0.1") });
      // List again by buyer
      await marketplace.connect(buyer).listForSale(1, ethers.parseEther("0.2"));
      // Second sale: buyer → other (royalty should go to original seller/creator)
      await marketplace.connect(other).buyModel(1, { value: ethers.parseEther("0.2") });

      const creatorRoyalty = await marketplace.getPendingBalance(seller.address);
      // seller gets first sale payment + 5% royalty on second sale
      expect(creatorRoyalty).to.be.gt(ethers.parseEther("0.1"));
    });
  });

  // ── 4. Reviews ───────────────────────────────────────────────
  describe("addReview", function () {
    it("stores a review on-chain", async function () {
      await registerModel();
      await marketplace.connect(buyer).addReview(1, 5, "Excellent model!");
      const reviews = await marketplace.getReviews(1);
      expect(reviews.length).to.equal(1);
      expect(reviews[0].rating).to.equal(5);
      expect(reviews[0].comment).to.equal("Excellent model!");
    });

    it("calculates average rating correctly", async function () {
      await registerModel();
      await marketplace.connect(buyer).addReview(1, 4, "Good");
      await marketplace.connect(other).addReview(1, 2, "Average");
      const avg = await marketplace.getAverageRating(1);
      expect(avg).to.equal(30); // (4+2)/2 = 3.0 → returns 30
    });

    it("rejects invalid star rating", async function () {
      await registerModel();
      await expect(
        marketplace.connect(buyer).addReview(1, 6, "Too high!")
      ).to.be.revertedWith("Rating must be 1 to 5 stars");
    });
  });

  // ── 5. Auctions ──────────────────────────────────────────────
  describe("Auction", function () {
    beforeEach(async function () {
      await registerModel();
      await marketplace.connect(seller).delistFromSale(1);
    });

    it("creates an auction", async function () {
      const duration = 60; // 60 seconds
      await marketplace.connect(seller).createAuction(
        1, ethers.parseEther("0.05"), duration
      );
      const auction = await marketplace.auctions(1);
      expect(auction.active).to.be.true;
      expect(auction.seller).to.equal(seller.address);
    });

    it("accepts bids", async function () {
      await marketplace.connect(seller).createAuction(1, ethers.parseEther("0.05"), 60);
      await marketplace.connect(buyer).placeBid(1, { value: ethers.parseEther("0.1") });
      const auction = await marketplace.auctions(1);
      expect(auction.highestBidder).to.equal(buyer.address);
      expect(auction.highestBid).to.equal(ethers.parseEther("0.1"));
    });

    it("refunds outbid bidder", async function () {
      await marketplace.connect(seller).createAuction(1, ethers.parseEther("0.05"), 60);
      await marketplace.connect(buyer).placeBid(1, { value: ethers.parseEther("0.1") });
      await marketplace.connect(other).placeBid(1, { value: ethers.parseEther("0.2") });

      const refund = await marketplace.getPendingBalance(buyer.address);
      expect(refund).to.equal(ethers.parseEther("0.1"));
    });
  });

  // ── 6. Platform stats ────────────────────────────────────────
  describe("getPlatformStats", function () {
    it("returns correct totals", async function () {
      await registerModel(ethers.parseEther("0.1"));
      await marketplace.connect(buyer).buyModel(1, { value: ethers.parseEther("0.1") });

      const [totalModels, totalSales, totalVolume, forSale]
        = await marketplace.getPlatformStats();

      expect(totalModels).to.equal(1);
      expect(totalSales).to.equal(1);
      expect(totalVolume).to.equal(ethers.parseEther("0.1"));
      expect(forSale).to.equal(0);
    });
  });
});
