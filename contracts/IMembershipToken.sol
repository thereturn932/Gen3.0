// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IMVPMembershipToken {
    function updatePool(address from, address to) external;

    function depositPool() external payable;
}
