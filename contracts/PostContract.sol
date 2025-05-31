// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title PostContract
 * @dev Smart contract for managing posts on the Blocks platform
 */
contract PostContract {
    struct Post {
        uint256 id;
        address author;
        string content;
        string[] images;
        uint256 timestamp;
        address[] likes;
        address[] dislikes;
        uint256[] comments;
        address[] mirrors;
        address[] bookmarks;
        uint256 netLikes; // Track net likes for content rating
        string rating;    // Content rating based on likes
        bool isVisible;   // Whether post is visible (false if in kill zone)
        uint256 communityId; // 0 for general posts, non-zero for community posts
    }
    
    struct Comment {
        uint256 id;
        uint256 postId;
        address author;
        string content;
        uint256 timestamp;
        address[] likes;
        address[] dislikes;
        uint256 netLikes;
    }
    
    // Counter for post IDs
    uint256 private _nextPostId = 1;
    
    // Counter for comment IDs
    uint256 private _nextCommentId = 1;
    
    // Mapping from post ID to post
    mapping(uint256 => Post) public posts;
    
    // Mapping from comment ID to comment
    mapping(uint256 => Comment) public comments;
    
    // Mapping user => postIds they created
    mapping(address => uint256[]) public userPosts;
    
    // Mapping user => postIds they liked
    mapping(address => uint256[]) public userLikes;
    
    // Mapping user => postIds they disliked
    mapping(address => uint256[]) public userDislikes;
    
    // Mapping user => postIds they mirrored
    mapping(address => uint256[]) public userMirrors;
    
    // Mapping user => postIds they bookmarked
    mapping(address => uint256[]) public userBookmarks;
    
    // Mapping for post likes/dislikes: postId => user => bool
    mapping(uint256 => mapping(address => bool)) public postLikedBy;
    mapping(uint256 => mapping(address => bool)) public postDislikedBy;
    
    // Mapping for post mirrors: postId => user => bool
    mapping(uint256 => mapping(address => bool)) public postMirroredBy;
    
    // Mapping for post bookmarks: postId => user => bool
    mapping(uint256 => mapping(address => bool)) public postBookmarkedBy;
    
    // Mapping for comment likes/dislikes: commentId => user => bool
    mapping(uint256 => mapping(address => bool)) public commentLikedBy;
    mapping(uint256 => mapping(address => bool)) public commentDislikedBy;
    
    // Mapping for community posts: communityId => postIds
    mapping(uint256 => uint256[]) public communityPosts;
    
    // Mapping for user community posts count: user => communityId => count
    mapping(address => mapping(uint256 => uint256)) public userCommunityPostCount;
    
    // Rating thresholds
    uint256 public constant BRONZE_THRESHOLD = 5;
    uint256 public constant SILVER_THRESHOLD = 20;
    uint256 public constant GOLD_THRESHOLD = 50;
    uint256 public constant PLATINUM_THRESHOLD = 150;
    uint256 public constant DIAMOND_THRESHOLD = 500;
    uint256 public constant ACE_THRESHOLD = 1000;
    uint256 public constant CONQUEROR_THRESHOLD = 1000000;
    
    // Kill zone threshold (if net likes drop below this, post is hidden)
    uint256 public constant KILL_ZONE_THRESHOLD = 2;
    
    // Interface to check if a profile exists and track post creation
    interface IProfileContract {
        function profileExists(address owner) external view returns (bool);
        function trackPostCreation(address user) external returns (bool);
        function updateUCR(address user, int256 likesChange, uint256 totalLikes) external;
        function canPostInCommunity(address user, uint256 communityId) external view returns (bool);
    }
    
    // Interface for token contract
    interface ITokenContract {
        function mintRewards(address recipient, uint256 amount) external;
    }
    
    // Profile contract reference
    IProfileContract public profileContract;
    
    // Token contract reference
    ITokenContract public tokenContract;
    
    // Community contract reference
    address public communityContract;
    
    // Events
    event PostCreated(uint256 indexed postId, address indexed author, uint256 timestamp, uint256 communityId);
    event PostLiked(uint256 indexed postId, address indexed user);
    event PostDisliked(uint256 indexed postId, address indexed user);
    event PostUnliked(uint256 indexed postId, address indexed user);
    event PostUndisliked(uint256 indexed postId, address indexed user);
    event CommentAdded(uint256 indexed commentId, uint256 indexed postId, address indexed author);
    event CommentLiked(uint256 indexed commentId, address indexed user);
    event CommentDisliked(uint256 indexed commentId, address indexed user);
    event PostMirrored(uint256 indexed postId, address indexed user);
    event PostUnmirrored(uint256 indexed postId, address indexed user);
    event PostTipped(uint256 indexed postId, address indexed tipper, uint256 amount);
    event PostBookmarked(uint256 indexed postId, address indexed user);
    event PostUnbookmarked(uint256 indexed postId, address indexed user);
    event PostHidden(uint256 indexed postId);
    event PostRatingUpdated(uint256 indexed postId, string rating);
    event TokenRewardDistributed(address indexed user, uint256 amount);
    
    modifier onlyCommunityContract() {
        require(msg.sender == communityContract, "Only community contract can call this function");
        _;
    }
    
    /**
     * @dev Constructor
     * @param _profileContractAddress Address of the ProfileContract
     */
    constructor(address _profileContractAddress) {
        profileContract = IProfileContract(_profileContractAddress);
    }
    
    /**
     * @dev Set token contract address
     * @param _tokenContract Address of the token contract
     */
    function setTokenContract(address _tokenContract) external {
        // Only allow setting once
        require(address(tokenContract) == address(0), "Token contract already set");
        tokenContract = ITokenContract(_tokenContract);
    }
    
    /**
     * @dev Set community contract address
     * @param _communityContract Address of the community contract
     */
    function setCommunityContract(address _communityContract) external {
        // Only allow setting once
        require(communityContract == address(0), "Community contract already set");
        communityContract = _communityContract;
    }
    
    /**
     * @dev Create a new post
     * @param content Text content of the post
     * @param images Array of IPFS URIs for post images
     * @param communityId ID of the community (0 for general post)
     * @return New post ID
     */
    function createPost(string memory content, string[] memory images, uint256 communityId) external returns (uint256) {
        // User must have a profile to post
        require(profileContract.profileExists(msg.sender), "Must have a profile to post");
        
        // Track post creation rate limiting
        require(profileContract.trackPostCreation(msg.sender), "Post creation not allowed at this time");
        
        // Check community post limits
        if (communityId > 0) {
            // Check if user can post in this community
            require(profileContract.canPostInCommunity(msg.sender, communityId), "Not a member of this community");
            
            // Limit to 2 posts per community
            require(userCommunityPostCount[msg.sender][communityId] < 2, "Maximum posts per community reached (2)");
            
            // Increment community post count
            userCommunityPostCount[msg.sender][communityId]++;
        }
        
        // Create empty arrays for interactions
        address[] memory emptyAddresses = new address[](0);
        uint256[] memory emptyComments = new uint256[](0);
        
        // Create post with initial net like of 1 (creator's own like)
        uint256 postId = _nextPostId++;
        posts[postId] = Post({
            id: postId,
            author: msg.sender,
            content: content,
            images: images,
            timestamp: block.timestamp,
            likes: emptyAddresses,
            dislikes: emptyAddresses,
            comments: emptyComments,
            mirrors: emptyAddresses,
            bookmarks: emptyAddresses,
            netLikes: 1, // Start with 1 net like
            rating: "None", // No rating initially
            isVisible: true, // Post is visible by default
            communityId: communityId
        });
        
        // Add to user's posts
        userPosts[msg.sender].push(postId);
        
        // Add to community posts if applicable
        if (communityId > 0) {
            communityPosts[communityId].push(postId);
        }
        
        // Emit event
        emit PostCreated(postId, msg.sender, block.timestamp, communityId);
        
        return postId;
    }
    
    /**
     * @dev Like a post
     * @param postId ID of the post to like
     */
    function likePost(uint256 postId) external {
        // Check if post exists and is visible
        require(postId < _nextPostId, "Post does not exist");
        require(posts[postId].isVisible, "Post is not visible");
        
        // Check if user already liked the post
        require(!postLikedBy[postId][msg.sender], "Already liked this post");
        
        Post storage post = posts[postId];
        
        // If user previously disliked, remove dislike first
        if (postDislikedBy[postId][msg.sender]) {
            _removeDislike(postId, msg.sender);
        }
        
        // Add user to post likes
        post.likes.push(msg.sender);
        
        // Update liked status
        postLikedBy[postId][msg.sender] = true;
        
        // Add post to user likes
        userLikes[msg.sender].push(postId);
        
        // Increase net likes
        post.netLikes++;
        
        // Update post rating
        _updatePostRating(postId);
        
        // Update author's UCR
        _updateAuthorUCR(postId, 1, post.likes.length + post.dislikes.length);
        
        // Distribute token rewards based on likes milestone
        _distributeRewards(post.author, post.netLikes);
        
        // Emit event
        emit PostLiked(postId, msg.sender);
    }
    
    /**
     * @dev Dislike a post
     * @param postId ID of the post to dislike
     */
    function dislikePost(uint256 postId) external {
        // Check if post exists and is visible
        require(postId < _nextPostId, "Post does not exist");
        require(posts[postId].isVisible, "Post is not visible");
        
        // Check if user already disliked the post
        require(!postDislikedBy[postId][msg.sender], "Already disliked this post");
        
        Post storage post = posts[postId];
        
        // If user previously liked, remove like first
        if (postLikedBy[postId][msg.sender]) {
            _removeLike(postId, msg.sender);
        }
        
        // Add user to post dislikes
        post.dislikes.push(msg.sender);
        
        // Update disliked status
        postDislikedBy[postId][msg.sender] = true;
        
        // Add post to user dislikes
        userDislikes[msg.sender].push(postId);
        
        // Decrease net likes
        post.netLikes--;
        
        // Check kill zone
        if (post.netLikes < KILL_ZONE_THRESHOLD) {
            post.isVisible = false;
            emit PostHidden(postId);
        }
        
        // Update post rating
        _updatePostRating(postId);
        
        // Update author's UCR
        _updateAuthorUCR(postId, -1, post.likes.length + post.dislikes.length);
        
        // Emit event
        emit PostDisliked(postId, msg.sender);
    }
    
    /**
     * @dev Unlike a post
     * @param postId ID of the post to unlike
     */
    function unlikePost(uint256 postId) external {
        // Check if user actually liked the post
        require(postLikedBy[postId][msg.sender], "Haven't liked this post");
        
        // Remove like
        _removeLike(postId, msg.sender);
        
        // Update author's UCR
        Post storage post = posts[postId];
        _updateAuthorUCR(postId, -1, post.likes.length + post.dislikes.length);
        
        // Emit event
        emit PostUnliked(postId, msg.sender);
    }
    
    /**
     * @dev Undislike a post
     * @param postId ID of the post to undislike
     */
    function undislikePost(uint256 postId) external {
        // Check if user actually disliked the post
        require(postDislikedBy[postId][msg.sender], "Haven't disliked this post");
        
        // Remove dislike
        _removeDislike(postId, msg.sender);
        
        // Update author's UCR
        Post storage post = posts[postId];
        _updateAuthorUCR(postId, 1, post.likes.length + post.dislikes.length);
        
        // Emit event
        emit PostUndisliked(postId, msg.sender);
    }
    
    /**
     * @dev Comment on a post
     * @param postId ID of the post to comment on
     * @param content Comment text
     * @return New comment ID
     */
    function commentOnPost(uint256 postId, string memory content) external returns (uint256) {
        // Check if post exists and is visible
        require(postId < _nextPostId, "Post does not exist");
        require(posts[postId].isVisible, "Post is not visible");
        
        // User must have a profile to comment
        require(profileContract.profileExists(msg.sender), "Must have a profile to comment");
        
        // Create empty arrays for likes/dislikes
        address[] memory emptyAddresses = new address[](0);
        
        // Create comment
        uint256 commentId = _nextCommentId++;
        comments[commentId] = Comment({
            id: commentId,
            postId: postId,
            author: msg.sender,
            content: content,
            timestamp: block.timestamp,
            likes: emptyAddresses,
            dislikes: emptyAddresses,
            netLikes: 0
        });
        
        // Add to post's comments
        posts[postId].comments.push(commentId);
        
        // Emit event
        emit CommentAdded(commentId, postId, msg.sender);
        
        return commentId;
    }
    
    /**
     * @dev Like a comment
     * @param commentId ID of the comment to like
     */
    function likeComment(uint256 commentId) external {
        // Check if comment exists
        require(commentId < _nextCommentId, "Comment does not exist");
        
        // Check if user already liked the comment
        require(!commentLikedBy[commentId][msg.sender], "Already liked this comment");
        
        Comment storage comment = comments[commentId];
        
        // If user previously disliked, remove dislike first
        if (commentDislikedBy[commentId][msg.sender]) {
            // Update disliked status
            commentDislikedBy[commentId][msg.sender] = false;
            
            // Remove from dislikes array
            _removeAddressFromArray(comment.dislikes, msg.sender);
            
            // Increase net likes
            comment.netLikes++;
        }
        
        // Add user to comment likes
        comment.likes.push(msg.sender);
        
        // Update liked status
        commentLikedBy[commentId][msg.sender] = true;
        
        // Increase net likes
        comment.netLikes++;
        
        // Update author's UCR
        _updateAuthorUCR(comments[commentId].postId, 1, comment.likes.length + comment.dislikes.length);
        
        // Emit event
        emit CommentLiked(commentId, msg.sender);
    }
    
    /**
     * @dev Dislike a comment
     * @param commentId ID of the comment to dislike
     */
    function dislikeComment(uint256 commentId) external {
        // Check if comment exists
        require(commentId < _nextCommentId, "Comment does not exist");
        
        // Check if user already disliked the comment
        require(!commentDislikedBy[commentId][msg.sender], "Already disliked this comment");
        
        Comment storage comment = comments[commentId];
        
        // If user previously liked, remove like first
        if (commentLikedBy[commentId][msg.sender]) {
            // Update liked status
            commentLikedBy[commentId][msg.sender] = false;
            
            // Remove from likes array
            _removeAddressFromArray(comment.likes, msg.sender);
            
            // Decrease net likes
            comment.netLikes--;
        }
        
        // Add user to comment dislikes
        comment.dislikes.push(msg.sender);
        
        // Update disliked status
        commentDislikedBy[commentId][msg.sender] = true;
        
        // Decrease net likes
        comment.netLikes--;
        
        // Update author's UCR
        _updateAuthorUCR(comments[commentId].postId, -1, comment.likes.length + comment.dislikes.length);
        
        // Emit event
        emit CommentDisliked(commentId, msg.sender);
    }
    
    /**
     * @dev Mirror a post (similar to retweet)
     * @param postId ID of the post to mirror
     */
    function mirrorPost(uint256 postId) external {
        // Check if post exists and is visible
        require(postId < _nextPostId, "Post does not exist");
        require(posts[postId].isVisible, "Post is not visible");
        
        // Check if user already mirrored the post
        require(!postMirroredBy[postId][msg.sender], "Already mirrored this post");
        
        // Can't mirror your own post
        require(posts[postId].author != msg.sender, "Cannot mirror your own post");
        
        // Add user to post mirrors
        posts[postId].mirrors.push(msg.sender);
        
        // Update mirrored status
        postMirroredBy[postId][msg.sender] = true;
        
        // Add post to user mirrors
        userMirrors[msg.sender].push(postId);
        
        // Emit event
        emit PostMirrored(postId, msg.sender);
    }
    
    /**
     * @dev Unmirror a post
     * @param postId ID of the post to unmirror
     */
    function unmirrorPost(uint256 postId) external {
        // Check if user actually mirrored the post
        require(postMirroredBy[postId][msg.sender], "Haven't mirrored this post");
        
        // Update mirrored status
        postMirroredBy[postId][msg.sender] = false;
        
        // Remove from mirrors array
        _removeAddressFromArray(posts[postId].mirrors, msg.sender);
        
        // Remove from user mirrors
        _removeUintFromArray(userMirrors[msg.sender], postId);
        
        // Emit event
        emit PostUnmirrored(postId, msg.sender);
    }
    
    /**
     * @dev Bookmark a post
     * @param postId ID of the post to bookmark
     */
    function bookmarkPost(uint256 postId) external {
        // Check if post exists
        require(postId < _nextPostId, "Post does not exist");
        
        // Check if user already bookmarked the post
        require(!postBookmarkedBy[postId][msg.sender], "Already bookmarked this post");
        
        // Add user to post bookmarks
        posts[postId].bookmarks.push(msg.sender);
        
        // Update bookmarked status
        postBookmarkedBy[postId][msg.sender] = true;
        
        // Add post to user bookmarks
        userBookmarks[msg.sender].push(postId);
        
        // Emit event
        emit PostBookmarked(postId, msg.sender);
    }
    
    /**
     * @dev Remove bookmark from a post
     * @param postId ID of the post to unbookmark
     */
    function unbookmarkPost(uint256 postId) external {
        // Check if user actually bookmarked the post
        require(postBookmarkedBy[postId][msg.sender], "Haven't bookmarked this post");
        
        // Update bookmarked status
        postBookmarkedBy[postId][msg.sender] = false;
        
        // Remove from bookmarks array
        _removeAddressFromArray(posts[postId].bookmarks, msg.sender);
        
        // Remove from user bookmarks
        _removeUintFromArray(userBookmarks[msg.sender], postId);
        
        // Emit event
        emit PostUnbookmarked(postId, msg.sender);
    }
    
    /**
     * @dev Tip a post creator with MATIC
     * @param postId ID of the post to tip
     */
    function tipPost(uint256 postId) external payable {
        // Check if post exists and is visible
        require(postId < _nextPostId, "Post does not exist");
        require(posts[postId].isVisible, "Post is not visible");
        
        // Check tip amount
        require(msg.value > 0, "Tip amount must be greater than 0");
        
        // Get post author
        address payable author = payable(posts[postId].author);
        
        // Send tip to author
        (bool sent,) = author.call{value: msg.value}("");
        require(sent, "Failed to send tip");
        
        // Emit event
        emit PostTipped(postId, msg.sender, msg.value);
    }
    
    /**
     * @dev Remove a like from a post
     * @param postId ID of the post
     * @param user Address of the user
     */
    function _removeLike(uint256 postId, address user) internal {
        Post storage post = posts[postId];
        
        // Update liked status
        postLikedBy[postId][user] = false;
        
        // Remove from likes array
        _removeAddressFromArray(post.likes, user);
        
        // Remove from user likes
        _removeUintFromArray(userLikes[user], postId);
        
        // Decrease net likes
        post.netLikes--;
        
        // Check kill zone
        if (post.netLikes < KILL_ZONE_THRESHOLD) {
            post.isVisible = false;
            emit PostHidden(postId);
        }
        
        // Update post rating
        _updatePostRating(postId);
    }
    
    /**
     * @dev Remove a dislike from a post
     * @param postId ID of the post
     * @param user Address of the user
     */
    function _removeDislike(uint256 postId, address user) internal {
        Post storage post = posts[postId];
        
        // Update disliked status
        postDislikedBy[postId][user] = false;
        
        // Remove from dislikes array
        _removeAddressFromArray(post.dislikes, user);
        
        // Remove from user dislikes
        _removeUintFromArray(userDislikes[user], postId);
        
        // Increase net likes
        post.netLikes++;
        
        // Update post visibility if coming out of kill zone
        if (post.netLikes >= KILL_ZONE_THRESHOLD && !post.isVisible) {
            post.isVisible = true;
        }
        
        // Update post rating
        _updatePostRating(postId);
    }
    
    /**
     * @dev Update post rating based on net likes
     * @param postId ID of the post to update
     */
    function _updatePostRating(uint256 postId) internal {
        Post storage post = posts[postId];
        string memory newRating;
        
        // Determine rating based on thresholds
        if (post.netLikes >= CONQUEROR_THRESHOLD) {
            newRating = "Conqueror";
        } else if (post.netLikes >= ACE_THRESHOLD) {
            newRating = "Ace";
        } else if (post.netLikes >= DIAMOND_THRESHOLD) {
            newRating = "Diamond";
        } else if (post.netLikes >= PLATINUM_THRESHOLD) {
            newRating = "Platinum";
        } else if (post.netLikes >= GOLD_THRESHOLD) {
            newRating = "Gold";
        } else if (post.netLikes >= SILVER_THRESHOLD) {
            newRating = "Silver";
        } else if (post.netLikes >= BRONZE_THRESHOLD) {
            newRating = "Bronze";
        } else {
            newRating = "None";
        }
        
        // Update rating if changed
        if (keccak256(bytes(post.rating)) != keccak256(bytes(newRating))) {
            post.rating = newRating;
            emit PostRatingUpdated(postId, newRating);
        }
    }
    
    /**
     * @dev Update author's User Credit Rating
     * @param postId ID of the post
     * @param likesChange Net change in likes (+1 for like, -1 for dislike)
     * @param totalInteractions Total likes + dislikes for calculation
     */
    function _updateAuthorUCR(uint256 postId, int256 likesChange, uint256 totalInteractions) internal {
        address author = posts[postId].author;
        
        // Call profile contract to update UCR
        if (totalInteractions > 0) {
            profileContract.updateUCR(author, likesChange, totalInteractions);
        }
    }
    
    /**
     * @dev Distribute token rewards based on likes milestones
     * @param author Post author address
     * @param netLikes Current net likes count
     */
    function _distributeRewards(address author, uint256 netLikes) internal {
        // Only distribute rewards if token contract is set
        if (address(tokenContract) != address(0)) {
            uint256 rewardAmount = 0;
            
            // Check for milestone achievements
            if (netLikes == BRONZE_THRESHOLD) {
                rewardAmount = 5;
            } else if (netLikes == SILVER_THRESHOLD) {
                rewardAmount = 20;
            } else if (netLikes == GOLD_THRESHOLD) {
                rewardAmount = 50;
            } else if (netLikes == PLATINUM_THRESHOLD) {
                rewardAmount = 150;
            } else if (netLikes == DIAMOND_THRESHOLD) {
                rewardAmount = 500;
            } else if (netLikes == ACE_THRESHOLD) {
                rewardAmount = 1000;
            } else if (netLikes == CONQUEROR_THRESHOLD) {
                rewardAmount = 10000;
            }
            
            // Distribute rewards if milestone reached
            if (rewardAmount > 0) {
                tokenContract.mintRewards(author, rewardAmount);
                emit TokenRewardDistributed(author, rewardAmount);
            }
        }
    }
    
    /**
     * @dev Get a single post
     * @param postId ID of the post to get
     * @return author Post author address
     * @return content Post content
     * @return timestamp Post creation timestamp
     * @return images Post image URIs
     */
    function getPost(uint256 postId) external view returns (
        address author,
        string memory content,
        uint256 timestamp,
        string[] memory images
    ) {
        // Check if post exists
        require(postId < _nextPostId, "Post does not exist");
        
        Post storage post = posts[postId];
        return (
            post.author,
            post.content,
            post.timestamp,
            post.images
        );
    }
    
    /**
     * @dev Get all posts by a user
     * @param user Address of the user
     * @return Array of post IDs
     */
    function getUserPosts(address user) external view returns (uint256[] memory) {
        return userPosts[user];
    }
    
    /**
     * @dev Get all posts liked by a user
     * @param user Address of the user
     * @return Array of post IDs
     */
    function getUserLikes(address user) external view returns (uint256[] memory) {
        return userLikes[user];
    }
    
    /**
     * @dev Get all posts mirrored by a user
     * @param user Address of the user
     * @return Array of post IDs
     */
    function getUserMirrors(address user) external view returns (uint256[] memory) {
        return userMirrors[user];
    }
    
    /**
     * @dev Get all posts bookmarked by a user
     * @param user Address of the user
     * @return Array of post IDs
     */
    function getUserBookmarks(address user) external view returns (uint256[] memory) {
        return userBookmarks[user];
    }
    
    /**
     * @dev Get like count for a post
     * @param postId ID of the post
     * @return Number of likes
     */
    function getLikeCount(uint256 postId) external view returns (uint256) {
        return posts[postId].likes.length;
    }
    
    /**
     * @dev Get comment count for a post
     * @param postId ID of the post
     * @return Number of comments
     */
    function getCommentCount(uint256 postId) external view returns (uint256) {
        return posts[postId].comments.length;
    }
    
    /**
     * @dev Get mirror count for a post
     * @param postId ID of the post
     * @return Number of mirrors
     */
    function getMirrorCount(uint256 postId) external view returns (uint256) {
        return posts[postId].mirrors.length;
    }
    
    /**
     * @dev Get bookmark count for a post
     * @param postId ID of the post
     * @return Number of bookmarks
     */
    function getBookmarkCount(uint256 postId) external view returns (uint256) {
        return posts[postId].bookmarks.length;
    }
    
    /**
     * @dev Get all comments for a post
     * @param postId ID of the post
     * @return Array of comment IDs
     */
    function getPostComments(uint256 postId) external view returns (uint256[] memory) {
        return posts[postId].comments;
    }
    
    /**
     * @dev Check if user has liked a post
     * @param postId ID of the post
     * @param user Address of the user
     * @return True if user has liked the post
     */
    function hasLiked(uint256 postId, address user) external view returns (bool) {
        return postLikedBy[postId][user];
    }
    
    /**
     * @dev Check if user has mirrored a post
     * @param postId ID of the post
     * @param user Address of the user
     * @return True if user has mirrored the post
     */
    function hasMirrored(uint256 postId, address user) external view returns (bool) {
        return postMirroredBy[postId][user];
    }
    
    /**
     * @dev Check if user has bookmarked a post
     * @param postId ID of the post
     * @param user Address of the user
     * @return True if user has bookmarked the post
     */
    function hasBookmarked(uint256 postId, address user) external view returns (bool) {
        return postBookmarkedBy[postId][user];
    }
    
    /**
     * @dev Get dislike count for a post
     * @param postId ID of the post
     * @return Number of dislikes
     */
    function getDislikeCount(uint256 postId) external view returns (uint256) {
        return posts[postId].dislikes.length;
    }
    
    /**
     * @dev Get net likes for a post
     * @param postId ID of the post
     * @return Net likes count
     */
    function getNetLikes(uint256 postId) external view returns (uint256) {
        return posts[postId].netLikes;
    }
    
    /**
     * @dev Get rating for a post
     * @param postId ID of the post
     * @return Rating string
     */
    function getPostRating(uint256 postId) external view returns (string memory) {
        return posts[postId].rating;
    }
    
    /**
     * @dev Check if a post is visible (not in kill zone)
     * @param postId ID of the post
     * @return True if post is visible
     */
    function isPostVisible(uint256 postId) external view returns (bool) {
        return posts[postId].isVisible;
    }
    
    /**
     * @dev Get likes percentage for a post
     * @param postId ID of the post
     * @return Likes percentage (0-100)
     */
    function getLikesPercentage(uint256 postId) external view returns (uint256) {
        Post storage post = posts[postId];
        uint256 totalVotes = post.likes.length + post.dislikes.length;
        
        if (totalVotes == 0) {
            return 0;
        }
        
        return (post.likes.length * 100) / totalVotes;
    }
    
    /**
     * @dev Helper function
