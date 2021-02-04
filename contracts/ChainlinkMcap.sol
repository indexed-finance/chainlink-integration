//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

// IMPORTS
import "@chainlink/contracts/src/v0.6/ChainlinkClient.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// CONTRACT CODE
contract ChainlinkMcap is Ownable, ChainlinkClient {

  // RINKEBY CONFIG
  /// @notice the chainlink node
  address public oracle = 0x7AFe1118Ea78C1eae84ca8feE5C65Bc76CcF879e;

  /// @notice the chainlink job id
  bytes32 job_id = "6d1bfe27e7034b1d87b5270556b17277";

  // MAINNET CONFIG
  // NOTE: for the node provider and job id you can choose from a list of various providers from https://market.link/
  /// @notice the chainlink node linkpool linkpool.io
  //address public oracle = 0x240BaE5A27233Fd3aC5440B5a598467725F7D1cd;

  /// @notice the chainlink job id  --> maybe have to contact node operator to get whitelisted for requests
  //bytes32 job_id = "1bc4f827ff5942eaaa7540b7dd1e20b9";

  /// @notice chainlink fee
  uint256 public fee = 0.1 * 10 ** 18; // 0.1 LINK

  /// @notice struct for chainlink tokens info
  struct tokenDetails {
    uint marcetcap;
    uint lastPriceTimestamp;
    bool whitelisted;
  }

  /// @notice mapping for address to tokenDetails
  mapping (address => tokenDetails) public tokenmap;

  /// @notice global minium delay
  uint256 public minimumDelay;

  /// @notice request map to store the token address and the chinlink id
  mapping(bytes32 => address) public requestsmap;

  /**
  * @dev Constructor
  * takes 1 argument: minimum delay before price can be updated
  */
  constructor(uint256 delay) public {
    // get link token address and set minimum delay
    setPublicChainlinkToken();
    minimumDelay = delay;
  }

  /**
  * @dev Internal function to convert an address to a string memory
  */
  function addressToString(address _addr) internal pure returns(string memory)
  {
    bytes32 value = bytes32(uint256(_addr));
    bytes memory alphabet = "0123456789abcdef";

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
  function canUpdatePrice(address token) public view returns (bool)
  {
    uint lasttokenupdate = tokenmap[token].lastPriceTimestamp;
    if (lasttokenupdate + minimumDelay < now)
    {
      return true;
    }
    return false;
  }

  /**
  * @dev Updates the tokens from the token list
  * checks if the prices are in the time limit so they can be updated
  * calls the chainlink request function
  */
  function updateTokenMarketCaps(address[] memory tokens) public
  {

    for (uint256 i = 0; i < tokens.length; i++)
    {
      // get last update of token
      uint lasttokenupdate = tokenmap[tokens[i]].lastPriceTimestamp;

      // check if token is whitelisted
      require(tokenmap[tokens[i]].whitelisted == true, "ChainlinkMcap: Token is not whitelisted");

      // check if we can update the price
      require(lasttokenupdate + minimumDelay < now, "ChainlinkMcap: Minimum Delay not reached");

      //start chainlink call
      requestCoinGeckoData(tokens[i]);
    }
  }

  /**
  * @dev Create a Chainlink request to retrieve API response, find the target
  * data, then multiply by 1000000000000000000 (to remove decimal places from data).
  * returns the request id for the node operator
  */
  function requestCoinGeckoData(address contractAddress) internal returns (bytes32 requestId)
  {
    Chainlink.Request memory request = buildChainlinkRequest(job_id, address(this), this.fulfill.selector);

    // get the string of the address
    string memory contractAddressString = addressToString(contractAddress);

    // build together the request string for the chainlink api call
    string memory requestString = string(abi.encodePacked("https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=", contractAddressString, "&vs_currencies=usd&include_market_cap=true"));

    // Set the URL to perform the GET request on
    request.add("get", requestString);

     // Set the path to find the desired data in the API response, where the response format is:
     // {
     //   "0x514910771af9ca656af840dff83e8264ecf986ca": {
     //   "usd": 23.01,
     //   "usd_market_cap": 9362732898.302298
     //     }
     //   }

    //build path for request back
    string memory pathString = string(abi.encodePacked(contractAddressString, ".usd_market_cap"));
    request.add("path", pathString);

    // Multiply the result by 1000000000000000000 to remove decimals
    int timesAmount = 10**18;
    request.addInt("times", timesAmount);

    // Sends the request
    bytes32 requestid = sendChainlinkRequestTo(oracle, request, fee);

    // add request id to the map
    requestsmap[requestid] = contractAddress;
    return requestid;
  }

  /**
  * @dev Receive the callback from the chainlink node
  * checkd the global request map for the token address mapping and stores tha values
  *
  */
  function fulfill(bytes32 _requestId, uint256 _marketcap) public recordChainlinkFulfillment(_requestId)
  {
    address tokenToUpdate = requestsmap[_requestId];

    tokenmap[tokenToUpdate].lastPriceTimestamp = now;
    tokenmap[tokenToUpdate].marcetcap = _marketcap;

    delete requestsmap[_requestId];
  }

  /**
   * @dev Receive back all link token which were sent to the contract
   *
   * only owner can call this
   */
  function withdrawLink() public onlyOwner
  {
    IERC20 link = IERC20(chainlinkTokenAddress());
    uint256 linkBalance = link.balanceOf(address(this));
    address owner = owner();
    link.transfer(owner,linkBalance);
  }

  /**
   * @dev Gets a list of addresses
   *
   * Adds all the tokens from the list to the global whitelist
   * only owner can call this
   */
  function addTokensToWhitelist(address[] memory whitelist) public onlyOwner
  {
    for (uint256 i = 0; i < whitelist.length; i++)
    {
      tokenmap[whitelist[i]].whitelisted = true;
    }
  }

  /**
   * @dev Gets a list of addresses
   *
   * Removes all tokens in the list from thr gloval whitelist
   * only owner can call this
   */
  function removeTokensFromWhitelist(address[] memory whitelist) public onlyOwner
  {
    for (uint256 i = 0; i < whitelist.length; i++)
    {
      delete tokenmap[whitelist[i]];
    }
  }

  /**
  * Adds the token whitelist
  */
  function setMinimumDelay(uint newdelay) public onlyOwner
  {
    minimumDelay = newdelay;
    emit newMinimumDelay(newdelay);
  }

  /**
  * Changes the chainlink node operator fee to be sent
  */
  function setChainlinkNodeFee(uint newfee) public onlyOwner
  {
    fee = newfee;
  }

  // Events
  event tokenAdded(address);
  event tokenRemoved(address);
  event newMinimumDelay(uint);
}
