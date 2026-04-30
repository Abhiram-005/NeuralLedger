// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AIModelRegistry {
    
    // Structure to store AI Model details
    struct AIModel {
        uint256 id;
        string name;
        string description;
        string modelHash;
        address owner;
        uint256 price;
        uint256 qualityScore;
        uint256 timestamp;
        bool isForSale;
    }

    // Store all models
    mapping(uint256 => AIModel) public models;
    uint256 public modelCount = 0;

    // Events
    event ModelRegistered(uint256 id, string name, address owner, uint256 timestamp);
    event ModelSold(uint256 id, address oldOwner, address newOwner, uint256 price);
    event ScoreUpdated(uint256 id, uint256 newScore);

    // Register a new AI Model
    function registerModel(
        string memory _name,
        string memory _description,
        string memory _modelHash,
        uint256 _price
    ) public {
        modelCount++;
        models[modelCount] = AIModel(
            modelCount,
            _name,
            _description,
            _modelHash,
            msg.sender,
            _price,
            0,
            block.timestamp,
            true
        );
        emit ModelRegistered(modelCount, _name, msg.sender, block.timestamp);
    }

    // Buy a model
    function buyModel(uint256 _id) public payable {
        AIModel storage model = models[_id];
        require(model.isForSale, "Model is not for sale");
        require(msg.value >= model.price, "Insufficient payment");
        require(msg.sender != model.owner, "You already own this model");

        address previousOwner = model.owner;
        model.owner = msg.sender;
        model.isForSale = false;

        payable(previousOwner).transfer(msg.value);
        emit ModelSold(_id, previousOwner, msg.sender, msg.value);
    }

    // Update quality score
    function updateQualityScore(uint256 _id, uint256 _score) public {
        require(_score <= 100, "Score must be between 0 and 100");
        models[_id].qualityScore = _score;
        emit ScoreUpdated(_id, _score);
    }

    // Get model details
    function getModel(uint256 _id) public view returns (AIModel memory) {
        return models[_id];
    }
}