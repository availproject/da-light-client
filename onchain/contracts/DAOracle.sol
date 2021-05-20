// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ChainlinkClient } from "@chainlink/contracts/src/v0.8/dev/ChainlinkClient.sol";
import { Chainlink } from "@chainlink/contracts/src/v0.8/dev/Chainlink.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

contract DAOracle is ChainlinkClient, AccessControl {
    using Chainlink for Chainlink.Request;

    struct LightClient {
        string url;
        bool use;
        bool exists;
    }
    struct Confidence {
        uint256[] values;
        uint256 max;
        uint256 min;
        bool exists;
    }
    mapping(uint256 => Confidence) public confidence;
    mapping(bytes32 => LightClient) public jobs;
    bytes32[] public jobList;
    address public oracle;
    uint256 public fee;
    
    event LightClientUpdated(bytes32 jobId, string url, bool enabled);
    event OracleUpdated(address old_, address new_);
    event FeeUpdated(uint256 old_, uint256 new_);
    event BlockConfidence(uint256 indexed block_, uint256 confidence_);
    event BlockConfidenceRequest(uint256 indexed block_, bytes32 requestId_);
    
    constructor(address token_) {
        setChainlinkToken(token_);

        oracle = 0x1cf7D49BE7e0c6AC30dEd720623490B64F572E17;
        fee = 10 ** 16;
        jobs['b29e1e51ae054c42849407b3cc28690d'] = LightClient("https://polygon-da-light.matic.today/v1/confidence", true, true);
        jobList.push('b29e1e51ae054c42849407b3cc28690d');

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    function updateLightClient(bytes32 jobId_, string memory url_, bool use_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        LightClient memory lc = jobs[jobId_];
        if(!lc.exists) {
            require(use_, "Light client not yet registered");
            jobs[jobId_] = LightClient(url_, use_, true);
            jobList.push(jobId_);

            emit LightClientUpdated(jobId_, url_, use_);
            return;
        }
    
        if(lc.use) {
            require(!use_, "Light client already in use");
            lc.url = url_;
            lc.use = use_;
            jobs[jobId_] = lc;
            
            emit LightClientUpdated(jobId_, url_, use_);
            return;
        }
        
        require(use_, "Light client not in use");
        lc.url = url_;
        lc.use = use_;
        jobs[jobId_] = lc;

        emit LightClientUpdated(jobId_, url_, use_);
    }
    
    function updateOracle(address oracle_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit OracleUpdated(oracle, oracle_);
        oracle = oracle_;
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

    function getQueryURL(string memory url, uint256 block_) internal pure returns(string memory) {
        return string(abi.encodePacked(url, "/", uint256ToStr(block_)));
    }

    function requestConfidence(uint256 block_) public {
        for(uint256 i = 0; i < jobList.length; i++) {
            bytes32 jobId = jobList[i];
            LightClient memory lc = jobs[jobId];
            if(!lc.use) {
                continue;
            }

            Chainlink.Request memory request = buildChainlinkRequest(jobId, address(this), this.setConfidence.selector);
            request.add("get", getQueryURL(lc.url, block_));
            request.add("path", "result.serialisedConfidence");
            bytes32 requestId = sendChainlinkRequestTo(oracle, request, fee);
            
            emit BlockConfidenceRequest(block_, requestId);
        }
    }

    function deserialise(uint256 serialisedConfidence) internal pure returns (uint256, uint256) {
        uint256 mask = 0x00000000000000000000000000000000000000000000000000000000ffffffff;
        uint256 a = serialisedConfidence >> 32;
        uint256 b = serialisedConfidence & mask;
        
        return (a, b);
    }

    function getMinMax(uint256 prevMin, uint256 prevMax, uint256 newVal) internal pure returns (uint256, uint256) {
        uint256 min;
        uint256 max;
        
        if(prevMin > newVal) {
            min = newVal;
        }
        
        if(prevMax < newVal) {
            max = newVal;
        }
        
        return (min, max);
    }

    function setConfidence(bytes32 requestId_, uint256 confidence_) public recordChainlinkFulfillment(requestId_) {
        (uint256 block_, uint256 confFactor_) = deserialise(confidence_);

        Confidence memory conf = confidence[block_];
        if(!conf.exists) {
            confidence[block_] = Confidence(new uint256[](0), confFactor_, confFactor_, true);
            confidence[block_].values.push(confFactor_);
            
            emit BlockConfidence(block_, confFactor_);
            return;
        }

        (uint256 min, uint256 max) = getMinMax(conf.min, conf.max, confFactor_);
        confidence[block_].values.push(confFactor_);
        confidence[block_].max = max;
        confidence[block_].min = min;

        emit BlockConfidence(block_, confFactor_);
    }
}
