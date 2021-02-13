async function main() {
    // We get the contract to deploy
    const ChainlinkMcap = await ethers.getContractFactory("ChainlinkMcap");
    // set to desired minimum delay in arg1
    const oracleAddress = "0x7AFe1118Ea78C1eae84ca8feE5C65Bc76CcF879e";
    const jobId = ethers.utils.toUtf8Bytes("6d1bfe27e7034b1d87b5270556b17277");
    const chainlinkmcap = await ChainlinkMcap.deploy(0, oracleAddress, jobId);
    await chainlinkmcap.deployed();
    console.log("ChainlinkMcap deployed to:", chainlinkmcap.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
