// this testcase uses the rinkeby network from the hardhat config (preferable ran as the owner of the current contract)
// imports
const {expect} = require("chai");
const {waffle} = require("hardhat");
const { ethers } = require("hardhat");
const {deployContract, solidity} = waffle;
const provider = waffle.provider;
const {BigNumber} = require('@ethersproject/bignumber');
const {Contract} =  require("@ethersproject/contracts");

const zeroaddress = "0x0000000000000000000000000000000000000000";
const linkaddress = "0x514910771af9ca656af840dff83e8264ecf986ca";
const snxaddress = "0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f";
const aaveaddress = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";

// deployed rinkeby address to test also has a few test rinkeby LINK tokens
const deployed_address = "0xb3D69BC4951348e322717A3728D7f67578ecAD31";
const ABI = require("./abi.json");

function Sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

// test suite for the NFT DAO contract
describe("Constructor", function () {

    // variable to store the deployed smart contract
    let chainlink_contract;
    let beforeupdaterequesttimestamp;

    let owner, addr1, addr2, addr3, addr4;

    // initial deployment of Dist Pool
    before(async function () {
        [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();
        chainlink_contract = new Contract(deployed_address, ABI, provider.getSigner(owner.address));
    })

    it("Should be able to find contract", async function () {
        let name = await chainlink_contract.oracle();
        expect(name).to.equal("0x7AFe1118Ea78C1eae84ca8feE5C65Bc76CcF879e");
    });

    // we whitelisted snx and chainlink to be able to update the mcap of those
    it("Should not be able to call update for aave", async function () {
        expect( chainlink_contract.updateTokenMarketCaps([aaveaddress])).to.be.reverted;
    });

    // we should be able to call update on snx and link
    it("Should be able to call update for snx and link", async function () {

        let block = await provider.getBlock(provider.getBlockNumber());
        beforeupdaterequesttimestamp = block.timestamp;

        await chainlink_contract.updateTokenMarketCaps([linkaddress, snxaddress]);
    });

    // check dor the updates in our mapping
    it("Should have been updated due to timestamp", async function () {
        this.timeout(70000);

        // wait 1 minute for approx 4 blocks
        await Sleep(60000);

        let chainlinktimestamp = await chainlink_contract.tokenmap(linkaddress);
        let snxtimestamp = await chainlink_contract.tokenmap(snxaddress);

        console.log(chainlinktimestamp.lastPriceTimestamp)
        console.log(snxtimestamp.lastPriceTimestamp)

        expect(parseInt(chainlinktimestamp.lastPriceTimestamp)).to.be.greaterThan(beforeupdaterequesttimestamp);
        expect(parseInt(snxtimestamp.lastPriceTimestamp)).to.be.greaterThan(beforeupdaterequesttimestamp);
    });

});
