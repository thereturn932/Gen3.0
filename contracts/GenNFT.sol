pragma solidity ^0.8.0;

//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

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
    uint24 _royaltyAmount = 500;
    using Strings for uint256;

    string private _baseTokenURI;
    uint256 public price;

    bytes32 private rootMembers;
    bytes32 private rootFollowers;

    uint public memberLimit = 89;
    uint public followerLimit = 244;

    uint public memberMinted;
    uint public followerMinted;

    mapping (address => uint) totalMinted;

    bool public inPreSale = true;
    bool public mintable;
    bool public claimable;
    uint public totalRevenue;
    uint public revenuePerToken;

    mapping(uint => bool) isSold;
    mapping(uint => bool) isClaimed;

    uint maxSupply = 444;

    constructor(string memory baseTokenURI, uint256 _price)
        ERC721("Gen3.0", "GEN3")
    {
        _baseTokenURI = baseTokenURI;
        price = _price;
    }

    function setPrice(uint256 _price) external onlyOwner {
        price = _price;
    }

    function setRoot(bytes1 newRoot) external onlyOwner {
        root = newRoot;
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

    function mint(uint256[] calldata _tokenIds, bytes32[] _merkleProof) external payable {
        require(mintable, "Mint hasn't started yet");
        if (inPreSale) {
            bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
            require(_tokenIds.length == 1, "Only 1 NFT can be minted during presale");
            require(MerkleProof.verify(_merkleProof, rootMembers, leaf) || MerkleProof.verify(_merkleProof, rootFollowers, leaf),"You don't have whitelist");
            if(MerkleProof.verify(_merkleProof, rootMembers, leaf)){
                require(memberMinted < memberLimit, "All member NFTs are sold");
                memberMinted++;
            }
            else if(MerkleProof.verify(_merkleProof, rootFollowers, leaf)){
                require(followerMinted < followerLimit, "All follower NFTs are sold");
                followerMinted++;
            }
        }
        require(_tokenIds.length > 0, "Amount cannot be zero");
        require(msg.value == price * _tokenIds.length, "Not enough balance");
        require((totalMinted[msg.sender] + _tokenIds.length) <= 10, "Maximum 10 NFT per wallet");

        for (uint256 i; i < _tokenIds.length; i++) {
            isSold[_tokenIds[i]] = true;
            _mint(msg.sender, _tokenIds[i]);
        }
        totalMinted[msg.sender] += _tokenIds.length;
        totalRevenue += msg.value;
        payable(owner()).transfer(msg.value);
    }

    function setPreSale() external onlyOwner {
        inPreSale = !inPreSale;
    }

    function claimShare() external {
        require(claimable, "Claims have not enabled yet.");
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
        payable(msg.sender).transfer(balance);
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
        revenuePerToken = totalRevenue / maxSupply;
    }

    function _setRoyalties(address recipient, uint256 value) internal {
        require(value <= 10000, "Royalty Too high");
        _royaltyAmount =  uint24(value);
        royaltyOwner = recipient;
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
        return string(abi.encodePacked(_baseURI(), tokenId.toString(), ".json"));
}
