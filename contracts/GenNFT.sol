//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "hardhat/console.sol";

interface IERC2981Royalties {
    function royaltyInfo(uint256 _tokenId, uint256 _value)
        external
        view
        returns (address _receiver, uint256 _royaltyAmount);
}

contract Gen30 is
    Context,
    Ownable,
    ERC721Enumerable,
    ERC721URIStorage,
    IERC2981Royalties
{
    address royaltyOwner;
    uint24 _royaltyAmount;
    using Strings for uint256;

    string private _baseTokenURI;
    uint256 public price;

    bytes32 private rootMembers;
    bytes32 private rootFollowers;

    uint public memberLimit = 89;
    uint public followerLimit = 244;
    uint public nonOwnerLimit = 400;

    bool public isMemberLimit = true;
    bool public isFollowerLimit = true;
    bool public isOwnerLimit = true;

    uint public memberMintedCount;
    uint public followerMintedCount;
    uint public totalMinted;

    mapping(address => uint) userMinted;
    mapping(address => bool) memberMint;
    mapping(address => bool) followerMint;

    bool public mintable; // false
    bool public inPreSale = true;
    bool public claimable; // false
    uint public totalRevenue;
    uint public revenuePerToken;

    mapping(uint => bool) isSold;
    mapping(uint => bool) isClaimed;

    uint maxSupply = 444;
    uint ownerCanClaimAll = 2**256 - 1;

    constructor(
        string memory baseTokenURI,
        uint256 _price,
        bytes32 _rootMembers,
        bytes32 _rootFollowers,
        address _royaltyRecipient,
        uint24 __royaltyAmount // 1000 is 10% 500 is 5%
    ) ERC721("Gen3.0", "GEN3") {
        rootMembers = _rootMembers;
        rootFollowers = _rootFollowers;
        _baseTokenURI = baseTokenURI;
        price = _price;
        royaltyOwner = _royaltyRecipient;
        _royaltyAmount = __royaltyAmount;
    }

    function setPrice(uint256 _price) external onlyOwner {
        price = _price;
    }

    function setRootFollower(bytes1 _rootFollower) external onlyOwner {
        rootFollowers = _rootFollower;
    }

    function setRootMembers(bytes1 _rootMembers) external onlyOwner {
        rootMembers = _rootMembers;
    }

    function setMemberLimit(bool _isOwnerLimit, uint _memberLimit)
        external
        onlyOwner
    {
        isMemberLimit = _isOwnerLimit;
        memberLimit = _memberLimit;
    }

    function setOwnerLimit(bool _isOwnerLimit, uint _nonOwnerLimit)
        external
        onlyOwner
    {
        isOwnerLimit = _isOwnerLimit;
        nonOwnerLimit = _nonOwnerLimit;
    }

    function setFollowLimit(bool _isFollowerLimit, uint _followerLimit)
        external
        onlyOwner
    {
        isFollowerLimit = _isFollowerLimit;
        followerLimit = _followerLimit;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }

    function setMintable() external onlyOwner {
        mintable = !mintable;
    }

    function mint(uint256[] calldata _tokenIds, bytes32[] calldata _merkleProof)
        external
        payable
    {
        if (msg.sender != owner()) {
            require(mintable, "Mint hasn't started yet");
            if (inPreSale) {
                bytes32 leaf = bytes32(uint256(uint160(msg.sender)));
                require(
                    _tokenIds.length == 1,
                    "Only 1 NFT can be minted during presale"
                );
                // console.log(
                //     "Is member",
                //     MerkleProof.verify(_merkleProof, rootMembers, leaf)
                // );
                // console.log(
                //     "Is follower",
                //     MerkleProof.verify(_merkleProof, rootFollowers, leaf)
                // );
                require(
                    MerkleProof.verify(_merkleProof, rootMembers, leaf) ||
                        MerkleProof.verify(_merkleProof, rootFollowers, leaf),
                    "You don't have whitelist"
                );
                if (MerkleProof.verify(_merkleProof, rootMembers, leaf)) {
                    // console.log("MEMBER");
                    require(
                        !memberMint[msg.sender],
                        "Already minted as a member"
                    );
                    if (isMemberLimit) {
                        require(
                            memberMintedCount < memberLimit,
                            "All member NFTs are sold"
                        );
                    }
                    memberMintedCount++;
                    memberMint[msg.sender] = true;
                } else if (
                    MerkleProof.verify(_merkleProof, rootFollowers, leaf)
                ) {
                    require(
                        !followerMint[msg.sender],
                        "Already minted as a follower"
                    );
                    if (isFollowerLimit) {
                        require(
                            followerMintedCount < followerLimit,
                            "All follower NFTs are sold"
                        );
                    }
                    followerMintedCount++;
                    followerMint[msg.sender] = true;
                }
            }
            require(_tokenIds.length > 0, "Amount cannot be zero");

            if (isOwnerLimit) {
                require(
                    (totalMinted + _tokenIds.length) < nonOwnerLimit,
                    "All non-owner tokens are minted"
                );
            }
            require(
                (userMinted[msg.sender] + _tokenIds.length) <= 10,
                "Maximum 10 NFT per wallet"
            );
            require(
                msg.value == price * _tokenIds.length,
                "Wrong amount of Ethers"
            );
        }

        for (uint256 i; i < _tokenIds.length; i++) {
            require(_tokenIds[i] < 444, "ID of token can't be larger than 443");
            isSold[_tokenIds[i]] = true;
            _mint(msg.sender, _tokenIds[i]);
        }
        userMinted[msg.sender] += _tokenIds.length;
        totalMinted += _tokenIds.length;
        totalRevenue += msg.value;
        (bool success, ) = owner().call{value: ((msg.value * 90) / 100)}("");
        require(success, "Transfer failed.");
        // console.log(userMinted[msg.sender]);
        // console.log("Holds",msg.value == price * _tokenIds.length);
        // console.log("Value",msg.value);
        // console.log("MINTED");
    }

    function setPreSale() external onlyOwner {
        inPreSale = !inPreSale;
    }

    function calculateClaimableShare()
        external
        view
        returns (uint claimableShare)
    {
        uint count = balanceOf(msg.sender);
        require(count > 0);
        uint unClaimed;
        for (uint i = 0; i < count; i++) {
            uint tokenId = tokenOfOwnerByIndex(msg.sender, i);
            if (!isClaimed[tokenId]) {
                unClaimed++;
            }
        }
        claimableShare = unClaimed * revenuePerToken;
    }

    function claimShare() external {
        require(claimable, "Claims is not enabled yet.");
        uint count = balanceOf(msg.sender);
        require(count > 0);
        uint unClaimed;
        for (uint i = 0; i < count; i++) {
            uint tokenId = tokenOfOwnerByIndex(msg.sender, i);
            if (!isClaimed[tokenId]) {
                isClaimed[tokenId] = true;
                unClaimed++;
            }
        }
        uint balance = unClaimed * revenuePerToken;
        console.log("Balance is", balance);
        console.log("Contract balance is", address(this).balance);
        require(balance > 0, "You have zero balance");
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "Transfer failed.");
    }

    function _exists(uint tokenId)
        internal
        view
        virtual
        override(ERC721)
        returns (bool)
    {
        return ERC721._exists(tokenId);
    }

    function _burn(uint256 tokenId)
        internal
        virtual
        override(ERC721, ERC721URIStorage)
    {
        return ERC721URIStorage._burn(tokenId);
    }

    function royaltyInfo(uint256, uint256 value)
        external
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        receiver = royaltyOwner;
        royaltyAmount = (value * _royaltyAmount) / 10000;
    }

    function setClaimable() external onlyOwner {
        claimable = !claimable;
        if (claimable) {
            revenuePerToken = ((totalRevenue * 10) / 100) / maxSupply;
            ownerCanClaimAll = block.timestamp + 30 days;
        }
    }

    function _setRoyalties(address recipient, uint256 value) internal {
        require(value <= 10000, "Royalty Too high");
        _royaltyAmount = uint24(value);
        royaltyOwner = recipient;
    }

    function checkSold(uint[] calldata _tokenIds) external view returns (bool) {
        for (uint i; i < _tokenIds.length; i++) {
            if (isSold[_tokenIds[i]]) {
                return false;
            }
        }
        return true;
    }

    function unSoldTokens()
        external
        view
        returns (uint[] memory unSoldTokenIds)
    {
        uint unSoldCounter;
        for (uint i; i < maxSupply; i++) {
            if (!isSold[i]) {
                unSoldCounter++;
            }
        }
        unSoldTokenIds = new uint[](unSoldCounter);
        uint counter;
        for (uint i; i < maxSupply; i++) {
            if (!isSold[i]) {
                unSoldTokenIds[counter] = i;
                counter++;
            }
        }
    }

    function isWhitelisted(address _user, bytes32[] calldata _merkleProof)
        external
        view
        returns (uint8 result)
    {
        bytes32 leaf = bytes32(uint256(uint160(_user)));
        if (MerkleProof.verify(_merkleProof, rootMembers, leaf)) {
            result = 1;
        } else if (MerkleProof.verify(_merkleProof, rootFollowers, leaf)) {
            result = 2;
        }
    }

    function withdrawAll() external onlyOwner {
        console.log("current", block.timestamp);
        console.log("required", ownerCanClaimAll);

        require(
            block.timestamp >= ownerCanClaimAll,
            "Balances are not claimable yet!"
        );
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        require(success, "Transfer failed.");
    }

    // OVERRIDES

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return
            interfaceId == type(IERC2981Royalties).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        require(_exists(tokenId), "URI query for nonexistent token");
        return
            string(abi.encodePacked(_baseURI(), tokenId.toString(), ".json"));
    }
}
