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
        chainlinkContract = await chainlinkContract.deploy(0, 86400, OracleAddress, ethers.utils.toUtf8Bytes(ChainlinkJobId));
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

        it('should remove token from whitelist if requested', async function(){

          expect(chainlinkContract.updateCirculatingMarketCaps([SnxAddress])).to.be.reverted;

          await chainlinkContract.addTokensToWhitelist([SnxAddress]);
          await chainlinkContract.updateCirculatingMarketCaps([SnxAddress]);
          await chainlinkContract.removeTokensFromWhitelist([SnxAddress]);

          expect(chainlinkContract.updateCirculatingMarketCaps([SnxAddress])).to.be.reverted;
        });
    });

    describe('getCirculatingMarketCap()', function(){
      it('should fetch the latest marketcap', async function(){
        expect(chainlinkContract.getCirculatingMarketCap([SnxAddress])).to.be.reverted;
        await chainlinkContract.addTokensToWhitelist([SnxAddress]);

        let marketcap = await chainlinkContract.getCirculatingMarketCap(SnxAddress);
        expect(marketcap).to.equal(0);

        await chainlinkContract.fulfillMock(SnxAddress, 1337);

        marketcap = await chainlinkContract.getCirculatingMarketCap(SnxAddress);
        expect(marketcap).to.equal(1337);

        // reset for future tests
        await chainlinkContract.fulfillMock(SnxAddress, 0);
        await chainlinkContract.removeTokensFromWhitelist([SnxAddress]);
      });

      it('should revert when marketcap is expired', async function(){
        await chainlinkContract.fulfillMock(SnxAddress, 1337);
        await chainlinkContract.setTimeToExpire(0);
        expect(chainlinkContract.getCirculatingMarketCap([SnxAddress])).to.be.reverted;

        // reset test
        await chainlinkContract.fulfillMock(SnxAddress, 0);
        await chainlinkContract.setTimeToExpire(86400);
      });
    });

    describe('getCirculatingMarketCaps()', function(){
      it('should fetch the latest marketcaps', async function(){
        expect(chainlinkContract.getCirculatingMarketCap([AaveAddress, SnxAddress])).to.be.reverted;
        await chainlinkContract.addTokensToWhitelist([AaveAddress, SnxAddress]);

        await chainlinkContract.fulfillMock(AaveAddress, 0);
        await chainlinkContract.fulfillMock(SnxAddress, 1337);

        marketcaps = await chainlinkContract.getCirculatingMarketCaps([AaveAddress, SnxAddress]);
        expect(marketcaps[0]).to.equal(0);
        expect(marketcaps[1]).to.equal(1337);

        // reset for future tests
        await chainlinkContract.fulfillMock(SnxAddress, 0);
        await chainlinkContract.removeTokensFromWhitelist([AaveAddress, SnxAddress]);
      });

      it('should revert when marketcap is expired', async function(){
        await chainlinkContract.fulfillMock(AaveAddress, 1337);
        await chainlinkContract.fulfillMock(SnxAddress, 1337);
        await chainlinkContract.setTimeToExpire(0);

        expect(chainlinkContract.getCirculatingMarketCap([AaveAddress, SnxAddress])).to.be.reverted;
        expect(chainlinkContract.getCirculatingMarketCap([SnxAddress])).to.be.reverted;
        expect(chainlinkContract.getCirculatingMarketCap([AaveAddress])).to.be.reverted;

        // reset test
        await chainlinkContract.fulfillMock(SnxAddress, 0);
        await chainlinkContract.fulfillMock(AaveAddress, 0);
        await chainlinkContract.setTimeToExpire(86400);
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
        expect(chainlinkContract.connect(addr1).setTimeToExpire(5)).to.be.reverted;
      });
    });

    describe('setTimeToExpire()', function(){
      it('should have the right timeToExpire set', async function(){
        let timeToExpire = await chainlinkContract.timeToExpire();
        expect(timeToExpire).to.equal(86400);
      });

      it('should be able to modify timeToExpire', async function(){
        await chainlinkContract.setTimeToExpire(5);
        let timeToExpire = await chainlinkContract.timeToExpire();
        expect(timeToExpire).to.equal(5);

        // reset timeToExpire to 86400
        await chainlinkContract.setTimeToExpire(86400);
      });

      it('should not be able to modify timeToExpire as non-owner', async function(){
        expect(chainlinkContract.connect(addr1).setTimeToExpire(5)).to.be.reverted;
      });
    });


    describe('withdraw()', function(){
      it('should allow only owners to withdraw', async function(){
        expect(chainlinkContract.connect(addr1).withdrawLink()).to.be.reverted;
        await chainlinkContract.withdrawLink();
      })
    })
});
