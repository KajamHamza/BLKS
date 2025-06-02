'use client'

import { useState, useEffect } from 'react'
import { Heart, MessageCircle, Share, Bookmark, MoreHorizontal, Wallet, DollarSign, RefreshCw } from 'lucide-react'
import { useBlocksProgram, Post, PostRating, Profile, Comment } from '@/hooks/useBlocksProgram'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import ClientOnly from './ClientOnly'
import { toast } from 'react-hot-toast'
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { convertToFastestGateway } from '@/utils/ipfs'

interface FeedProps {
  connected: boolean
  userProfile: Profile | null
  onProfileClick?: (profileAddress: string) => void
}

interface PostWithProfile extends Post {
  authorProfile?: Profile | null
}

export default function Feed({ connected, userProfile, onProfileClick }: FeedProps) {
  const { 
    getPosts, 
    likePost, 
    unlikePost,
    getProfile, 
    commentOnPost, 
    bookmarkPost, 
    getUserBookmarks, 
    isPostBookmarked,
    refreshData,
    getCommentsForPost,
    hasUserLikedPost
  } = useBlocksProgram()
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const [posts, setPosts] = useState<PostWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showTipModal, setShowTipModal] = useState<string | null>(null)
  const [tipAmount, setTipAmount] = useState('')
  const [sendingTip, setSendingTip] = useState(false)
  const [showCommentModal, setShowCommentModal] = useState<number | null>(null)
  const [commentContent, setCommentContent] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [commentTargetPost, setCommentTargetPost] = useState<PostWithProfile | null>(null)
  const [bookmarkedPosts, setBookmarkedPosts] = useState<number[]>([])
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set())
  const [postComments, setPostComments] = useState<Map<number, Comment[]>>(new Map())
  const [loadingComments, setLoadingComments] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchPosts()
    if (connected && publicKey) {
      // Load user's bookmarks
      const userBookmarks = getUserBookmarks()
      setBookmarkedPosts(userBookmarks)
      console.log('📚 Loaded user bookmarks:', userBookmarks)
    } else {
      setBookmarkedPosts([])
    }
  }, [connected, publicKey])

  // Auto-refresh when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 Window focused, refreshing data...')
      refreshData()
      fetchPosts()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refreshData])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      console.log('🔍 Fetching posts and author profiles...')
      
      const fetchedPosts = await getPosts()
      console.log(`📊 Fetched ${fetchedPosts.length} posts, now loading author profiles...`)
      
      // Fetch profiles for each post author with rate limiting protection
      const postsWithProfiles: PostWithProfile[] = []
      
      for (let i = 0; i < fetchedPosts.length; i++) {
        const post = fetchedPosts[i]
        try {
          console.log(`👤 Loading profile ${i + 1}/${fetchedPosts.length} for ${post.author.toString().slice(0, 8)}...`)
          
          // Add delay between requests to prevent rate limiting
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 200)) // 200ms delay
          }
          
          const profile = await getProfile(post.author)
          
          if (profile) {
            console.log(`✅ Loaded profile for ${post.author.toString().slice(0, 8)}: "${profile.username}"`)
          } else {
            console.log(`❌ No profile found for ${post.author.toString().slice(0, 8)}`)
          }
          
          postsWithProfiles.push({ ...post, authorProfile: profile })
        } catch (error) {
          console.warn(`⚠️ Failed to load profile for ${post.author.toString().slice(0, 8)}:`, error)
          postsWithProfiles.push({ ...post, authorProfile: null })
          
          // If we hit rate limiting, add a longer delay
          if (error instanceof Error && error.message.includes('429')) {
            console.log('⏳ Rate limited, waiting 2 seconds...')
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      }
      
      setPosts(postsWithProfiles)
      
      const profilesLoaded = postsWithProfiles.filter(p => p.authorProfile).length
      console.log(`✅ Loaded ${profilesLoaded}/${fetchedPosts.length} author profiles successfully`)
    } catch (error) {
      console.error('Failed to fetch posts:', error)
      toast.error('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }

  const handleLike = async (postId: number, postAuthor: PublicKey) => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet')
      return
    }

    if (postAuthor.equals(publicKey)) {
      toast.error("You can't like your own posts! 😅")
      return
    }
    
    try {
      const userHasLiked = hasUserLikedPost(postId)
      
      if (userHasLiked) {
        // User has already liked, so unlike
        await unlikePost(postId, postAuthor)
        toast.success('Post unliked! 👎')
      } else {
        // User hasn't liked, so like
        await likePost(postId, postAuthor)
        toast.success('Post liked! 👍')
      }
      
      // Refresh posts to show updated like count immediately
      await fetchPosts()
    } catch (error) {
      console.error('Failed to toggle like:', error)
      toast.error('Failed to update like')
    }
  }

  const handleComment = async (postId: number, postAuthor: PublicKey) => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet')
      return
    }

    if (!commentContent.trim()) {
      toast.error('Please enter a comment')
      return
    }

    // Double-check we have the correct target post
    if (!commentTargetPost || commentTargetPost.id !== postId || !commentTargetPost.author.equals(postAuthor)) {
      console.error('❌ Comment target mismatch!')
      console.error('Expected:', { postId, postAuthor: postAuthor.toString() })
      console.error('Target post:', commentTargetPost)
      toast.error('Comment target error. Please close and reopen the comment modal.')
      return
    }

    try {
      console.log(`💬 Commenting on post ${postId} by ${postAuthor.toString().slice(0, 8)}`)
      console.log(`📝 Target post content: "${commentTargetPost.content.substring(0, 50)}..."`)
      console.log(`👤 Target post author: ${commentTargetPost.authorProfile?.username || 'Unknown'}`)
      console.log(`💭 Comment content: "${commentContent.trim()}"`)
      
      setSubmittingComment(true)
      
      await commentOnPost(postId, commentContent.trim(), postAuthor)
      
      // Clear the comment form
      setCommentContent('')
      setShowCommentModal(null)
      setCommentTargetPost(null)
      
      // Refresh comments for this specific post only
      console.log(`🔄 Refreshing comments for post ${postId}`)
      await loadCommentsForPost(postId)
      
      // Refresh posts to show updated comment count immediately
      await fetchPosts()
      
      console.log(`✅ Comment posted successfully on post ${postId}`)
    } catch (error) {
      console.error('Failed to comment on post:', error)
      toast.error('Failed to comment on post')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleBookmark = async (postId: number) => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      console.log(`🔖 Toggling bookmark for post ${postId}`)
      console.log(`📚 Current bookmarks before toggle:`, bookmarkedPosts)
      
      // Toggle bookmark
      await bookmarkPost(postId)
      
      // Get updated bookmarks from localStorage
      const updatedBookmarks = getUserBookmarks()
      setBookmarkedPosts(updatedBookmarks)
      
      console.log(`📚 Updated bookmarks after toggle:`, updatedBookmarks)
      
      // Show appropriate message
      if (updatedBookmarks.includes(postId)) {
        toast.success('Post bookmarked!')
      } else {
        toast.success('Bookmark removed!')
      }
    } catch (error) {
      console.error('Failed to bookmark post:', error)
      toast.error('Failed to bookmark post')
    }
  }

  const handleTip = async (recipientAddress: PublicKey) => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet')
      return
    }

    if (recipientAddress.equals(publicKey)) {
      toast.error("You can't tip yourself! 😅")
      return
    }

    const amount = parseFloat(tipAmount)
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid tip amount')
      return
    }

    if (amount > 10) {
      toast.error('Maximum tip amount is 10 SOL')
      return
    }

    try {
      setSendingTip(true)
      
      // Check SOL balance
      const balance = await connection.getBalance(publicKey)
      const balanceSOL = balance / LAMPORTS_PER_SOL
      
      if (balanceSOL < amount + 0.001) { // Include fee
        toast.error(`Insufficient balance. You have ${balanceSOL.toFixed(4)} SOL`)
        return
      }

      // Create transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientAddress,
          lamports: amount * LAMPORTS_PER_SOL,
        })
      )

      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      const signature = await sendTransaction(transaction, connection)
      
      await connection.confirmTransaction(signature, 'processed')
      
      toast.success(`🎉 Tip of ${amount} SOL sent successfully!`)
      setShowTipModal(null)
      setTipAmount('')
    } catch (error) {
      console.error('Tip sending error:', error)
      toast.error('Failed to send tip')
    } finally {
      setSendingTip(false)
    }
  }

  const loadCommentsForPost = async (postId: number) => {
    try {
      console.log(`📝 Loading comments for post ${postId}...`)
      
      // Add to loading state
      setLoadingComments(prev => new Set(prev.add(postId)))
      
      const comments = await getCommentsForPost(postId)
      
      // Load profiles for comment authors
      const commentsWithProfiles: Comment[] = []
      for (const comment of comments) {
        // Comments already include authorProfile from the hook
        commentsWithProfiles.push(comment)
      }
      
      setPostComments(prev => new Map(prev.set(postId, commentsWithProfiles)))
      console.log(`✅ Loaded ${commentsWithProfiles.length} comments for post ${postId}`)
    } catch (error) {
      console.error('Failed to load comments:', error)
    } finally {
      // Remove from loading state
      setLoadingComments(prev => {
        const newSet = new Set(prev)
        newSet.delete(postId)
        return newSet
      })
    }
  }

  const toggleComments = async (postId: number) => {
    console.log(`🔄 Toggling comments for post ${postId}`)
    console.log(`📊 Current expanded comments:`, Array.from(expandedComments))
    
    const isExpanded = expandedComments.has(postId)
    
    if (isExpanded) {
      // Collapse comments for this specific post
      console.log(`📤 Collapsing comments for post ${postId}`)
      setExpandedComments(new Set())
    } else {
      // Expand comments for this specific post only (close all others)
      console.log(`📥 Expanding comments for post ${postId} (closing all others)`)
      setExpandedComments(new Set([postId]))
      
      // Load comments if not already loaded
      if (!postComments.has(postId)) {
        console.log(`📋 Loading comments for post ${postId} for the first time`)
        await loadCommentsForPost(postId)
      } else {
        console.log(`📋 Comments already loaded for post ${postId}`)
      }
    }
  }

  const handleManualRefresh = async () => {
    try {
      console.log('🔄 Manual refresh triggered...')
      refreshData()
      await fetchPosts()
      toast.success('Feed refreshed!')
    } catch (error) {
      console.error('Failed to refresh feed:', error)
      toast.error('Failed to refresh feed')
    }
  }

  const getRatingBadge = (rating: PostRating) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full'
    
    const ratingInfo = {
      [PostRating.None]: { name: 'None', class: 'bg-gray-100 text-gray-800' },
      [PostRating.Bronze]: { name: 'Bronze', class: 'bg-amber-100 text-amber-800' },
      [PostRating.Silver]: { name: 'Silver', class: 'bg-gray-100 text-gray-800' },
      [PostRating.Gold]: { name: 'Gold', class: 'bg-yellow-100 text-yellow-800' },
      [PostRating.Platinum]: { name: 'Platinum', class: 'bg-slate-100 text-slate-800' },
      [PostRating.Diamond]: { name: 'Diamond', class: 'bg-blue-100 text-blue-800' },
      [PostRating.Ace]: { name: 'Ace', class: 'bg-purple-100 text-purple-800' },
      [PostRating.Conqueror]: { name: 'Conqueror', class: 'bg-red-100 text-red-800' },
    }

    const info = ratingInfo[rating] || ratingInfo[PostRating.None]

    return (
      <span className={`${baseClasses} ${info.class}`}>
        {info.name}
      </span>
    )
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

  const ConnectWalletPrompt = () => (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Wallet className="h-6 w-6 text-blue-600" />
          <div>
            <h3 className="text-sm font-medium text-blue-900">Connect your wallet to interact</h3>
            <p className="text-xs text-blue-700">Like, comment, and create posts on the blockchain</p>
          </div>
        </div>
        <ClientOnly fallback={<div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>}>
          <WalletMultiButton className="!bg-blue-600 !py-2 !px-4 !text-sm hover:!bg-blue-700" />
        </ClientOnly>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {!connected && <ConnectWalletPrompt />}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="animate-pulse">
              <div className="flex items-center space-x-3 mb-4">
                <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!connected && <ConnectWalletPrompt />}
      
      {/* Feed Header with Refresh Button */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">Latest Posts</h2>
        <button
          onClick={handleManualRefresh}
          disabled={loading}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
            loading 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          }`}
          title="Refresh feed"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium">
            {loading ? 'Loading...' : 'Refresh'}
          </span>
        </button>
      </div>
      
      {posts.map((post) => (
        <div 
          key={post.id} 
          className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${
            post.inKillZone ? 'kill-zone' : ''
          }`}
        >
          {/* Post Header */}
          <div className="p-6 pb-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src={post.authorProfile?.profileImage ? convertToFastestGateway(post.authorProfile.profileImage) : `https://picsum.photos/40/40?random=${post.id}`}
                  alt="Author"
                  className="h-10 w-10 rounded-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    const originalSrc = target.src
                    console.log(`❌ Failed to load profile image for ${post.authorProfile?.username || 'unknown'}:`)
                    console.log(`   Original URL: ${originalSrc}`)
                    console.log(`   Profile Image URL from blockchain: ${post.authorProfile?.profileImage}`)
                    console.log(`   Error details:`, e)
                    console.log(`   Image naturalWidth: ${target.naturalWidth}, naturalHeight: ${target.naturalHeight}`)
                    console.log(`   Image complete: ${target.complete}`)
                    
                    // If it's a PINATA URL that failed, try alternative gateways
                    if (originalSrc.includes('gateway.pinata.cloud') && post.authorProfile?.profileImage) {
                      const ipfsHash = post.authorProfile.profileImage.split('/').pop()
                      if (ipfsHash) {
                        console.log(`🔄 Trying alternative IPFS gateway for hash: ${ipfsHash}`)
                        target.src = `https://ipfs.io/ipfs/${ipfsHash}`
                        return
                      }
                    }
                    
                    // If ipfs.io failed, try cloudflare
                    if (originalSrc.includes('ipfs.io/ipfs/') && post.authorProfile?.profileImage) {
                      const ipfsHash = post.authorProfile.profileImage.split('/').pop()
                      if (ipfsHash) {
                        console.log(`🔄 Trying Cloudflare IPFS gateway for hash: ${ipfsHash}`)
                        target.src = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`
                        return
                      }
                    }
                    
                    // If cloudflare failed, try dweb.link
                    if (originalSrc.includes('cloudflare-ipfs.com/ipfs/') && post.authorProfile?.profileImage) {
                      const ipfsHash = post.authorProfile.profileImage.split('/').pop()
                      if (ipfsHash) {
                        console.log(`🔄 Trying dweb.link IPFS gateway for hash: ${ipfsHash}`)
                        target.src = `https://dweb.link/ipfs/${ipfsHash}`
                        return
                      }
                    }
                    
                    // Final fallback
                    target.src = `https://picsum.photos/40/40?random=${post.id}`
                  }}
                  onLoad={() => {
                    if (post.authorProfile?.profileImage) {
                      console.log(`✅ Successfully loaded profile image for ${post.authorProfile.username}:`)
                      console.log(`   URL: ${post.authorProfile.profileImage}`)
                    }
                  }}
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onProfileClick?.(post.author.toString())}
                      className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {post.authorProfile?.username || `User_${post.author.toString().slice(0, 8)}`}
                    </button>
                    {post.authorProfile && (
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        post.authorProfile.userCreditRating >= 4.0 ? 'bg-green-100 text-green-800' :
                        post.authorProfile.userCreditRating >= 3.0 ? 'bg-blue-100 text-blue-800' :
                        post.authorProfile.userCreditRating >= 2.5 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        UCR {post.authorProfile.userCreditRating.toFixed(1)}
                      </span>
                    )}
                    {getRatingBadge(post.rating)}
                  </div>
                  <p className="text-sm text-gray-500">{formatTimeAgo(post.timestamp)}</p>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Post Content */}
          <div className="px-6 py-4">
            <p className="text-gray-900 whitespace-pre-wrap">{post.content}</p>
          </div>

          {/* Post Images */}
          {post.images.length > 0 && (
            <div className="px-6">
              <div className="grid grid-cols-1 gap-2">
                {post.images.map((image, index) => (
                  <img
                    key={index}
                    src={image}
                    alt={`Post image ${index + 1}`}
                    className="w-full h-64 object-cover rounded-lg"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Post Actions */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <button
                  onClick={() => handleLike(post.id, post.author)}
                  disabled={!connected}
                  className={`flex items-center space-x-2 transition-colors ${
                    connected 
                      ? hasUserLikedPost(post.id)
                        ? 'text-red-500 hover:text-red-600' 
                        : 'text-gray-500 hover:text-red-500'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                  title={!connected ? 'Connect wallet to like' : 
                         hasUserLikedPost(post.id) ? 'Unlike this post' : 'Like this post'}
                >
                  <Heart className={`h-5 w-5 ${hasUserLikedPost(post.id) ? 'fill-current' : ''}`} />
                  <span className="text-sm font-medium">{post.likes}</span>
                </button>
                <button 
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log(`🎯 Toggling comments for post ${post.id}`)
                    toggleComments(post.id)
                  }}
                  disabled={!connected}
                  className={`flex items-center space-x-2 transition-colors ${
                    connected 
                      ? expandedComments.has(post.id)
                        ? 'text-blue-500'
                        : 'text-gray-500 hover:text-blue-500'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                  title={!connected ? 'Connect wallet to view comments' : 
                         expandedComments.has(post.id) ? 'Hide comments' : 'Show comments'}
                >
                  <MessageCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">{post.comments}</span>
                </button>
                <button 
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log(`🎯 Opening comment modal for post ${post.id} by ${post.authorProfile?.username || 'Unknown'}`)
                    console.log(`📝 Post content: "${post.content.substring(0, 50)}..."`)
                    setShowCommentModal(post.id)
                    setCommentTargetPost(post)
                  }}
                  disabled={!connected}
                  className={`flex items-center space-x-2 transition-colors ${
                    connected 
                      ? 'text-gray-500 hover:text-green-500' 
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                  title={!connected ? 'Connect wallet to reply' : 'Reply to this post'}
                >
                  <span className="text-sm font-medium">Reply</span>
                </button>
                <button 
                  disabled={!connected}
                  className={`flex items-center space-x-2 transition-colors ${
                    connected 
                      ? 'text-gray-500 hover:text-blue-500' 
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                  title={!connected ? 'Connect wallet to share' : 'Share this post'}
                >
                  <Share className="h-5 w-5" />
                  <span className="text-sm font-medium">{post.mirrors}</span>
                </button>
                {/* Tip Button - Only show if not own post */}
                {connected && publicKey && !post.author.equals(publicKey) && (
                  <button 
                    onClick={() => setShowTipModal(post.author.toString())}
                    className="flex items-center space-x-2 text-gray-500 hover:text-yellow-500 transition-colors"
                    title="Send a tip to the author"
                  >
                    <DollarSign className="h-5 w-5" />
                    <span className="text-sm font-medium">Tip</span>
                  </button>
                )}
              </div>
              <button 
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log(`🔖 Bookmarking post ${post.id}`)
                  handleBookmark(post.id)
                }}
                disabled={!connected}
                className={`transition-colors ${
                  connected 
                    ? bookmarkedPosts.includes(post.id)
                      ? 'text-blue-500 hover:text-blue-600'
                      : 'text-gray-500 hover:text-blue-500'
                    : 'text-gray-300 cursor-not-allowed'
                }`}
                title={!connected ? 'Connect wallet to bookmark' : 
                       bookmarkedPosts.includes(post.id) ? 'Remove bookmark' : 'Bookmark this post'}
              >
                <Bookmark className={`h-5 w-5 ${bookmarkedPosts.includes(post.id) ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {/* Kill Zone Warning */}
          {post.inKillZone && (
            <div className="px-6 pb-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">
                  ⚠️ This post is in the kill zone due to low engagement
                </p>
              </div>
            </div>
          )}

          {/* Comments Section */}
          {expandedComments.has(post.id) && (
            <div className="border-t border-gray-200">
              <div className="px-6 py-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Comments ({postComments.get(post.id)?.length || 0})
                </h4>
                
                {loadingComments.has(post.id) ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading comments...</p>
                  </div>
                ) : postComments.get(post.id)?.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {postComments.get(post.id)?.map((comment) => (
                      <div key={comment.id} className="flex space-x-3">
                        <img
                          src={comment.authorProfile?.profileImage || `https://picsum.photos/32/32?random=${comment.id}`}
                          alt="Commenter"
                          className="h-8 w-8 rounded-full object-cover"
                        />
                        <div className="flex-1">
                          <div className="bg-gray-50 rounded-lg px-3 py-2">
                            <div className="flex items-center space-x-2 mb-1">
                              <button
                                onClick={() => onProfileClick?.(comment.author.toString())}
                                className="text-sm font-medium text-gray-900 hover:text-blue-600"
                              >
                                {comment.authorProfile?.username || `User_${comment.author.toString().slice(0, 8)}`}
                              </button>
                              <span className="text-xs text-gray-500">
                                {formatTimeAgo(comment.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900">{comment.content}</p>
                          </div>
                          
                          {/* Comment Actions */}
                          <div className="flex items-center space-x-4 mt-1 ml-3">
                            <button
                              onClick={() => handleLike(comment.id, comment.author)}
                              disabled={!connected}
                              className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                            >
                              ❤️ {comment.likes}
                            </button>
                            <button
                              disabled={!connected}
                              className="text-xs text-gray-500 hover:text-blue-500 transition-colors"
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Tip Modal */}
      {showTipModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="fixed inset-0" 
            onClick={() => setShowTipModal(null)}
          />
          <div className="bg-white rounded-lg max-w-md w-full relative z-10">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">💰 Send a Tip</h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Send SOL to this author as a tip for their great content!
                </p>
                <p className="text-xs text-gray-500">
                  Recipient: {showTipModal.slice(0, 8)}...{showTipModal.slice(-8)}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tip Amount (SOL)
                </label>
                <input
                  type="number"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  placeholder="0.1"
                  min="0.001"
                  max="10"
                  step="0.001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
                <div className="flex space-x-2 mt-2">
                  {[0.1, 0.5, 1.0].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setTipAmount(amount.toString())}
                      className="px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full hover:bg-yellow-200 transition-colors"
                    >
                      {amount} SOL
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowTipModal(null)
                    setTipAmount('')
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleTip(new PublicKey(showTipModal))}
                  disabled={sendingTip || !tipAmount}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    sendingTip || !tipAmount
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-yellow-500 text-white hover:bg-yellow-600'
                  }`}
                >
                  {sendingTip ? 'Sending...' : '💰 Send Tip'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {showCommentModal && commentTargetPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="fixed inset-0" 
            onClick={() => {
              setShowCommentModal(null)
              setCommentContent('')
              setCommentTargetPost(null)
            }}
          />
          <div className="bg-white rounded-lg max-w-md w-full relative z-10">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">💬 Add a Comment</h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Replying to <span className="font-medium">{commentTargetPost.authorProfile?.username || `User_${commentTargetPost.author.toString().slice(0, 8)}`}</span>
                </p>
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <p className="text-sm text-gray-700 line-clamp-3">
                    "{commentTargetPost.content.substring(0, 100)}{commentTargetPost.content.length > 100 ? '...' : ''}"
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  Post ID: {commentTargetPost.id} | Author: {commentTargetPost.author.toString().slice(0, 8)}...
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Comment
                </label>
                <textarea
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  placeholder="Write your comment here..."
                  rows={4}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {commentContent.length}/500 characters
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCommentModal(null)
                    setCommentContent('')
                    setCommentTargetPost(null)
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (commentTargetPost) {
                      handleComment(commentTargetPost.id, commentTargetPost.author)
                    }
                  }}
                  disabled={submittingComment || !commentContent.trim()}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    submittingComment || !commentContent.trim()
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {submittingComment ? 'Posting...' : '💬 Post Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 