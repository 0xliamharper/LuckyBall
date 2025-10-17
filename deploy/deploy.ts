import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as dotenv from "dotenv";

dotenv.config();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedLuckyBall = await deploy("LuckyBall", {
    from: deployer,
    log: true,
  });

  console.log(`LuckyBall contract: `, deployedLuckyBall.address);
};
export default func;
func.id = "deploy_luckyball"; // id required to prevent reexecution
func.tags = ["LuckyBall"];
