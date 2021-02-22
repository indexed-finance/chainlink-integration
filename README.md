# Chainlink-Integration

Smart contracts for querying circulating market caps from Coingecko through Chainlink.

This contract:
- can receive a list of tokens to be whitelisted for price updates (only owner)
- uses chainlink to query the CoinGecko API for token marketcap
- persists the result into a mapping for querying

## Install

`npm install`

## Scripts

### Test
`npm run test`

### Generate Coverage Report
`npm run coverage`

### Compile Solidity Files
`npm run build`

## Configuration Values

### Rinkeby
oracle = 0x7AFe1118Ea78C1eae84ca8feE5C65Bc76CcF879e;
jobId = '6d1bfe27e7034b1d87b5270556b17277';

### Mainnet
NOTE: for the node provider and job id you can choose from a list of various providers from https://market.link/
oracle = 0x240BaE5A27233Fd3aC5440B5a598467725F7D1cd;
jobId = '1bc4f827ff5942eaaa7540b7dd1e20b9';
