'use client'

import { MessageCircle, Users, DollarSign, Star, Heart, Clock, Crown, TrendingUp } from 'lucide-react'
import { Profile, useBlocksProgram, Post } from '@/hooks/useBlocksProgram'
import { useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { convertToFastestGateway } from '@/utils/ipfs'

interface SidebarProps {
  userProfile: Profile | null
  connected: boolean
  onProfileClick?: (profileAddress: string) => void
}

interface PostWithProfile extends Post {
  authorProfile?: Profile | null
}

export default function Sidebar({ userProfile, connected, onProfileClick }: SidebarProps) {
  const { getPosts, getProfile } = useBlocksProgram()
  const [recentPosts, setRecentPosts] = useState<PostWithProfile[]>([])
  const [topUsers, setTopUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSidebarData()
  }, [connected])

  const loadSidebarData = async () => {
    try {
      setLoading(true)
      
      // Get posts and sort by likes to show most liked posts
      const posts = await getPosts()
      const mostLikedPosts = posts
        .sort((a, b) => b.likes - a.likes)
        .slice(0, 5) // Get 5 most liked posts
      
      console.log(`📊 Loading author profiles for ${mostLikedPosts.length} most liked posts...`)
      
      // Load author profiles for the most liked posts with rate limiting protection
      const postsWithProfiles: PostWithProfile[] = []
      
      for (let i = 0; i < mostLikedPosts.length; i++) {
        const post = mostLikedPosts[i]
        try {
          console.log(`👤 Loading sidebar profile ${i + 1}/${mostLikedPosts.length} for ${post.author.toString().slice(0, 8)}...`)
          
          // Add delay between requests to prevent rate limiting
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 300)) // 300ms delay for sidebar
          }
          
          const profile = await getProfile(post.author)
          
          if (profile) {
            console.log(`✅ Loaded sidebar profile for ${post.author.toString().slice(0, 8)}: "${profile.username}"`)
          } else {
            console.log(`❌ No sidebar profile found for ${post.author.toString().slice(0, 8)}`)
          }
          
          postsWithProfiles.push({ ...post, authorProfile: profile })
        } catch (error) {
          console.warn(`⚠️ Failed to load sidebar profile for ${post.author.toString().slice(0, 8)}:`, error)
          postsWithProfiles.push({ ...post, authorProfile: null })
          
          // If we hit rate limiting, add a longer delay
          if (error instanceof Error && error.message.includes('429')) {
            console.log('⏳ Sidebar rate limited, waiting 2 seconds...')
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      }
      
      setRecentPosts(postsWithProfiles)
      
      // Get unique users from posts and fetch their profiles to find top UCR users
      const uniqueAuthors = Array.from(new Set(posts.map(post => post.author.toString())))
      const userProfiles: Profile[] = []
      
      for (let i = 0; i < Math.min(uniqueAuthors.length, 10); i++) { // Limit to 10 to avoid too many requests
        const authorAddress = uniqueAuthors[i]
        try {
          // Add delay between requests to prevent rate limiting
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 400)) // 400ms delay for top users
          }
          
          const profile = await getProfile(new PublicKey(authorAddress))
          if (profile) {
            userProfiles.push(profile)
          }
        } catch (error) {
          // Skip if profile fetch fails
          console.warn(`⚠️ Failed to load top user profile for ${authorAddress.slice(0, 8)}:`, error)
          
          // If we hit rate limiting, add a longer delay
          if (error instanceof Error && error.message.includes('429')) {
            console.log('⏳ Top users rate limited, waiting 2 seconds...')
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
          continue
        }
      }
      
      // Sort by UCR and take top 3
      const sortedByUCR = userProfiles
        .sort((a, b) => b.userCreditRating - a.userCreditRating)
        .slice(0, 3)
      
      setTopUsers(sortedByUCR)
      
      const profilesLoaded = postsWithProfiles.filter(p => p.authorProfile).length
      console.log(`✅ Sidebar loaded ${profilesLoaded}/${mostLikedPosts.length} author profiles successfully`)
    } catch (error) {
      console.error('Failed to load sidebar data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  return (
    <div className="space-y-6">
      {/* Most Liked Posts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Heart className="h-5 w-5 mr-2 text-blue-600" />
            Most Liked Posts
          </h3>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                  </div>
                  <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : recentPosts.length > 0 ? (
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <div key={post.id} className="p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center space-x-2 mb-1">
                    <img 
                      src={post.authorProfile?.profileImage ? convertToFastestGateway(post.authorProfile.profileImage) : `https://picsum.photos/24/24?random=${post.id}`}
                      alt="Author"
                      className="w-6 h-6 rounded-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        const originalSrc = target.src
                        console.log(`❌ Sidebar: Failed to load profile image for ${post.authorProfile?.username || 'unknown'}:`)
                        console.log(`   Original URL: ${originalSrc}`)
                        console.log(`   Profile Image URL from blockchain: ${post.authorProfile?.profileImage}`)
                        console.log(`   Error details:`, e)
                        console.log(`   Image naturalWidth: ${target.naturalWidth}, naturalHeight: ${target.naturalHeight}`)
                        console.log(`   Image complete: ${target.complete}`)
                        
                        // If it's a PINATA URL that failed, try alternative gateways
                        if (originalSrc.includes('gateway.pinata.cloud') && post.authorProfile?.profileImage) {
                          const ipfsHash = post.authorProfile.profileImage.split('/').pop()
                          if (ipfsHash) {
                            console.log(`🔄 Sidebar: Trying alternative IPFS gateway for hash: ${ipfsHash}`)
                            target.src = `https://ipfs.io/ipfs/${ipfsHash}`
                            return
                          }
                        }
                        
                        // If ipfs.io failed, try cloudflare
                        if (originalSrc.includes('ipfs.io/ipfs/') && post.authorProfile?.profileImage) {
                          const ipfsHash = post.authorProfile.profileImage.split('/').pop()
                          if (ipfsHash) {
                            console.log(`🔄 Sidebar: Trying Cloudflare IPFS gateway for hash: ${ipfsHash}`)
                            target.src = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`
                            return
                          }
                        }
                        
                        // If cloudflare failed, try dweb.link
                        if (originalSrc.includes('cloudflare-ipfs.com/ipfs/') && post.authorProfile?.profileImage) {
                          const ipfsHash = post.authorProfile.profileImage.split('/').pop()
                          if (ipfsHash) {
                            console.log(`🔄 Sidebar: Trying dweb.link IPFS gateway for hash: ${ipfsHash}`)
                            target.src = `https://dweb.link/ipfs/${ipfsHash}`
                            return
                          }
                        }
                        
                        // Final fallback
                        target.src = `https://picsum.photos/24/24?random=${post.id}`
                      }}
                      onLoad={() => {
                        if (post.authorProfile?.profileImage) {
                          console.log(`✅ Sidebar: Successfully loaded profile image for ${post.authorProfile.username}:`)
                          console.log(`   URL: ${post.authorProfile.profileImage}`)
                        }
                      }}
                    />
                    <button
                      onClick={() => onProfileClick?.(post.author.toString())}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate"
                    >
                      {post.authorProfile?.username || `User_${post.author.toString().slice(0, 8)}`}
                    </button>
                    {post.authorProfile && (
                      <span className={`text-xs font-medium px-1 py-0.5 rounded ${
                        post.authorProfile.userCreditRating >= 4.0 ? 'bg-green-100 text-green-800' :
                        post.authorProfile.userCreditRating >= 3.0 ? 'bg-blue-100 text-blue-800' :
                        post.authorProfile.userCreditRating >= 2.5 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        UCR {post.authorProfile.userCreditRating.toFixed(1)}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">{formatTimeAgo(post.timestamp)}</span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {post.content.slice(0, 80)}...
                  </p>
                  <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center">
                      <MessageCircle className="h-3 w-3 mr-1" />
                      {post.likes} likes
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              No posts found on the blockchain yet
            </p>
          )}
        </div>
      </div>

      {/* Top Users by UCR */}
      {connected && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Crown className="h-5 w-5 mr-2 text-yellow-600" />
              Top Contributors
            </h3>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                      <div className="space-y-1">
                        <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
                        <div className="h-2 bg-gray-200 rounded w-16 animate-pulse"></div>
                      </div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-12 animate-pulse"></div>
                  </div>
                ))}
              </div>
            ) : topUsers.length > 0 ? (
              <div className="space-y-3">
                {topUsers.map((user, index) => (
                  <div key={user.owner.toString()} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <img 
                          src={user.profileImage ? convertToFastestGateway(user.profileImage) : `https://picsum.photos/32/32?random=${user.owner.toString()}`}
                          alt={user.username}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            const originalSrc = target.src
                            console.log(`❌ Top Users: Failed to load profile image for ${user.username}:`)
                            console.log(`   Original URL: ${originalSrc}`)
                            console.log(`   Profile Image URL from blockchain: ${user.profileImage}`)
                            console.log(`   Error details:`, e)
                            console.log(`   Image naturalWidth: ${target.naturalWidth}, naturalHeight: ${target.naturalHeight}`)
                            console.log(`   Image complete: ${target.complete}`)
                            
                            // If it's a PINATA URL that failed, try alternative gateways
                            if (originalSrc.includes('gateway.pinata.cloud') && user.profileImage) {
                              const ipfsHash = user.profileImage.split('/').pop()
                              if (ipfsHash) {
                                console.log(`🔄 Top Users: Trying alternative IPFS gateway for hash: ${ipfsHash}`)
                                target.src = `https://ipfs.io/ipfs/${ipfsHash}`
                                return
                              }
                            }
                            
                            // If ipfs.io failed, try cloudflare
                            if (originalSrc.includes('ipfs.io/ipfs/') && user.profileImage) {
                              const ipfsHash = user.profileImage.split('/').pop()
                              if (ipfsHash) {
                                console.log(`🔄 Top Users: Trying Cloudflare IPFS gateway for hash: ${ipfsHash}`)
                                target.src = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`
                                return
                              }
                            }
                            
                            // If cloudflare failed, try dweb.link
                            if (originalSrc.includes('cloudflare-ipfs.com/ipfs/') && user.profileImage) {
                              const ipfsHash = user.profileImage.split('/').pop()
                              if (ipfsHash) {
                                console.log(`🔄 Top Users: Trying dweb.link IPFS gateway for hash: ${ipfsHash}`)
                                target.src = `https://dweb.link/ipfs/${ipfsHash}`
                                return
                              }
                            }
                            
                            // Final fallback
                            target.src = `https://picsum.photos/32/32?random=${user.owner.toString()}`
                          }}
                          onLoad={() => {
                            if (user.profileImage) {
                              console.log(`✅ Top Users: Successfully loaded profile image for ${user.username}:`)
                              console.log(`   URL: ${user.profileImage}`)
                            }
                          }}
                        />
                        {index === 0 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                            <Crown className="h-2 w-2 text-white" />
                          </div>
                        )}
                        {index === 1 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center text-[8px] font-bold text-white">
                            2
                          </div>
                        )}
                        {index === 2 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-400 rounded-full flex items-center justify-center text-[8px] font-bold text-white">
                            3
                          </div>
                        )}
                      </div>
                      <div>
                        <button
                          onClick={() => onProfileClick?.(user.owner.toString())}
                          className="font-medium text-gray-900 text-sm hover:text-blue-600"
                        >
                          {user.username}
                        </button>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span className={`px-1 py-0.5 rounded ${
                            user.userCreditRating >= 4.0 ? 'bg-green-100 text-green-800' :
                            user.userCreditRating >= 3.0 ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            UCR {user.userCreditRating.toFixed(1)}
                          </span>
                          <span>{user.postsCount} posts</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${
                        index === 0 ? 'text-yellow-600' :
                        index === 1 ? 'text-gray-500' :
                        'text-orange-500'
                      }`}>
                        {index === 0 ? '🏆' : index === 1 ? '🥈' : '🥉'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No user profiles found yet
              </p>
            )}
          </div>
        </div>
      )}

      {/* Your Stats Summary */}
      {connected && userProfile && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
              Your Activity
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-xl font-bold text-blue-600">{userProfile.postsCount}</div>
                <div className="text-xs text-gray-600">Posts</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600">{userProfile.followersCount}</div>
                <div className="text-xs text-gray-600">Followers</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-xl font-bold text-purple-600">{userProfile.followingCount}</div>
                <div className="text-xs text-gray-600">Following</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-xl font-bold text-yellow-600">
                  {Math.floor((Date.now() - userProfile.createdAt) / (1000 * 60 * 60 * 24))}
                </div>
                <div className="text-xs text-gray-600">Days</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UCR Info */}
      {connected && userProfile && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
            <Star className="h-5 w-5 mr-2 text-yellow-600" />
            Your UCR Score
          </h3>
          <div className="flex items-center justify-between mb-3">
            <span className="text-3xl font-bold text-blue-600">
              {userProfile.userCreditRating.toFixed(1)}
            </span>
            <div className="text-right">
              <div className={`text-sm font-medium ${
                userProfile.userCreditRating >= 4.0 ? 'text-green-600' :
                userProfile.userCreditRating >= 3.0 ? 'text-blue-600' :
                userProfile.userCreditRating >= 2.5 ? 'text-yellow-600' :
                'text-gray-600'
              }`}>
                {userProfile.userCreditRating >= 4.0 ? '🏆 Elite' :
                 userProfile.userCreditRating >= 3.0 ? '⭐ Advanced' :
                 userProfile.userCreditRating >= 2.5 ? '📈 Intermediate' :
                 '🌱 Beginner'}
              </div>
              <div className="text-xs text-gray-500">
                {userProfile.userCreditRating >= 2.5 ? 'Can create SubBlocks' : 'Need 2.5+ for SubBlocks'}
              </div>
            </div>
          </div>
          
          {/* UCR Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div 
              className={`h-2 rounded-full ${
                userProfile.userCreditRating >= 4.0 ? 'bg-green-500' :
                userProfile.userCreditRating >= 3.0 ? 'bg-blue-500' :
                userProfile.userCreditRating >= 2.5 ? 'bg-yellow-500' :
                'bg-gray-500'
              }`}
              style={{ width: `${Math.min((userProfile.userCreditRating / 5) * 100, 100)}%` }}
            ></div>
          </div>
          
          <p className="text-xs text-gray-500">
            Post quality content, get followers, and stay active to improve your UCR
          </p>
        </div>
      )}

      {/* Welcome Message for Disconnected Users */}
      {!connected && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Welcome to Blocks</h3>
          <p className="text-sm text-gray-600 mb-3">
            Decentralized social media on Solana
          </p>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• 💰 Earn SOL tips for great content</li>
            <li>• 📊 Build your User Credit Rating</li>
            <li>• 🏘️ Create & join elite SubBlocks</li>
            <li>• 🔗 Own your content on blockchain</li>
            <li>• 🚀 No algorithmic manipulation</li>
          </ul>
        </div>
      )}
    </div>
  )
} 