'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, Crown, Globe, Lock, MessageCircle, Share2, Settings, Plus, Send, Image, Heart, MoreHorizontal } from 'lucide-react'
import { useBlocksProgram, Community, Post, Profile } from '@/hooks/useBlocksProgram'
import { useWallet } from '@solana/wallet-adapter-react'
import { toast } from 'react-hot-toast'

export default function SubBlockDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { publicKey } = useWallet()
  const { getCommunities, getProfile, getPosts, createPost, likePost, unlikePost, hasUserLikedPost } = useBlocksProgram()
  const [subblock, setSubblock] = useState<Community | null>(null)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [postContent, setPostContent] = useState('')
  const [postImages, setPostImages] = useState<string[]>([])
  const [isCreatingPost, setIsCreatingPost] = useState(false)

  useEffect(() => {
    loadSubblock()
    loadUserProfile()
  }, [params.id, publicKey])

  useEffect(() => {
    if (subblock) {
      loadSubblockPosts()
    }
  }, [subblock])

  const loadUserProfile = async () => {
    if (!publicKey) return
    try {
      const profile = await getProfile(publicKey)
      setUserProfile(profile)
    } catch (error) {
      console.error('Failed to load user profile:', error)
    }
  }

  const loadSubblock = async () => {
    try {
      setLoading(true)
      const communities = await getCommunities()
      const targetSubblock = communities.find(c => c.id.toString() === params.id)
      
      if (!targetSubblock) {
        toast.error('SubBlock not found')
        router.push('/subblocks')
        return
      }
      
      setSubblock(targetSubblock)
    } catch (error) {
      console.error('Failed to load SubBlock:', error)
      toast.error('Failed to load SubBlock')
      router.push('/subblocks')
    } finally {
      setLoading(false)
    }
  }

  const loadSubblockPosts = async () => {
    try {
      setPostsLoading(true)
      console.log(`🔍 Loading posts for SubBlock: ${subblock?.name}`)
      
      // Get all posts and filter for this specific SubBlock
      const allPosts = await getPosts()
      
      // Filter posts that were created specifically in this SubBlock
      // We'll identify SubBlock posts by checking if the post content includes a SubBlock identifier
      // or by checking if the post was created by someone while they were in this SubBlock context
      const subblockPosts = allPosts.filter(post => {
        // Method 1: Check if post content includes SubBlock identifier
        // Posts created in SubBlocks will have a special prefix or tag
        const hasSubBlockTag = post.content.includes(`#SubBlock-${subblock?.id}`) || 
                              post.content.includes(`[${subblock?.name}]`)
        
        // Debug logging
        if (hasSubBlockTag) {
          console.log(`✅ Found SubBlock post: "${post.content.substring(0, 50)}..." by ${post.author.toString().slice(0, 8)}`)
        }
        
        // Method 2: For now, we'll use a more sophisticated approach
        // Since we don't have SubBlock-specific posting in the smart contract yet,
        // we'll only show posts that were created after the user joined this SubBlock
        // and contain SubBlock-related content
        
        if (hasSubBlockTag) {
          return true
        }
        
        // For demonstration, let's not show any posts until they're created specifically in SubBlocks
        // This prevents showing all global posts in SubBlocks
        return false
      })
      
      console.log(`📊 Found ${subblockPosts.length} SubBlock-specific posts for "${subblock?.name}"`)
      console.log(`📊 Total posts scanned: ${allPosts.length}`)
      setPosts(subblockPosts)
    } catch (error) {
      console.error('Failed to load SubBlock posts:', error)
      setPosts([])
    } finally {
      setPostsLoading(false)
    }
  }

  const handleCreatePost = async () => {
    if (!publicKey || !userProfile || !postContent.trim()) {
      toast.error('Please fill in the post content')
      return
    }

    if (!isMember) {
      toast.error('You must be a member to post in this SubBlock')
      return
    }

    try {
      setIsCreatingPost(true)
      console.log(`📝 Creating post in SubBlock: ${subblock?.name}`)
      
      // Add SubBlock context to the post content
      // This way we can identify which posts belong to which SubBlock
      const subblockTaggedContent = `[${subblock?.name}] ${postContent}`
      
      // Alternative: Add a hidden SubBlock identifier
      const subblockIdentifiedContent = `${postContent} #SubBlock-${subblock?.id}`
      
      console.log(`📝 Post content with SubBlock context: ${subblockIdentifiedContent}`)
      
      // Create the post with SubBlock context
      await createPost(subblockIdentifiedContent, postImages)
      
      // Reset form
      setPostContent('')
      setPostImages([])
      setShowCreatePost(false)
      
      // Reload posts
      await loadSubblockPosts()
      
      toast.success(`Post created in ${subblock?.name}!`)
    } catch (error) {
      console.error('Failed to create post:', error)
      toast.error('Failed to create post')
    } finally {
      setIsCreatingPost(false)
    }
  }

  const handleLikePost = async (post: Post) => {
    if (!publicKey) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      const isLiked = hasUserLikedPost(post.id)
      
      if (isLiked) {
        await unlikePost(post.id, post.author)
      } else {
        await likePost(post.id, post.author)
      }
      
      // Reload posts to show updated like count
      await loadSubblockPosts()
    } catch (error) {
      console.error('Failed to like/unlike post:', error)
    }
  }

  const isCreator = subblock && publicKey && subblock.creator.equals(publicKey)
  const isElite = subblock?.rules.some(rule => rule.toLowerCase().includes('ucr'))
  
  // For now, consider creator as member. In full implementation, you'd check actual membership
  const isMember = isCreator || (userProfile && userProfile.userCreditRating >= 2.5)

  // Helper function to clean post content for display (remove SubBlock tags)
  const cleanPostContent = (content: string) => {
    // Remove SubBlock ID tags like "#SubBlock-123"
    let cleanContent = content.replace(/#SubBlock-\d+/g, '').trim()
    
    // Remove SubBlock name tags like "[SubBlock Name]" from the beginning
    cleanContent = cleanContent.replace(/^\[.*?\]\s*/, '').trim()
    
    return cleanContent
  }

  const formatMemberCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const days = Math.floor(diff / 86400000)
    const months = Math.floor(days / 30)
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor(diff / (1000 * 60))

    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    return 'Just now'
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-4 mb-6">
              <div className="h-20 w-20 bg-gray-200 rounded-full"></div>
              <div className="space-y-2">
                <div className="h-6 bg-gray-200 rounded w-48"></div>
                <div className="h-4 bg-gray-200 rounded w-32"></div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!subblock) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">SubBlock Not Found</h2>
          <p className="text-gray-600 mb-4">The SubBlock you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/?page=subblocks')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to SubBlocks
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => router.push('/?page=subblocks')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to SubBlocks</span>
        </button>
      </div>

      {/* SubBlock Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
        {/* Elite Badge */}
        {isElite && (
          <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-sm font-medium px-4 py-2 text-center">
            ⭐ ELITE SUBBLOCK
          </div>
        )}
        
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center space-x-4">
              <img
                src={subblock.avatar || `https://picsum.photos/80/80?random=${subblock.id}`}
                alt={subblock.name}
                className="h-20 w-20 rounded-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('picsum.photos')) {
                    target.src = `https://picsum.photos/80/80?random=${subblock.id}`;
                  }
                }}
              />
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">{subblock.name}</h1>
                  <Globe className="h-5 w-5 text-gray-400" />
                  {isCreator && (
                    <div title="You are the creator">
                      <Crown className="h-5 w-5 text-yellow-500" />
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Users className="h-4 w-4" />
                    <span>{formatMemberCount(subblock.memberCount)} members</span>
                  </div>
                  <span>Created {formatTimeAgo(subblock.createdAt)}</span>
                </div>
              </div>
            </div>
            
            {isCreator && (
              <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Settings className="h-4 w-4" />
                <span>Manage</span>
              </button>
            )}
          </div>

          <p className="text-gray-700 mb-6">{subblock.description}</p>

          {/* Rules */}
          {subblock.rules && subblock.rules.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">SubBlock Rules</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <ul className="space-y-2">
                  {subblock.rules.map((rule, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-blue-600 font-medium">{index + 1}.</span>
                      <span className="text-gray-700">{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            {!isCreator && (
              <button className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Users className="h-5 w-5" />
                <span>Join SubBlock</span>
              </button>
            )}
            
            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>

      {/* Create Post Section */}
      {isMember && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          {!showCreatePost ? (
            <button
              onClick={() => setShowCreatePost(true)}
              className="w-full flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <img
                src={userProfile?.profileImage || `https://picsum.photos/40/40?random=${publicKey?.toString()}`}
                alt="Your avatar"
                className="h-10 w-10 rounded-full object-cover"
              />
              <span className="text-gray-500 flex-1 text-left">Share something with the SubBlock...</span>
              <Plus className="h-5 w-5 text-gray-400" />
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <img
                  src={userProfile?.profileImage || `https://picsum.photos/40/40?random=${publicKey?.toString()}`}
                  alt="Your avatar"
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div className="flex-1">
                  <textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="What's happening in this SubBlock?"
                    className="w-full p-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Image className="h-4 w-4" />
                    <span className="text-sm">Photo</span>
                  </button>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setShowCreatePost(false)
                      setPostContent('')
                      setPostImages([])
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreatePost}
                    disabled={!postContent.trim() || isCreatingPost}
                    className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingPost ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Posting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Post</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Posts Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">SubBlock Posts</h3>
          <p className="text-sm text-gray-600">Posts from SubBlock members</p>
        </div>
        
        {postsLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex space-x-3">
                  <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center">
            <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
            <p className="text-gray-600">
              {isMember 
                ? "Be the first to share something in this SubBlock!"
                : "Join this SubBlock to see and create posts."
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {posts.map((post) => (
              <div key={post.id} className="p-6">
                <div className="flex items-start space-x-3">
                  <img
                    src={`https://picsum.photos/40/40?random=${post.author.toString()}`}
                    alt="Author avatar"
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium text-gray-900">
                        {post.author.equals(subblock.creator) ? 'Creator' : 'Member'}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-sm text-gray-500">{formatTimeAgo(post.timestamp)}</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {subblock.name}
                      </span>
                    </div>
                    
                    <p className="text-gray-900 mb-3">{cleanPostContent(post.content)}</p>
                    
                    {post.images && post.images.length > 0 && (
                      <div className="mb-3">
                        <img
                          src={post.images[0]}
                          alt="Post image"
                          className="rounded-lg max-w-full h-auto"
                        />
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-6">
                      <button
                        onClick={() => handleLikePost(post)}
                        className={`flex items-center space-x-2 text-sm ${
                          hasUserLikedPost(post.id) 
                            ? 'text-red-600' 
                            : 'text-gray-500 hover:text-red-600'
                        }`}
                      >
                        <Heart className={`h-4 w-4 ${hasUserLikedPost(post.id) ? 'fill-current' : ''}`} />
                        <span>{post.likes}</span>
                      </button>
                      
                      <button className="flex items-center space-x-2 text-sm text-gray-500 hover:text-blue-600">
                        <MessageCircle className="h-4 w-4" />
                        <span>{post.comments}</span>
                      </button>
                      
                      <button className="text-sm text-gray-500 hover:text-gray-700">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 