// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ChainlinkClient } from "@chainlink/contracts/src/v0.8/dev/ChainlinkClient.sol";
import { Chainlink } from "@chainlink/contracts/src/v0.8/dev/Chainlink.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

contract DAOracle is ChainlinkClient, AccessControl {
    using Chainlink for Chainlink.Request;

    mapping(uint256 => uint256) public confidence;
    string public lightClientURL;
    address public oracle;
    bytes32 public jobId;
    uint256 public fee;
    
    event LightClientUpdated(string old_, string new_);
    event OracleUpdated(address old_, address new_);
    event JobIdUpdated(bytes32 old_, bytes32 new_);
    event FeeUpdated(uint256 old_, uint256 new_);
    event BlockConfidence(uint256 indexed block_, uint256 confidence_);
    
    constructor(address token_) {
        setChainlinkToken(token_);
        lightClientURL = "https://polygon-da-light.matic.today/v1/confidence";
        oracle = 0x1cf7D49BE7e0c6AC30dEd720623490B64F572E17;
        jobId = 'b29e1e51ae054c42849407b3cc28690d';
        fee = 10 ** 16;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    function updateLightClientURL(string memory url_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit LightClientUpdated(lightClientURL, url_);
        lightClientURL = url_;
    }
    
    function updateOracle(address oracle_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit OracleUpdated(oracle, oracle_);
        oracle = oracle_;
    }
    
    function updateJobId(bytes32 jobId_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit JobIdUpdated(jobId, jobId_);
        jobId = jobId_;
    }
    
    function updateFee(uint256 fee_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit FeeUpdated(fee, fee_);
        fee = fee_;
    }
    
    function uint256ToStr(uint256 i_) internal pure returns (string memory) {
        if (i_ == 0) {
            return "0";
        }
        
        uint256 j = i_;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        
        bytes memory str = new bytes(length);
        j = i_;
        while (j != 0) {
            str[--length] = bytes1(uint8(48 + j % 10));
            j /= 10;
        }

        return string(str);
    }
    
    function getQueryURL(uint256 block_) internal view returns(string memory) {
        return string(abi.encodePacked(lightClientURL, "/", uint256ToStr(block_)));
    }
    
    function requestConfidence(uint256 block_) public returns(bytes32) {
        Chainlink.Request memory request = buildChainlinkRequest(jobId, address(this), this.setConfidence.selector);
        request.add("get", getQueryURL(block_));
        request.add("path", "result.serialisedConfidence");
        return sendChainlinkRequestTo(oracle, request, fee);
    }
    
    function deserialise(uint256 serialisedConfidence) internal pure returns (uint256, uint256) {
        uint256 mask = 0x00000000000000000000000000000000000000000000000000000000ffffffff;
        uint256 a = serialisedConfidence >> 32;
        uint256 b = serialisedConfidence & mask;
        
        return (a, b);
    }
    
    function setConfidence(bytes32 requestId_, uint256 confidence_) public recordChainlinkFulfillment(requestId_) {
        (uint256 block_, uint256 confFactor_) = deserialise(confidence_);
        confidence[block_] = confFactor_;
        emit BlockConfidence(block_, confFactor_);
    }
}
