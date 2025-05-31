
use crate::{
    error::BlocksError,
    instruction::ContractInstruction,
    state::{
        pack_profile_into_slice, pack_post_into_slice, pack_community_into_slice, 
        Profile, Post, Community, PostRating, 
        unpack_profile_from_slice, unpack_post_from_slice, unpack_community_from_slice
    },
};
use borsh::{BorshDeserialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    program::{invoke, invoke_signed},
    pubkey::Pubkey,
    system_instruction,
    sysvar::{rent::Rent, Sysvar},
    clock::Clock,
};

pub struct Processor {}

impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = ContractInstruction::try_from_slice(&instruction_data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        match instruction {
            ContractInstruction::CreateProfile { username, bio, profile_image, cover_image } => {
                Self::process_create_profile(program_id, accounts, username, bio, profile_image, cover_image)
            }
            ContractInstruction::UpdateProfile { bio, profile_image, cover_image } => {
                Self::process_update_profile(program_id, accounts, bio, profile_image, cover_image)
            }
            ContractInstruction::CreatePost { content, images } => {
                Self::process_create_post(program_id, accounts, content, images)
            }
            ContractInstruction::LikePost { post_id } => {
                Self::process_like_post(program_id, accounts, post_id)
            }
            ContractInstruction::CommentOnPost { content, parent_id } => {
                Self::process_comment(program_id, accounts, content, parent_id)
            }
            ContractInstruction::FollowProfile { profile_id } => {
                Self::process_follow(program_id, accounts, profile_id)
            }
            ContractInstruction::UnfollowProfile { profile_id } => {
                Self::process_unfollow(program_id, accounts, profile_id)
            }
            ContractInstruction::CreateCommunity { name, description, avatar, rules } => {
                Self::process_create_community(program_id, accounts, name, description, avatar, rules)
            }
            ContractInstruction::JoinCommunity { community_id } => {
                // Here we need to correctly handle the type mismatch
                // The instruction expects u64, but the function expects Pubkey
                // Let's extract the Pubkey from the account info
                let accounts_iter = &mut accounts.iter();
                let community_account = next_account_info(accounts_iter)?;
                Self::process_join_community(program_id, accounts, *community_account.key)
            }
        }
    }

    fn process_create_profile(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        username: String,
        bio: String,
        profile_image: String,
        cover_image: String,
    ) -> ProgramResult {
        msg!("Instruction: CreateProfile");
        let accounts_iter = &mut accounts.iter();
        
        // Parse accounts
        let user_account = next_account_info(accounts_iter)?;
        let profile_account = next_account_info(accounts_iter)?;
        let system_program = next_account_info(accounts_iter)?;

        // Verify the user account is the signer
        if !user_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Verify system program is correct
        if system_program.key != &solana_program::system_program::id() {
            return Err(ProgramError::InvalidAccountData);
        }

        // Generate PDA for profile account
        let seeds = [
            user_account.key.as_ref(),
            b"profile",
            username.as_bytes(),
        ];
        
        // Find the PDA - this should match what the client calculated
        let (expected_pda, bump_seed) = Pubkey::find_program_address(&seeds, program_id);
        
        // Debug logs
        msg!("Expected PDA: {}", expected_pda);
        msg!("Provided profile account: {}", profile_account.key);
        
        // Verify the PDA matches the profile account
        if expected_pda != *profile_account.key {
            msg!("PDA mismatch - expected: {}, got: {}", expected_pda, profile_account.key);
            return Err(ProgramError::InvalidArgument);
        }

        // Check if the profile account needs to be created
        if profile_account.owner != program_id {
            msg!("Creating profile account as a PDA");
            
            // Calculate rent - REDUCED SPACE FOR MEMORY MANAGEMENT
            let rent = Rent::get()?;
            // Reduced from 1024 to a more reasonable size
            let space = 512; // Reduced space for the profile data to avoid out of memory errors
            let lamports = rent.minimum_balance(space);
            
            msg!("Creating account with space: {} bytes, lamports: {}", space, lamports);
            
            // Create signer seeds array for PDA
            let signer_seeds = [
                user_account.key.as_ref(),
                b"profile",
                username.as_bytes(),
                &[bump_seed],
            ];
            
            // IMPROVED APPROACH: Split account creation into 3 steps:
            // 1. Transfer lamports to the PDA
            msg!("Step 1: Transferring lamports to PDA");
            let transfer_ix = system_instruction::transfer(
                user_account.key,
                profile_account.key,
                lamports,
            );
            
            invoke(
                &transfer_ix,
                &[
                    user_account.clone(),
                    profile_account.clone(),
                    system_program.clone(),
                ],
            )?;
            msg!("Lamports transferred successfully");
            
            // 2. Allocate space for the account - REDUCED SPACE
            msg!("Step 2: Allocating space for PDA");
            let allocate_ix = system_instruction::allocate(
                profile_account.key,
                space as u64,
            );
            
            invoke_signed(
                &allocate_ix,
                &[
                    profile_account.clone(),
                    system_program.clone(),
                ],
                &[&signer_seeds],
            )?;
            msg!("Space allocated successfully");
            
            // 3. Assign the account to our program
            msg!("Step 3: Assigning PDA ownership to program");
            let assign_ix = system_instruction::assign(
                profile_account.key,
                program_id,
            );
            
            invoke_signed(
                &assign_ix,
                &[
                    profile_account.clone(),
                    system_program.clone(),
                ],
                &[&signer_seeds],
            )?;
            msg!("Ownership assigned successfully");
            
            msg!("PDA account created successfully with 3-step approach");
        } else {
            msg!("Profile account already exists, proceeding to initialize");
        }

        // Initialize the Profile struct
        // Limit the lengths of strings to prevent memory issues
        let max_len = 128; // Maximum length for string fields
        let username = if username.len() > max_len { username[0..max_len].to_string() } else { username };
        let bio = if bio.len() > max_len { bio[0..max_len].to_string() } else { bio };
        let profile_image = if profile_image.len() > max_len { profile_image[0..max_len].to_string() } else { profile_image };
        let cover_image = if cover_image.len() > max_len { cover_image[0..max_len].to_string() } else { cover_image };

        let clock = Clock::get()?;
        let current_timestamp = clock.unix_timestamp as u64;

        msg!("Initializing profile data with limited string lengths");
        
        let profile = Profile {
            is_initialized: true,
            owner: *user_account.key,
            username,
            bio,
            profile_image,
            cover_image,
            created_at: current_timestamp,
            followers_count: 0,
            following_count: 0,
            user_credit_rating: 100, // Initial UCR score
            posts_count: 0,
            last_post_timestamp: 0,
            daily_post_count: 0,
            is_verified: false,
        };

        // Serialize and save the profile data
        msg!("Serializing profile data to account");
        pack_profile_into_slice(&profile, &mut profile_account.data.borrow_mut())?;

        msg!("Profile created successfully");
        Ok(())
    }

    fn process_update_profile(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        bio: String,
        profile_image: String,
        cover_image: String,
    ) -> ProgramResult {
        msg!("Instruction: UpdateProfile");
        let accounts_iter = &mut accounts.iter();
        
        let user_account = next_account_info(accounts_iter)?;
        let profile_account = next_account_info(accounts_iter)?;
        
        // Verify the user account is the signer
        if !user_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Verify the profile account is owned by our program
        if profile_account.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }
        
        // Deserialize the profile data
        let mut profile = unpack_profile_from_slice(&profile_account.data.borrow())?;
        
        // Verify the profile is owned by the user
        if profile.owner != *user_account.key {
            return Err(ProgramError::InvalidAccountData);
        }
        
        // Update the profile fields
        profile.bio = bio;
        profile.profile_image = profile_image;
        profile.cover_image = cover_image;
        
        // Serialize and save the updated profile data
        pack_profile_into_slice(&profile, &mut profile_account.data.borrow_mut())?;
        
        msg!("Profile updated successfully");
        Ok(())
    }

    fn process_create_post(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        content: String,
        images: Vec<String>,
    ) -> ProgramResult {
        msg!("Instruction: CreatePost");
        let accounts_iter = &mut accounts.iter();
        
        let user_account = next_account_info(accounts_iter)?;
        let post_account = next_account_info(accounts_iter)?;
        let profile_account = next_account_info(accounts_iter)?;
        let system_program = next_account_info(accounts_iter)?;
        
        // Verify the user account is the signer
        if !user_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Verify the profile account is owned by our program
        if profile_account.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }
        
        // Deserialize the profile data
        let mut profile = unpack_profile_from_slice(&profile_account.data.borrow())?;
        
        // Verify the profile is owned by the user
        if profile.owner != *user_account.key {
            return Err(ProgramError::InvalidAccountData);
        }
        
        // Create the post account if it doesn't exist
        if post_account.owner != program_id {
            // Calculate rent
            let rent = Rent::get()?;
            let space = 2048; // Adjust as needed for your post struct
            let lamports = rent.minimum_balance(space);
            
            // Create account
            invoke(
                &system_instruction::create_account(
                    user_account.key,
                    post_account.key,
                    lamports,
                    space as u64,
                    program_id,
                ),
                &[
                    user_account.clone(),
                    post_account.clone(),
                    system_program.clone(),
                ],
            )?;
        }
        
        // Get current timestamp
        let clock = Clock::get()?;
        let current_timestamp = clock.unix_timestamp as u64;
        
        // Check if this is a new day for post count tracking
        let seconds_in_day = 86400;
        if current_timestamp - profile.last_post_timestamp > seconds_in_day {
            profile.daily_post_count = 0;
        }
        
        // Increment post count
        profile.posts_count += 1;
        profile.daily_post_count += 1;
        profile.last_post_timestamp = current_timestamp;
        
        // Initialize the Post struct
        let post = Post {
            is_initialized: true,
            id: profile.posts_count,
            author: *user_account.key,
            content,
            timestamp: current_timestamp,
            likes: 0,
            comments: 0,
            mirrors: 0,
            images,
            rating: PostRating::None,
            in_kill_zone: false,
        };
        
        // Serialize and save the post data
        pack_post_into_slice(&post, &mut post_account.data.borrow_mut())?;
        
        // Update the profile
        pack_profile_into_slice(&profile, &mut profile_account.data.borrow_mut())?;
        
        msg!("Post created successfully");
        Ok(())
    }

    fn process_like_post(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        post_id: u64,
    ) -> ProgramResult {
        msg!("Instruction: LikePost");
        let accounts_iter = &mut accounts.iter();
        
        let user_account = next_account_info(accounts_iter)?;
        let post_account = next_account_info(accounts_iter)?;
        let author_profile_account = next_account_info(accounts_iter)?;
        
        // Verify the user account is the signer
        if !user_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Verify the post account is owned by our program
        if post_account.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }
        
        // Verify the author profile account is owned by our program
        if author_profile_account.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }
        
        // Deserialize the post data
        let mut post = unpack_post_from_slice(&post_account.data.borrow())?;
        
        // Verify the post ID matches
        if post.id != post_id {
            return Err(ProgramError::InvalidArgument);
        }
        
        // Deserialize the author profile data
        let mut author_profile = unpack_profile_from_slice(&author_profile_account.data.borrow())?;
        
        // Verify the author profile matches the post author
        if author_profile.owner != post.author {
            return Err(ProgramError::InvalidArgument);
        }
        
        // Increment like count
        post.likes += 1;
        
        // Update post rating based on new like count
        post.rating = PostRating::from_likes(post.likes);
        
        // Update kill zone status
        post.in_kill_zone = post.likes < 0;
        
        // Update author's UCR score based on the like
        // Simple algorithm: +1 UCR point per like
        author_profile.user_credit_rating += 1;
        
        // Serialize and save the updated post data
        pack_post_into_slice(&post, &mut post_account.data.borrow_mut())?;
        
        // Serialize and save the updated author profile data
        pack_profile_into_slice(&author_profile, &mut author_profile_account.data.borrow_mut())?;
        
        msg!("Post liked successfully");
        Ok(())
    }

    fn process_comment(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        content: String,
        parent_id: u64,
    ) -> ProgramResult {
        msg!("Instruction: CommentOnPost");
        let accounts_iter = &mut accounts.iter();
        
        let user_account = next_account_info(accounts_iter)?;
        let comment_account = next_account_info(accounts_iter)?;
        let parent_post_account = next_account_info(accounts_iter)?;
        let user_profile_account = next_account_info(accounts_iter)?;
        let system_program = next_account_info(accounts_iter)?;
        
        // Verify the user account is the signer
        if !user_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Verify the parent post account is owned by our program
        if parent_post_account.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }
        
        // Verify the user profile account is owned by our program
        if user_profile_account.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }
        
        // Deserialize the parent post data
        let mut parent_post = unpack_post_from_slice(&parent_post_account.data.borrow())?;
        
        // Verify the parent post ID matches
        if parent_post.id != parent_id {
            return Err(ProgramError::InvalidArgument);
        }
        
        // Deserialize the user profile data
        let mut user_profile = unpack_profile_from_slice(&user_profile_account.data.borrow())?;
        
        // Verify the user profile is owned by the user
        if user_profile.owner != *user_account.key {
            return Err(ProgramError::InvalidArgument);
        }
        
        // Create the comment account if it doesn't exist
        if comment_account.owner != program_id {
            // Calculate rent
            let rent = Rent::get()?;
            let space = 1024; // Adjust as needed for your comment struct
            let lamports = rent.minimum_balance(space);
            
            // Create account
            invoke(
                &system_instruction::create_account(
                    user_account.key,
                    comment_account.key,
                    lamports,
                    space as u64,
                    program_id,
                ),
                &[
                    user_account.clone(),
                    comment_account.clone(),
                    system_program.clone(),
                ],
            )?;
        }
        
        // Get current timestamp
        let clock = Clock::get()?;
        let current_timestamp = clock.unix_timestamp as u64;
        
        // Increment post count for the user
        user_profile.posts_count += 1;
        
        // Increment comment count for the parent post
        parent_post.comments += 1;
        
        // Initialize the Comment as a Post struct
        let comment = Post {
            is_initialized: true,
            id: user_profile.posts_count,
            author: *user_account.key,
            content,
            timestamp: current_timestamp,
            likes: 0,
            comments: 0,
            mirrors: 0,
            images: vec![],
            rating: PostRating::None,
            in_kill_zone: false,
        };
        
        // Serialize and save the comment data
        pack_post_into_slice(&comment, &mut comment_account.data.borrow_mut())?;
        
        // Update the parent post
        pack_post_into_slice(&parent_post, &mut parent_post_account.data.borrow_mut())?;
        
        // Update the user profile
        pack_profile_into_slice(&user_profile, &mut user_profile_account.data.borrow_mut())?;
        
        msg!("Comment created successfully");
        Ok(())
    }

    fn process_follow(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        profile_id: Pubkey,
    ) -> ProgramResult {
        msg!("Instruction: FollowProfile");
        let accounts_iter = &mut accounts.iter();
        
        let follower_account = next_account_info(accounts_iter)?;
        let followed_profile_account = next_account_info(accounts_iter)?;
        let follower_profile_account = next_account_info(accounts_iter)?;
        
        // Verify the follower account is the signer
        if !follower_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Verify the followed profile account is owned by our program
        if followed_profile_account.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }
        
        // Verify the follower profile account is owned by our program
        if follower_profile_account.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }
        
        // Verify the followed profile account key matches the profile_id
        if *followed_profile_account.key != profile_id {
            return Err(ProgramError::InvalidArgument);
        }
        
        // Deserialize the followed profile data
        let mut followed_profile = unpack_profile_from_slice(&followed_profile_account.data.borrow())?;
        
        // Deserialize the follower profile data
        let mut follower_profile = unpack_profile_from_slice(&follower_profile_account.data.borrow())?;
        
        // Verify the follower profile is owned by the follower
        if follower_profile.owner != *follower_account.key {
            return Err(ProgramError::InvalidArgument);
        }
        
        // Increment followers count for the followed profile
        followed_profile.followers_count += 1;
        
        // Increment following count for the follower profile
        follower_profile.following_count += 1;
        
        // Serialize and save the updated followed profile data
        pack_profile_into_slice(&followed_profile, &mut followed_profile_account.data.borrow_mut())?;
        
        // Serialize and save the updated follower profile data
        pack_profile_into_slice(&follower_profile, &mut follower_profile_account.data.borrow_mut())?;
        
        msg!("Follow successful");
        Ok(())
    }

    fn process_unfollow(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        profile_id: Pubkey,
    ) -> ProgramResult {
        msg!("Instruction: UnfollowProfile");
        let accounts_iter = &mut accounts.iter();
        
        let follower_account = next_account_info(accounts_iter)?;
        let followed_profile_account = next_account_info(accounts_iter)?;
        let follower_profile_account = next_account_info(accounts_iter)?;
        
        // Verify the follower account is the signer
        if !follower_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Verify the followed profile account is owned by our program
        if followed_profile_account.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }
        
        // Verify the follower profile account is owned by our program
        if follower_profile_account.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }
        
        // Verify the followed profile account key matches the profile_id
        if *followed_profile_account.key != profile_id {
            return Err(ProgramError::InvalidArgument);
        }
        
        // Deserialize the followed profile data
        let mut followed_profile = unpack_profile_from_slice(&followed_profile_account.data.borrow())?;
        
        // Deserialize the follower profile data
        let mut follower_profile = unpack_profile_from_slice(&follower_profile_account.data.borrow())?;
        
        // Verify the follower profile is owned by the follower
        if follower_profile.owner != *follower_account.key {
            return Err(ProgramError::InvalidArgument);
        }
        
        // Decrement followers count for the followed profile
        if followed_profile.followers_count > 0 {
            followed_profile.followers_count -= 1;
        }
        
        // Decrement following count for the follower profile
        if follower_profile.following_count > 0 {
            follower_profile.following_count -= 1;
        }
        
        // Serialize and save the updated followed profile data
        pack_profile_into_slice(&followed_profile, &mut followed_profile_account.data.borrow_mut())?;
        
        // Serialize and save the updated follower profile data
        pack_profile_into_slice(&follower_profile, &mut follower_profile_account.data.borrow_mut())?;
        
        msg!("Unfollow successful");
        Ok(())
    }

    fn process_create_community(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        name: String,
        description: String,
        avatar: String,
        rules: Vec<String>,
    ) -> ProgramResult {
        msg!("Instruction: CreateCommunity");
        let accounts_iter = &mut accounts.iter();
        
        let owner_account = next_account_info(accounts_iter)?;
        let community_account = next_account_info(accounts_iter)?;
        let system_program = next_account_info(accounts_iter)?;
        
        // Verify the owner account is the signer
        if !owner_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Create the community account if it doesn't exist
        if community_account.owner != program_id {
            // Calculate rent
            let rent = Rent::get()?;
            let space = 2048; // Adjust as needed for your community struct
            let lamports = rent.minimum_balance(space);
            
            // Create account
            invoke(
                &system_instruction::create_account(
                    owner_account.key,
                    community_account.key,
                    lamports,
                    space as u64,
                    program_id,
                ),
                &[
                    owner_account.clone(),
                    community_account.clone(),
                    system_program.clone(),
                ],
            )?;
        }
        
        // Check if this is a subBlocks community
        let is_sb_community = name.starts_with("sb/");
        
        // Initialize the Community struct
        let community = Community {
            is_initialized: true,
            id: 0, // This should be assigned by the program state
            name,
            description,
            avatar,
            owner: *owner_account.key,
            member_count: 1, // Owner is the first member
            rules,
            is_sb_community,
        };
        
        // Serialize and save the community data
        pack_community_into_slice(&community, &mut community_account.data.borrow_mut())?;
        
        msg!("Community created successfully");
        Ok(())
    }

    fn process_join_community(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        community_id: Pubkey,
    ) -> ProgramResult {
        msg!("Instruction: JoinCommunity");
        let accounts_iter = &mut accounts.iter();
        
        let user_account = next_account_info(accounts_iter)?;
        let community_account = next_account_info(accounts_iter)?;
        
        // Verify the user account is the signer
        if !user_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Verify the community account is owned by our program
        if community_account.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }
        
        // Verify the community account key matches the community_id
        if *community_account.key != community_id {
            return Err(ProgramError::InvalidArgument);
        }
        
        // Deserialize the community data
        let mut community = unpack_community_from_slice(&community_account.data.borrow())?;
        
        // Increment member count
        community.member_count += 1;
        
        // Serialize and save the updated community data
        pack_community_into_slice(&community, &mut community_account.data.borrow_mut())?;
        
        msg!("Joined community successfully");
        Ok(())
    }
}
