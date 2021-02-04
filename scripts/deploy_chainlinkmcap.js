async function main() {
    // We get the contract to deploy
    const ChainlinkMcap = await ethers.getContractFactory("ChainlinkMcap");
    // set to desired minimum delay in arg1
    const chainlinkmcap = await ChainlinkMcap.deploy(0);
    await chainlinkmcap.deployed();
    console.log("ChainlinkMcap deployed to:", chainlinkmcap.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
