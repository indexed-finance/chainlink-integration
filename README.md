# Chainlink-Integration
Smart contracts for querying circulating market caps from Coingecko through Chainlink.

This contract:
  - can receive a list of tokens to be whitelisted for price updates (only owner)
  - uses chainlink to query the CoinGecko API for token marketcap
  - persists the result into a mapping for querying

Rinkeby deployments:

0xb3D69BC4951348e322717A3728D7f67578ecAD31
https://rinkeby.etherscan.io/address/0xb3D69BC4951348e322717A3728D7f67578ecAD31


Setting up for dev:

1. Install packages and dependencies:

`npm install`

2. Run tests:

`npx hardhat test`
