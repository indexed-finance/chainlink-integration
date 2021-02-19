const { expect } = require('chai');
const { BigNumber } = require('ethers');
const {
  ChainlinkJobId,
  OracleAddress,
  AaveAddress,
  SnxAddress,
  MinimumDelay,
  TimeToExpire,
  sha3,
  deploy,
  getTransactionTimestamp,
  fastForward
} = require('./utils');


describe('CirculatingMarketCapOracle', function () {
  let chainlinkContract;
  let beforeupdaterequesttimestamp;
  let link;

  let owner, addr1, addr2, addr3, addr4;

  before(async () => {
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();
  });

  function setupTests() {
    before(async () => {
      link = await deploy('MockERC20', 'Chainlink', 'LINK');
      chainlinkContract = await deploy(
        'MockCirculatingMarketCapOracle',
        MinimumDelay,
        TimeToExpire,
        OracleAddress,
        ethers.utils.toUtf8Bytes(ChainlinkJobId),
        link.address
      );
    })
  }

  describe('Settings', () => {
    setupTests();
    
    it('oracle()', async () => {
      expect(await chainlinkContract.oracle()).to.eq(OracleAddress);
    })

    it('minimumDelay()', async () => {
      expect(await chainlinkContract.minimumDelay()).to.eq(MinimumDelay)
    })

    it('timeToExpire()', async () => {
      expect(await chainlinkContract.timeToExpire()).to.eq(TimeToExpire)
    })

    it('oracle()', async () => {
      expect(await chainlinkContract.oracle()).to.eq(OracleAddress)
    })

    it('jobId()', async () => {
      expect(await chainlinkContract.jobId()).to.eq('0x' + Buffer.from(ethers.utils.toUtf8Bytes(ChainlinkJobId)).toString('hex'));
    })

    it('fee()', async () => {
      expect(await chainlinkContract.fee()).to.eq(BigNumber.from(10).pow(17));
    })
  })

  describe('getCoingeckoMarketCapUrl()', () => {
    it('should compute the correct URL', async () => {
      await chainlinkContract.testUrlDerivation();
    })
  })

  describe('updateCirculatingMarketCaps()', function () {
    setupTests();

    it('should revert when updating non-whitelisted addresses', async function () {
      expect(chainlinkContract.updateCirculatingMarketCaps([AaveAddress])).to.be.revertedWith(
        "CirculatingMarketCapOracle: Token is not whitelisted"
      );
      expect(chainlinkContract.updateCirculatingMarketCaps([SnxAddress])).to.be.revertedWith(
        "CirculatingMarketCapOracle: Token is not whitelisted"
      );
    });

    it('should allow updating of whitelisted addresses', async function () {
      // Whitelist and attempt to update SNX
      await chainlinkContract.addTokensToWhitelist([SnxAddress, AaveAddress]);
      await chainlinkContract.updateCirculatingMarketCaps([SnxAddress, AaveAddress]);
    });

    it('should mark the tokens as pending', async () => {
      const { hasPendingRequest: hasPendingRequest1 } = await chainlinkContract.getTokenDetails(SnxAddress);
      const { hasPendingRequest: hasPendingRequest2 } = await chainlinkContract.getTokenDetails(AaveAddress);
      expect(hasPendingRequest1).to.be.true;
      expect(hasPendingRequest2).to.be.true;
    })

    it('should save the token for the request ID', async () => {
      expect(
        await chainlinkContract.pendingRequestMap(sha3(SnxAddress))
      ).to.eq(SnxAddress)
      expect(
        await chainlinkContract.pendingRequestMap(sha3(AaveAddress))
      ).to.eq(AaveAddress)
    })

    it('should fail gracefully if minDelay has not been reached', async function () {
      // Set minimum delay
      await chainlinkContract.setMinimumDelay(1000);
      expect((await chainlinkContract.getTokenDetails(SnxAddress)).hasPendingRequest).to.be.true;
      // Fill pending request
      await chainlinkContract.fulfill(sha3(SnxAddress), 1337);
      expect((await chainlinkContract.getTokenDetails(SnxAddress)).hasPendingRequest).to.be.false;
      // Verify no new request is made
      await chainlinkContract.updateCirculatingMarketCaps([SnxAddress]);
      expect((await chainlinkContract.getTokenDetails(SnxAddress)).hasPendingRequest).to.be.false;
      expect(
        await chainlinkContract.pendingRequestMap(sha3(SnxAddress))
      ).to.eq(`0x`.padEnd(42, '0'));
    });
  });

  describe('addTokensToWhitelist()', () => {
    setupTests();

    it('should not be able to whitelist tokens as non-owner', async function () {
      expect(
        chainlinkContract.connect(addr1).addTokensToWhitelist([SnxAddress, AaveAddress])
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should add tokens to whitelist if called by owner', async () => {
      await chainlinkContract.addTokensToWhitelist([SnxAddress, AaveAddress]);
      expect(await chainlinkContract.isTokenWhitelisted(SnxAddress)).to.be.true;
      expect(await chainlinkContract.isTokenWhitelisted(AaveAddress)).to.be.true;
    })
  })

  describe('removeTokensFromWhitelist()', () => {
    setupTests();

    it('should not be able to dewhitelist tokens as non-owner', async function () {
      expect(
        chainlinkContract.connect(addr1).removeTokensFromWhitelist([SnxAddress, AaveAddress])
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should remove tokens from whitelist if called by owner', async () => {
      await chainlinkContract.addTokensToWhitelist([SnxAddress, AaveAddress]);
      expect(await chainlinkContract.isTokenWhitelisted(SnxAddress)).to.be.true;
      expect(await chainlinkContract.isTokenWhitelisted(AaveAddress)).to.be.true;
      await chainlinkContract.removeTokensFromWhitelist([SnxAddress, AaveAddress]);
      expect(await chainlinkContract.isTokenWhitelisted(SnxAddress)).to.be.false;
      expect(await chainlinkContract.isTokenWhitelisted(AaveAddress)).to.be.false;
    })
  })

  describe('fulfill()', () => {
    setupTests();

    it('should revert if market cap exceeds uint208', async () => {
      await chainlinkContract.addTokensToWhitelist([SnxAddress]);
      await chainlinkContract.updateCirculatingMarketCaps([SnxAddress]);
      const amount = BigNumber.from(2).pow(208);
      await expect(
        chainlinkContract.fulfill(sha3(SnxAddress), amount)
      ).to.be.revertedWith('CirculatingMarketCapOracle: uint exceeds 208 bits');
    })

    it('should mark latest timestamp, update market cap, remove pending request', async () => {
      const tx = await chainlinkContract.fulfill(sha3(SnxAddress), 1337);
      const {
        hasPendingRequest,
        lastPriceTimestamp,
        marketCap
      } = await chainlinkContract.getTokenDetails(SnxAddress);
      expect(hasPendingRequest).to.be.false;
      expect(lastPriceTimestamp).to.eq(await getTransactionTimestamp(tx));
      expect(marketCap).to.eq(1337);
      expect(
        await chainlinkContract.pendingRequestMap(sha3(SnxAddress))
      ).to.eq(`0x`.padEnd(42, '0'));
    })
  })

  describe('getCirculatingMarketCap()', function () {
    setupTests();

    it('should revert if market cap does not exist', async () => {
      expect(
        chainlinkContract.getCirculatingMarketCap(SnxAddress)
      ).to.be.revertedWith('CirculatingMarketCapOracle: Marketcap has expired');
    })

    it('should fetch the latest market cap', async function () {
      await chainlinkContract.addTokensToWhitelist([SnxAddress]);
      await chainlinkContract.updateCirculatingMarketCaps([SnxAddress]);
      await chainlinkContract.fulfill(sha3(SnxAddress), 1337);

      expect(
        await chainlinkContract.getCirculatingMarketCap(SnxAddress)
      ).to.eq(1337);
    });

    it('should revert when market cap is expired', async function () {
      await fastForward(TimeToExpire);
      expect(
        chainlinkContract.getCirculatingMarketCap(SnxAddress)
      ).to.be.revertedWith('CirculatingMarketCapOracle: Marketcap has expired');
    });
  });

  describe('getCirculatingMarketCaps()', function () {
    setupTests();

    it('should revert if any market cap does not exist', async () => {
      expect(
        chainlinkContract.getCirculatingMarketCaps([SnxAddress, AaveAddress])
      ).to.be.revertedWith('CirculatingMarketCapOracle: Marketcap has expired');
    })

    it('should fetch the latest market caps', async function () {
      await chainlinkContract.addTokensToWhitelist([SnxAddress, AaveAddress]);
      await chainlinkContract.updateCirculatingMarketCaps([SnxAddress, AaveAddress]);
      await chainlinkContract.fulfill(sha3(SnxAddress), 1337);
      await chainlinkContract.fulfill(sha3(AaveAddress), 9999);
      const [snxCap, aaveCap] = await chainlinkContract.getCirculatingMarketCaps([SnxAddress, AaveAddress]);
      expect(snxCap).to.eq(1337);
      expect(aaveCap).to.eq(9999);
    });

    it('should revert when any market cap is expired', async function () {
      await fastForward(TimeToExpire);
      expect(
        chainlinkContract.getCirculatingMarketCaps([SnxAddress, AaveAddress])
      ).to.be.revertedWith('CirculatingMarketCapOracle: Marketcap has expired');
    });
  });

  describe('setMinimumDelay()', function () {
    it('should not be able to modify minDelay as non-owner', async function () {
      expect(
        chainlinkContract.connect(addr1).setMinimumDelay(5)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should be able to modify minimumDelay as owner', async function () {
      await chainlinkContract.setMinimumDelay(5);
      expect(await chainlinkContract.minimumDelay()).to.equal(5);
    });
  });

  describe('setTimeToExpire()', function () {
    it('should not be able to modify timeToExpire as non-owner', async function () {
      expect(
        chainlinkContract.connect(addr1).setTimeToExpire(5)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should be able to modify timeToExpire as owner', async function () {
      await chainlinkContract.setTimeToExpire(5);
      expect(await chainlinkContract.timeToExpire()).to.equal(5);
    });
  });

  describe('setTimeToExpire()', function () {
    it('should not be able to modify timeToExpire as non-owner', async function () {
      expect(
        chainlinkContract.connect(addr1).setTimeToExpire(5)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should be able to modify timeToExpire as owner', async function () {
      await chainlinkContract.setTimeToExpire(5);
      expect(await chainlinkContract.timeToExpire()).to.equal(5);
    });
  });

  describe('withdrawLink()', function () {
    it('should not be able to withdraw as non-owner', async function () {
      expect(
        chainlinkContract.connect(addr1).withdrawLink()
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should be able to withdraw as owner', async function () {
      await link.getFreeTokens(chainlinkContract.address, 1000);
      await chainlinkContract.withdrawLink();
      expect(await link.balanceOf(owner.address)).to.eq(1000);
    })
  })

  describe('setChainlinkNodeFee()', function () {
    it('should not be able to set fee as non-owner', async function () {
      expect(
        chainlinkContract.connect(addr1).setChainlinkNodeFee(10000)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should be able to withdraw as owner', async function () {
      await chainlinkContract.setChainlinkNodeFee(10000);
      expect(await chainlinkContract.fee()).to.eq(10000);
    })
  })
});