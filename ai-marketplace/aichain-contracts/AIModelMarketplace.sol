// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   AIChain — AI Model Marketplace Smart Contract
//   Language: Solidity (runs on Ethereum blockchain)
//
//   What this contract does:
//   - Registers AI models as NFTs (each model = unique token)
//   - Handles buying/selling with automatic royalty payments
//   - Runs on-chain auctions with real ETH bids
//   - Stores star ratings and reviews permanently on-chain
//   - Enforces roles: Creator, Buyer, Platform Admin
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ERC721 = NFT standard. Each AI model becomes a unique token.
// ReentrancyGuard = security feature that blocks hack attacks.
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract AIModelMarketplace is ERC721, ReentrancyGuard {

    // ── Counters track how many models/auctions exist ──────────
    using Counters for Counters.Counter;
    Counters.Counter private _modelIds;    // auto-increments: 1, 2, 3...
    Counters.Counter private _auctionIds;

    // ── Platform settings ──────────────────────────────────────
    address public platformOwner;          // the person who deployed this contract
    uint8   public constant ROYALTY_PCT  = 5;   // 5% royalty to original creator on every resale
    uint8   public constant PLATFORM_PCT = 2;   // 2% platform fee to AIChain
    uint256 public constant MIN_AUCTION_DURATION = 1 minutes; // for testing; use 1 days in production

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //   DATA STRUCTURES  (what we store on the blockchain)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Every AI model stored on the blockchain looks like this:
    struct AIModel {
        uint256 id;
        string  name;
        string  description;
        string  modelHash;        // SHA-256 fingerprint of the model file
        uint256 price;            // price in Wei (smallest unit of ETH)
        uint256 qualityScore;     // 0-100, set by your RandomForest AI
        uint256 plagiarismRisk;   // 0=LOW 1=MEDIUM 2=HIGH, set by Cosine Similarity AI
        address creator;          // wallet that first registered this model
        address currentOwner;     // wallet that owns it right now
        bool    isForSale;        // is it listed in the marketplace?
        uint256 registeredAt;     // Unix timestamp of registration
        uint256 totalSales;       // how many times has this been sold?
        uint256 totalRevenue;     // total Wei earned from this model
    }

    // A star rating left by a buyer:
    struct Review {
        address reviewer;
        uint8   rating;      // 1 to 5 stars
        string  comment;
        uint256 timestamp;
    }

    // An on-chain auction:
    struct Auction {
        uint256 modelId;
        address seller;
        uint256 startPrice;      // minimum first bid
        uint256 highestBid;      // current top bid in Wei
        address highestBidder;   // wallet of current top bidder
        uint256 endTime;         // Unix timestamp when auction closes
        bool    active;          // is bidding still open?
        bool    ended;           // has the winner been decided?
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //   STORAGE  (the blockchain's permanent memory)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    mapping(uint256 => AIModel)   public models;           // modelId → model data
    mapping(uint256 => Review[])  public modelReviews;     // modelId → list of reviews
    mapping(uint256 => Auction)   public auctions;         // auctionId → auction data
    mapping(uint256 => uint256)   public modelToAuction;   // modelId → its active auctionId
    mapping(address => uint256)   public pendingWithdrawals; // wallet → ETH they can withdraw
    mapping(address => uint256[]) public ownedModels;      // wallet → list of model IDs they own
    mapping(address => bool)      public hasReviewed;      // reviewer+model → already reviewed?
    // (we encode reviewer+model as a single uint256 key below)
    mapping(uint256 => bool)      private _reviewedKey;

    uint256[] public allModelIds; // array of all model IDs ever registered

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //   EVENTS  (notifications broadcast to the blockchain)
    //   Your React app listens for these in real time!
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    event ModelRegistered(
        uint256 indexed modelId,
        string  name,
        address indexed creator,
        uint256 price,
        uint256 qualityScore,
        uint256 timestamp
    );

    event ModelSold(
        uint256 indexed modelId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 royaltyPaid,
        uint256 timestamp
    );

    event ModelListed(uint256 indexed modelId, uint256 price);
    event ModelDelisted(uint256 indexed modelId);

    event ReviewAdded(
        uint256 indexed modelId,
        address indexed reviewer,
        uint8   rating,
        string  comment
    );

    event AuctionCreated(
        uint256 indexed auctionId,
        uint256 indexed modelId,
        address indexed seller,
        uint256 startPrice,
        uint256 endTime
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount
    );

    event AuctionEnded(
        uint256 indexed auctionId,
        uint256 indexed modelId,
        address indexed winner,
        uint256 finalPrice
    );

    event RoyaltyPaid(
        uint256 indexed modelId,
        address indexed creator,
        uint256 amount
    );

    event PlatformFeeCollected(uint256 amount);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //   MODIFIERS  (reusable checks that run before functions)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Stops anyone except the platform owner from calling a function:
    modifier onlyPlatformOwner() {
        require(msg.sender == platformOwner, "Only platform owner");
        _;
    }

    // Stops anyone except the model's current owner:
    modifier onlyModelOwner(uint256 modelId) {
        require(models[modelId].currentOwner == msg.sender, "Not model owner");
        _;
    }

    // Checks the model actually exists:
    modifier modelExists(uint256 modelId) {
        require(modelId > 0 && modelId <= _modelIds.current(), "Model does not exist");
        _;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //   CONSTRUCTOR  (runs once when contract is deployed)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ERC721("AIChain", "AIC") = our NFT collection name and symbol
    constructor() ERC721("AIChain", "AIC") {
        platformOwner = msg.sender; // whoever deploys the contract becomes admin
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //   CORE FUNCTIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ── 1. REGISTER a new AI model (mints it as an NFT) ───────
    //
    // Called by your Flask backend after running AI analysis.
    // qualityScore comes from your RandomForest model.
    // plagiarismRisk: 0=LOW, 1=MEDIUM, 2=HIGH from Cosine Similarity.
    //
    function registerModel(
        string  memory name,
        string  memory description,
        string  memory modelHash,
        uint256 price,
        uint256 qualityScore,
        uint256 plagiarismRisk
    ) external returns (uint256) {

        // Validation — quality 0-100, plagiarism 0-2
        require(bytes(name).length > 0,        "Name required");
        require(bytes(modelHash).length > 0,   "Model hash required");
        require(qualityScore <= 100,            "Quality score max 100");
        require(plagiarismRisk <= 2,            "Risk: 0=LOW 1=MED 2=HIGH");

        // Increment the counter and get the new ID
        _modelIds.increment();
        uint256 newId = _modelIds.current();

        // Mint the NFT — msg.sender becomes the owner of token #newId
        _safeMint(msg.sender, newId);

        // Store all model data permanently on the blockchain
        models[newId] = AIModel({
            id:            newId,
            name:          name,
            description:   description,
            modelHash:     modelHash,
            price:         price,
            qualityScore:  qualityScore,
            plagiarismRisk: plagiarismRisk,
            creator:       msg.sender,   // original creator, never changes
            currentOwner:  msg.sender,
            isForSale:     true,         // listed in marketplace by default
            registeredAt:  block.timestamp,
            totalSales:    0,
            totalRevenue:  0
        });

        allModelIds.push(newId);
        ownedModels[msg.sender].push(newId);

        // Broadcast the event so React app knows a new model was registered
        emit ModelRegistered(newId, name, msg.sender, price, qualityScore, block.timestamp);

        return newId;
    }

    // ── 2. BUY a model (direct purchase at listed price) ──────
    //
    // "payable" means this function accepts ETH.
    // "nonReentrant" blocks re-entrancy attacks (a common hack).
    //
    function buyModel(uint256 modelId)
        external
        payable
        nonReentrant
        modelExists(modelId)
    {
        AIModel storage model = models[modelId];

        require(model.isForSale,                        "Not for sale");
        require(model.currentOwner != msg.sender,       "You already own this");
        require(msg.value >= model.price,               "Not enough ETH sent");

        address seller  = model.currentOwner;
        address creator = model.creator;
        uint256 salePrice = model.price;

        // ── Calculate payment splits ───────────────────────────
        uint256 platformFee  = (salePrice * PLATFORM_PCT) / 100;  // 2% to AIChain
        uint256 royalty      = 0;
        uint256 sellerAmount = salePrice - platformFee;

        // Royalty only applies when someone OTHER than the creator is selling
        if (seller != creator) {
            royalty      = (salePrice * ROYALTY_PCT) / 100;       // 5% to original creator
            sellerAmount = salePrice - platformFee - royalty;
        }

        // ── Update model state ─────────────────────────────────
        model.currentOwner = msg.sender;
        model.isForSale    = false;
        model.totalSales  += 1;
        model.totalRevenue += salePrice;

        // Transfer the NFT from seller to buyer
        _transfer(seller, msg.sender, modelId);

        // Update owned models tracking
        ownedModels[msg.sender].push(modelId);
        _removeFromOwnedModels(seller, modelId);

        // ── Send payments ──────────────────────────────────────
        // We use "pending withdrawals" pattern — safer than direct transfer
        pendingWithdrawals[seller]         += sellerAmount;
        pendingWithdrawals[platformOwner]  += platformFee;

        if (royalty > 0) {
            pendingWithdrawals[creator] += royalty;
            emit RoyaltyPaid(modelId, creator, royalty);
        }

        // Refund any excess ETH sent
        if (msg.value > salePrice) {
            pendingWithdrawals[msg.sender] += (msg.value - salePrice);
        }

        emit PlatformFeeCollected(platformFee);
        emit ModelSold(modelId, seller, msg.sender, salePrice, royalty, block.timestamp);
    }

    // ── 3. LIST a model for sale (set a new price) ────────────
    function listForSale(uint256 modelId, uint256 price)
        external
        modelExists(modelId)
        onlyModelOwner(modelId)
    {
        require(price > 0, "Price must be greater than 0");
        require(!_isInActiveAuction(modelId), "Model is in active auction");

        models[modelId].isForSale = true;
        models[modelId].price     = price;

        emit ModelListed(modelId, price);
    }

    // ── 4. DELIST a model (take it off the market) ────────────
    function delistFromSale(uint256 modelId)
        external
        modelExists(modelId)
        onlyModelOwner(modelId)
    {
        models[modelId].isForSale = false;
        emit ModelDelisted(modelId);
    }

    // ── 5. ADD a review (only buyers can review) ──────────────
    function addReview(uint256 modelId, uint8 rating, string memory comment)
        external
        modelExists(modelId)
    {
        require(rating >= 1 && rating <= 5, "Rating must be 1 to 5 stars");
        require(models[modelId].currentOwner == msg.sender ||
                models[modelId].creator != msg.sender,
                "Must have purchased to review");

        // Check they haven't already reviewed this model
        uint256 reviewKey = uint256(keccak256(abi.encodePacked(msg.sender, modelId)));
        require(!_reviewedKey[reviewKey], "Already reviewed this model");

        _reviewedKey[reviewKey] = true;

        modelReviews[modelId].push(Review({
            reviewer:  msg.sender,
            rating:    rating,
            comment:   comment,
            timestamp: block.timestamp
        }));

        emit ReviewAdded(modelId, msg.sender, rating, comment);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //   AUCTION SYSTEM
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ── 6. CREATE an auction for a model ──────────────────────
    // duration = how many seconds the auction lasts
    function createAuction(uint256 modelId, uint256 startPrice, uint256 duration)
        external
        modelExists(modelId)
        onlyModelOwner(modelId)
    {
        require(!models[modelId].isForSale,       "Delist before auctioning");
        require(!_isInActiveAuction(modelId),     "Already in auction");
        require(duration >= MIN_AUCTION_DURATION, "Duration too short");
        require(startPrice > 0,                   "Start price must be > 0");

        _auctionIds.increment();
        uint256 auctionId = _auctionIds.current();
        uint256 endTime   = block.timestamp + duration;

        auctions[auctionId] = Auction({
            modelId:       modelId,
            seller:        msg.sender,
            startPrice:    startPrice,
            highestBid:    0,
            highestBidder: address(0),
            endTime:       endTime,
            active:        true,
            ended:         false
        });

        modelToAuction[modelId] = auctionId;

        emit AuctionCreated(auctionId, modelId, msg.sender, startPrice, endTime);
    }

    // ── 7. PLACE a bid on an active auction ───────────────────
    function placeBid(uint256 auctionId)
        external
        payable
        nonReentrant
    {
        Auction storage auction = auctions[auctionId];

        require(auction.active,                          "Auction not active");
        require(block.timestamp < auction.endTime,       "Auction has ended");
        require(msg.sender != auction.seller,            "Seller cannot bid");
        require(msg.value >= auction.startPrice,         "Bid below start price");
        require(msg.value > auction.highestBid,          "Bid must beat current highest");

        // Refund the previous highest bidder automatically
        if (auction.highestBidder != address(0)) {
            pendingWithdrawals[auction.highestBidder] += auction.highestBid;
        }

        auction.highestBid    = msg.value;
        auction.highestBidder = msg.sender;

        emit BidPlaced(auctionId, msg.sender, msg.value);
    }

    // ── 8. END an auction (anyone can call once time is up) ───
    function endAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];

        require(auction.active,                    "Auction not active");
        require(!auction.ended,                    "Already ended");
        require(block.timestamp >= auction.endTime,"Auction still running");

        auction.active = false;
        auction.ended  = true;

        uint256 modelId = auction.modelId;
        modelToAuction[modelId] = 0;

        if (auction.highestBidder != address(0)) {
            // There was at least one bid — transfer the model
            uint256 salePrice   = auction.highestBid;
            address seller      = auction.seller;
            address creator     = models[modelId].creator;
            address winner      = auction.highestBidder;

            uint256 platformFee  = (salePrice * PLATFORM_PCT) / 100;
            uint256 royalty      = 0;
            uint256 sellerAmount = salePrice - platformFee;

            if (seller != creator) {
                royalty      = (salePrice * ROYALTY_PCT) / 100;
                sellerAmount = salePrice - platformFee - royalty;
            }

            // Transfer NFT to auction winner
            models[modelId].currentOwner = winner;
            models[modelId].totalSales  += 1;
            models[modelId].totalRevenue += salePrice;
            _transfer(seller, winner, modelId);

            _removeFromOwnedModels(seller, modelId);
            ownedModels[winner].push(modelId);

            pendingWithdrawals[seller]        += sellerAmount;
            pendingWithdrawals[platformOwner] += platformFee;

            if (royalty > 0) {
                pendingWithdrawals[creator] += royalty;
                emit RoyaltyPaid(modelId, creator, royalty);
            }

            emit ModelSold(modelId, seller, winner, salePrice, royalty, block.timestamp);
            emit AuctionEnded(auctionId, modelId, winner, salePrice);

        } else {
            // No bids — model goes back to owner with no sale
            emit AuctionEnded(auctionId, modelId, address(0), 0);
        }
    }

    // ── 9. WITHDRAW earned ETH ────────────────────────────────
    // Sellers, creators, and the platform call this to collect their ETH
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        pendingWithdrawals[msg.sender] = 0;

        // transfer() is safer than send() — reverts on failure
        payable(msg.sender).transfer(amount);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //   READ FUNCTIONS  (free to call — don't cost gas)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Get all models ever registered
    function getAllModels() external view returns (AIModel[] memory) {
        AIModel[] memory result = new AIModel[](_modelIds.current());
        for (uint256 i = 0; i < _modelIds.current(); i++) {
            result[i] = models[allModelIds[i]];
        }
        return result;
    }

    // Get all models currently listed for sale
    function getModelsForSale() external view returns (AIModel[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < allModelIds.length; i++) {
            if (models[allModelIds[i]].isForSale) count++;
        }
        AIModel[] memory result = new AIModel[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < allModelIds.length; i++) {
            if (models[allModelIds[i]].isForSale) {
                result[idx++] = models[allModelIds[i]];
            }
        }
        return result;
    }

    // Get all models owned by a specific wallet
    function getModelsByOwner(address owner) external view returns (AIModel[] memory) {
        uint256[] memory ids = ownedModels[owner];
        AIModel[] memory result = new AIModel[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = models[ids[i]];
        }
        return result;
    }

    // Get all reviews for a model
    function getReviews(uint256 modelId) external view returns (Review[] memory) {
        return modelReviews[modelId];
    }

    // Get average star rating for a model (returns value * 10 to avoid decimals)
    // e.g. 45 means 4.5 stars
    function getAverageRating(uint256 modelId) external view returns (uint256) {
        Review[] memory reviews = modelReviews[modelId];
        if (reviews.length == 0) return 0;
        uint256 total = 0;
        for (uint256 i = 0; i < reviews.length; i++) {
            total += reviews[i].rating;
        }
        return (total * 10) / reviews.length; // multiply by 10 for one decimal
    }

    // Get platform-wide statistics
    function getPlatformStats() external view returns (
        uint256 totalModels,
        uint256 totalSalesCount,
        uint256 totalVolumeWei,
        uint256 modelsForSale
    ) {
        totalModels     = _modelIds.current();
        uint256 salesCount = 0;
        uint256 volume     = 0;
        uint256 forSale    = 0;

        for (uint256 i = 0; i < allModelIds.length; i++) {
            AIModel memory m = models[allModelIds[i]];
            salesCount += m.totalSales;
            volume     += m.totalRevenue;
            if (m.isForSale) forSale++;
        }
        return (totalModels, salesCount, volume, forSale);
    }

    // Check how much ETH a wallet can withdraw
    function getPendingBalance(address wallet) external view returns (uint256) {
        return pendingWithdrawals[wallet];
    }

    // Total models registered so far
    function getTotalModels() external view returns (uint256) {
        return _modelIds.current();
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //   ADMIN FUNCTIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Transfer platform ownership to another address
    function transferPlatformOwnership(address newOwner) external onlyPlatformOwner {
        require(newOwner != address(0), "Invalid address");
        platformOwner = newOwner;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //   INTERNAL HELPERS  (private — only used inside contract)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    function _isInActiveAuction(uint256 modelId) internal view returns (bool) {
        uint256 auctionId = modelToAuction[modelId];
        if (auctionId == 0) return false;
        return auctions[auctionId].active;
    }

    function _removeFromOwnedModels(address owner, uint256 modelId) internal {
        uint256[] storage ids = ownedModels[owner];
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == modelId) {
                ids[i] = ids[ids.length - 1];
                ids.pop();
                break;
            }
        }
    }
}
