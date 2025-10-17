import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { LuckyBall, LuckyBall__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

const TICKET_PRICE = ethers.parseEther("0.001");

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("LuckyBall")) as LuckyBall__factory;
  const contract = (await factory.deploy()) as LuckyBall;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

describe("LuckyBall", function () {
  let signers: Signers;
  let contract: LuckyBall;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("LuckyBall tests require FHEVM mock");
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  it("initializes draw and zero score", async function () {
    const currentDrawId = await contract.currentDrawId();
    expect(currentDrawId).to.eq(1);

    const draw = await contract.getDraw(currentDrawId);
    expect(draw.executed).to.eq(false);

    const score = await contract.getScore(signers.alice.address);
    expect(score).to.eq(ethers.ZeroHash);
  });

  it("stores encrypted tickets and awards score to winners", async function () {
    const indices: Map<number, bigint> = new Map();

    for (let number = 1; number <= 9; number++) {
      const encryptedInput = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(number)
        .encrypt();

      const tx = await contract
        .connect(signers.alice)
        .buyTicket(encryptedInput.handles[0], encryptedInput.inputProof, { value: TICKET_PRICE });
      const receipt = await tx.wait();
      const ticketEvent = receipt?.logs
        .map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch (error) {
            return null;
          }
        })
        .find((parsed) => parsed && parsed.name === "TicketPurchased");
      if (!ticketEvent) {
        throw new Error("TicketPurchased event not emitted");
      }
      indices.set(number, ticketEvent.args?.ticketIndex as bigint);
    }

    const total = await contract.totalTickets(signers.alice.address);
    expect(total).to.eq(9n);

    const txDraw = await contract.connect(signers.bob).executeDraw();
    const receiptDraw = await txDraw.wait();
    const drawEvent = receiptDraw?.logs
      .map((log) => {
        try {
          return contract.interface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "DrawExecuted");
    if (!drawEvent) {
      throw new Error("DrawExecuted event not found");
    }
    const winningNumber = Number(drawEvent.args?.winningNumber);

    const winningIndex = indices.get(winningNumber);
    if (winningIndex === undefined) {
      throw new Error("Winning index not recorded");
    }

    const scoreBefore = await contract.getScore(signers.alice.address);
    const clearScoreBefore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      scoreBefore,
      contractAddress,
      signers.alice,
    );
    expect(clearScoreBefore).to.eq(0n);

    await contract.connect(signers.alice).claimTicket(Number(winningIndex));

    const scoreAfter = await contract.getScore(signers.alice.address);
    const clearScoreAfter = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      scoreAfter,
      contractAddress,
      signers.alice,
    );
    expect(clearScoreAfter).to.eq(10n);

    const losingNumber = winningNumber === 1 ? 2 : 1;
    const losingIndex = indices.get(losingNumber);
    if (losingIndex === undefined) {
      throw new Error("Losing index not recorded");
    }

    await contract.connect(signers.alice).claimTicket(Number(losingIndex));

    const scoreFinal = await contract.getScore(signers.alice.address);
    const clearScoreFinal = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      scoreFinal,
      contractAddress,
      signers.alice,
    );
    expect(clearScoreFinal).to.eq(10n);
  });
});
