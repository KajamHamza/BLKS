'use client'

import { useState, useEffect } from 'react'
import { Calendar, MapPin, Link as LinkIcon, Users, FileText, Heart, MessageCircle, Share, MoreHorizontal } from 'lucide-react'
import { useBlocksProgram, Profile, Post, PostRating } from '@/hooks/useBlocksProgram'
import { PublicKey } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'

interface ProfilePageProps {
  profileAddress: string
  isOwnProfile?: boolean
}

export default function ProfilePage({ profileAddress, isOwnProfile = false }: ProfilePageProps) {
  const { getProfile, getPosts, followProfile, unfollowProfile } = useBlocksProgram()
  const { publicKey } = useWallet()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [profileAddress])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const profilePubkey = new PublicKey(profileAddress)
      
      // Load profile
      const profileData = await getProfile(profilePubkey)
      setProfile(profileData)
      
      // Load user's posts
      const allPosts = await getPosts()
      const userPosts = allPosts.filter(post => post.author.equals(profilePubkey))
      setPosts(userPosts)
      
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFollow = async () => {
    if (!publicKey || !profile) return
    
    try {
      if (following) {
        await unfollowProfile(profile.owner)
        setFollowing(false)
      } else {
        await followProfile(profile.owner)
        setFollowing(true)
      }
      // Refresh profile to get updated follower count
      await loadProfile()
    } catch (error) {
      console.error('Follow/unfollow error:', error)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-48 bg-gray-200 rounded-lg mb-6"></div>
          <div className="flex items-center space-x-4 mb-6">
            <div className="h-24 w-24 bg-gray-200 rounded-full"></div>
            <div className="space-y-2">
              <div className="h-6 bg-gray-200 rounded w-48"></div>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h2>
          <p className="text-gray-600">This profile doesn't exist or hasn't been created yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Cover Image */}
      <div className="h-48 bg-gradient-to-r from-blue-500 to-purple-600 relative rounded-t-lg overflow-hidden">
        {profile.coverImage && (
          <img 
            src={profile.coverImage} 
            alt="Cover" 
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Profile Header */}
      <div className="bg-white px-6 py-6 rounded-b-lg shadow-sm border border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 -mt-20">
            <img
              src={profile.profileImage || `https://picsum.photos/96/96?random=${profile.owner.toString()}`}
              alt={profile.username}
              className="h-32 w-32 rounded-full border-4 border-white bg-white shadow-lg relative z-10"
            />
            <div className="mt-16 pt-4">
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-gray-900">{profile.username}</h1>
                {profile.isVerified && (
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                    ✓ Verified
                  </span>
                )}
              </div>
              <p className="text-gray-600 mt-1">@{profile.username}</p>
              <div className="flex items-center space-x-2 mt-2">
                <span className="text-sm text-gray-500">UCR:</span>
                <span className={`text-sm font-medium px-2 py-1 rounded ${
                  profile.userCreditRating >= 4.0 ? 'bg-green-100 text-green-800' :
                  profile.userCreditRating >= 3.0 ? 'bg-blue-100 text-blue-800' :
                  profile.userCreditRating >= 2.5 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {profile.userCreditRating.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {!isOwnProfile && publicKey && (
            <div className="mt-4">
              <button
                onClick={handleFollow}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  following 
                    ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {following ? 'Following' : 'Follow'}
              </button>
            </div>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-gray-900 mt-4 max-w-2xl">{profile.bio}</p>
        )}

        {/* Profile Stats */}
        <div className="flex items-center space-x-6 mt-4 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>Joined {formatDate(profile.createdAt)}</span>
          </div>
          <div className="flex items-center space-x-4">
            <span><strong>{profile.followingCount}</strong> Following</span>
            <span><strong>{profile.followersCount}</strong> Followers</span>
          </div>
          <div className="flex items-center space-x-1">
            <span><strong>{profile.postsCount}</strong> Posts</span>
          </div>
        </div>
      </div>

      {/* Profile Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <nav className="flex space-x-8">
            <button className="py-4 border-b-2 border-blue-600 text-blue-600 font-medium">
              Posts ({profile.postsCount})
            </button>
            <button className="py-4 text-gray-500 hover:text-gray-700">
              Media
            </button>
            <button className="py-4 text-gray-500 hover:text-gray-700">
              Likes
            </button>
          </nav>
        </div>
      </div>

      {/* Posts */}
      <div className="bg-gray-50 min-h-screen">
        <div className="p-6 space-y-6">
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
              <p className="text-gray-600">
                {isOwnProfile ? "You haven't posted anything yet." : `${profile.username} hasn't posted anything yet.`}
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Post Header */}
                <div className="p-6 pb-0">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <img
                        src={profile.profileImage || `https://picsum.photos/40/40?random=${post.id}`}
                        alt="Author"
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-gray-900">{profile.username}</h3>
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
                  <div className="flex items-center space-x-6">
                    <button className="flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors">
                      <Heart className="h-5 w-5" />
                      <span className="text-sm font-medium">{post.likes}</span>
                    </button>
                    <button className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors">
                      <MessageCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">{post.comments}</span>
                    </button>
                    <button className="flex items-center space-x-2 text-gray-500 hover:text-green-500 transition-colors">
                      <Share className="h-5 w-5" />
                      <span className="text-sm font-medium">{post.mirrors}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
} 