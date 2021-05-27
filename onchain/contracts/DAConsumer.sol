// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import { LinkTokenInterface } from "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";
import { IDAOracle } from "./IDAOracle.sol";

contract DAConsumer {
    address public token;
    address public oracle;
    event BlockConfidence(uint256 indexed block_, uint256 max, uint256 min, uint256 latest, bool requested);
    
    constructor(address token_, address oracle_) {
        token = token_;
        oracle = oracle_;
    }
    
    function approved() external view returns (uint256) {
        return LinkTokenInterface(token).allowance(address(this), oracle);
    }
    
    function balance() external view returns (uint256) {
        return LinkTokenInterface(token).balanceOf(address(this));
    }
    
    function approve(uint256 amount_) external {
        require(LinkTokenInterface(token).approve(oracle, amount_), "LINK token approval failed");
    }
    
    function requestDABlockConfidence(uint256 block_) external {
        IDAOracle(oracle).requestConfidence(block_);
    }
    
    function queryDABlockConfidence(uint256 block_) external {
        (uint256 max, uint256 min, uint256 latest, bool requested) = IDAOracle(oracle).confidence(block_);
        emit BlockConfidence(block_, max, min, latest, requested);
    }
}
