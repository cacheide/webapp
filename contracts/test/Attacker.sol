// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IEscrow { function createDeal(address, uint64) external payable returns (uint256); function reclaim(uint256) external; }
/// Malicious buyer: re-enters reclaim() from receive().
contract Attacker {
    IEscrow public e; uint256 public id; uint256 public hits;
    constructor(address _e) { e = IEscrow(_e); }
    function open(address seller, uint64 dl) external payable { id = e.createDeal{value: msg.value}(seller, dl); }
    function attack() external { e.reclaim(id); }
    receive() external payable { hits++; try e.reclaim(id) {} catch {} }
}
/// Malicious seller: refuses payment.
contract Rejecter { receive() external payable { revert(); } }
