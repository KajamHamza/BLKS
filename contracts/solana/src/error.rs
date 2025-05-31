
use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone)]
pub enum BlocksError {
    #[error("Invalid Instruction")]
    InvalidInstruction,

    #[error("Not Rent Exempt")]
    NotRentExempt,

    #[error("Profile Already Exists")]
    ProfileAlreadyExists,

    #[error("Profile Not Found")]
    ProfileNotFound,

    #[error("Post Not Found")]
    PostNotFound,

    #[error("Community Not Found")]
    CommunityNotFound,

    #[error("Not Profile Owner")]
    NotProfileOwner,

    #[error("Not Post Owner")]
    NotPostOwner,

    #[error("Not Community Owner")]
    NotCommunityOwner,
    
    #[error("Invalid Community Name")]
    InvalidCommunityName,
    
    #[error("Already Member")]
    AlreadyMember,
    
    #[error("Community Limit Exceeded")]
    CommunityLimitExceeded,
    
    #[error("Daily Post Limit Reached")]
    DailyPostLimitReached,
    
    #[error("Post Time Limit")]
    PostTimeLimit,
    
    #[error("Spam User")]
    SpamUser,
    
    #[error("Already Liked")]
    AlreadyLiked,
    
    #[error("Already Disliked")]
    AlreadyDisliked,
    
    #[error("Post In Kill Zone")]
    PostInKillZone,
    
    #[error("Insufficient Funds")]
    InsufficientFunds,
}

impl From<BlocksError> for ProgramError {
    fn from(e: BlocksError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
