
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum ContractInstruction {
    /// Create a new user profile
    /// Accounts expected:
    /// 0. `[signer]` The user's wallet account
    /// 1. `[]` The profile account (PDA)
    /// 2. `[]` The system program
    CreateProfile {
        username: String,
        bio: String,
        profile_image: String,
        cover_image: String,
    },
    /// Update an existing user profile
    /// Accounts expected:
    /// 0. `[signer, writable]` The user's wallet account
    UpdateProfile {
        bio: String,
        profile_image: String,
        cover_image: String,
    },
    /// Create a new post
    /// Accounts expected:
    /// 0. `[signer]` The post's author wallet account
    CreatePost {
        content: String,
        images: Vec<String>,
    },
    /// Like a post
    /// Accounts expected:
    /// 0. `[signer]` The user's wallet account
    LikePost {
        post_id: u64,
    },
    /// Comment on a post
    /// Accounts expected:
    /// 0. `[signer]` The user's wallet account
    CommentOnPost {
        content: String,
        parent_id: u64,
    },
    /// Follow another profile
    /// Accounts expected:
    /// 0. `[signer, writable]` The follower's wallet account
    /// 1. `[writable]` The profile to follow
    FollowProfile {
        profile_id: Pubkey,
    },
    /// Unfollow another profile
    /// Accounts expected:
    /// 0. `[signer, writable]` The follower's wallet account
    /// 1. `[writable]` The profile to unfollow
    UnfollowProfile {
        profile_id: Pubkey,
    },
    /// Create a new community
    /// Accounts expected:
    /// 0. `[signer]` The community creator's wallet account
    CreateCommunity {
        name: String,
        description: String,
        avatar: String,
        rules: Vec<String>,
    },
    /// Join a community
    /// Accounts expected:
    /// 0. `[signer]` The user's wallet account
    JoinCommunity {
        community_id: u64,
    },
}
