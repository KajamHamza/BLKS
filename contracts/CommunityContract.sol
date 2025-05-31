
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title CommunityContract
 * @dev Smart contract for managing communities on the Blocks platform
 */
contract CommunityContract {
    struct Community {
        uint256 id;
        string name;
        string description;
        string coverImage;
        address owner;
        address[] moderators;
        address[] members;
        uint256 createdAt;
        string[] rules;
        bool isActive;
    }
    
    // Counter for community IDs
    uint256 private _nextCommunityId = 1;
    
    // Mapping from community ID to community
    mapping(uint256 => Community) public communities;
    
    // Mapping from community name to community ID
    mapping(string => uint256) public communityNameToId;
    
    // Mapping for community membership: communityId => user => bool
    mapping(uint256 => mapping(address => bool)) public communityMembers;
    
    // Mapping for community moderators: communityId => user => bool
    mapping(uint256 => mapping(address => bool)) public communityModerators;
    
    // Interface to profile contract
    interface IProfileContract {
        function profileExists(address owner) external view returns (bool);
        function registerUserCommunity(address user, uint256 communityId) external;
        function getUCRTier(address user) external view returns (string memory);
    }
    
    // Profile contract reference
    IProfileContract public profileContract;
    
    // Events
    event CommunityCreated(uint256 indexed communityId, string name, address indexed owner);
    event CommunityUpdated(uint256 indexed communityId, string description, string coverImage);
    event CommunityRuleAdded(uint256 indexed communityId, string rule);
    event ModeratorAdded(uint256 indexed communityId, address indexed moderator);
    event ModeratorRemoved(uint256 indexed communityId, address indexed moderator);
    event MemberJoined(uint256 indexed communityId, address indexed member);
    event MemberLeft(uint256 indexed communityId, address indexed member);
    event CommunityDeactivated(uint256 indexed communityId);
    event CommunityReactivated(uint256 indexed communityId);
    
    /**
     * @dev Constructor
     * @param _profileContractAddress Address of the ProfileContract
     */
    constructor(address _profileContractAddress) {
        profileContract = IProfileContract(_profileContractAddress);
    }
    
    /**
     * @dev Create a new community
     * @param name Community name (must be unique and start with "sb/")
     * @param description Community description
     * @param coverImage Community cover image URI
     * @param rules Initial community rules
     * @return New community ID
     */
    function createCommunity(
        string memory name,
        string memory description,
        string memory coverImage,
        string[] memory rules
    ) external returns (uint256) {
        // User must have a profile to create a community
        require(profileContract.profileExists(msg.sender), "Must have a profile to create community");
        
        // Check community name format
        require(bytes(name).length > 3, "Community name too short");
        require(bytes(name).length <= 50, "Community name too long");
        require(_startsWithSB(name), "Community name must start with 'sb/'");
        
        // Check if community name is available
        require(communityNameToId[name] == 0, "Community name already taken");
        
        // Check user credit rating - only valuable contributors or higher can create communities
        string memory tier = profileContract.getUCRTier(msg.sender);
        bool hasRequiredTier = 
            keccak256(bytes(tier)) == keccak256(bytes("Top Contributor")) ||
            keccak256(bytes(tier)) == keccak256(bytes("Valuable Contributor"));
        require(hasRequiredTier, "Insufficient user credit rating to create community");
        
        // Create empty arrays for moderators and members
        address[] memory emptyModerators = new address[](0);
        address[] memory emptyMembers = new address[](0);
        
        // Create community
        uint256 communityId = _nextCommunityId++;
        
        communities[communityId] = Community({
            id: communityId,
            name: name,
            description: description,
            coverImage: coverImage,
            owner: msg.sender,
            moderators: emptyModerators,
            members: emptyMembers,
            createdAt: block.timestamp,
            rules: rules,
            isActive: true
        });
        
        // Register community name
        communityNameToId[name] = communityId;
        
        // Add creator as first member
        _addMember(communityId, msg.sender);
        
        // Register user joining this community in profile contract
        profileContract.registerUserCommunity(msg.sender, communityId);
        
        // Emit event
        emit CommunityCreated(communityId, name, msg.sender);
        
        return communityId;
    }
    
    /**
     * @dev Update community details
     * @param communityId Community ID
     * @param description Updated community description
     * @param coverImage Updated cover image URI
     */
    function updateCommunity(
        uint256 communityId,
        string memory description,
        string memory coverImage
    ) external {
        // Check if community exists
        require(_communityExists(communityId), "Community does not exist");
        
        // Only owner can update
        require(communities[communityId].owner == msg.sender, "Only owner can update community");
        
        // Update community
        communities[communityId].description = description;
        communities[communityId].coverImage = coverImage;
        
        // Emit event
        emit CommunityUpdated(communityId, description, coverImage);
    }
    
    /**
     * @dev Add a new rule to the community
     * @param communityId Community ID
     * @param rule Rule text
     */
    function addCommunityRule(uint256 communityId, string memory rule) external {
        // Check if community exists
        require(_communityExists(communityId), "Community does not exist");
        
        // Only owner or moderators can add rules
        require(
            communities[communityId].owner == msg.sender || 
            communityModerators[communityId][msg.sender],
            "Only owner or moderators can add rules"
        );
        
        // Add rule
        communities[communityId].rules.push(rule);
        
        // Emit event
        emit CommunityRuleAdded(communityId, rule);
    }
    
    /**
     * @dev Add a moderator to the community
     * @param communityId Community ID
     * @param moderator Moderator address
     */
    function addModerator(uint256 communityId, address moderator) external {
        // Check if community exists
        require(_communityExists(communityId), "Community does not exist");
        
        // Only owner can add moderators
        require(communities[communityId].owner == msg.sender, "Only owner can add moderators");
        
        // Check if already a moderator
        require(!communityModerators[communityId][moderator], "Already a moderator");
        
        // Check if user has a profile
        require(profileContract.profileExists(moderator), "User must have a profile");
        
        // Add as moderator
        communities[communityId].moderators.push(moderator);
        communityModerators[communityId][moderator] = true;
        
        // Make sure moderator is also a member
        if (!communityMembers[communityId][moderator]) {
            _addMember(communityId, moderator);
            
            // Register in profile contract
            profileContract.registerUserCommunity(moderator, communityId);
        }
        
        // Emit event
        emit ModeratorAdded(communityId, moderator);
    }
    
    /**
     * @dev Remove a moderator from the community
     * @param communityId Community ID
     * @param moderator Moderator address
     */
    function removeModerator(uint256 communityId, address moderator) external {
        // Check if community exists
        require(_communityExists(communityId), "Community does not exist");
        
        // Only owner can remove moderators
        require(communities[communityId].owner == msg.sender, "Only owner can remove moderators");
        
        // Check if actually a moderator
        require(communityModerators[communityId][moderator], "Not a moderator");
        
        // Remove moderator status
        communityModerators[communityId][moderator] = false;
        
        // Remove from moderators array
        _removeAddressFromArray(communities[communityId].moderators, moderator);
        
        // Emit event
        emit ModeratorRemoved(communityId, moderator);
    }
    
    /**
     * @dev Join a community
     * @param communityId Community ID
     */
    function joinCommunity(uint256 communityId) external {
        // Check if community exists and is active
        require(_communityExists(communityId), "Community does not exist");
        require(communities[communityId].isActive, "Community is not active");
        
        // Check if already a member
        require(!communityMembers[communityId][msg.sender], "Already a member");
        
        // Check if user has a profile
        require(profileContract.profileExists(msg.sender), "Must have a profile to join community");
        
        // Check if user credit rating is sufficient (not a spam user)
        string memory tier = profileContract.getUCRTier(msg.sender);
        require(!_compareStrings(tier, "Spam User"), "Spam users cannot join communities");
        
        // Add member
        _addMember(communityId, msg.sender);
        
        // Register in profile contract
        profileContract.registerUserCommunity(msg.sender, communityId);
        
        // Emit event
        emit MemberJoined(communityId, msg.sender);
    }
    
    /**
     * @dev Leave a community
     * @param communityId Community ID
     */
    function leaveCommunity(uint256 communityId) external {
        // Check if community exists
        require(_communityExists(communityId), "Community does not exist");
        
        // Check if actually a member
        require(communityMembers[communityId][msg.sender], "Not a member");
        
        // Owner cannot leave their own community
        require(communities[communityId].owner != msg.sender, "Owner cannot leave their community");
        
        // If moderator, remove moderator status first
        if (communityModerators[communityId][msg.sender]) {
            communityModerators[communityId][msg.sender] = false;
            _removeAddressFromArray(communities[communityId].moderators, msg.sender);
            emit ModeratorRemoved(communityId, msg.sender);
        }
        
        // Remove member status
        communityMembers[communityId][msg.sender] = false;
        
        // Remove from members array
        _removeAddressFromArray(communities[communityId].members, msg.sender);
        
        // Emit event
        emit MemberLeft(communityId, msg.sender);
    }
    
    /**
     * @dev Deactivate a community
     * @param communityId Community ID
     */
    function deactivateCommunity(uint256 communityId) external {
        // Check if community exists
        require(_communityExists(communityId), "Community does not exist");
        
        // Only owner can deactivate
        require(communities[communityId].owner == msg.sender, "Only owner can deactivate community");
        
        // Deactivate community
        communities[communityId].isActive = false;
        
        // Emit event
        emit CommunityDeactivated(communityId);
    }
    
    /**
     * @dev Reactivate a community
     * @param communityId Community ID
     */
    function reactivateCommunity(uint256 communityId) external {
        // Check if community exists
        require(_communityExists(communityId), "Community does not exist");
        
        // Only owner can reactivate
        require(communities[communityId].owner == msg.sender, "Only owner can reactivate community");
        
        // Make sure community is currently inactive
        require(!communities[communityId].isActive, "Community is already active");
        
        // Reactivate community
        communities[communityId].isActive = true;
        
        // Emit event
        emit CommunityReactivated(communityId);
    }
    
    /**
     * @dev Add a member to a community
     * @param communityId Community ID
     * @param member Member address
     */
    function _addMember(uint256 communityId, address member) internal {
        communities[communityId].members.push(member);
        communityMembers[communityId][member] = true;
    }
    
    /**
     * @dev Check if a community exists
     * @param communityId Community ID
     * @return True if community exists
     */
    function _communityExists(uint256 communityId) internal view returns (bool) {
        return communityId > 0 && communityId < _nextCommunityId;
    }
    
    /**
     * @dev Check if a string starts with "sb/"
     * @param str String to check
     * @return True if string starts with "sb/"
     */
    function _startsWithSB(string memory str) internal pure returns (bool) {
        bytes memory strBytes = bytes(str);
        if (strBytes.length < 3) {
            return false;
        }
        
        return strBytes[0] == 's' && strBytes[1] == 'b' && strBytes[2] == '/';
    }
    
    /**
     * @dev Compare two strings
     * @param a First string
     * @param b Second string
     * @return True if strings are equal
     */
    function _compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
    
    /**
     * @dev Helper function to remove an address from an array
     * @param array The array to modify
     * @param addressToRemove The address to remove from the array
     */
    function _removeAddressFromArray(address[] storage array, address addressToRemove) internal {
        for (uint i = 0; i < array.length; i++) {
            if (array[i] == addressToRemove) {
                array[i] = array[array.length - 1];
                array.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Get community data
     * @param communityId Community ID
     * @return name Community name
     * @return description Community description
     * @return coverImage Community cover image
     * @return owner Community owner
     * @return createdAt Creation timestamp
     * @return memberCount Number of members
     * @return isActive Whether community is active
     */
    function getCommunity(uint256 communityId) external view returns (
        string memory name,
        string memory description,
        string memory coverImage,
        address owner,
        uint256 createdAt,
        uint256 memberCount,
        bool isActive
    ) {
        require(_communityExists(communityId), "Community does not exist");
        
        Community storage community = communities[communityId];
        
        return (
            community.name,
            community.description,
            community.coverImage,
            community.owner,
            community.createdAt,
            community.members.length,
            community.isActive
        );
    }
    
    /**
     * @dev Get community members
     * @param communityId Community ID
     * @return Array of member addresses
     */
    function getCommunityMembers(uint256 communityId) external view returns (address[] memory) {
        require(_communityExists(communityId), "Community does not exist");
        return communities[communityId].members;
    }
    
    /**
     * @dev Get community moderators
     * @param communityId Community ID
     * @return Array of moderator addresses
     */
    function getCommunityModerators(uint256 communityId) external view returns (address[] memory) {
        require(_communityExists(communityId), "Community does not exist");
        return communities[communityId].moderators;
    }
    
    /**
     * @dev Get community rules
     * @param communityId Community ID
     * @return Array of rules
     */
    function getCommunityRules(uint256 communityId) external view returns (string[] memory) {
        require(_communityExists(communityId), "Community does not exist");
        return communities[communityId].rules;
    }
    
    /**
     * @dev Check if user is a community member
     * @param communityId Community ID
     * @param user User address
     * @return True if user is a member
     */
    function isCommunityMember(uint256 communityId, address user) external view returns (bool) {
        return communityMembers[communityId][user];
    }
    
    /**
     * @dev Check if user is a community moderator
     * @param communityId Community ID
     * @param user User address
     * @return True if user is a moderator
     */
    function isCommunityModerator(uint256 communityId, address user) external view returns (bool) {
        return communityModerators[communityId][user];
    }
    
    /**
     * @dev Get community ID by name
     * @param name Community name
     * @return Community ID
     */
    function getCommunityIdByName(string memory name) external view returns (uint256) {
        uint256 communityId = communityNameToId[name];
        require(communityId > 0, "Community does not exist");
        return communityId;
    }
}
