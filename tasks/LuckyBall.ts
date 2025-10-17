import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { parseEther, ZeroHash } from "ethers";

const CONTRACT_NAME = "LuckyBall";
const TICKET_PRICE = parseEther("0.001");

task("luckyball:address", "Print the LuckyBall deployment address").setAction(async (_args, hre) => {
  const deployment = await hre.deployments.get(CONTRACT_NAME);
  console.log(`${CONTRACT_NAME} address: ${deployment.address}`);
});

task("luckyball:buy", "Buy a LuckyBall ticket with an encrypted number")
  .addParam("number", "Plain number between 1 and 9 before encryption")
  .addOptionalParam("address", "Optional LuckyBall contract address")
  .setAction(async (args: TaskArguments, hre) => {
    const choice = Number(args.number);
    if (!Number.isInteger(choice) || choice < 1 || choice > 9) {
      throw new Error("--number must be an integer between 1 and 9");
    }

    const { deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployment = args.address ? { address: args.address as string } : await deployments.get(CONTRACT_NAME);
    const [signer] = await hre.ethers.getSigners();
    const contract = await hre.ethers.getContractAt(CONTRACT_NAME, deployment.address);

    const encrypted = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .add8(choice)
      .encrypt();

    const tx = await contract
      .connect(signer)
      .buyTicket(encrypted.handles[0], encrypted.inputProof, { value: TICKET_PRICE });
    const receipt = await tx.wait();
    console.log(`Ticket purchase tx: ${tx.hash} status=${receipt?.status}`);
  });

task("luckyball:draw", "Execute the current LuckyBall draw")
  .addOptionalParam("address", "Optional LuckyBall contract address")
  .setAction(async (args: TaskArguments, hre) => {
    const { deployments } = hre;
    const deployment = args.address ? { address: args.address as string } : await deployments.get(CONTRACT_NAME);
    const [caller] = await hre.ethers.getSigners();
    const contract = await hre.ethers.getContractAt(CONTRACT_NAME, deployment.address);

    const tx = await contract.connect(caller).executeDraw();
    const receipt = await tx.wait();
    console.log(`Draw execution tx: ${tx.hash} status=${receipt?.status}`);
  });

task("luckyball:score", "Decrypt the caller score")
  .addOptionalParam("address", "Optional LuckyBall contract address")
  .setAction(async (args: TaskArguments, hre) => {
    const { deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployment = args.address ? { address: args.address as string } : await deployments.get(CONTRACT_NAME);
    const [signer] = await hre.ethers.getSigners();
    const contract = await hre.ethers.getContractAt(CONTRACT_NAME, deployment.address);

    const encryptedScore = await contract.getScore(signer.address);
    if (encryptedScore === ZeroHash) {
      console.log("Encrypted score: 0 (no tickets yet)");
      return;
    }

    const clearScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedScore,
      deployment.address,
      signer,
    );

    console.log(`Encrypted score: ${encryptedScore}`);
    console.log(`Clear score    : ${clearScore}`);
  });

task("luckyball:claim", "Claim a ticket by index")
  .addParam("index", "Ticket index to claim")
  .addOptionalParam("address", "Optional LuckyBall contract address")
  .setAction(async (args: TaskArguments, hre) => {
    const index = Number(args.index);
    if (!Number.isInteger(index) || index < 0) {
      throw new Error("--index must be a non-negative integer");
    }

    const { deployments } = hre;
    const deployment = args.address ? { address: args.address as string } : await deployments.get(CONTRACT_NAME);
    const [signer] = await hre.ethers.getSigners();
    const contract = await hre.ethers.getContractAt(CONTRACT_NAME, deployment.address);

    const tx = await contract.connect(signer).claimTicket(index);
    const receipt = await tx.wait();
    console.log(`Claim ticket tx: ${tx.hash} status=${receipt?.status}`);
  });
