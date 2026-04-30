const AIModelRegistry = artifacts.require("AIModelRegistry");

module.exports = function (deployer) {
  deployer.deploy(AIModelRegistry);
};