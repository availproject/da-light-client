// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ChainlinkClient } from "@chainlink/contracts/src/v0.8/dev/ChainlinkClient.sol";
import { Chainlink } from "@chainlink/contracts/src/v0.8/dev/Chainlink.sol";

contract DAOracle is ChainlinkClient {
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
        jobId = 'a8c5f4e776d845e68d4ac724b7765994';
        fee = 10 ** 16;
    }

    function updateLightClientURL(string memory url_) public {
        emit LightClientUpdated(lightClientURL, url_);
        lightClientURL = url_;
    }
    
    function updateOracle(address oracle_) public {
        emit OracleUpdated(oracle, oracle_);
        oracle = oracle_;
    }
    
    function updateJobId(bytes32 jobId_) public {
        emit JobIdUpdated(jobId, jobId_);
        jobId = jobId_;
    }
    
    function updateFee(uint256 fee_) public {
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
    
    function deserialise(bytes32 serialisedConfidence) internal pure returns (uint256, uint256) {
        bytes32 mask = 0x00000000000000000000000000000000000000000000000000000000ffffffff;
        bytes32 a = serialisedConfidence >> 32;
        bytes32 b = serialisedConfidence & mask;
        
        return (uint256(a), uint256(b));
    }
    
    function setConfidence(bytes32 requestId_, bytes32 confidence_) public recordChainlinkFulfillment(requestId_) {
        (uint256 block_, uint256 confFactor_) = deserialise(confidence_);
        confidence[block_] = confFactor_;
        emit BlockConfidence(block_, confFactor_);
    }
}
