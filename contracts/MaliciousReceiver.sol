// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMyToken {
    function requestWithdrawal(address to, uint256 amount) external;
}

contract MaliciousReceiver {
    IMyToken public token;

    function setTokenAddress(address _token) external {
        token = IMyToken(_token);
    }

    // This function will be called by the test
    function attack(uint256 amount) external {
        token.requestWithdrawal(address(this), amount);
    }

    // Optionally, implement receive() or fallback() to try reentrancy
    receive() external payable {
        // Try to re-enter if needed
    }
}