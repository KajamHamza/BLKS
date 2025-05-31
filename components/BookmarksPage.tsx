'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Heart, MessageCircle, Share, Bookmark, MoreHorizontal, Wallet } from 'lucide-react'
import { useBlocksProgram, Post, PostRating, Profile } from '@/hooks/useBlocksProgram'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import ClientOnly from './ClientOnly'
import { toast } from 'react-hot-toast'
import { PublicKey } from '@solana/web3.js'
import { convertToFastestGateway } from '@/utils/ipfs'

interface PostWithProfile extends Post {
  authorProfile?: Profile | null
}

interface BookmarksPageProps {
  onProfileClick?: (profileAddress: string) => void
}

export default function BookmarksPage({ onProfileClick }: BookmarksPageProps) {
  const { connected, publicKey } = useWallet()
  const { 
    getPosts, 
    getProfile, 
    getUserBookmarks, 
    isPostBookmarked,
    bookmarkPost,
    likePost
  } = useBlocksProgram()
  
  const [bookmarkedPosts, setBookmarkedPosts] = useState<PostWithProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (connected && publicKey) {
      loadBookmarkedPosts()
    } else {
      setBookmarkedPosts([])
      setLoading(false)
    }
  }, [connected, publicKey])

  const loadBookmarkedPosts = async () => {
    try {
      setLoading(true)
      
      // Get user's bookmarked post IDs
      const bookmarkIds = getUserBookmarks()
      
      if (bookmarkIds.length === 0) {
        setBookmarkedPosts([])
        return
      }

      // Get all posts
      const allPosts = await getPosts()
      
      // Filter to only bookmarked posts
      const bookmarked = allPosts.filter(post => bookmarkIds.includes(post.id))
      
      // Load author profiles
      const postsWithProfiles: PostWithProfile[] = []
      for (const post of bookmarked) {
        try {
          const profile = await getProfile(post.author)
          postsWithProfiles.push({ ...post, authorProfile: profile })
        } catch (error) {
          postsWithProfiles.push({ ...post, authorProfile: null })
        }
      }
      
      setBookmarkedPosts(postsWithProfiles)
    } catch (error) {
      console.error('Failed to load bookmarked posts:', error)
      toast.error('Failed to load bookmarks')
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
      await likePost(postId, postAuthor)
      await loadBookmarkedPosts() // Refresh to show updated like count
      toast.success('Post liked! 👍')
    } catch (error) {
      console.error('Failed to like post:', error)
      toast.error('Failed to like post')
    }
  }

  const handleBookmark = async (postId: number) => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      await bookmarkPost(postId)
      await loadBookmarkedPosts() // Refresh bookmarks
    } catch (error) {
      console.error('Failed to update bookmark:', error)
      toast.error('Failed to update bookmark')
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

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="h-16 w-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Wallet className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-6">
            You need to connect your wallet to view your bookmarks
          </p>
          <ClientOnly fallback={<div className="h-9 w-32 bg-gray-200 animate-pulse rounded mx-auto"></div>}>
            <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700" />
          </ClientOnly>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Your Bookmarks</h1>
          <p className="text-gray-600">Posts you've saved for later</p>
        </div>
        
        <div className="space-y-6">
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
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Your Bookmarks</h1>
        <p className="text-gray-600">
          {bookmarkedPosts.length} saved post{bookmarkedPosts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {bookmarkedPosts.length === 0 ? (
        <div className="text-center py-12">
          <div className="h-16 w-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Bookmark className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bookmarks yet</h3>
          <p className="text-gray-600">
            Start bookmarking posts you want to read later by clicking the bookmark icon
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {bookmarkedPosts.map((post) => (
            <div 
              key={post.id} 
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Post Header */}
              <div className="p-6 pb-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src={post.authorProfile?.profileImage ? convertToFastestGateway(post.authorProfile.profileImage) : `https://picsum.photos/40/40?random=${post.id}`}
                      alt="Author"
                      className="h-10 w-10 rounded-full object-cover"
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
                      className="flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors"
                      title="Like this post"
                    >
                      <Heart className="h-5 w-5" />
                      <span className="text-sm font-medium">{post.likes}</span>
                    </button>
                    <button 
                      disabled={!connected}
                      className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors"
                      title="View comments"
                    >
                      <MessageCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">{post.comments}</span>
                    </button>
                    <button 
                      disabled={!connected}
                      className="flex items-center space-x-2 text-gray-500 hover:text-green-500 transition-colors"
                      title="Share this post"
                    >
                      <Share className="h-5 w-5" />
                      <span className="text-sm font-medium">{post.mirrors}</span>
                    </button>
                  </div>
                  <button 
                    onClick={() => handleBookmark(post.id)}
                    className="text-blue-500 hover:text-blue-600 transition-colors"
                    title="Remove bookmark"
                  >
                    <Bookmark className="h-5 w-5 fill-current" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 