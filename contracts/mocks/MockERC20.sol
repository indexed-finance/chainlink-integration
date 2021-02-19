// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract MockERC20 is ERC20 {
  mapping(address => address) public delegateeByAddress;

  constructor(string memory name, string memory symbol) public ERC20(name, symbol) {}

  // Mocks WETH deposit fn
  function deposit() external payable {
    _mint(msg.sender, msg.value);
  }

  function getFreeTokens(address to, uint256 amount) public {
    _mint(to, amount);
  }

  /**
   * @dev transfer token to a contract address with additional data if the recipient is a contact.
   * @param _to The address to transfer to.
   * @param _value The amount to be transferred.
   * @param _data The extra data to be passed to the receiving contract.
   */
  function transferAndCall(address _to, uint _value, bytes memory _data)
    public
    returns (bool success)
  {
    super.transfer(_to, _value);
    return true;
  }
}