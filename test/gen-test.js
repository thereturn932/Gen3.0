const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { MerkleTree } = require("merkletreejs");
const { keccak256 } = ethers.utils;
const { waffle } = require("hardhat");

describe("Gen3.0 NFT Project", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshopt in every test.
  async function deployGen30NFT() {
    const base_uri = "ipfs://CID/"; // baseTokenURI
    const price = hre.ethers.utils.parseEther("1.0"); // _price

    const accounts = await hre.ethers.getSigners();

    // let accounts = [];
    // for (let i = 0; i < 420; i++) {
    //   var wallet = ethers.Wallet.createRandom();
    //   // add the provider from Hardhat
    //   wallet = wallet.connect(ethers.provider);
    //   await orj_wallets[0].sendTransaction({
    //     to: wallet.address,
    //     value: ethers.utils.parseEther("100.0"),
    //   });
    //   accounts.push(wallet);
    // }
    const followerWL = accounts.slice(1, 300);
    const memberWL = accounts.slice(300, 400);
    const nonWL = accounts.slice(400, 410);

    const padBuffer = (addr) => {
      return Buffer.from(addr.substr(2).padStart(32 * 2, 0), "hex");
    };

    const leavesMembers = memberWL.map((account) => padBuffer(account.address));
    const treeMembers = new MerkleTree(leavesMembers, keccak256, {
      sort: true,
    });
    const merkleRootMembers = treeMembers.getHexRoot(); //_rootMembers

    const leavesFollowers = followerWL.map((account) =>
      padBuffer(account.address)
    );
    const treeFollowers = new MerkleTree(leavesFollowers, keccak256, {
      sort: true,
    });
    const merkleRootFollowers = treeFollowers.getHexRoot(); //_rootFollowers

    const owner = accounts[0]; // _royaltyRecipient
    const royaltyAmount = 1000; // __royaltyAmount

    const NFT = await ethers.getContractFactory("Gen30");
    const nft = await NFT.deploy(
      base_uri,
      price,
      merkleRootMembers,
      merkleRootFollowers,
      owner.address,
      royaltyAmount
    );

    return {
      nft,
      memberWL,
      followerWL,
      nonWL,
      price,
      owner,
      royaltyAmount,
      treeFollowers,
      treeMembers,
      padBuffer,
    };
  }

  describe("Minting", function () {
    it("should mint public sale", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await nft
        .connect(nonWL[0])
        .mint([0], [proof], { value: hre.ethers.utils.parseEther("1.0") });
      expect(await nft.balanceOf(nonWL[0].address)).to.equal(1);
    });

    it("should mint private sale (follower)", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);
      await nft.setMintable();
      console.log("NFTs are now mintable!");

      const merkleProofFollower = treeFollowers.getHexProof(
        padBuffer(followerWL[0].address)
      );
      await nft.connect(followerWL[0]).mint([1], merkleProofFollower, {
        value: hre.ethers.utils.parseEther("1.0"),
      });
      expect(await nft.balanceOf(followerWL[0].address)).to.equal(1);
    });

    it("should mint private sale (member)", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);
      await nft.setMintable();
      console.log("NFTs are now mintable!");

      const merkleProofMember = treeMembers.getHexProof(
        padBuffer(memberWL[0].address)
      );
      await nft.connect(memberWL[0]).mint([1], merkleProofMember, {
        value: hre.ethers.utils.parseEther("1.0"),
      });
      expect(await nft.balanceOf(memberWL[0].address)).to.equal(1);
    });

    it("Should fail if not white listed", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);
      await nft.setMintable();
      console.log("NFTs are now mintable!");

      const invalidMerkleProofFollower = treeFollowers.getHexProof(
        padBuffer(nonWL[0].address)
      );

      const invalidMerkleProofMember = treeMembers.getHexProof(
        padBuffer(nonWL[0].address)
      );
      await expect(
        nft.connect(nonWL[0]).mint([1], invalidMerkleProofFollower, {
          value: hre.ethers.utils.parseEther("1.0"),
        })
      ).to.be.revertedWith("You don't have whitelist");

      await expect(
        nft.connect(nonWL[0]).mint([1], invalidMerkleProofMember, {
          value: hre.ethers.utils.parseEther("1.0"),
        })
      ).to.be.revertedWith("You don't have whitelist");
    });

    it("Should fail if minting not started", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await expect(
        nft
          .connect(nonWL[0])
          .mint([0], [proof], { value: hre.ethers.utils.parseEther("1.0") })
      ).to.be.revertedWith("Mint hasn't started yet");
    });

    it("Should fail if 400 NFTs are already sold", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);

      console.log("Minting tokens");
      for (var i = 0; i < 399; i++) {
        await nft.mint([i], [proof], {
          value: hre.ethers.utils.parseEther("1.0"),
        });
      }
      console.log("Minted tokens");
      expect(await nft.balanceOf(owner.address)).to.equal(399);
      await expect(
        nft.connect(nonWL[0]).mint([400], [proof], {
          value: hre.ethers.utils.parseEther("1.0"),
        })
      ).to.be.revertedWith("Only 400 tokens can be minted by users");
    });

    it("Should fail if all follower NFTs are already sold", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);
      await nft.setMintable();
      console.log("NFTs are now mintable!");

      for (var i = 0; i < 244; i++) {
        const merkleProofFollower = treeFollowers.getHexProof(
          padBuffer(followerWL[i].address)
        );
        await nft.connect(followerWL[i]).mint([i], merkleProofFollower, {
          value: hre.ethers.utils.parseEther("1.0"),
        });
      }
      const merkleProofFollower = treeFollowers.getHexProof(
        padBuffer(followerWL[245].address)
      );
      await expect(
        nft.connect(followerWL[245]).mint([245], merkleProofFollower, {
          value: hre.ethers.utils.parseEther("1.0"),
        })
      ).to.be.revertedWith("All follower NFTs are sold");
    });

    it("Should fail if all member NFTs are already sold", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);
      await nft.setMintable();
      console.log("NFTs are now mintable!");

      for (var i = 0; i < 89; i++) {
        const merkleProofMember = treeMembers.getHexProof(
          padBuffer(memberWL[i].address)
        );
        await nft.connect(memberWL[i]).mint([i], merkleProofMember, {
          value: hre.ethers.utils.parseEther("1.0"),
        });
      }
      const merkleProofMember = treeMembers.getHexProof(
        padBuffer(memberWL[90].address)
      );
      await expect(
        nft.connect(memberWL[90]).mint([90], merkleProofMember, {
          value: hre.ethers.utils.parseEther("1.0"),
        })
      ).to.be.revertedWith("All member NFTs are sold");
    });

    it("Should fail if follower already bought one NFT", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);
      await nft.setMintable();
      console.log("NFTs are now mintable!");

      const merkleProofFollower = treeFollowers.getHexProof(
        padBuffer(followerWL[0].address)
      );
      // const invalidMerkleProof = tree.getHexProof(
      //   padBuffer(nonWL[0].address)
      // );
      await nft.connect(followerWL[0]).mint([1], merkleProofFollower, {
        value: hre.ethers.utils.parseEther("1.0"),
      });

      await expect(
        nft.connect(followerWL[0]).mint([2], merkleProofFollower, {
          value: hre.ethers.utils.parseEther("1.0"),
        })
      ).to.be.revertedWith("Already minted as a follower");
    });

    it("Should fail if member already bought one NFT", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);
      await nft.setMintable();
      console.log("NFTs are now mintable!");

      const merkleProofMember = treeMembers.getHexProof(
        padBuffer(memberWL[0].address)
      );
      // const invalidMerkleProof = tree.getHexProof(
      //   padBuffer(nonWL[0].address)
      // );
      await nft.connect(memberWL[0]).mint([1], merkleProofMember, {
        value: hre.ethers.utils.parseEther("1.0"),
      });

      await expect(
        nft.connect(memberWL[0]).mint([1], merkleProofMember, {
          value: hre.ethers.utils.parseEther("1.0"),
        })
      ).to.be.revertedWith("Already minted as a member");
    });

    it("Should fail if nft already sold", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await nft
        .connect(nonWL[0])
        .mint([0], [proof], { value: hre.ethers.utils.parseEther("1.0") });
      await expect(
        nft
          .connect(nonWL[0])
          .mint([0], [proof], { value: hre.ethers.utils.parseEther("1.0") })
      ).to.be.revertedWith("ERC721: token already minted");
    });

    it("Should fail if sent Ether is lower than required.", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await expect(
        nft
          .connect(nonWL[0])
          .mint([0], [proof], { value: hre.ethers.utils.parseEther("0.9") })
      ).to.be.revertedWith("Wrong amount of Ethers");
    });

    it("Should fail if sent Ether is higher than required.", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await expect(
        nft
          .connect(nonWL[0])
          .mint([0], [proof], { value: hre.ethers.utils.parseEther("1.1") })
      ).to.be.revertedWith("Wrong amount of Ethers");
    });

    it("should mint multiple public sale", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await nft.connect(nonWL[0]).mint([0, 1, 2], [proof], {
        value: hre.ethers.utils.parseEther("3.0"),
      });
      expect(await nft.balanceOf(nonWL[0].address)).to.equal(3);
    });

    it("should fail while minting multiple private sale (follower)", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);
      await nft.setMintable();
      console.log("NFTs are now mintable!");

      const merkleProofFollower = treeFollowers.getHexProof(
        padBuffer(followerWL[0].address)
      );
      // const invalidMerkleProof = tree.getHexProof(
      //   padBuffer(nonWL[0].address)
      // );
      await expect(
        nft.connect(followerWL[0]).mint([1, 2], merkleProofFollower, {
          value: hre.ethers.utils.parseEther("2.0"),
        })
      ).to.be.revertedWith("Only 1 NFT can be minted during presale");
    });

    it("should fail while minting multiple private sale (member)", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);
      await nft.setMintable();
      console.log("NFTs are now mintable!");

      const merkleProofMember = treeMembers.getHexProof(
        padBuffer(memberWL[0].address)
      );
      // const invalidMerkleProof = tree.getHexProof(
      //   padBuffer(nonWL[0].address)
      // );
      await expect(
        nft.connect(memberWL[0]).mint([1, 2], merkleProofMember, {
          value: hre.ethers.utils.parseEther("2.0"),
        })
      ).to.be.revertedWith("Only 1 NFT can be minted during presale");
    });

    it("Should fail if sent Ether is lower than required (multiple).", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await expect(
        nft.connect(nonWL[0]).mint([0, 1, 2], [proof], {
          value: hre.ethers.utils.parseEther("1.0"),
        })
      ).to.be.revertedWith("Wrong amount of Ethers");
    });

    it("Should fail if sent Ether is higher than required (multiple).", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await expect(
        nft.connect(nonWL[0]).mint([0, 1, 2], [proof], {
          value: hre.ethers.utils.parseEther("3.1"),
        })
      ).to.be.revertedWith("Wrong amount of Ethers");
    });

    it("should fail while minting more than 10 NFT", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      const merkleProofFollower = treeFollowers.getHexProof(
        padBuffer(followerWL[0].address)
      );
      await nft.connect(followerWL[0]).mint([300], merkleProofFollower, {
        value: hre.ethers.utils.parseEther("1.0"),
      });

      const merkleProofMember = treeMembers.getHexProof(
        padBuffer(memberWL[0].address)
      );
      await nft.connect(memberWL[0]).mint([400], merkleProofMember, {
        value: hre.ethers.utils.parseEther("1.0"),
      });

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await expect(
        nft
          .connect(nonWL[0])
          .mint([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [proof], {
            value: hre.ethers.utils.parseEther("10.0"),
          })
      ).to.be.revertedWith("Maximum 10 NFT per wallet");
      for (var i = 20; i < 30; i++) {
        await nft.connect(nonWL[1]).mint([i], [proof], {
          value: hre.ethers.utils.parseEther("1.0"),
        });
      }
      await expect(
        nft.connect(nonWL[1]).mint([31], [proof], {
          value: hre.ethers.utils.parseEther("1.0"),
        })
      ).to.be.revertedWith("Maximum 10 NFT per wallet");
      await expect(
        nft
          .connect(followerWL[0])
          .mint([301, 302, 303, 304, 305, 306, 307, 308, 309, 310], [proof], {
            value: hre.ethers.utils.parseEther("10.0"),
          })
      ).to.be.revertedWith("Maximum 10 NFT per wallet");
      await expect(
        nft
          .connect(memberWL[0])
          .mint([401, 402, 403, 404, 405, 406, 407, 408, 409, 410], [proof], {
            value: hre.ethers.utils.parseEther("10.0"),
          })
      ).to.be.revertedWith("Maximum 10 NFT per wallet");
      await nft.connect(nonWL[3]).mint([100, 101, 102, 103, 104], [proof], {
        value: hre.ethers.utils.parseEther("5.0"),
      });
      await expect(
        nft.connect(nonWL[3]).mint([105, 106, 107, 108, 109, 110], [proof], {
          value: hre.ethers.utils.parseEther("6.0"),
        })
      ).to.be.revertedWith("Maximum 10 NFT per wallet");
    });
  });

  describe("Withdrawals", function () {
    it("calculate claimable rewards", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await nft
        .connect(nonWL[0])
        .mint([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [proof], {
          value: hre.ethers.utils.parseEther("10.0"),
        });
      for (let i = 10; i < 444; i++) {
        await nft.mint([i], [proof], {
          value: hre.ethers.utils.parseEther("1.0"),
        });
      }
      await nft.setClaimable();
      console.log("Enabled claims");

      expect(await nft.connect(nonWL[0]).calculateClaimableShare()).to.equal(
        ethers.utils.parseEther("1.0")
      );
    });

    it("claim rewards", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await nft
        .connect(nonWL[0])
        .mint([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [proof], {
          value: hre.ethers.utils.parseEther("10.0"),
        });
      for (let i = 10; i < 444; i++) {
        await nft.mint([i], [proof], {
          value: hre.ethers.utils.parseEther("1.0"),
        });
      }
      await nft.setClaimable();
      console.log("Enabled claims");

      await expect(nft.connect(nonWL[0]).claimShare()).to.changeEtherBalance(
        nonWL[0],
        ethers.utils.parseEther("1.0")
      );
    });

    it("fail claimin rewards twice", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await nft
        .connect(nonWL[0])
        .mint([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [proof], {
          value: hre.ethers.utils.parseEther("10.0"),
        });
      for (let i = 10; i < 444; i++) {
        await nft.mint([i], [proof], {
          value: hre.ethers.utils.parseEther("1.0"),
        });
      }
      await nft.setClaimable();
      console.log("Enabled claims");

      await expect(nft.connect(nonWL[0]).claimShare()).to.changeEtherBalance(
        nonWL[0],
        ethers.utils.parseEther("1.0")
      );
      await expect(nft.connect(nonWL[0]).claimShare()).to.be.revertedWith(
        "You have zero balance"
      );
    });

    it("claim rewards if bought an unclaimed one before claiming", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await nft
        .connect(nonWL[0])
        .mint([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [proof], {
          value: hre.ethers.utils.parseEther("10.0"),
        });
      for (let i = 10; i < 444; i++) {
        await nft.mint([i], [proof], {
          value: hre.ethers.utils.parseEther("1.0"),
        });
      }
      await nft.setClaimable();
      console.log("Enabled claims");

      await nft["safeTransferFrom(address,address,uint256)"](
        owner.address,
        nonWL[0].address,
        11
      );
      console.log("Transfered 1 NFT");

      await expect(nft.connect(nonWL[0]).claimShare()).to.changeEtherBalance(
        nonWL[0],
        ethers.utils.parseEther("1.1")
      );
    });

    it("claim rewards if bought an unclaimed one after claiming", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await nft
        .connect(nonWL[0])
        .mint([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [proof], {
          value: hre.ethers.utils.parseEther("10.0"),
        });
      for (let i = 10; i < 444; i++) {
        await nft.mint([i], [proof], {
          value: hre.ethers.utils.parseEther("1.0"),
        });
      }
      await nft.setClaimable();
      console.log("Enabled claims");

      await expect(nft.connect(nonWL[0]).claimShare()).to.changeEtherBalance(
        nonWL[0],
        ethers.utils.parseEther("1.0")
      );

      await nft["safeTransferFrom(address,address,uint256)"](
        owner.address,
        nonWL[0].address,
        11
      );
      console.log("Transfered 1 NFT");

      await expect(nft.connect(nonWL[0]).claimShare()).to.changeEtherBalance(
        nonWL[0],
        ethers.utils.parseEther("0.1")
      );
    });

    it("fails to claim rewards if not enabled", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await nft
        .connect(nonWL[0])
        .mint([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [proof], {
          value: hre.ethers.utils.parseEther("10.0"),
        });
      for (let i = 10; i < 444; i++) {
        await nft.mint([i], [proof], {
          value: hre.ethers.utils.parseEther("1.0"),
        });
      }

      await expect(nft.connect(nonWL[0]).claimShare()).to.be.revertedWith(
        "Claims is not enabled yet."
      );
    });

    it("fails to admin withdraw if time is not up", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await nft
        .connect(nonWL[0])
        .mint([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [proof], {
          value: hre.ethers.utils.parseEther("10.0"),
        });
      for (let i = 10; i < 444; i++) {
        await nft.mint([i], [proof], {
          value: hre.ethers.utils.parseEther("1.0"),
        });
      }
      await expect(nft.withdrawAll()).to.be.revertedWith(
        "Balances are not claimable yet!"
      );
    });

    it("admin withdraw remaining ether", async function () {
      const {
        nft,
        memberWL,
        followerWL,
        nonWL,
        price,
        owner,
        royaltyAmount,
        treeFollowers,
        treeMembers,
        padBuffer,
      } = await loadFixture(deployGen30NFT);

      await nft.setMintable();
      console.log("NFTs are now mintable!");

      await nft.setPreSale();
      console.log("Public sale is enabled now!");
      const proof = ethers.utils.hexZeroPad("0x00", 32);
      await nft
        .connect(nonWL[0])
        .mint([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [proof], {
          value: hre.ethers.utils.parseEther("10.0"),
        });
      for (let i = 10; i < 444; i++) {
        await nft.mint([i], [proof], {
          value: hre.ethers.utils.parseEther("1.0"),
        });
      }
      await nft.setClaimable();
      console.log("Enabled claims");
      await network.provider.send("evm_setNextBlockTimestamp", [1690635824]);
      await expect(nft.withdrawAll()).to.changeEtherBalance(
        owner,
        ethers.utils.parseEther("44.4")
      );
    });
  });

  it("admin withdraw remaining ether (previously claimed rewards by NFT owners)", async function () {
    const {
      nft,
      memberWL,
      followerWL,
      nonWL,
      price,
      owner,
      royaltyAmount,
      treeFollowers,
      treeMembers,
      padBuffer,
    } = await loadFixture(deployGen30NFT);

    await nft.setMintable();
    console.log("NFTs are now mintable!");

    await nft.setPreSale();
    console.log("Public sale is enabled now!");
    const proof = ethers.utils.hexZeroPad("0x00", 32);
    await nft.connect(nonWL[0]).mint([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [proof], {
      value: hre.ethers.utils.parseEther("10.0"),
    });
    for (let i = 10; i < 444; i++) {
      await nft.mint([i], [proof], {
        value: hre.ethers.utils.parseEther("1.0"),
      });
    }
    await nft.setClaimable();
    console.log("Enabled claims");

    await expect(nft.connect(nonWL[0]).claimShare()).to.changeEtherBalance(
      nonWL[0],
      ethers.utils.parseEther("1.0")
    );
    await network.provider.send("evm_setNextBlockTimestamp", [1690635824]);
    await expect(nft.withdrawAll()).to.changeEtherBalance(
      owner,
      ethers.utils.parseEther("43.4")
    );
  });
});
