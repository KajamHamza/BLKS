
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title BlocksToken
 * @dev ERC20 Token for Blocks platform with reward distribution
 */
contract BlocksToken {
    string public name = "Blocks Token";
    string public symbol = "BLKS";
    uint8 public decimals = 18;
    uint256 public totalSupply = 0;
    
    // Maximum supply cap
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion BLKS
    
    // Post contract reference for authorization
    address public postContract;
    
    // Profile contract reference
    address public profileContract;
    
    // Community contract reference
    address public communityContract;
    
    // Mapping from address to token balance
    mapping(address => uint256) public balanceOf;
    
    // Mapping from owner => spender => allowance
    mapping(address => mapping(address => uint256)) public allowance;
    
    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event RewardMinted(address indexed to, uint256 amount);
    
    /**
     * @dev Set contract references to authorize reward minting
     * @param _postContract Address of the post contract
     * @param _profileContract Address of the profile contract
     * @param _communityContract Address of the community contract
     */
    function setContracts(
        address _postContract,
        address _profileContract,
        address _communityContract
    ) external {
        // Only allow setting once
        require(postContract == address(0), "Contracts already set");
        
        postContract = _postContract;
        profileContract = _profileContract;
        communityContract = _communityContract;
    }
    
    /**
     * @dev Mint tokens as rewards for user contributions
     * @param recipient Address to receive tokens
     * @param amount Amount to mint
     */
    function mintRewards(address recipient, uint256 amount) external {
        // Only authorized contracts can mint rewards
        require(
            msg.sender == postContract ||
            msg.sender == profileContract ||
            msg.sender == communityContract,
            "Not authorized to mint"
        );
        
        // Check max supply
        uint256 amountWithDecimals = amount * 10**18;
        require(totalSupply + amountWithDecimals <= MAX_SUPPLY, "Max supply exceeded");
        
        // Mint tokens to recipient
        balanceOf[recipient] += amountWithDecimals;
        totalSupply += amountWithDecimals;
        
        emit Transfer(address(0), recipient, amountWithDecimals);
        emit RewardMinted(recipient, amountWithDecimals);
    }
    
    /**
     * @dev Transfer tokens to another address
     * @param to Address to transfer to
     * @param value Amount to transfer
     * @return Success status
     */
    function transfer(address to, uint256 value) external returns (bool) {
        require(to != address(0), "Transfer to zero address");
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        
        emit Transfer(msg.sender, to, value);
        return true;
    }
    
    /**
     * @dev Approve another address to spend tokens
     * @param spender Address to approve
     * @param value Amount to approve
     * @return Success status
     */
    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }
    
    /**
     * @dev Transfer from one address to another (with allowance)
     * @param from Address to transfer from
     * @param to Address to transfer to
     * @param value Amount to transfer
     * @return Success status
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(to != address(0), "Transfer to zero address");
        require(balanceOf[from] >= value, "Insufficient balance");
        require(allowance[from][msg.sender] >= value, "Insufficient allowance");
        
        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;
        
        emit Transfer(from, to, value);
        return true;
    }
}
