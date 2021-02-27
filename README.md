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

### Kovan
LINK 0xa36085F69e2889c224210F603D836748e7dC0088
Oracle 0x2f90A6D021db21e1B2A077c5a37B3C7E75D15b7e
JobID 29fa9aa13bf1468788b7cc4a500a45b8

### Rinkeby
LINK 0x01be23585060835e02b77ef475b0cc51aa1e0709
Oracle 0x7AFe1118Ea78C1eae84ca8feE5C65Bc76CcF879e
JobID 6d1bfe27e7034b1d87b5270556b17277

### Mainnet
NOTE: for the node provider and job id you can choose from a list of various providers from https://market.link/
LINK 0x514910771AF9Ca656af840dff83E8264EcF986CA
Oracle 0x240BaE5A27233Fd3aC5440B5a598467725F7D1cd
JobID 1bc4f827ff5942eaaa7540b7dd1e20b9
