
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    borsh::try_from_slice_unchecked,
    program_error::ProgramError,
    program_pack::{IsInitialized, Sealed},
    pubkey::Pubkey,
};

#[derive(BorshSerialize, BorshDeserialize)]
pub struct Profile {
    pub is_initialized: bool,
    pub owner: Pubkey,
    pub username: String,
    pub bio: String,
    pub profile_image: String,
    pub cover_image: String,
    pub created_at: u64,
    pub followers_count: u64,
    pub following_count: u64,
    pub user_credit_rating: i64,      // UCR score (multiplied by 100 to handle decimals)
    pub posts_count: u64,
    pub last_post_timestamp: u64,
    pub daily_post_count: u64,
    pub is_verified: bool,            // Verification status
}

impl Sealed for Profile {}

impl IsInitialized for Profile {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct Post {
    pub is_initialized: bool,
    pub id: u64,
    pub author: Pubkey,
    pub content: String,
    pub timestamp: u64,
    pub likes: u64,
    pub comments: u64,
    pub mirrors: u64,
    pub images: Vec<String>,
    pub rating: PostRating,          // Rating based on likes
    pub in_kill_zone: bool,          // If post is in kill zone (< 0 likes)
}

impl Sealed for Post {}

impl IsInitialized for Post {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

// Rating based on like count
#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, PartialEq)]
pub enum PostRating {
    None,           // 0 likes
    Bronze,         // 5+ likes
    Silver,         // 20+ likes
    Gold,           // 50+ likes
    Platinum,       // 150+ likes
    Diamond,        // 500+ likes
    Ace,            // 1000+ likes  
    Conqueror,      // 1,000,000+ likes
}

impl PostRating {
    // Calculate rating based on like count
    pub fn from_likes(likes: u64) -> Self {
        match likes {
            l if l >= 1_000_000 => PostRating::Conqueror,
            l if l >= 1_000 => PostRating::Ace,
            l if l >= 500 => PostRating::Diamond,
            l if l >= 150 => PostRating::Platinum,
            l if l >= 50 => PostRating::Gold,
            l if l >= 20 => PostRating::Silver,
            l if l >= 5 => PostRating::Bronze,
            _ => PostRating::None,
        }
    }
    
    // Convert rating to string
    pub fn to_string(&self) -> &str {
        match self {
            PostRating::None => "none",
            PostRating::Bronze => "bronze",
            PostRating::Silver => "silver",
            PostRating::Gold => "gold",
            PostRating::Platinum => "platinum",
            PostRating::Diamond => "diamond",
            PostRating::Ace => "ace",
            PostRating::Conqueror => "conqueror",
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct Community {
    pub is_initialized: bool,
    pub id: u64,
    pub name: String,
    pub description: String,
    pub avatar: String,
    pub owner: Pubkey,
    pub member_count: u64,
    pub rules: Vec<String>,          // Community rules
    pub is_sb_community: bool,       // "sb/" prefix for subBlocks communities
}

impl Sealed for Community {}

impl IsInitialized for Community {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

// Constants for UCR Tiers (multiplied by 100 to handle decimals as integers)
pub const UCR_TOP_CONTRIBUTOR: i64 = 420;     // 4.20
pub const UCR_VALUABLE_CONTRIBUTOR: i64 = 69; // 0.69
pub const UCR_AVERAGE_CONTRIBUTOR: i64 = 1;   // 0.01 (default)
pub const UCR_LOW_VALUE_CONTRIBUTOR: i64 = -3; // -0.03
pub const UCR_SPAM_USER: i64 = -10;           // -0.1

// Constants for verification
pub const VERIFICATION_THRESHOLD: u64 = 70;   // 70% likes rate for verification

// Baseline for UCR calculations
pub const UCR_BASELINE: u64 = 100;

#[derive(BorshSerialize, BorshDeserialize)]
pub struct ProgramState {
    pub profiles_count: u64,
    pub posts_count: u64,
    pub communities_count: u64,
}

// Helper functions
pub fn pack_profile_into_slice(profile: &Profile, dst: &mut [u8]) -> Result<(), ProgramError> {
    let data = profile.try_to_vec()?;
    if data.len() > dst.len() {
        return Err(ProgramError::InvalidAccountData);
    }
    dst[0..data.len()].copy_from_slice(&data);
    Ok(())
}

pub fn unpack_profile_from_slice(src: &[u8]) -> Result<Profile, ProgramError> {
    try_from_slice_unchecked::<Profile>(src).map_err(|_| ProgramError::InvalidAccountData)
}

pub fn pack_post_into_slice(post: &Post, dst: &mut [u8]) -> Result<(), ProgramError> {
    let data = post.try_to_vec()?;
    if data.len() > dst.len() {
        return Err(ProgramError::InvalidAccountData);
    }
    dst[0..data.len()].copy_from_slice(&data);
    Ok(())
}

pub fn unpack_post_from_slice(src: &[u8]) -> Result<Post, ProgramError> {
    try_from_slice_unchecked::<Post>(src).map_err(|_| ProgramError::InvalidAccountData)
}

pub fn pack_community_into_slice(community: &Community, dst: &mut [u8]) -> Result<(), ProgramError> {
    let data = community.try_to_vec()?;
    if data.len() > dst.len() {
        return Err(ProgramError::InvalidAccountData);
    }
    dst[0..data.len()].copy_from_slice(&data);
    Ok(())
}

pub fn unpack_community_from_slice(src: &[u8]) -> Result<Community, ProgramError> {
    try_from_slice_unchecked::<Community>(src).map_err(|_| ProgramError::InvalidAccountData)
}
