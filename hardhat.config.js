require("@nomiclabs/hardhat-waffle");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {

  defaultNetwork: "hardhat",
  networks: {
	  // use this for the basic getter setter functions
    hardhat: {
     (forking: {
       url: "https://mainnet.infura.io/v3/_INFURA_ID"
      }
    },
	// use this for the main function test case
    //rinkeby: {
    //  url: `https://rinkeby.infura.io/v3/_INFURA_ID_`,
    // accounts: ['_ACCOUNT_PK_']
    //},
  },
  solidity: {
    compilers: [
      {
        version: "0.6.5",
        settings: { }
      }
    ]
  }
};