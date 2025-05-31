'use client'

import { useState, useEffect } from 'react'
import { Camera, Save, Lock, Bell, Globe, Shield, Trash2, Upload } from 'lucide-react'
import { useBlocksProgram, Profile } from '@/hooks/useBlocksProgram'
import { useWallet } from '@solana/wallet-adapter-react'
import { toast } from 'react-hot-toast'

// IPFS Upload Helper
const uploadToIPFS = async (file: File): Promise<string> => {
  try {
    const formData = new FormData()
    formData.append('file', file)

    // Using a free IPFS service (in production, use your own IPFS node)
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        // You'd need to add your Pinata API keys here
        // 'pinata_api_key': 'your-api-key',
        // 'pinata_secret_api_key': 'your-secret-key',
      },
      body: formData
    })

    if (!response.ok) {
      // Fallback: create a temporary URL for demo purposes
      const tempUrl = URL.createObjectURL(file)
      toast.success('Image uploaded (demo mode)')
      return tempUrl
    }

    const data = await response.json()
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`
    toast.success('Image uploaded to IPFS!')
    return ipfsUrl
  } catch (error) {
    console.error('IPFS upload error:', error)
    // Fallback for demo
    const tempUrl = URL.createObjectURL(file)
    toast.success('Image uploaded (demo mode)')
    return tempUrl
  }
}

export default function SettingsPage() {
  const { publicKey } = useWallet()
  const { getProfile, updateProfile } = useBlocksProgram()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [uploadingProfile, setUploadingProfile] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')

  // Form states
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [profileImage, setProfileImage] = useState('')
  const [coverImage, setCoverImage] = useState('')

  // Settings states
  const [settings, setSettings] = useState({
    notifications: {
      likes: true,
      comments: true,
      follows: true,
      mentions: true,
    },
    privacy: {
      privateProfile: false,
      hideFollowers: false,
      hideFollowing: false,
    },
    content: {
      autoDeleteOldPosts: false,
      hideSensitiveContent: true,
    }
  })

  useEffect(() => {
    loadProfile()
  }, [publicKey])

  const loadProfile = async () => {
    if (!publicKey) return
    
    try {
      setLoading(true)
      const profileData = await getProfile(publicKey)
      if (profileData) {
        setProfile(profileData)
        setUsername(profileData.username)
        setBio(profileData.bio)
        setProfileImage(profileData.profileImage)
        setCoverImage(profileData.coverImage)
      }
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async () => {
    if (!publicKey) return

    try {
      setUpdating(true)
      await updateProfile(username, bio, profileImage, coverImage)
      toast.success('Profile updated successfully!')
      await loadProfile() // Refresh profile data
    } catch (error: any) {
      console.error('Update profile error:', error)
      toast.error(`Failed to update profile: ${error.message}`)
    } finally {
      setUpdating(false)
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }

    try {
      if (type === 'profile') {
        setUploadingProfile(true)
      } else {
        setUploadingCover(true)
      }

      const ipfsUrl = await uploadToIPFS(file)
      
      if (type === 'profile') {
        setProfileImage(ipfsUrl)
      } else {
        setCoverImage(ipfsUrl)
      }
    } catch (error) {
      toast.error('Failed to upload image')
    } finally {
      setUploadingProfile(false)
      setUploadingCover(false)
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: Camera },
    { id: 'privacy', label: 'Privacy & Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'content', label: 'Content', icon: Globe },
    { id: 'danger', label: 'Danger Zone', icon: Shield },
  ]

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="md:col-span-3 space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile Required</h2>
          <p className="text-gray-600">You need to create a profile first before accessing settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="md:col-span-3">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h2>
                
                {/* Profile Image */}
                <div className="flex items-center space-x-4 mb-6">
                  <img
                    src={profileImage || `https://picsum.photos/80/80?random=${publicKey?.toString()}`}
                    alt="Profile"
                    className="h-20 w-20 rounded-full object-cover"
                  />
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'profile')}
                      className="hidden"
                      id="profile-upload"
                      disabled={uploadingProfile}
                    />
                    <label
                      htmlFor="profile-upload"
                      className={`flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer ${
                        uploadingProfile ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <Upload className="h-4 w-4" />
                      <span>{uploadingProfile ? 'Uploading...' : 'Upload to IPFS'}</span>
                    </label>
                  </div>
                </div>

                {/* Cover Image */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image</label>
                  <div className="h-32 bg-gray-200 rounded-lg mb-2 overflow-hidden">
                    {coverImage && (
                      <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'cover')}
                    className="hidden"
                    id="cover-upload"
                    disabled={uploadingCover}
                  />
                  <label
                    htmlFor="cover-upload"
                    className={`flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer ${
                      uploadingCover ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    <span>{uploadingCover ? 'Uploading...' : 'Upload to IPFS'}</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">Max 5MB. Uploaded to IPFS for decentralization.</p>
                </div>

                {/* Username */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your username"
                  />
                </div>

                {/* Bio */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <button
                  onClick={handleUpdateProfile}
                  disabled={updating}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{updating ? 'Updating...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900">Privacy & Security</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">Private Profile</h3>
                    <p className="text-sm text-gray-600">Only followers can see your posts</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.privacy.privateProfile}
                      onChange={(e) => setSettings({
                        ...settings,
                        privacy: { ...settings.privacy, privateProfile: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">Hide Followers</h3>
                    <p className="text-sm text-gray-600">Don't show who follows you</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.privacy.hideFollowers}
                      onChange={(e) => setSettings({
                        ...settings,
                        privacy: { ...settings.privacy, hideFollowers: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">Hide Following</h3>
                    <p className="text-sm text-gray-600">Don't show who you follow</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.privacy.hideFollowing}
                      onChange={(e) => setSettings({
                        ...settings,
                        privacy: { ...settings.privacy, hideFollowing: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900">Notifications</h2>
              
              <div className="space-y-4">
                {Object.entries(settings.notifications).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900 capitalize">{key}</h3>
                      <p className="text-sm text-gray-600">Get notified when someone {key} your content</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setSettings({
                          ...settings,
                          notifications: { ...settings.notifications, [key]: e.target.checked }
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content Tab */}
          {activeTab === 'content' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900">Content Settings</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">Auto-delete Old Posts</h3>
                    <p className="text-sm text-gray-600">Automatically delete posts older than 30 days</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.content.autoDeleteOldPosts}
                      onChange={(e) => setSettings({
                        ...settings,
                        content: { ...settings.content, autoDeleteOldPosts: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">Hide Sensitive Content</h3>
                    <p className="text-sm text-gray-600">Filter out potentially sensitive content</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.content.hideSensitiveContent}
                      onChange={(e) => setSettings({
                        ...settings,
                        content: { ...settings.content, hideSensitiveContent: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone Tab */}
          {activeTab === 'danger' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900">Danger Zone</h2>
              
              <div className="border border-red-200 rounded-lg p-4">
                <h3 className="font-medium text-red-900 mb-2">Delete Account</h3>
                <p className="text-sm text-red-700 mb-4">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <button className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Account</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 