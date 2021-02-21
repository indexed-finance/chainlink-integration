const { keccak256 } = require('ethers/lib/utils');

const sha3 = (x) => keccak256(Buffer.from(x.slice(2), 'hex'));

async function mineBlock(timestamp) {
  return ethers.provider.send('evm_mine', timestamp ? [timestamp] : [])
}

async function deploy(contractName, ...args) {
  const Factory = await ethers.getContractFactory(contractName);
  return Factory.deploy(...args);
}

async function getTransactionTimestamp(tx) {
  const { blockHash } = await tx.wait();
  const { timestamp } = await ethers.provider.getBlock(blockHash);
  return timestamp;
}

async function fastForward(seconds) {
  await ethers.provider.send('evm_increaseTime', [seconds]);
  await mineBlock();
}

module.exports = {
  ChainlinkJobId: '6d1bfe27e7034b1d87b5270556b17277',
  OracleAddress: '0x7AFe1118Ea78C1eae84ca8feE5C65Bc76CcF879e',
  AaveAddress: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
  SnxAddress: '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F',
  LinkAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
  MinimumDelay: 0,
  MaximumAge: 86400,
  RequestTimeout: 3600,
  sha3,
  mineBlock,
  deploy,
  getTransactionTimestamp,
  fastForward
}