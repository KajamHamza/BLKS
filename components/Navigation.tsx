'use client'

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import { Search, Home, Users, PlusCircle, Bell, User, Settings, ChevronDown, Bookmark } from 'lucide-react'
import { Profile } from '@/hooks/useBlocksProgram'
import ClientOnly from './ClientOnly'
import { useState } from 'react'

interface NavigationProps {
  userProfile: Profile | null
  onCreatePost: () => void
  connected: boolean
  currentPage: 'feed' | 'profile' | 'settings' | 'subblocks' | 'bookmarks'
  onNavigate: (page: 'feed' | 'profile' | 'settings' | 'subblocks' | 'bookmarks') => void
}

export default function Navigation({ userProfile, onCreatePost, connected, currentPage, onNavigate }: NavigationProps) {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)

  return (
    <nav className="fixed top-0 w-full bg-white border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <button onClick={() => onNavigate('feed')}>
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  Blocks
                </h1>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="hidden md:block flex-1 max-w-lg mx-8">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search posts, users, SubBlocks..."
              />
            </div>
          </div>

          {/* Navigation Icons & Wallet */}
          <div className="flex items-center space-x-4">
            {connected ? (
              <>
                <button 
                  onClick={() => onNavigate('feed')}
                  className={`p-2 rounded-lg transition-colors ${
                    currentPage === 'feed' 
                      ? 'text-blue-600 bg-blue-50' 
                      : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                  title="Home"
                >
                  <Home className="h-6 w-6" />
                </button>
                <button 
                  onClick={() => onNavigate('subblocks')}
                  className={`p-2 rounded-lg transition-colors ${
                    currentPage === 'subblocks' 
                      ? 'text-blue-600 bg-blue-50' 
                      : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                  title="SubBlocks"
                >
                  <Users className="h-6 w-6" />
                </button>
                <button 
                  onClick={onCreatePost}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Create Post"
                >
                  <PlusCircle className="h-6 w-6" />
                </button>
                <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Notifications">
                  <Bell className="h-6 w-6" />
                </button>
                
                {/* Profile dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className={`flex items-center space-x-2 p-2 rounded-lg transition-colors ${
                      currentPage === 'profile' || currentPage === 'settings'
                        ? 'text-blue-600 bg-blue-50' 
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {userProfile?.profileImage ? (
                      <img 
                        src={userProfile.profileImage} 
                        alt="Profile" 
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-6 w-6" />
                    )}
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {showProfileDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <button
                        onClick={() => {
                          onNavigate('profile')
                          setShowProfileDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-3"
                      >
                        <User className="h-4 w-4" />
                        <span>My Profile</span>
                      </button>
                      <button
                        onClick={() => {
                          onNavigate('bookmarks')
                          setShowProfileDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-3"
                      >
                        <Bookmark className="h-4 w-4" />
                        <span>Bookmarks</span>
                      </button>
                      <button
                        onClick={() => {
                          onNavigate('settings')
                          setShowProfileDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-3"
                      >
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                      </button>
                      <div className="border-t border-gray-100 my-1"></div>
                      <div className="px-4 py-2 text-xs text-gray-500">
                        UCR: {userProfile?.userCreditRating.toFixed(1) || '0.0'}
                      </div>
                    </div>
                  )}
                </div>
                
                <ClientOnly fallback={<div className="h-9 w-32 bg-gray-200 animate-pulse rounded"></div>}>
                  <WalletMultiButton className="!bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700" />
                </ClientOnly>
              </>
            ) : (
              <>
                <button 
                  onClick={onCreatePost}
                  className="hidden sm:flex items-center px-4 py-2 text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <PlusCircle className="h-5 w-5 mr-2" />
                  Post
                </button>
                <ClientOnly fallback={<div className="h-9 w-32 bg-gray-200 animate-pulse rounded"></div>}>
                  <WalletMultiButton className="!bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700" />
                </ClientOnly>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search bar */}
      <div className="md:hidden px-4 pb-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Search..."
          />
        </div>
      </div>

      {/* Click outside to close dropdown */}
      {showProfileDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowProfileDropdown(false)}
        />
      )}
    </nav>
  )
} 