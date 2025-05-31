import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction, TransactionInstruction, SystemProgram, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js'
import { serialize, deserialize } from 'borsh'
import { toast } from 'react-hot-toast'
import { config } from '@/config'

// Your deployed program ID - configured from environment
const PROGRAM_ID = new PublicKey(config.solana.programId)

// Add debug mode for testing without actual blockchain transactions
const DEBUG_MODE = process.env.NODE_ENV === 'development'

// Instruction enum matching your Rust contract
enum ContractInstruction {
  CreateProfile = 0,
  UpdateProfile = 1,
  CreatePost = 2,
  LikePost = 3,
  CommentOnPost = 4,
  FollowProfile = 5,
  UnfollowProfile = 6,
  CreateCommunity = 7,
  JoinCommunity = 8,
}

// PostRating enum matching Rust contract
export enum PostRating {
  None = 0,
  Bronze = 1,
  Silver = 2,
  Gold = 3,
  Platinum = 4,
  Diamond = 5,
  Ace = 6,
  Conqueror = 7,
}

// Create Profile instruction data class
class CreateProfileInstruction {
  username: string
  bio: string
  profile_image: string
  cover_image: string

  constructor(fields: {
    username: string
    bio: string
    profile_image: string
    cover_image: string
  }) {
    this.username = fields.username
    this.bio = fields.bio
    this.profile_image = fields.profile_image
    this.cover_image = fields.cover_image
  }
}

// Create Post instruction data class
class CreatePostInstruction {
  content: string
  images: string[]

  constructor(fields: {
    content: string
    images: string[]
  }) {
    this.content = fields.content
    this.images = fields.images
  }
}

// Like Post instruction data class
class LikePostInstruction {
  post_id: bigint

  constructor(fields: {
    post_id: bigint
  }) {
    this.post_id = fields.post_id
  }
}

// Comment On Post instruction data class
class CommentOnPostInstruction {
  content: string
  parent_id: bigint

  constructor(fields: {
    content: string
    parent_id: bigint
  }) {
    this.content = fields.content
    this.parent_id = fields.parent_id
  }
}

// Bookmark Post instruction data class
class BookmarkPostInstruction {
  post_id: bigint

  constructor(fields: {
    post_id: bigint
  }) {
    this.post_id = fields.post_id
  }
}

// Profile struct for deserialization - matching Rust exactly
class ProfileAccount {
  is_initialized: number  // u8 from Rust bool
  owner: Uint8Array
  username: string
  bio: string
  profile_image: string
  cover_image: string
  created_at: bigint
  followers_count: bigint
  following_count: bigint
  user_credit_rating: bigint
  posts_count: bigint
  last_post_timestamp: bigint
  daily_post_count: bigint
  is_verified: number  // u8 from Rust bool

  constructor(fields: any) {
    this.is_initialized = fields.is_initialized
    this.owner = fields.owner
    this.username = fields.username
    this.bio = fields.bio
    this.profile_image = fields.profile_image
    this.cover_image = fields.cover_image
    this.created_at = fields.created_at
    this.followers_count = fields.followers_count
    this.following_count = fields.following_count
    this.user_credit_rating = fields.user_credit_rating
    this.posts_count = fields.posts_count
    this.last_post_timestamp = fields.last_post_timestamp
    this.daily_post_count = fields.daily_post_count
    this.is_verified = fields.is_verified
  }
}

// Post struct for deserialization - matching Rust exactly
class PostAccount {
  is_initialized: number  // u8 from Rust bool
  id: bigint
  author: Uint8Array
  content: string
  timestamp: bigint
  likes: bigint
  comments: bigint
  mirrors: bigint
  images: string[]
  rating: number
  in_kill_zone: number  // u8 from Rust bool

  constructor(fields: any) {
    this.is_initialized = fields.is_initialized
    this.id = fields.id
    this.author = fields.author
    this.content = fields.content
    this.timestamp = fields.timestamp
    this.likes = fields.likes
    this.comments = fields.comments
    this.mirrors = fields.mirrors
    this.images = fields.images
    this.rating = fields.rating
    this.in_kill_zone = fields.in_kill_zone
  }
}

// Borsh schemas
const createProfileSchema = new Map([
  [CreateProfileInstruction, {
    kind: 'struct',
    fields: [
      ['username', 'string'],
      ['bio', 'string'],
      ['profile_image', 'string'],
      ['cover_image', 'string'],
    ],
  }],
])

const createPostSchema = new Map([
  [CreatePostInstruction, {
    kind: 'struct',
    fields: [
      ['content', 'string'],
      ['images', ['string']],
    ],
  }],
])

const likePostSchema = new Map([
  [LikePostInstruction, {
    kind: 'struct',
    fields: [
      ['post_id', 'u64'],
    ],
  }],
])

const commentOnPostSchema = new Map([
  [CommentOnPostInstruction, {
    kind: 'struct',
    fields: [
      ['content', 'string'],
      ['parent_id', 'u64'],
    ],
  }],
])

const bookmarkPostSchema = new Map([
  [BookmarkPostInstruction, {
    kind: 'struct',
    fields: [
      ['post_id', 'u64'],
    ],
  }],
])

const profileAccountSchema = new Map([
  [ProfileAccount, {
    kind: 'struct',
    fields: [
      ['is_initialized', 'u8'],  // Rust bool is serialized as u8
      ['owner', [32]],
      ['username', 'string'],
      ['bio', 'string'],
      ['profile_image', 'string'],
      ['cover_image', 'string'],
      ['created_at', 'u64'],
      ['followers_count', 'u64'],
      ['following_count', 'u64'],
      ['user_credit_rating', 'i64'],
      ['posts_count', 'u64'],
      ['last_post_timestamp', 'u64'],
      ['daily_post_count', 'u64'],
      ['is_verified', 'u8'],  // Rust bool is serialized as u8
    ],
  }],
])

const postAccountSchema = new Map([
  [PostAccount, {
    kind: 'struct',
    fields: [
      ['is_initialized', 'u8'],  // Rust bool is serialized as u8
      ['id', 'u64'],
      ['author', [32]],
      ['content', 'string'],
      ['timestamp', 'u64'],
      ['likes', 'u64'],
      ['comments', 'u64'],
      ['mirrors', 'u64'],
      ['images', ['string']],
      ['rating', 'u8'],
      ['in_kill_zone', 'u8'],  // Rust bool is serialized as u8
    ],
  }],
])

// Community/SubBlock interface
export interface Community {
  isInitialized: boolean
  id: number
  creator: PublicKey
  name: string
  description: string
  avatar: string
  rules: string[]
  memberCount: number
  createdAt: number
  isPrivate: boolean
}

// Community struct for deserialization
class CommunityAccount {
  is_initialized: number
  id: bigint
  creator: Uint8Array
  name: string
  description: string
  avatar: string
  rules: string[]
  member_count: bigint
  created_at: bigint
  is_private: number

  constructor(fields: any) {
    this.is_initialized = fields.is_initialized
    this.id = fields.id
    this.creator = fields.creator
    this.name = fields.name
    this.description = fields.description
    this.avatar = fields.avatar
    this.rules = fields.rules
    this.member_count = fields.member_count
    this.created_at = fields.created_at
    this.is_private = fields.is_private
  }
}

