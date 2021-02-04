// this testcase can be run from within hardhat network with mainnet forking
// imports
const {expect} = require("chai");
const {waffle} = require("hardhat");
const { ethers } = require("hardhat");
const {deployContract, solidity} = waffle;
const provider = waffle.provider;
const {BigNumber} = require('@ethersproject/bignumber');

const zeroaddress = "0x0000000000000000000000000000000000000000";
const linkaddress = "0x514910771af9ca656af840dff83e8264ecf986ca";

// test suite for the NFT DAO contract
describe("Constructor", function () {

  // variable to store the deployed smart contract
  let chainlink_contract;

  let owner, addr1, addr2, addr3, addr4;

  // initial deployment of Dist Pool
  before(async function () {
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    // deploy ether collateral
    const CHAINLINKCONTRACT = await ethers.getContractFactory("ChainlinkMcap");
    chainlink_contract = await  CHAINLINKCONTRACT.deploy(10);
    await chainlink_contract.deployed();
  })

  it("Should be able to find contract", async function () {
    let name = await chainlink_contract.oracle();
    expect(name).to.equal("0x7AFe1118Ea78C1eae84ca8feE5C65Bc76CcF879e");
  });

  it("Should have the right min delay set", async function () {
    let mindelay = await chainlink_contract.minimumDelay();
    expect(mindelay).to.equal(10);
  });

  it("Should be able to modify min delay", async function () {
    await chainlink_contract.setMinimumDelay(5);
    let mindelay = await chainlink_contract.minimumDelay();
    expect(mindelay).to.equal(5);
  });

  it("Should not be able to modify min delay as not owner", async function () {
    expect(chainlink_contract.connect(addr1).setMinimumDelay(5)).to.be.reverted;
  });

  it("Should be possible to add and remove tokens from the whitelist", async function () {
    let temp = await chainlink_contract.tokenmap(linkaddress);
    expect(temp.marcetcap).to.equal(0);
    expect(temp.whitelisted).to.equal(false);

    await chainlink_contract.addTokensToWhitelist([linkaddress]);

    temp = await chainlink_contract.tokenmap(linkaddress);
    expect(temp.marcetcap).to.equal(0);
    expect(temp.whitelisted).to.equal(true);

    await chainlink_contract.removeTokensFromWhitelist([linkaddress]);

    temp = await chainlink_contract.tokenmap(linkaddress);
    expect(temp.marcetcap).to.equal(0);
    expect(temp.whitelisted).to.equal(false);

  });

  it("Only owner can call withdraw link", async function () {
    expect(chainlink_contract.connect(addr1).withdrawLink()).to.be.reverted;
    await chainlink_contract.withdrawLink();
  });

});
