'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Edit, Shield, Calendar, Wallet } from 'lucide-react'
import { Profile, useBlocksProgram } from '@/hooks/useBlocksProgram'
import ClientOnly from './ClientOnly'

interface UserProfileProps {
  profile: Profile | null
  loading: boolean
  onRefresh: () => void
  connected: boolean
}

export default function UserProfile({ profile, loading, onRefresh, connected }: UserProfileProps) {
  const { publicKey } = useWallet()
  const { createProfile } = useBlocksProgram()
  const [showCreateProfile, setShowCreateProfile] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    profileImage: '',
    coverImage: ''
  })
  const [creating, setCreating] = useState(false)

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publicKey) return

    setCreating(true)
    try {
      await createProfile(
        formData.username,
        formData.bio,
        formData.profileImage || 'https://picsum.photos/150/150?random=user',
        formData.coverImage || 'https://picsum.photos/800/200?random=cover'
      )
      setShowCreateProfile(false)
      onRefresh()
    } catch (error) {
      console.error('Failed to create profile:', error)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
          <div className="h-16 w-16 bg-gray-200 rounded-full mx-auto -mt-8 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3 mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
        <div className="mb-4">
          <div className="h-16 w-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Wallet className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Wallet</h3>
          <p className="text-gray-600 text-sm mb-4">
            Connect your Solana wallet to create your profile and start engaging with the community
          </p>
          <ClientOnly fallback={<div className="h-9 w-full bg-gray-200 animate-pulse rounded"></div>}>
            <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700" />
          </ClientOnly>
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Why connect?</h4>
          <ul className="text-xs text-gray-600 space-y-2 text-left">
            <li className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              <span>Create posts and engage with content</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              <span>Earn BLKS tokens for quality content</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              <span>Build your reputation (UCR score)</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              <span>Join communities and follow users</span>
            </li>
          </ul>
        </div>
      </div>
    )
  }

  if (connected && !profile) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
        <div className="mb-4">
          <div className="h-16 w-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Edit className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Your Profile</h3>
          <p className="text-gray-600 text-sm mb-4">
            Set up your profile to start engaging with the Blocks community
          </p>
          <p className="text-xs text-gray-500">
            Profile creation will open automatically...
          </p>
        </div>
      </div>
    )
  }

  if (showCreateProfile) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Profile</h3>
        <form onSubmit={handleCreateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Tell us about yourself"
              rows={3}
            />
          </div>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setShowCreateProfile(false)}
              className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.username.trim() || creating}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (profile) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Cover Image */}
        <div className="h-32 bg-gradient-to-r from-blue-400 to-purple-500">
          <img
            src={profile.coverImage}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Profile Info */}
        <div className="px-6 pb-6">
          <div className="flex flex-col items-center -mt-8">
            <img
              src={profile.profileImage}
              alt="Profile"
              className="h-16 w-16 rounded-full border-4 border-white object-cover"
            />
            <div className="text-center mt-2">
              <div className="flex items-center justify-center space-x-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {profile.username}
                </h3>
                {profile.isVerified && (
                  <Shield className="h-5 w-5 text-blue-500" />
                )}
              </div>
              <p className="text-gray-600 text-sm mt-1">{profile.bio}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-200">
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">{profile.postsCount}</p>
              <p className="text-xs text-gray-500">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">{profile.followersCount}</p>
              <p className="text-xs text-gray-500">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">{profile.followingCount}</p>
              <p className="text-xs text-gray-500">Following</p>
            </div>
          </div>

          {/* Join Date */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center text-gray-500 text-sm">
              <Calendar className="h-4 w-4 mr-2" />
              Joined {new Date(profile.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
} 