// Create Community instruction
class CreateCommunityInstruction {
  name: string
  description: string
  avatar: string
  rules: string[]

  constructor(fields: {
    name: string
    description: string
    avatar: string
    rules: string[]
  }) {
    this.name = fields.name
    this.description = fields.description
    this.avatar = fields.avatar
    this.rules = fields.rules
  }
}

// Follow Profile instruction
class FollowProfileInstruction {
  profile_id: Uint8Array

  constructor(fields: {
    profile_id: PublicKey
  }) {
    this.profile_id = fields.profile_id.toBuffer()
  }
}

const createCommunitySchema = new Map([
  [CreateCommunityInstruction, {
    kind: 'struct',
    fields: [
      ['name', 'string'],
      ['description', 'string'],
      ['avatar', 'string'],
      ['rules', ['string']],
    ],
  }],
])

const followProfileSchema = new Map([
  [FollowProfileInstruction, {
    kind: 'struct',
    fields: [
      ['profile_id', [32]],
    ],
  }],
])

const communityAccountSchema = new Map([
  [CommunityAccount, {
    kind: 'struct',
    fields: [
      ['is_initialized', 'u8'],
      ['id', 'u64'],
      ['creator', [32]],
      ['name', 'string'],
      ['description', 'string'],
      ['avatar', 'string'],
      ['rules', ['string']],
      ['member_count', 'u64'],
      ['created_at', 'u64'],
      ['is_private', 'u8'],
    ],
  }],
])

// Profile interface
export interface Profile {
  isInitialized: boolean
  owner: PublicKey
  username: string
  bio: string
  profileImage: string
  coverImage: string
  createdAt: number
  followersCount: number
  followingCount: number
  userCreditRating: number
  postsCount: number
  lastPostTimestamp: number
  dailyPostCount: number
  isVerified: boolean
}

// Comment interface - separate from Post
export interface Comment {
  id: number
  parentPostId: number
  author: PublicKey
  content: string
  timestamp: number
  likes: number
  authorProfile?: Profile | null
}

// Post interface - clean without comment confusion
export interface Post {
  isInitialized: boolean
  id: number
  author: PublicKey
  content: string
  timestamp: number
  likes: number
  comments: number
  mirrors: number
  images: string[]
  rating: PostRating
  inKillZone: boolean
}

// Cache for profile lookups to avoid repeated blockchain calls
const profileCache = new Map<string, Profile | null>()
const CACHE_DURATION = 60000 // 1 minute for memory cache (increased from 30 seconds)

// Posts cache
let postsCache: { posts: Post[], timestamp: number } | null = null
const POSTS_CACHE_DURATION = 30000 // 30 seconds for posts cache (increased from 10 seconds)

// localStorage cache configuration - Updated to support multiple profiles
const LOCALSTORAGE_CACHE_PREFIX = 'blocks_profile_'
const LOCALSTORAGE_CACHE_DURATION = 10 * 60 * 1000 // 10 minutes for localStorage cache (increased from 5 minutes)

interface CachedProfile {
  profile: Profile | null
  timestamp: number
  walletAddress: string
}

// localStorage cache utilities - Updated to support multiple profiles
const saveProfileToLocalStorage = (walletAddress: string, profile: Profile | null) => {
  try {
    const cacheKey = `${LOCALSTORAGE_CACHE_PREFIX}${walletAddress}`
    const cacheData: CachedProfile = {
      profile,
      timestamp: Date.now(),
      walletAddress
    }
    localStorage.setItem(cacheKey, JSON.stringify(cacheData))
    console.log(`💾 Profile cached to localStorage for ${walletAddress.slice(0, 8)}`)
  } catch (error) {
    console.warn('Failed to save profile to localStorage:', error)
  }
}

const getProfileFromLocalStorage = (walletAddress: string): Profile | null => {
  try {
    const cacheKey = `${LOCALSTORAGE_CACHE_PREFIX}${walletAddress}`
    const cached = localStorage.getItem(cacheKey)
    if (!cached) return null

    const cacheData: CachedProfile = JSON.parse(cached)
    
    // Check if cache is expired
    if (Date.now() - cacheData.timestamp > LOCALSTORAGE_CACHE_DURATION) {
      console.log(`⏰ Cache expired for ${walletAddress.slice(0, 8)}, clearing`)
      localStorage.removeItem(cacheKey)
      return null
    }
    
    console.log(`⚡ Using cached profile from localStorage for ${walletAddress.slice(0, 8)}`)
    return cacheData.profile
  } catch (error) {
    console.warn('Failed to read profile from localStorage:', error)
    const cacheKey = `${LOCALSTORAGE_CACHE_PREFIX}${walletAddress}`
    localStorage.removeItem(cacheKey)
    return null
  }
}

const clearProfileCache = (walletAddress?: string) => {
  // Clear memory cache
  if (walletAddress) {
    profileCache.delete(walletAddress)
    // Clear localStorage cache for specific user
    const cacheKey = `${LOCALSTORAGE_CACHE_PREFIX}${walletAddress}`
    localStorage.removeItem(cacheKey)
  } else {
    profileCache.clear()
    // Clear all localStorage profile caches
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith(LOCALSTORAGE_CACHE_PREFIX)) {
        localStorage.removeItem(key)
      }
    })
  }
  
  // Clear posts cache
  postsCache = null
  
  console.log('🗑️ Profile and posts cache cleared')
}

// Simple in-memory comment storage (resets on page refresh)
let commentsStorage: { [postId: number]: Comment[] } = {}

