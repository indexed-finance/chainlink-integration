pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

// IMPORTS
import '@chainlink/contracts/src/v0.6/ChainlinkClient.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../interfaces/ICirculatingMarketCapOracle.sol';

// Mock example taken from - https://github.com/tweether-protocol/tweether/blob/master/contracts/mocks/MockOracleClient.sol
contract ChainlinkMcapMock is Ownable, ChainlinkClient, ICirculatingMarketCapOracle {
  /// @notice the chainlink job id
  bytes32 jobId;

  /// @notice the chainlink node
  address public oracle;

  /// @notice global minium delay
  uint256 public minimumDelay;

  /// @notice chainlink fee
  uint256 public fee = 0.1 * 10 ** 18; // 0.1 LINK


  /// @notice struct for chainlink tokens info
  struct tokenDetails {
    uint256 marketcap;
    uint256 lastPriceTimestamp;
    bool whitelisted;
  }

  /// @notice mapping for address to tokenDetails
  mapping (address => tokenDetails) public tokenMap;

  /// @notice request map to store the token address and the Chainlink id
  mapping(bytes32 => address) public pendingRequestMap;

  /**
  * @dev Constructor
  * @param _delay   Minimum delay in seconds before token price can be updated again
  * @param _oracle  Chainlink oracle address
  * @param _jobId   Chainlink job id
  */
  constructor(uint256 _delay, address _oracle, bytes32 _jobId) public {
    // setPublicChainlinkToken();

    minimumDelay = _delay;
    oracle = _oracle;
    jobId = _jobId;
  }

  /**
  * @dev Internal function to convert an address to a string memory
  */
  function addressToString(address _addr) internal pure returns(string memory) {
    bytes32 value = bytes32(uint256(_addr));
    bytes memory alphabet = '0123456789abcdef';

    bytes memory str = new bytes(42);
    str[0] = '0';
    str[1] = 'x';
    for (uint256 i = 0; i < 20; i++) {
      str[2+i*2] = alphabet[uint8(value[i + 12] >> 4)];
      str[3+i*2] = alphabet[uint8(value[i + 12] & 0x0f)];
    }
    return string(str);
  }

  /**
  * @dev check if a certain price can be updated
  * returns bool
  */
  function canUpdatePrice(address _token) public view returns (bool) {
    return tokenMap[_token].lastPriceTimestamp + minimumDelay < now;
  }

  /**
  * @dev Updates the tokens from the token list
  * checks if the prices are in the time limit so they can be updated
  * calls the chainlink request function
  */
  function updateCirculatingMarketCaps(address[] calldata _tokenAddresses) override external {
    for (uint256 i = 0; i < _tokenAddresses.length; i++){
      // check if token is whitelisted
      require(tokenMap[_tokenAddresses[i]].whitelisted, 'ChainlinkMcap: Token is not whitelisted');

      // check if we can update the price
      require(canUpdatePrice(_tokenAddresses[i]), 'ChainlinkMcap: Minimum delay not reached');

      //start chainlink call
      // requestCoinGeckoData(_tokenAddresses[i]);
    }
  }

  function getCirculatingMarketCap(address _tokenAddress) override external view returns (uint256){
    return tokenMap[_tokenAddress].marketcap;
  }

  function getCirculatingMarketCaps(address[] calldata _tokenAddresses) override external view returns (uint256[] memory){
    uint256[] memory marketcaps = new uint256[](_tokenAddresses.length);
    for (uint256 i = 0; i < _tokenAddresses.length; i++){
      marketcaps[i] = tokenMap[_tokenAddresses[i]].marketcap;
    }

    return marketcaps;
  }

  /**
  * @dev Create a Chainlink request to retrieve API response, find the target
  * data, then multiply 10^6 to get rid of the decimal.
  * returns the request id for the node operator
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
  */
  function requestCoinGeckoData(address _contractAddress) internal returns (bytes32 requestId) {
    Chainlink.Request memory request = buildChainlinkRequest(jobId, address(this), this.fulfill.selector);

    string memory contractAddressString = addressToString(_contractAddress);

    // Build the CoinGecko request URL
    string memory requestString = string(abi.encodePacked('https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=', contractAddressString, '&vs_currencies=usd&include_market_cap=true'));

    // Set the request object to perform a GET request with the constructed URL
    request.add('get', requestString);

    // Build path to parse JSON response from CoinGecko
    // e.g. '0x514910771af9ca656af840dff83e8264ecf986ca.usd_market_cap'
    string memory pathString = string(abi.encodePacked(contractAddressString, '.usd_market_cap'));
    request.add('path', pathString);

    // Multiply by 18 decimal places even though CoinGecko returns usd_marketcap w/ precision of 6 decimal places.
    // This prevents the edge case where we truncate too much if CoinGecko decides to return < 6 decimal places.
    int multiplyAmount = 10**18;
    request.addInt('times', multiplyAmount);

    // Sends the request
    bytes32 requestid = sendChainlinkRequestTo(oracle, request, fee);

    // Add requestId to pendingRequest
    pendingRequestMap[requestid] = _contractAddress;
    return requestid;
  }

  /**
  * @dev Callback function for Chainlink node. Updates the token mapping and removes the request from pendingRequestMap
  */
  function fulfill(bytes32 _requestId, uint256 _marketcap) public recordChainlinkFulfillment(_requestId) {
    address tokenAddress = pendingRequestMap[_requestId];

    tokenMap[tokenAddress].lastPriceTimestamp = now;
    tokenMap[tokenAddress].marketcap = _marketcap;

    delete pendingRequestMap[_requestId];
  }

  function fulfillMock(address _tokenAddress, uint256 _marketcap) public {
    tokenMap[_tokenAddress].lastPriceTimestamp = now;
    tokenMap[_tokenAddress].marketcap = _marketcap;
  }

  /**
   * @dev Receive back all link token which were sent to the contract
   */
  function withdrawLink() public onlyOwner {
    // IERC20 linkToken = IERC20(chainlinkTokenAddress());
    // linkToken.transfer(owner(), linkToken.balanceOf(address(this)));
  }

  /**
   * @dev Gets a list of addresses
   *
   * Adds all the tokens from the list to the global whitelist
   * only owner can call this
   */
  function addTokensToWhitelist(address[] memory _whitelist) public onlyOwner {
    for (uint256 i = 0; i < _whitelist.length; i++){
      tokenMap[_whitelist[i]].whitelisted = true;
    }
  }

  /**
   * @dev Gets a list of addresses
   *
   * Removes all tokens in the list from thr gloval whitelist
   * only owner can call this
   */
  function removeTokensFromWhitelist(address[] memory _whitelist) public onlyOwner {
    for (uint256 i = 0; i < _whitelist.length; i++){
      delete tokenMap[_whitelist[i]];
    }
  }

  /**
  * Adds the token whitelist
  */
  function setMinimumDelay(uint _newDelay) public onlyOwner {
    minimumDelay = _newDelay;
    emit newMinimumDelay(_newDelay);
  }

  /**
  * Changes the chainlink node operator fee to be sent
  */
  function setChainlinkNodeFee(uint _newFee) public onlyOwner {
    fee = _newFee;
  }

  // Events
  event tokenAdded(address);
  event tokenRemoved(address);
  event newMinimumDelay(uint);
}
