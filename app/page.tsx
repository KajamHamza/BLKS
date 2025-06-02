'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useSearchParams } from 'next/navigation'
import Navigation from '@/components/Navigation'
import Feed from '@/components/Feed'
import Sidebar from '@/components/Sidebar'
import CreatePost from '@/components/CreatePost'
import UserProfile from '@/components/UserProfile'
import CreateProfileModal from '@/components/CreateProfileModal'
import ProfilePage from '@/components/ProfilePage'
import SettingsPage from '@/components/SettingsPage'
import SubBlocksPage from '@/components/SubBlocksPage'
import BookmarksPage from '@/components/BookmarksPage'
import IPFSStatus from '@/components/IPFSStatus'
import DebugPanel from '@/components/DebugPanel'
import { useBlocksProgram, Profile } from '@/hooks/useBlocksProgram'

export default function Home() {
  const { connected, publicKey } = useWallet()
  const { getProfile, checkProfileAtPDA } = useBlocksProgram()
  const searchParams = useSearchParams()
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [showCreateProfile, setShowCreateProfile] = useState(false)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [feedRefreshKey, setFeedRefreshKey] = useState(0)
  
  // Page navigation state
  const [currentPage, setCurrentPage] = useState<'feed' | 'profile' | 'settings' | 'subblocks' | 'bookmarks'>('feed')
  const [viewingProfileAddress, setViewingProfileAddress] = useState<string | null>(null)

  // Handle URL parameters for navigation
  useEffect(() => {
    const pageParam = searchParams.get('page')
    if (pageParam && ['feed', 'profile', 'settings', 'subblocks', 'bookmarks'].includes(pageParam)) {
      setCurrentPage(pageParam as 'feed' | 'profile' | 'settings' | 'subblocks' | 'bookmarks')
    }
  }, [searchParams])

  useEffect(() => {
    if (connected && publicKey) {
      fetchUserProfile()
      
      // Check your specific profile PDA from the creation log
      checkProfileAtPDA('FqtWjQ2Lj3UAYEU9iYE5KvwrMPo7X8GQvTmL6goA8u3L')
    } else {
      setUserProfile(null)
    }
  }, [connected, publicKey])

  const fetchUserProfile = async () => {
    if (!publicKey) return
    
    setLoading(true)
    try {
      const profile = await getProfile(publicKey)
      setUserProfile(profile)
      // If no profile exists, show create profile modal
      if (!profile) {
        setShowCreateProfile(true)
      }
    } catch (error) {
      console.log('No profile found for user')
      setUserProfile(null)
      setShowCreateProfile(true)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePost = () => {
    if (!connected) {
      // Will be handled by the CreatePost component
      setShowCreatePost(true)
      return
    }
    
    if (!userProfile) {
      setShowCreateProfile(true)
      return
    }
    
    setShowCreatePost(true)
  }

  const handleProfileCreated = async () => {
    setShowCreateProfile(false)
    
    // Wait a moment for blockchain state to propagate then refresh
    setTimeout(async () => {
      await fetchUserProfile()
    }, 2000)
  }

  // Navigation handlers
  const handleProfileClick = (profileAddress: string) => {
    setViewingProfileAddress(profileAddress)
    setCurrentPage('profile')
  }

  const handleNavigate = (page: 'feed' | 'profile' | 'settings' | 'subblocks' | 'bookmarks') => {
    setCurrentPage(page)
    if (page !== 'profile') {
      setViewingProfileAddress(null)
    } else if (page === 'profile' && publicKey) {
      // Navigate to own profile
      setViewingProfileAddress(publicKey.toString())
    }
  }

  const renderMainContent = () => {
    switch (currentPage) {
      case 'profile':
        if (!viewingProfileAddress) return null
        return (
          <ProfilePage 
            profileAddress={viewingProfileAddress}
            isOwnProfile={publicKey?.toString() === viewingProfileAddress}
          />
        )
      
      case 'settings':
        return <SettingsPage />
      
      case 'subblocks':
        return <SubBlocksPage />
      
      case 'bookmarks':
        return <BookmarksPage onProfileClick={handleProfileClick} />
      
      case 'feed':
      default:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-3">
              <Sidebar 
                userProfile={userProfile} 
                connected={connected} 
                onProfileClick={handleProfileClick}
              />
            </div>

            {/* Main Feed */}
            <div className="lg:col-span-6">
              <Feed 
                key={feedRefreshKey}
                connected={connected} 
                userProfile={userProfile} 
                onProfileClick={handleProfileClick}
              />
            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-3">
              <UserProfile 
                profile={userProfile} 
                loading={loading}
                onRefresh={fetchUserProfile}
                connected={connected}
              />
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation 
        userProfile={userProfile} 
        onCreatePost={handleCreatePost}
        connected={connected}
        currentPage={currentPage}
        onNavigate={handleNavigate}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        {renderMainContent()}
      </div>

      {/* Create Post Modal */}
      {showCreatePost && (
        <CreatePost 
          onClose={() => setShowCreatePost(false)}
          onSuccess={() => {
            setShowCreatePost(false)
            // Refresh feed and user profile after post creation
            setFeedRefreshKey(prevKey => prevKey + 1)
            fetchUserProfile() // Refresh user profile to update post count
          }}
          connected={connected}
          userProfile={userProfile}
          onNeedProfile={() => {
            setShowCreatePost(false)
            setShowCreateProfile(true)
          }}
        />
      )}

      {/* Create Profile Modal */}
      {showCreateProfile && connected && (
        <CreateProfileModal
          onClose={() => setShowCreateProfile(false)}
          onSuccess={handleProfileCreated}
        />
      )}

      {/* IPFS Status Indicator */}
      <IPFSStatus />

      {/* Debug Panel (only in development) */}
      {process.env.NODE_ENV === 'development' && <DebugPanel />}
    </div>
  )
} 