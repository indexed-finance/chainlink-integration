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
    return keccak256(abi.encodePacked(_token));
  }

  function fulfill(bytes32 _requestId, uint256 _marketCap) external override {
    _fulfill(_requestId, _marketCap);
  }

  function testUrlDerivation() external pure {
    address testAddress = 0xf1f1f1F1f1f1F1F1f1F1f1F1F1F1F1f1F1f1f1F1;
    string memory expectedUrl = "https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=0xf1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1&vs_currencies=eth&include_market_cap=true";
    string memory realUrl = getCoingeckoMarketCapUrl(
      addressToString(testAddress)
    );
    require(
      keccak256(abi.encode(expectedUrl)) == keccak256(abi.encode(realUrl)),
      "Generated URL does not match expected URL"
    );
  }
}