export function useBlocksProgram() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()

  // Get profile PDA
  const getProfilePDA = async (userPublicKey: PublicKey, username: string): Promise<PublicKey> => {
    const [profilePDA] = await PublicKey.findProgramAddress(
      [userPublicKey.toBuffer(), Buffer.from('profile'), Buffer.from(username)],
      PROGRAM_ID
    )
    return profilePDA
  }

  // Get post PDA
  const getPostPDA = async (userPublicKey: PublicKey, postId: number): Promise<PublicKey> => {
    const [postPDA] = await PublicKey.findProgramAddress(
      [userPublicKey.toBuffer(), Buffer.from('post'), Buffer.from(postId.toString())],
      PROGRAM_ID
    )
    return postPDA
  }

  // Helper function to check if program exists
  const checkProgramExists = async (): Promise<boolean> => {
    try {
      const programInfo = await connection.getAccountInfo(PROGRAM_ID)
      return programInfo !== null && programInfo.executable
    } catch (error) {
      console.error('Error checking program existence:', error)
      return false
    }
  }

  // Helper function to check SOL balance
  const checkSOLBalance = async (): Promise<number> => {
    if (!publicKey) return 0
    try {
      const balance = await connection.getBalance(publicKey)
      return balance / LAMPORTS_PER_SOL
    } catch (error) {
      console.error('Error checking SOL balance:', error)
      return 0
    }
  }

  // Convert ProfileAccount to Profile interface
  const convertProfileAccount = (profileAccount: ProfileAccount): Profile => {
    // Calculate UCR based on activity
    const calculateUCR = (profile: ProfileAccount) => {
      const postsCount = Number(profile.posts_count)
      const followersCount = Number(profile.followers_count)
      const followingCount = Number(profile.following_count)
      
      // Base UCR calculation algorithm
      let ucr = 1.0 // Start with base rating
      
      // Posts factor (0.1 points per post, max 2.0 points)
      const postsScore = Math.min(postsCount * 0.1, 2.0)
      
      // Followers factor (0.05 points per follower, max 1.5 points)
      const followersScore = Math.min(followersCount * 0.05, 1.5)
      
      // Following/followers ratio (healthy ratio = bonus)
      let ratioBonus = 0
      if (followersCount > 0 && followingCount > 0) {
        const ratio = followersCount / followingCount
        if (ratio >= 0.5 && ratio <= 2.0) { // Healthy ratio
          ratioBonus = 0.3
        }
      }
      
      // Account age factor (older accounts get bonus)
      const accountAge = Date.now() - Number(profile.created_at) * 1000
      const daysOld = accountAge / (1000 * 60 * 60 * 24)
      const ageBonus = Math.min(daysOld / 30 * 0.2, 1.0) // 0.2 points per month, max 1.0
      
      // Verification bonus
      const verificationBonus = profile.is_verified === 1 ? 0.5 : 0
      
      // Activity factor (posting regularly)
      const lastPostAge = Date.now() - Number(profile.last_post_timestamp) * 1000
      const daysSinceLastPost = lastPostAge / (1000 * 60 * 60 * 24)
      const activityBonus = daysSinceLastPost < 7 ? 0.3 : daysSinceLastPost < 30 ? 0.1 : 0
      
      ucr = ucr + postsScore + followersScore + ratioBonus + ageBonus + verificationBonus + activityBonus
      
      // Cap at 5.0 max
      return Math.min(ucr, 5.0)
    }

    return {
      isInitialized: profileAccount.is_initialized === 1,
      owner: new PublicKey(profileAccount.owner),
      username: profileAccount.username,
      bio: profileAccount.bio,
      profileImage: profileAccount.profile_image,
      coverImage: profileAccount.cover_image,
      createdAt: Number(profileAccount.created_at) * 1000, // Convert seconds to milliseconds
      followersCount: Number(profileAccount.followers_count),
      followingCount: Number(profileAccount.following_count),
      userCreditRating: calculateUCR(profileAccount), // Use calculated UCR instead of stored value
      postsCount: Number(profileAccount.posts_count),
      lastPostTimestamp: Number(profileAccount.last_post_timestamp) * 1000, // Convert seconds to milliseconds
      dailyPostCount: Number(profileAccount.daily_post_count),
      isVerified: profileAccount.is_verified === 1,
    }
  }

  // Convert PostAccount to Post interface
  const convertPostAccount = (postAccount: PostAccount): Post => {
    return {
      isInitialized: postAccount.is_initialized === 1,
      id: Number(postAccount.id),
      author: new PublicKey(postAccount.author),
      content: postAccount.content,
      timestamp: Number(postAccount.timestamp) * 1000, // Convert seconds to milliseconds
      likes: Number(postAccount.likes),
      comments: Number(postAccount.comments),
      mirrors: Number(postAccount.mirrors),
      images: postAccount.images,
      rating: postAccount.rating as PostRating,
      inKillZone: postAccount.in_kill_zone === 1,
    }
  }

  // Create user profile - REAL IMPLEMENTATION
  const createProfile = async (
    username: string,
    bio: string,
    profileImage: string,
    coverImage: string
  ) => {
    if (!publicKey) throw new Error('Wallet not connected')

    try {
      console.log('🔍 Running pre-flight checks...')
      
      const balance = await checkSOLBalance()
      console.log(`💰 SOL Balance: ${balance}`)
      if (balance < 0.1) {
        throw new Error(`Insufficient SOL balance: ${balance}. You need at least 0.1 SOL for transaction fees and account creation.`)
      }

      const programExists = await checkProgramExists()
      console.log(`📋 Program exists: ${programExists}`)
      if (!programExists) {
        throw new Error(`Program not found at address: ${PROGRAM_ID.toString()}. Make sure the program is deployed on ${config.solana.network}.`)
      }

      console.log('✅ Pre-flight checks passed')

      const profilePDA = await getProfilePDA(publicKey, username)
      console.log(`📍 Profile PDA: ${profilePDA.toString()}`)

      const instructionData = new CreateProfileInstruction({
        username,
        bio,
        profile_image: profileImage,
        cover_image: coverImage,
      })

      const createProfileVariant = Buffer.from([0])
      const serializedData = serialize(createProfileSchema, instructionData)
      const fullInstructionData = Buffer.concat([createProfileVariant, Buffer.from(serializedData)])

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: profilePDA, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: fullInstructionData,
      })

      const transaction = new Transaction().add(instruction)
      const { blockhash } = await connection.getLatestBlockhash('processed')
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      const simulation = await connection.simulateTransaction(transaction)
      if (simulation.value.err) {
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`)
      }

      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: 'processed',
        maxRetries: 3,
      })

      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
      }, 'processed')
      
      // Invalidate cache after profile creation
      clearProfileCache(publicKey.toString())
      
      toast.success('Profile created successfully!')
      return signature
    } catch (error: any) {
      console.error('❌ Profile creation error:', error)
      toast.error(`Transaction failed: ${error.message || 'Unknown error'}`)
      throw error
    }
  }

  // Production-ready profile detection with localStorage caching - Improved for multiple users
  const getProfile = async (userPublicKey: PublicKey): Promise<Profile | null> => {
    const cacheKey = userPublicKey.toString()
    
    try {
      // 1. Check localStorage cache first (fastest)
      const cachedProfile = getProfileFromLocalStorage(cacheKey)
      if (cachedProfile !== null) {
        // Also update memory cache
        profileCache.set(cacheKey, cachedProfile)
        setTimeout(() => profileCache.delete(cacheKey), CACHE_DURATION)
        return cachedProfile
      }
      
      // 2. Check memory cache
      if (profileCache.has(cacheKey)) {
        const cached = profileCache.get(cacheKey)
        return cached ?? null
      }

      // 3. Fetch from blockchain (slowest)
      console.log(`🔍 Fetching profile from blockchain for: ${userPublicKey.toString().slice(0, 8)}...`)
      
      const accounts = await connection.getProgramAccounts(PROGRAM_ID)
      
      console.log(`📊 Found ${accounts.length} program accounts to scan for profiles`)

      let profilesFound = 0
      
      // Scan through accounts to find user's profile
      for (const { account, pubkey } of accounts) {
        try {
          if (account.data.length === 0) continue
          
          // Try manual parsing first
          const profileAccount = manualParseProfile(account.data)
          if (!profileAccount) continue
          
          profilesFound++
          
          const accountOwner = new PublicKey(profileAccount.owner)
          
          // Check if this profile belongs to the user we're looking for
          if (profileAccount.is_initialized === 1 && accountOwner.equals(userPublicKey)) {
            console.log(`🎯 FOUND PROFILE! Username: "${profileAccount.username}" for ${userPublicKey.toString().slice(0, 8)}`)
            console.log(`📸 Profile Image URL: "${profileAccount.profile_image}"`)
            console.log(`🖼️ Cover Image URL: "${profileAccount.cover_image}"`)
            console.log(`📊 Profile Data:`, {
              username: profileAccount.username,
              bio: profileAccount.bio,
              profileImage: profileAccount.profile_image,
              coverImage: profileAccount.cover_image,
              postsCount: Number(profileAccount.posts_count),
              followersCount: Number(profileAccount.followers_count),
              isVerified: profileAccount.is_verified === 1
            })
            const profile = convertProfileAccount(profileAccount)
            
            // Cache in both memory and localStorage
            profileCache.set(cacheKey, profile)
            setTimeout(() => profileCache.delete(cacheKey), CACHE_DURATION)
            saveProfileToLocalStorage(cacheKey, profile)
            
            return profile
          }
        } catch (error) {
          // Not a profile account or parsing failed, continue
          continue
        }
      }

      console.log(`📊 Scanned ${profilesFound} profiles, no match found for user: ${userPublicKey.toString().slice(0, 8)}`)

      // No profile found - cache null result to avoid repeated scans
      profileCache.set(cacheKey, null)
      setTimeout(() => profileCache.delete(cacheKey), CACHE_DURATION)
      saveProfileToLocalStorage(cacheKey, null)
      
      return null
    } catch (error) {
      console.error(`Error fetching profile for ${userPublicKey.toString().slice(0, 8)}:`, error)
      return null
    }
  }

  // Get profile by username (for specific lookups)
  const getProfileByUsername = async (userPublicKey: PublicKey, username: string): Promise<Profile | null> => {
    try {
      const profilePDA = await getProfilePDA(userPublicKey, username)
      const accountInfo = await connection.getAccountInfo(profilePDA)
      
      if (!accountInfo || !accountInfo.data || accountInfo.data.length === 0) {
        return null
      }

      // Now try manual parsing
      const profileAccount = manualParseProfile(accountInfo.data)
      if (profileAccount) {
        console.log(`✅ Successfully manually parsed profile:`, {
          username: profileAccount.username,
          bio: profileAccount.bio,
          isInitialized: profileAccount.is_initialized === 1,
          owner: new PublicKey(profileAccount.owner).toString(),
          profileImage: profileAccount.profile_image,
          coverImage: profileAccount.cover_image,
          postsCount: Number(profileAccount.posts_count)
        })
        
        return convertProfileAccount(profileAccount)
      } else {
        console.log(`❌ Manual parsing failed`)
        return null
      }
    } catch (error) {
      return null
    }
  }

  // Get posts - SIMPLIFIED without complex filtering
  const getPosts = async (): Promise<Post[]> => {
    try {
      // Check cache first
      if (postsCache && Date.now() - postsCache.timestamp < POSTS_CACHE_DURATION) {
        console.log('⚡ Using cached posts')
        return postsCache.posts
      }

      console.log('🔍 Fetching posts from blockchain...')
      
      const accounts = await connection.getProgramAccounts(PROGRAM_ID)
      const posts: Post[] = []

      console.log(`📊 Scanning ${accounts.length} program accounts for posts...`)

      for (const { account, pubkey } of accounts) {
        try {
          if (account.data.length === 0) continue

          const postAccount = manualParsePost(account.data)
          if (postAccount && postAccount.is_initialized === 1 && postAccount.content) {
            const post = convertPostAccount(postAccount)
            posts.push(post)
            console.log(`📝 Found post: "${post.content.substring(0, 50)}..." by ${post.author.toString()}`)
          }
        } catch (error) {
          continue
        }
      }

      posts.sort((a, b) => b.timestamp - a.timestamp)
      console.log(`✅ Loaded ${posts.length} posts from blockchain`)
      
      // Cache the results
      postsCache = { posts, timestamp: Date.now() }
      
      return posts
    } catch (error) {
      console.error('Error fetching posts:', error)
      return []
    }
  }

  // Get comments for a specific post - SIMPLIFIED
  const getCommentsForPost = async (postId: number): Promise<Comment[]> => {
    try {
      console.log(`🔍 Getting comments for post ID ${postId}...`)
      
      // Return comments from in-memory storage
      const comments = commentsStorage[postId] || []
      console.log(`✅ Found ${comments.length} comments for post ${postId}`)
      
      return comments
    } catch (error) {
      console.error('Error fetching comments:', error)
      return []
    }
  }

  // Store comment - SIMPLIFIED
  const storeComment = (parentPostId: number, comment: Comment) => {
    try {
      console.log(`💾 Storing comment for post ${parentPostId}:`, comment.content.substring(0, 30))
      
      if (!commentsStorage[parentPostId]) {
        commentsStorage[parentPostId] = []
      }
      
      commentsStorage[parentPostId].push(comment)
      console.log(`✅ Stored comment. Post ${parentPostId} now has ${commentsStorage[parentPostId].length} comments`)
    } catch (error) {
      console.error('Failed to store comment:', error)
    }
  }

  // Create post - REAL IMPLEMENTATION
  const createPost = async (content: string, images: string[] = []) => {
    if (!publicKey) throw new Error('Wallet not connected')

    try {
      console.log('🔍 Creating post with content:', content)
      
      // Check SOL balance
      const balance = await checkSOLBalance()
      if (balance < 0.05) {
        throw new Error(`Insufficient SOL balance: ${balance}. You need at least 0.05 SOL for transaction fees and account creation.`)
      }

      // Get user's profile PDA - we need this for the instruction
      const userProfile = await getProfile(publicKey)
      if (!userProfile) {
        throw new Error('You must create a profile before posting')
      }

      // Get user's current post count to generate the correct post ID
      // The Rust contract increments posts_count first, then uses that as the post ID
      const postId = userProfile.postsCount + 1
      const postPDA = await getPostPDA(publicKey, postId)
      console.log(`📍 Post PDA: ${postPDA.toString()} for post ID: ${postId}`)

      // Generate a new keypair for the post account
      // The Rust contract uses invoke with system_instruction::create_account
      // This means the post account MUST be a keypair that signs the transaction
      const postKeypair = Keypair.generate()
      console.log(`📍 Post Account: ${postKeypair.publicKey.toString()}`)

      // Get profile PDA for the user (we need the actual username)
      // Try to find the profile account among all program accounts
      const accounts = await connection.getProgramAccounts(PROGRAM_ID)
      let userProfilePDA: PublicKey | null = null
      
      for (const { account, pubkey } of accounts) {
        try {
          const profileAccount = manualParseProfile(account.data)
          if (profileAccount && 
              profileAccount.is_initialized === 1 && 
              new PublicKey(profileAccount.owner).equals(publicKey)) {
            userProfilePDA = pubkey
            console.log(`📍 User Profile PDA: ${userProfilePDA.toString()}`)
            break
          }
        } catch (error) {
          continue
        }
      }

      if (!userProfilePDA) {
        throw new Error('Could not find your profile PDA. Please refresh and try again.')
      }

      const instructionData = new CreatePostInstruction({
        content,
        images,
      })

      const createPostVariant = Buffer.from([2]) // CreatePost enum index
      const serializedData = serialize(createPostSchema, instructionData)
      const fullInstructionData = Buffer.concat([createPostVariant, Buffer.from(serializedData)])

      console.log(`🔢 Instruction data length: ${fullInstructionData.length} bytes`)

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true }, // User account (payer)
          { pubkey: postKeypair.publicKey, isSigner: true, isWritable: true }, // Post account (must be signer)
          { pubkey: userProfilePDA, isSigner: false, isWritable: true }, // User profile (for post count)
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
        ],
        programId: PROGRAM_ID,
        data: fullInstructionData,
      })

      console.log('📝 Transaction instruction created')
      console.log('🔑 Keys:', instruction.keys.map(k => ({
        pubkey: k.pubkey.toString(),
        isSigner: k.isSigner,
        isWritable: k.isWritable
      })))

      const transaction = new Transaction().add(instruction)
      const { blockhash } = await connection.getLatestBlockhash('processed')
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      // Sign transaction before simulation
      transaction.partialSign(postKeypair)
      
      // Simulate transaction 
      const simulation = await connection.simulateTransaction(transaction)
      console.log('🎯 Transaction simulation:', simulation)
      
      if (simulation.value.err) {
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`)
      }

      // Send transaction with post keypair as additional signer
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: 'processed',
        maxRetries: 3,
        signers: [postKeypair], // Post keypair must sign the transaction
      })

      console.log(`📋 Transaction signature: ${signature}`)
      
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
      }, 'processed')

      // Invalidate cache after post creation (profile post count changed)
      clearProfileCache(publicKey.toString())
      postsCache = null // Also clear posts cache to show new post immediately

      console.log('✅ Post created successfully!')
      toast.success('Post created successfully!')
      return signature
    } catch (error: any) {
      console.error('❌ Post creation error:', error)
      
      if (error.message?.includes('insufficient funds')) {
        const balance = await checkSOLBalance()
        toast.error(`Insufficient SOL: ${balance.toFixed(4)} SOL. Need at least 0.05 SOL for fees.`)
      } else if (error.message?.includes('simulation failed')) {
        toast.error('Transaction would fail: Check account setup and balance')
        console.error('Simulation error details:', error.message)
      } else {
        toast.error(`Failed to create post: ${error.message || 'Unknown error'}`)
      }
      
      throw error
    }
  }

  // Like post - REAL IMPLEMENTATION - Fixed to find actual post accounts
  const likePost = async (postId: number, postAuthor: PublicKey) => {
    if (!publicKey) throw new Error('Wallet not connected')

    try {
      console.log(`🔍 Attempting to like post ID ${postId} by author ${postAuthor.toString().slice(0, 8)}...`)
      
      // Check SOL balance first
      const balance = await checkSOLBalance()
      console.log(`💰 Current SOL balance: ${balance}`)
      if (balance < 0.01) {
        throw new Error(`Insufficient SOL balance: ${balance}. Need at least 0.01 SOL for transaction fees.`)
      }

      // Find the actual post account and author's profile account by scanning all program accounts
      console.log(`🔍 Searching for post ID ${postId} by author ${postAuthor.toString().slice(0, 8)}...`)
      
      const accounts = await connection.getProgramAccounts(PROGRAM_ID)
      let postAccountAddress: PublicKey | null = null
      let postAccount: PostAccount | null = null
      let authorProfileAddress: PublicKey | null = null
      
      // First pass: find the post account
      for (const { account, pubkey } of accounts) {
        try {
          const parsedPost = manualParsePost(account.data)
          if (parsedPost && 
              parsedPost.is_initialized === 1 && 
              Number(parsedPost.id) === postId &&
              new PublicKey(parsedPost.author).equals(postAuthor)) {
            postAccountAddress = pubkey
            postAccount = parsedPost
            console.log(`🎯 Found post ID ${postId} at address: ${pubkey.toString()}`)
            break
          }
        } catch (error) {
          // Not a post account, continue
          continue
        }
      }

      if (!postAccountAddress || !postAccount) {
        throw new Error(`Post ID ${postId} by author ${postAuthor.toString().slice(0, 8)} not found on blockchain`)
      }

      // Second pass: find the author's profile account
      console.log(`🔍 Searching for author's profile: ${postAuthor.toString().slice(0, 8)}...`)
      for (const { account, pubkey } of accounts) {
        try {
          const parsedProfile = manualParseProfile(account.data)
          if (parsedProfile && 
              parsedProfile.is_initialized === 1 && 
              new PublicKey(parsedProfile.owner).equals(postAuthor)) {
            authorProfileAddress = pubkey
            console.log(`✅ Found author profile account: ${pubkey.toString()}`)
            break
          }
        } catch (error) {
          // Not a profile account, continue
          continue
        }
      }

      if (!authorProfileAddress) {
        throw new Error(`Author's profile not found for ${postAuthor.toString().slice(0, 8)}`)
      }

      console.log(`📝 Post data verified: "${postAccount.content.slice(0, 30)}..." with ${Number(postAccount.likes)} likes`)

      const instructionData = new LikePostInstruction({
        post_id: BigInt(postId),
      })

      const likePostVariant = Buffer.from([3]) // LikePost instruction variant
      const serializedData = serialize(likePostSchema, instructionData)
      const fullInstructionData = Buffer.concat([likePostVariant, Buffer.from(serializedData)])

      console.log(`🔢 Instruction data: variant [3], serialized length: ${serializedData.length}, total: ${fullInstructionData.length} bytes`)

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: false }, // User account (liker)
          { pubkey: postAccountAddress, isSigner: false, isWritable: true }, // Post account (to update likes)
          { pubkey: authorProfileAddress, isSigner: false, isWritable: true }, // Author profile account (to update UCR)
        ],
        programId: PROGRAM_ID,
        data: fullInstructionData,
      })

      console.log('🔑 Transaction accounts:')
      console.log(`  User (liker): ${publicKey.toString()} (signer, readonly)`)
      console.log(`  Post: ${postAccountAddress.toString()} (not signer, writable)`)
      console.log(`  Author Profile: ${authorProfileAddress.toString()} (not signer, writable)`)
      console.log(`  Program: ${PROGRAM_ID.toString()}`)

      const transaction = new Transaction().add(instruction)
      const { blockhash } = await connection.getLatestBlockhash('processed')
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      // Simulate transaction before sending
      console.log('🎯 Simulating transaction...')
      const simulation = await connection.simulateTransaction(transaction)
      console.log('📊 Simulation result:', simulation)
      
      if (simulation.value.err) {
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`)
      }
      console.log('✅ Transaction simulation successful')

      console.log('🚀 Sending transaction...')
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: 'processed',
        maxRetries: 3,
      })

      console.log(`📋 Transaction sent with signature: ${signature}`)
      
      console.log('⏳ Confirming transaction...')
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
      }, 'processed')

      console.log('✅ Transaction confirmed! Post liked successfully!')
      
      // Clear posts cache to force refresh
      postsCache = null
      
      toast.success('Post liked!')
      return signature
    } catch (error: any) {
      console.error('❌ Like post error:', error)
      
      // More specific error messages
      if (error.message?.includes('insufficient funds')) {
        const balance = await checkSOLBalance()
        toast.error(`Insufficient SOL: ${balance.toFixed(4)} SOL. Need at least 0.01 SOL for fees.`)
      } else if (error.message?.includes('simulation failed')) {
        toast.error('Transaction would fail: Check post exists and wallet has permission')
        console.error('Simulation error details:', error.message)
      } else if (error.message?.includes('not found on blockchain')) {
        toast.error('Post not found on blockchain')
      } else {
        toast.error(`Failed to like post: ${error.message || 'Unknown error'}`)
      }
      
      throw error
    }
  }

  // Check specific profile PDA - for debugging profile detection issues
  const checkProfileAtPDA = async (pdaAddress: string): Promise<void> => {
    try {
      console.log(`🔍 Checking specific PDA: ${pdaAddress}`)
      const pda = new PublicKey(pdaAddress)
      const accountInfo = await connection.getAccountInfo(pda)
      
      if (!accountInfo) {
        console.log(`❌ No account found at PDA: ${pdaAddress}`)
        return
      }
      
      console.log(`✅ Account exists! Owner: ${accountInfo.owner.toString()}, Size: ${accountInfo.data.length} bytes`)
      
      // Inspect raw data
      console.log(`🔍 Raw data (first 100 bytes):`, Array.from(accountInfo.data.slice(0, 100)))
      
      if (accountInfo.owner.equals(PROGRAM_ID)) {
        console.log(`✅ Account is owned by our program`)
        
        try {
          // Try manual parsing to understand the structure
          let offset = 0
          const is_initialized = accountInfo.data[offset]
          offset += 1
          console.log(`📊 is_initialized: ${is_initialized}`)
          
          const owner = accountInfo.data.slice(offset, offset + 32)
          offset += 32
          console.log(`📊 owner: ${new PublicKey(owner).toString()}`)
          
          // Try to read the username length (Borsh string format: 4 bytes length + string)
          const usernameLength = accountInfo.data.readUInt32LE(offset)
          offset += 4
          console.log(`📊 username length: ${usernameLength}`)
          
          if (usernameLength > 0 && usernameLength < 100) {
            const username = accountInfo.data.slice(offset, offset + usernameLength).toString('utf8')
            console.log(`📊 username: "${username}"`)
          }
          
          // Now try manual parsing
          const profileAccount = manualParseProfile(accountInfo.data)
          if (profileAccount) {
            console.log(`✅ Successfully manually parsed profile:`, {
              username: profileAccount.username,
              bio: profileAccount.bio,
              isInitialized: profileAccount.is_initialized === 1,
              owner: new PublicKey(profileAccount.owner).toString(),
              profileImage: profileAccount.profile_image,
              coverImage: profileAccount.cover_image,
              postsCount: Number(profileAccount.posts_count)
            })
          } else {
            console.log(`❌ Manual parsing failed`)
          }
          
          // Also try Borsh for comparison
          try {
            const profileAccount = deserialize(profileAccountSchema, ProfileAccount, accountInfo.data) as ProfileAccount
            console.log(`✅ Borsh deserialization also worked:`, {
              username: profileAccount.username,
              bio: profileAccount.bio,
              isInitialized: profileAccount.is_initialized === 1,
              owner: new PublicKey(profileAccount.owner).toString()
            })
          } catch (error) {
            console.log(`❌ Borsh deserialization still fails:`, error)
          }
        } catch (error) {
          console.log(`❌ Error checking PDA:`, error)
        }
      } else {
        console.log(`❌ Account is owned by different program: ${accountInfo.owner.toString()}`)
      }
    } catch (error) {
      console.log(`❌ Error checking PDA:`, error)
    }
  }

  // Manual profile parser - bypasses Borsh deserialization issues
  const manualParseProfile = (data: Buffer): ProfileAccount | null => {
    try {
      // Basic validation - profiles should have a minimum size
      if (data.length < 150) return null // Profiles need at least 150 bytes for basic structure
      
      let offset = 0
      
      // Parse each field manually
      const is_initialized = data[offset]
      if (is_initialized !== 1) return null // Must be initialized
      offset += 1
      
      const owner = data.slice(offset, offset + 32)
      offset += 32
      
      // Validate we have enough data for username length
      if (offset + 4 > data.length) return null
      
      // String fields (username, bio, profile_image, cover_image)
      const usernameLength = data.readUInt32LE(offset)
      offset += 4
      
      // Validate username length is reasonable
      if (usernameLength > 100 || usernameLength === 0) return null
      if (offset + usernameLength > data.length) return null
      
      const username = data.slice(offset, offset + usernameLength).toString('utf8')
      offset += usernameLength
      
      // Validate we have enough data for bio length
      if (offset + 4 > data.length) return null
      
      const bioLength = data.readUInt32LE(offset)
      offset += 4
      
      // Validate bio length is reasonable
      if (bioLength > 1000) return null
      if (offset + bioLength > data.length) return null
      
      const bio = data.slice(offset, offset + bioLength).toString('utf8')
      offset += bioLength
      
      // Validate we have enough data for profile image length
      if (offset + 4 > data.length) return null
      
      const profileImageLength = data.readUInt32LE(offset)
      offset += 4
      
      // Validate profile image length is reasonable
      if (profileImageLength > 500) return null
      if (offset + profileImageLength > data.length) return null
      
      const profile_image = data.slice(offset, offset + profileImageLength).toString('utf8')
      offset += profileImageLength
      
      // Validate we have enough data for cover image length
      if (offset + 4 > data.length) return null
      
      const coverImageLength = data.readUInt32LE(offset)
      offset += 4
      
      // Validate cover image length is reasonable
      if (coverImageLength > 500) return null
      if (offset + coverImageLength > data.length) return null
      
      const cover_image = data.slice(offset, offset + coverImageLength).toString('utf8')
      offset += coverImageLength
      
      // Validate we have enough data for all the u64 fields (8 bytes each * 6 fields = 48 bytes)
      if (offset + 48 > data.length) return null
      
      // u64 fields
      const created_at = data.readBigUInt64LE(offset)
      offset += 8
      
      const followers_count = data.readBigUInt64LE(offset)
      offset += 8
      
      const following_count = data.readBigUInt64LE(offset)
      offset += 8
      
      // i64 field
      const user_credit_rating = data.readBigInt64LE(offset)
      offset += 8
      
      const posts_count = data.readBigUInt64LE(offset)
      offset += 8
      
      const last_post_timestamp = data.readBigUInt64LE(offset)
      offset += 8
      
      const daily_post_count = data.readBigUInt64LE(offset)
      offset += 8
      
      // Validate we have enough data for the final u8 field
      if (offset + 1 > data.length) return null
      
      const is_verified = data[offset]
      offset += 1
      
      return new ProfileAccount({
        is_initialized,
        owner: new Uint8Array(owner),
        username,
        bio,
        profile_image,
        cover_image,
        created_at,
        followers_count,
        following_count,
        user_credit_rating,
        posts_count,
        last_post_timestamp,
        daily_post_count,
        is_verified
      })
    } catch (error) {
      // Silent failure - not a profile account or invalid data
      return null
    }
  }

  // Manual post parser - bypasses Borsh deserialization issues
  const manualParsePost = (data: Buffer): PostAccount | null => {
    try {
      // Quick validation: posts should have specific size and structure
      if (data.length < 100) return null // Posts should be larger than profiles
      
      let offset = 0
      
      // Parse each field manually
      const is_initialized = data[offset]
      if (is_initialized !== 1) return null // Must be initialized
      offset += 1
      
      // Check if this looks like a post vs profile by examining the structure
      // Posts start with: u8 (init), u64 (id), [32]u8 (author), string (content)
      // Profiles start with: u8 (init), [32]u8 (owner), string (username)
      
      const id = data.readBigUInt64LE(offset)
      offset += 8
      
      const author = data.slice(offset, offset + 32)
      offset += 32
      
      const contentLength = data.readUInt32LE(offset)
      offset += 4
      
      // Validate content length is reasonable (not too large)
      if (contentLength > 10000 || contentLength === 0) return null
      if (offset + contentLength > data.length) return null
      
      const content = data.slice(offset, offset + contentLength).toString('utf8')
      offset += contentLength
      
      // Ensure we have enough remaining data for the rest of the post structure
      if (offset + 40 > data.length) return null // Need at least 40 more bytes for timestamps and counts
      
      const timestamp = data.readBigUInt64LE(offset)
      offset += 8
      
      const likes = data.readBigUInt64LE(offset)
      offset += 8
      
      const comments = data.readBigUInt64LE(offset)
      offset += 8
      
      const mirrors = data.readBigUInt64LE(offset)
      offset += 8
      
      // Parse images array length
      if (offset + 4 > data.length) return null
      const imagesLength = data.readUInt32LE(offset)
      offset += 4
      const images: string[] = []
      
      // Parse images array - each image is a length-prefixed string
      for (let i = 0; i < imagesLength; i++) {
        if (offset + 4 > data.length) return null
        const imageLength = data.readUInt32LE(offset)
        offset += 4
        if (offset + imageLength > data.length) return null
        const image = data.slice(offset, offset + imageLength).toString('utf8')
        offset += imageLength
        images.push(image)
      }
      
      // Ensure we have enough data for rating and kill zone
      if (offset + 2 > data.length) return null
      
      const rating = data[offset]
      offset += 1
      
      const in_kill_zone = data[offset]
      offset += 1
      
      return new PostAccount({
        is_initialized,
        id,
        author: new Uint8Array(author),
        content,
        timestamp,
        likes,
        comments,
        mirrors,
        images,
        rating,
        in_kill_zone
      })
    } catch (error) {
      // Silent failure - not a post account
      return null
    }
  }

  // Convert CommunityAccount to Community interface
  const convertCommunityAccount = (communityAccount: CommunityAccount): Community => {
    return {
      isInitialized: communityAccount.is_initialized === 1,
      id: Number(communityAccount.id),
      creator: new PublicKey(communityAccount.creator),
      name: communityAccount.name,
      description: communityAccount.description,
      avatar: communityAccount.avatar,
      rules: communityAccount.rules,
      memberCount: Number(communityAccount.member_count),
      createdAt: Number(communityAccount.created_at) * 1000, // Convert seconds to milliseconds
      isPrivate: communityAccount.is_private === 1,
    }
  }

  // Create Community
  const createCommunity = async (
    name: string,
    description: string,
    avatar: string,
    rules: string[] = []
  ) => {
    if (!publicKey) throw new Error('Wallet not connected')

    try {
      console.log('🏘️ Creating community:', name)
      
      const balance = await checkSOLBalance()
      if (balance < 0.05) {
        throw new Error(`Insufficient SOL balance: ${balance}. Need at least 0.05 SOL.`)
      }

      // Generate a keypair for the community account
      const communityKeypair = Keypair.generate()
      console.log(`📍 Community Account: ${communityKeypair.publicKey.toString()}`)

      const instructionData = new CreateCommunityInstruction({
        name,
        description,
        avatar,
        rules,
      })

      const createCommunityVariant = Buffer.from([7]) // CreateCommunity enum index
      const serializedData = serialize(createCommunitySchema, instructionData)
      const fullInstructionData = Buffer.concat([createCommunityVariant, Buffer.from(serializedData)])

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true }, // Creator account
          { pubkey: communityKeypair.publicKey, isSigner: true, isWritable: true }, // Community account
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
        ],
        programId: PROGRAM_ID,
        data: fullInstructionData,
      })

      const transaction = new Transaction().add(instruction)
      const { blockhash } = await connection.getLatestBlockhash('processed')
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      // Sign with community keypair
      transaction.partialSign(communityKeypair)

      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: 'processed',
        maxRetries: 3,
        signers: [communityKeypair],
      })

      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
      }, 'processed')

      console.log('✅ Community created successfully!')
      toast.success(`Community "${name}" created successfully!`)
      return signature
    } catch (error: any) {
      console.error('❌ Community creation error:', error)
      toast.error(`Failed to create community: ${error.message || 'Unknown error'}`)
      throw error
    }
  }

  // Follow Profile
  const followProfile = async (profilePublicKey: PublicKey) => {
    if (!publicKey) throw new Error('Wallet not connected')

    try {
      console.log('👥 Following profile:', profilePublicKey.toString())

      // Find the follower's profile account (current user's profile)
      console.log(`🔍 Searching for follower profile: ${publicKey.toString().slice(0, 8)}...`)
      const accounts = await connection.getProgramAccounts(PROGRAM_ID)
      let followerProfileAddress: PublicKey | null = null
      
      for (const { account, pubkey } of accounts) {
        try {
          const parsedProfile = manualParseProfile(account.data)
          if (parsedProfile && 
              parsedProfile.is_initialized === 1 && 
              new PublicKey(parsedProfile.owner).equals(publicKey)) {
            followerProfileAddress = pubkey
            console.log(`✅ Found follower profile account: ${pubkey.toString()}`)
            break
          }
        } catch (error) {
          // Silent failure - not a profile account
          continue
        }
      }

      if (!followerProfileAddress) {
        throw new Error('You must create a profile before following others')
      }

      const instructionData = new FollowProfileInstruction({
        profile_id: profilePublicKey,
      })

      const followProfileVariant = Buffer.from([5]) // FollowProfile enum index
      const serializedData = serialize(followProfileSchema, instructionData)
      const fullInstructionData = Buffer.concat([followProfileVariant, Buffer.from(serializedData)])

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: false }, // Follower account
          { pubkey: profilePublicKey, isSigner: false, isWritable: true }, // Profile to follow
          { pubkey: followerProfileAddress, isSigner: false, isWritable: true }, // Follower's profile account
        ],
        programId: PROGRAM_ID,
        data: fullInstructionData,
      })

      const transaction = new Transaction().add(instruction)
      const signature = await sendTransaction(transaction, connection)

      await connection.confirmTransaction(signature, 'processed')
      
      // Clear profile cache to force refresh of follower counts
      clearProfileCache()
      
      toast.success('Profile followed!')
      return signature
    } catch (error: any) {
      console.error('Follow error:', error)
      toast.error('Failed to follow profile')
      throw error
    }
  }

  // Unfollow Profile
  const unfollowProfile = async (profilePublicKey: PublicKey) => {
    if (!publicKey) throw new Error('Wallet not connected')

    try {
      console.log('👥 Unfollowing profile:', profilePublicKey.toString())

      // Find the follower's profile account (current user's profile)
      console.log(`🔍 Searching for follower profile: ${publicKey.toString().slice(0, 8)}...`)
      const accounts = await connection.getProgramAccounts(PROGRAM_ID)
      let followerProfileAddress: PublicKey | null = null
      
      for (const { account, pubkey } of accounts) {
        try {
          const parsedProfile = manualParseProfile(account.data)
          if (parsedProfile && 
              parsedProfile.is_initialized === 1 && 
              new PublicKey(parsedProfile.owner).equals(publicKey)) {
            followerProfileAddress = pubkey
            console.log(`✅ Found follower profile account: ${pubkey.toString()}`)
            break
          }
        } catch (error) {
          // Silent failure - not a profile account
          continue
        }
      }

      if (!followerProfileAddress) {
        throw new Error('You must create a profile before unfollowing others')
      }

      const instructionData = new FollowProfileInstruction({
        profile_id: profilePublicKey,
      })

      const unfollowProfileVariant = Buffer.from([6]) // UnfollowProfile enum index
      const serializedData = serialize(followProfileSchema, instructionData)
      const fullInstructionData = Buffer.concat([unfollowProfileVariant, Buffer.from(serializedData)])

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: false }, // Follower account
          { pubkey: profilePublicKey, isSigner: false, isWritable: true }, // Profile to unfollow
          { pubkey: followerProfileAddress, isSigner: false, isWritable: true }, // Follower's profile account
        ],
        programId: PROGRAM_ID,
        data: fullInstructionData,
      })

      const transaction = new Transaction().add(instruction)
      const signature = await sendTransaction(transaction, connection)

      await connection.confirmTransaction(signature, 'processed')
      
      // Clear profile cache to force refresh of follower counts
      clearProfileCache()
      
      toast.success('Profile unfollowed!')
      return signature
    } catch (error: any) {
      console.error('Unfollow error:', error)
      toast.error('Failed to unfollow profile')
      throw error
    }
  }

  // Update Profile
  const updateProfile = async (
    username: string,
    bio: string,
    profileImage: string,
    coverImage: string
  ) => {
    if (!publicKey) throw new Error('Wallet not connected')

    try {
      console.log('🔄 Updating profile:', username)
      
      const instructionData = new CreateProfileInstruction({
        username,
        bio,
        profile_image: profileImage,
        cover_image: coverImage,
      })

      const updateProfileVariant = Buffer.from([1]) // UpdateProfile enum index (same as CreateProfile)
      const serializedData = serialize(createProfileSchema, instructionData)
      const fullInstructionData = Buffer.concat([updateProfileVariant, Buffer.from(serializedData)])

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true }, // Profile owner account
        ],
        programId: PROGRAM_ID,
        data: fullInstructionData,
      })

      const transaction = new Transaction().add(instruction)
      const signature = await sendTransaction(transaction, connection)

      await connection.confirmTransaction(signature, 'processed')
      console.log('✅ Profile updated successfully!')
      
      // Clear cache to force refresh
      profileCache.delete(publicKey.toString())
      
      return signature
    } catch (error: any) {
      console.error('❌ Update profile error:', error)
      throw error
    }
  }

  // Comment on Post - SIMPLIFIED (in-memory only)
  const commentOnPost = async (postId: number, content: string, postAuthor: PublicKey) => {
    if (!publicKey) throw new Error('Wallet not connected')

    try {
      console.log(`💬 Creating comment on post ID ${postId}...`)
      
      // Get user's profile for the comment
      const userProfile = await getProfile(publicKey)
      if (!userProfile) {
        throw new Error('You must create a profile before commenting')
      }

      // Create comment object
      const comment: Comment = {
        id: Date.now(), // Use timestamp as unique ID
        parentPostId: postId,
        author: publicKey,
        content: content,
        timestamp: Date.now(),
        likes: 0,
        authorProfile: userProfile
      }

      // Store comment in memory
      storeComment(postId, comment)

      console.log('✅ Comment created successfully!')
      toast.success('Comment posted!')
      
      return 'comment_created'
    } catch (error: any) {
      console.error('❌ Comment creation error:', error)
      toast.error(`Failed to comment: ${error.message || 'Unknown error'}`)
      throw error
    }
  }

  // Bookmark Post (using localStorage since we don't have bookmark functionality)
  const bookmarkPost = async (postId: number) => {
    if (!publicKey) throw new Error('Wallet not connected')

    try {
      console.log(`🔖 Bookmarking post ID ${postId}...`)
      
      const bookmarksKey = `bookmarks_${publicKey.toString()}`
      const existingBookmarks = localStorage.getItem(bookmarksKey)
      const bookmarks: number[] = existingBookmarks ? JSON.parse(existingBookmarks) : []
      
      if (bookmarks.includes(postId)) {
        // Remove bookmark
        const updatedBookmarks = bookmarks.filter(id => id !== postId)
        localStorage.setItem(bookmarksKey, JSON.stringify(updatedBookmarks))
        toast.success('Bookmark removed!')
      } else {
        // Add bookmark
        bookmarks.push(postId)
        localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks))
        toast.success('Post bookmarked!')
      }
      
      return 'bookmarked'
    } catch (error: any) {
      console.error('❌ Bookmark error:', error)
      toast.error('Failed to bookmark post')
      throw error
    }
  }

  // Get user bookmarks
  const getUserBookmarks = (): number[] => {
    if (!publicKey) return []
    
    try {
      const bookmarksKey = `bookmarks_${publicKey.toString()}`
      const existingBookmarks = localStorage.getItem(bookmarksKey)
      return existingBookmarks ? JSON.parse(existingBookmarks) : []
    } catch (error) {
      console.error('Failed to get bookmarks:', error)
      return []
    }
  }

  // Check if post is bookmarked
  const isPostBookmarked = (postId: number): boolean => {
    const bookmarks = getUserBookmarks()
    return bookmarks.includes(postId)
  }

  // Utility function to preload profile on wallet connection
  const preloadProfile = async () => {
    if (!publicKey) return
    
    console.log('🚀 Preloading profile on wallet connection...')
    try {
      await getProfile(publicKey)
    } catch (error) {
      console.warn('Failed to preload profile:', error)
    }
  }

  // Force refresh all data - clears all caches
  const refreshData = () => {
    console.log('🔄 Force refreshing all data...')
    clearProfileCache()
    postsCache = null
    // Clear comments storage
    commentsStorage = {}
  }

  return {
    createProfile,
    createPost,
    likePost,
    getProfile,
    getProfileByUsername,
    getPosts,
    getProfilePDA,
    getPostPDA,
    checkProfileAtPDA,
    preloadProfile,
    clearProfileCache,
    refreshData,
    createCommunity,
    followProfile,
    unfollowProfile,
    updateProfile,
    commentOnPost,
    bookmarkPost,
    getUserBookmarks,
    isPostBookmarked,
    getCommentsForPost,
  }
}