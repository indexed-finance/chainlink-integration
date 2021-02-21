//SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

// IMPORTS
import "@chainlink/contracts/src/v0.6/ChainlinkClient.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/ICirculatingMarketCapOracle.sol";


contract CirculatingMarketCapOracle is Ownable, ChainlinkClient, ICirculatingMarketCapOracle {
/* ==========  Events  ========== */

  event TokenAdded(address token);
  event TokenRemoved(address token);
  event NewMinimumDelay(uint256 minimumDelay);
  event NewTimeToExpire(uint256 timeToExpire);
  event NewChainlinkFee(uint256 fee);

/* ==========  Structs  ========== */

  struct TokenDetails {
    bool whitelisted;
    bool hasPendingRequest;
    uint32 lastPriceTimestamp;
    uint208 marketCap;
  }

/* ==========  Storage  ========== */

  /** @dev Minimum delay between Chainlink queries for a token's market cap */
  uint256 public minimumDelay;
  /** @dev Maximum age of a market cap value that can be queried */
  uint256 public timeToExpire;
  /** @dev Amount of LINK paid for each query */
  uint256 public fee = 1e17; // 0.1 LINK
  /** @dev Address of the Chainlink node */
  address public oracle;
  /** @dev Chainlink job ID */
  bytes32 public jobId;

  mapping(address => TokenDetails) public getTokenDetails;
  mapping(bytes32 => address) public pendingRequestMap;

  /**
  * @dev Constructor
  * @param _minimumDelay Minimum delay in seconds before token price can be updated again.
  * @param _timeToExpire Maximum age of a market cap record that can be queried.
  * @param _oracle Chainlink oracle address.
  * @param _jobId Chainlink job id.
  * @param _link Chainlink token address.
  */
  constructor(
    uint256 _minimumDelay,
    uint256 _timeToExpire,
    address _oracle,
    bytes32 _jobId,
    address _link
  ) public Ownable() {
    minimumDelay = _minimumDelay;
    timeToExpire = _timeToExpire;
    oracle = _oracle;
    jobId = _jobId;
    setChainlinkToken(_link);
  }

/* ==========  Public Actions  ========== */

  /**
   * @dev Requests the market caps for a set of tokens from Chainlink.
   *
   * Note: If token is not whitelisted, this function will revert.
   * If the token already has a pending request, or the last update is too
   * recent, this will not revert but a new request will not be created.
   */
  function updateCirculatingMarketCaps(address[] calldata _tokenAddresses) external override {
    for (uint256 i = 0; i < _tokenAddresses.length; i++) {
      address token = _tokenAddresses[i];
      TokenDetails storage details = getTokenDetails[token];
      // If token is not whitelisted, don't pay to update it.
      require(details.whitelisted, "CirculatingMarketCapOracle: Token is not whitelisted");
      // If token already has a pending update request, or the last update is too
      // new, fail gracefully.
      if (
        details.hasPendingRequest ||
        now - details.lastPriceTimestamp < minimumDelay
      ) {
        continue;
      }
      details.hasPendingRequest = true;
      // Execute Chainlink request
      bytes32 requestId = requestCoinGeckoData(_tokenAddresses[i]);
      // Map requestId to the token address
      pendingRequestMap[requestId] = token;
    }
  }

/* ==========  Market Cap Queries  ========== */

  /**
   * @dev Query the latest circulating market caps for a set of tokens.
   *
   * Note: Reverts if any of the tokens has no stored market cap or if the last
   * market cap is older than `timeToExpire` seconds.
   *
   * @param tokens Addresses of tokens to get market caps for.
   * @return marketCaps Array of latest markets cap for tokens
   */
  function getCirculatingMarketCaps(address[] calldata tokens)
    external
    view
    override
    returns (uint256[] memory marketCaps)
  {
    uint256 len = tokens.length;
    marketCaps = new uint256[](len);

    for (uint256 i = 0; i < len; i++) {
      marketCaps[i] = getCirculatingMarketCap(tokens[i]);
    }
  }

  /**
   * @dev Query the latest circulating market cap for a token.
   *
   * Note: Reverts if the token has no stored market cap or if the last
   * market cap is older than `timeToExpire` seconds.
   *
   * @param token Address of token to get market cap for.
   * @return uint256 of latest market cap for token
   */
  function getCirculatingMarketCap(address token) public view override returns (uint256) {
    require(
      now - getTokenDetails[token].lastPriceTimestamp < timeToExpire,
      "CirculatingMarketCapOracle: Marketcap has expired"
    );

    return getTokenDetails[token].marketCap;
  }

  /**
   * @dev Check if a token is whitelisted.
   * @param token Address to check
   * @return boolean indicating whether token is whitelisted
   */
  function isTokenWhitelisted(address token) external view override returns (bool) {
    return getTokenDetails[token].whitelisted;
  }

/* ==========  Chainlink Functions  ========== */

  /**
  * @dev Create a Chainlink request to retrieve API response, find the target
  * data, then multiply 1e18 to normalize the value as a token amount.
  *
  * CoinGecko API Example:
  * {
  *   '0x514910771af9ca656af840dff83e8264ecf986ca': {
  *   'usd': 23.01,
  *   'usd_market_cap': 9362732898.302298
  *     }
  *   }
  *
  * https://docs.chain.link/docs/make-a-http-get-request#api-consumer
  *
  * @param _token Address of the token to query the circulating market cap of.
  * @return requestId The request id for the node operator
  */
  function requestCoinGeckoData(address _token) internal virtual returns (bytes32 requestId) {
    Chainlink.Request memory request = buildChainlinkRequest(
      jobId,
      address(this),
      this.fulfill.selector
    );

    string memory contractAddressString = addressToString(_token);

    // Build the CoinGecko request URL
    string memory url = getCoingeckoMarketCapUrl(contractAddressString);

    // Set the request object to perform a GET request with the constructed URL
    request.add("get", url);

    // Build path to parse JSON response from CoinGecko
    // e.g. '0x514910771af9ca656af840dff83e8264ecf986ca.eth_market_cap'
    string memory pathString = string(abi.encodePacked("0x", contractAddressString, ".eth_market_cap"));
    request.add("path", pathString);

    // Multiply by 1e18 to format the number as an ether value in wei.
    request.addInt("times", 1e18);

    // Sends the request
    requestId = sendChainlinkRequestTo(oracle, request, fee);
  }

  /**
  * @dev Callback function for Chainlink node.
  * Updates the token mapping and removes the request from pendingRequestMap
  */
  function fulfill(bytes32 _requestId, uint256 _marketCap) external virtual recordChainlinkFulfillment(_requestId) {
    // Wraps the internal function to simplify automated testing with mocks.
    _fulfill(_requestId, _marketCap);
  }

  function _fulfill(bytes32 _requestId, uint256 _marketCap) internal {
    address tokenAddress = pendingRequestMap[_requestId];

    getTokenDetails[tokenAddress].lastPriceTimestamp = uint32(now);
    getTokenDetails[tokenAddress].marketCap = _safeUint208(_marketCap);
    getTokenDetails[tokenAddress].hasPendingRequest = false;

    delete pendingRequestMap[_requestId];
  }

/* ==========  Control Functions  ========== */

  /**
   * @dev Withdraw Link tokens in contract to owner address
   */
  function withdrawLink() external onlyOwner {
    IERC20 linkToken = IERC20(chainlinkTokenAddress());
    linkToken.transfer(owner(), linkToken.balanceOf(address(this)));
  }

  /**
   * @dev Whitelist a list of token addresses
   */
  function addTokensToWhitelist(address[] calldata _tokens) external onlyOwner {
    uint256 len = _tokens.length;
    for (uint256 i = 0; i < len; i++) {
      address token = _tokens[i];
      getTokenDetails[token].whitelisted = true;
      emit TokenAdded(token);
    }
  }

  /**
   * @dev Remove a list of token addresses from whitelist
   */
  function removeTokensFromWhitelist(address[] calldata _tokens) external onlyOwner {
    for (uint256 i = 0; i < _tokens.length; i++){
      address token = _tokens[i];
      getTokenDetails[token].whitelisted = false;
      emit TokenRemoved(token);
    }
  }

  /**
   * @dev Change minimumDelay
   */
  function setMinimumDelay(uint256 _newDelay) external onlyOwner {
    minimumDelay = _newDelay;
    emit NewMinimumDelay(_newDelay);
  }

  /**
   * @dev Change timeToExpire
   */
  function setTimeToExpire(uint256 _timeToExpire) external onlyOwner {
    timeToExpire = _timeToExpire;
    emit NewTimeToExpire(_timeToExpire);
  }

  /**
  * @dev Changes the chainlink node operator fee to be sent
  */
  function setChainlinkNodeFee(uint256 _fee) external onlyOwner {
    fee = _fee;
    emit NewChainlinkFee(_fee);
  }

/* ==========  Utility Functions  ========== */

  /**
   * @dev Internal function to convert an address to a string memory
   */
  function addressToString(address _addr) public pure returns(string memory) {
    bytes32 value = bytes32(uint256(_addr));
    bytes memory alphabet = "0123456789abcdef";

    bytes memory str = new bytes(40);
    for (uint256 i = 0; i < 20; i++) {
      str[i*2] = alphabet[uint8(value[i + 12] >> 4)];
      str[1 + i*2] = alphabet[uint8(value[i + 12] & 0x0f)];
    }
    return string(str);
  }

  function getCoingeckoMarketCapUrl(string memory contractAddressString) public pure returns (string memory url) {
    url = string(
      abi.encodePacked(
        "https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=0x",
        contractAddressString,
        "&vs_currencies=eth&include_market_cap=true"
      )
    );
  }

  function _safeUint208(uint256 x) internal pure returns (uint208 y) {
    y = uint208(x);
    require(x == y, "CirculatingMarketCapOracle: uint exceeds 208 bits");
  }
}
