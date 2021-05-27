// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IDAOracle {
    function requestConfidence(uint256 block_) external;
    function confidence(uint256 block_) external view returns (uint256, uint256, uint256, bool);
}
