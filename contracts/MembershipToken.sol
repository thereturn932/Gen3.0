// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "./IMembershipToken.sol";

contract MVPMembershipToken is ERC721, Ownable, IMVPMembershipToken {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    struct Pool {
        uint poolId;
        address nftCollection;
        uint poolBalance;
        uint poolBalanceForRound;
        uint poolMembers;
        uint poolRound;
    }

    mapping(address => bool) isCollection;
    mapping(address => Pool) poolOfCollection;
    Pool[] private pools;
    mapping(address => uint) poolIndex;

    /// poolIndex => user => roundID
    mapping(uint => mapping(address => uint)) latestWithdrawRound;

    /// poolIndex => round => pay per token
    mapping(uint => mapping(uint => uint)) payPerRoundPerToken;

    modifier onlyCollection() {
        require(isCollection[msg.sender], "Only Collections");
        _;
    }

    constructor() ERC721("MVP Membership Token", "MVPT") {}

    function _baseURI() internal pure override returns (string memory) {
        return "ipfs://test/";
    }

    function safeMint(address to) public onlyOwner {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId // required for this function to be override
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, tokenId);
        updatePoolForMembership(from, to);
    }

    function createPool(address _collectionAddress) external onlyOwner {
        Pool storage newPool = pools.push();
        newPool.nftCollection = _collectionAddress;
        isCollection[_collectionAddress] = true;
        poolOfCollection[_collectionAddress] = newPool;
        poolIndex[_collectionAddress] = pools.length - 1;
        newPool.poolId = poolIndex[_collectionAddress];
    }

    function readPool(
        address _collectionAddress
    ) external view returns (Pool memory) {
        return poolOfCollection[_collectionAddress];
    }

    function updatePool(address from, address to) external onlyCollection {
        Pool storage pool = poolOfCollection[msg.sender];
        int newUserCount = 0;
        if (balanceOf(from) > 0) {
            newUserCount--;
        }
        if (balanceOf(to) > 0) {
            newUserCount++;
        }
        updateMemberCount(pool, newUserCount);
    }

    function depositPool() external payable {
        Pool storage pool = poolOfCollection[msg.sender];
        pool.poolBalance += msg.value;
        pool.poolBalanceForRound += msg.value;
    }

    function updatePoolForMembership(address from, address to) internal {
        uint poolLength = pools.length;
        if (balanceOf(from) == 1) {
            for (uint i = 0; i < poolLength; i++) {
                int newUserCount = 0;
                Pool storage pool = pools[i];
                if (IERC721(pool.nftCollection).balanceOf(from) > 0) {
                    newUserCount--;
                }
                if (balanceOf(to) == 0) {
                    if (IERC721(pool.nftCollection).balanceOf(to) > 0) {
                        newUserCount++;
                    }
                }
                updateMemberCount(pool, newUserCount);
            }
        } else if (balanceOf(from) > 1) {
            for (uint i = 0; i < poolLength; i++) {
                Pool storage pool = pools[i];
                if (balanceOf(to) == 0) {
                    if (IERC721(pool.nftCollection).balanceOf(to) > 0) {
                        updateMemberCount(pool, 1);
                    }
                }
            }
        }
    }

    function updateMemberCount(Pool storage pool, int resulting) internal {
        if (resulting < 0) {
            require(pool.poolMembers > 0, "Pool already has no members");
        }
        _newRound(pool);
        pool.poolMembers = uint(int(pool.poolMembers) + resulting);
    }

    function _newRound(Pool storage pool) internal {
        payPerRoundPerToken[pool.poolId][pool.poolRound] =
            pool.poolBalanceForRound /
            pool.poolMembers;
        pool.poolBalanceForRound = 0;
        pool.poolRound++;
    }

    function withdrawMember(address _collectionAddress) external {
        require(
            (balanceOf(msg.sender) > 0 &&
                IERC721(_collectionAddress).balanceOf(msg.sender) > 0),
            "You are not revenue partner of this collection"
        );
        uint userBalance = calculateRevenue(_collectionAddress);
        Pool storage pool = poolOfCollection[_collectionAddress];
        _newRound(poolOfCollection[_collectionAddress]);
        latestWithdrawRound[pool.poolId][msg.sender] = pool.poolRound;
        pool.poolBalance -= userBalance;
        (bool success, ) = payable(msg.sender).call{value: userBalance}("");
        require(success, "Transfer Failed");
    }

    function calculateRevenue(
        address _collectionAddress
    ) public view returns (uint) {
        Pool memory pool = poolOfCollection[_collectionAddress];
        uint latestRound = latestWithdrawRound[pool.poolId][msg.sender];
        uint userBalance = 0;
        for (uint i = latestRound; i < pool.poolRound; i++) {
            userBalance +=
                payPerRoundPerToken[pool.poolId][i] *
                IERC721(_collectionAddress).balanceOf(msg.sender);
        }
        return userBalance;
    }

    function deletePool(address _collectionAddress) external onlyOwner {
        Pool storage lastPool = pools[pools.length - 1];
        poolIndex[lastPool.nftCollection] = poolIndex[_collectionAddress];
        pools[poolIndex[_collectionAddress]] = pools[pools.length - 1];
        pools.pop();
        isCollection[_collectionAddress] = false;
        delete poolOfCollection[_collectionAddress];
        delete poolIndex[_collectionAddress];
    }

    function getPools() external view returns (Pool[] memory) {
        return pools;
    }
}
