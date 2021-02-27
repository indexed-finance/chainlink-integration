pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../CirculatingMarketCapOracle.sol";


contract MockCirculatingMarketCapOracle is CirculatingMarketCapOracle {
  constructor(
    uint256 _delay,
    uint256 _maximumAge,
    uint256 _requestTimeout,
    address _oracle,
    bytes32 _jobID,
    address _link
  )
    public
    CirculatingMarketCapOracle(_delay, _maximumAge, _requestTimeout, _oracle, _jobID, _link)
  {}

  function requestCoinGeckoData(address _token) internal override returns (bytes32 requestId) {
    (string memory url, string memory key) = getCoingeckoMarketCapUrlAndKey(_token);
    return keccak256(abi.encodePacked(url, key));
  }

  function fulfill(bytes32 _requestId, uint256 _marketCap) external override {
    _fulfill(_requestId, _marketCap);
  }
}