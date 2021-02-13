const { expect } = require('chai');
const { waffle } = require('hardhat');
const { deployContract, solidity } = waffle;
const provider = waffle.provider;

const ChainlinkJobId = '6d1bfe27e7034b1d87b5270556b17277';
const OracleAddress = '0x7AFe1118Ea78C1eae84ca8feE5C65Bc76CcF879e';

const AaveAddress = '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9';
const SnxAddress = '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f';
const LinkAddress = '0x514910771af9ca656af840dff83e8264ecf986ca';

describe('ChainlinkMcap', function(){
    let chainlinkContract;
    let beforeupdaterequesttimestamp;

    let owner, addr1, addr2, addr3, addr4;

    before(async () => {
        [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

        chainlinkContract = await ethers.getContractFactory('ChainlinkMcapMock');
        chainlinkContract = await chainlinkContract.deploy(0, OracleAddress, ethers.utils.toUtf8Bytes(ChainlinkJobId));
    });

    it('should be able to find the deployed contract', async function(){
        let name = await chainlinkContract.oracle();
        expect(name).to.equal(OracleAddress);
    });

    describe('updateCirculatingMarketCaps()', function(){
        it('should revert when updating non-whitelisted addresses', async function(){
            expect(chainlinkContract.updateCirculatingMarketCaps([AaveAddress])).to.be.reverted;
        });

        it('should allow updating of whitelisted addresses', async function(){
            // Assert that both tokens are not whitelisted
            expect(chainlinkContract.updateCirculatingMarketCaps([AaveAddress])).to.be.reverted;
            expect(chainlinkContract.updateCirculatingMarketCaps([SnxAddress])).to.be.reverted;

            // Whitelist and attempt to update SNX
            await chainlinkContract.addTokensToWhitelist([SnxAddress]);
            await chainlinkContract.updateCirculatingMarketCaps([SnxAddress]);

            // Assert that AAVE is still not whitelisted
            expect(chainlinkContract.updateCirculatingMarketCaps([AaveAddress])).to.be.reverted;
        });

        it('should revert if minDelay has not been reached', async function(){
          await chainlinkContract.addTokensToWhitelist([SnxAddress]);

          await chainlinkContract.setMinimumDelay(1000);
          await chainlinkContract.fulfillMock(SnxAddress, 1337);

          expect(chainlinkContract.updateCirculatingMarketCaps([SnxAddress])).to.be.reverted;

          // reset for future tests
          await chainlinkContract.setMinimumDelay(0);
          await chainlinkContract.fulfillMock(SnxAddress, 0);
        });
    });

    describe('getCirculatingMarketCap()', function(){
      it('should fetch the latest marketcap', async function(){
        let marketcap = await chainlinkContract.getCirculatingMarketCap(SnxAddress);
        expect(marketcap).to.equal(0);

        await chainlinkContract.fulfillMock(SnxAddress, 1337);

        marketcap = await chainlinkContract.getCirculatingMarketCap(SnxAddress);
        expect(marketcap).to.equal(1337);

        // reset for future tests
        await chainlinkContract.fulfillMock(SnxAddress, 0);
      })
    });

    describe('getCirculatingMarketCaps()', function(){
      it('should fetch the latest marketcaps', async function(){
        let marketcaps = await chainlinkContract.getCirculatingMarketCaps([AaveAddress, SnxAddress]);
        expect(marketcaps[0]).to.equal(0);
        expect(marketcaps[1]).to.equal(0);

        await chainlinkContract.fulfillMock(SnxAddress, 1337);

        marketcaps = await chainlinkContract.getCirculatingMarketCaps([AaveAddress, SnxAddress]);
        expect(marketcaps[0]).to.equal(0);
        expect(marketcaps[1]).to.equal(1337);

        // reset for future tests
        await chainlinkContract.fulfillMock(SnxAddress, 0);
      });
    });

    describe('minimumDelay()', function(){
      it('should have the right minDelay set', async function(){
        let minDelay = await chainlinkContract.minimumDelay();
        expect(minDelay).to.equal(0);
      });

      it('should be able to modify minDelay', async function(){
        await chainlinkContract.setMinimumDelay(5);
        let minDelay = await chainlinkContract.minimumDelay();
        expect(minDelay).to.equal(5);

        // reset minDelay to 0
        await chainlinkContract.setMinimumDelay(0);

      });

      it('should not be able to modify minDelay as non-owner', async function(){
        expect(chainlinkContract.connect(addr1).setMinimumDelay(5)).to.be.reverted;
      });
    });

    describe('withdraw()', function(){
      it('should allow only owners to withdraw', async function(){
        expect(chainlinkContract.connect(addr1).withdrawLink()).to.be.reverted;
        await chainlinkContract.withdrawLink();
      })
    })
});
