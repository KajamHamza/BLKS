'use client'

import { useState, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { X, Upload, Image as ImageIcon, Loader2, AlertTriangle } from 'lucide-react'
import { useBlocksProgram } from '@/hooks/useBlocksProgram'
import { uploadToIPFS, validateImageFile, createPreviewUrl, revokePreviewUrl } from '@/utils/ipfs'
import { toast } from 'react-hot-toast'

interface CreateProfileModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface ImageUpload {
  file: File | null
  preview: string | null
  ipfsUrl: string | null
  uploading: boolean
}

export default function CreateProfileModal({ onClose, onSuccess }: CreateProfileModalProps) {
  const { publicKey } = useWallet()
  const { createProfile } = useBlocksProgram()
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
  })
  const [profileImage, setProfileImage] = useState<ImageUpload>({
    file: null,
    preview: null,
    ipfsUrl: null,
    uploading: false
  })
  const [coverImage, setCoverImage] = useState<ImageUpload>({
    file: null,
    preview: null,
    ipfsUrl: null,
    uploading: false
  })
  const [creating, setCreating] = useState(false)
  
  const profileImageRef = useRef<HTMLInputElement>(null)
  const coverImageRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (file: File, type: 'profile' | 'cover') => {
    const validation = validateImageFile(file)
    if (validation) {
      toast.error(validation)
      return
    }

    const preview = createPreviewUrl(file)
    const setter = type === 'profile' ? setProfileImage : setCoverImage

    // Set preview and uploading state
    setter({
      file,
      preview,
      ipfsUrl: null,
      uploading: true
    })

    try {
      // Upload to IPFS
      const result = await uploadToIPFS(file)
      
      setter({
        file,
        preview,
        ipfsUrl: result.url,
        uploading: false
      })
      
      toast.success(`${type === 'profile' ? 'Profile' : 'Cover'} image uploaded to IPFS!`)
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('Failed to upload image')
      
      setter({
        file: null,
        preview: null,
        ipfsUrl: null,
        uploading: false
      })
      
      revokePreviewUrl(preview)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file, type)
    }
  }

  const removeImage = (type: 'profile' | 'cover') => {
    const current = type === 'profile' ? profileImage : coverImage
    const setter = type === 'profile' ? setProfileImage : setCoverImage
    
    if (current.preview) {
      revokePreviewUrl(current.preview)
    }
    
    setter({
      file: null,
      preview: null,
      ipfsUrl: null,
      uploading: false
    })

    // Reset file input
    if (type === 'profile' && profileImageRef.current) {
      profileImageRef.current.value = ''
    } else if (type === 'cover' && coverImageRef.current) {
      coverImageRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publicKey || !canSubmit) return

    setCreating(true)
    try {
      console.log('🚀 Starting profile creation...')
      
      // Get image URLs or use defaults
      const profileImageUrl = profileImage.ipfsUrl || 'https://picsum.photos/150/150?random=1'
      const coverImageUrl = coverImage.ipfsUrl || 'https://picsum.photos/800/200?random=1'
      
      // Create profile
      const signature = await createProfile(
        formData.username,
        formData.bio,
        profileImageUrl,
        coverImageUrl
      )
      
      console.log('✅ Profile created with signature:', signature)
      
      // Check if it's demo mode
      if (signature?.startsWith('demo-signature-')) {
        console.log('🎭 Demo mode detected')
        toast.success('Profile created in demo mode!', {
          duration: 5000,
          icon: '🎭'
        })
      }
      
      onSuccess()
    } catch (error: any) {
      console.error('❌ Profile creation failed:', error)
      
      // Show user-friendly error message
      if (error.message?.includes('Program not found')) {
        toast.error('Smart contract not deployed on devnet', {
          duration: 6000,
        })
      } else if (error.message?.includes('insufficient funds')) {
        toast.error('Insufficient SOL for transaction fees', {
          duration: 6000,
        })
      } else {
        toast.error('Failed to create profile. Check console for details.', {
          duration: 6000,
        })
      }
    } finally {
      setCreating(false)
    }
  }

  const canSubmit = formData.username.trim() && 
                   !profileImage.uploading && 
                   !coverImage.uploading && 
                   !creating

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create Your Profile</h2>
            <p className="text-sm text-gray-600 mt-1">Set up your profile to start using Blocks</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username *
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your username"
                required
                maxLength={20}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.username.length}/20 characters
              </p>
            </div>
            
            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Tell us about yourself..."
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.bio.length}/200 characters
              </p>
            </div>

            {/* Profile Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Profile Image
              </label>
              <div className="flex items-center space-x-4">
                {/* Image Preview */}
                <div className="relative">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200">
                    {profileImage.preview ? (
                      <img 
                        src={profileImage.preview} 
                        alt="Profile preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  {profileImage.uploading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                  )}
                </div>

                {/* Upload Controls */}
                <div className="flex-1">
                  <input
                    ref={profileImageRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e, 'profile')}
                    className="hidden"
                  />
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => profileImageRef.current?.click()}
                      disabled={profileImage.uploading}
                      className="flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {profileImage.file ? 'Change' : 'Upload'}
                    </button>
                    {profileImage.file && (
                      <button
                        type="button"
                        onClick={() => removeImage('profile')}
                        disabled={profileImage.uploading}
                        className="px-3 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {profileImage.ipfsUrl ? 'Uploaded to IPFS ✓' : 'Max 5MB. JPEG, PNG, WebP, or GIF'}
                  </p>
                </div>
              </div>
            </div>

            {/* Cover Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Cover Image
              </label>
              <div className="space-y-3">
                {/* Image Preview */}
                <div className="relative">
                  <div className="w-full h-32 rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                    {coverImage.preview ? (
                      <img 
                        src={coverImage.preview} 
                        alt="Cover preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <ImageIcon className="h-12 w-12" />
                      </div>
                    )}
                  </div>
                  {coverImage.uploading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                      <Loader2 className="h-8 w-8 text-white animate-spin" />
                    </div>
                  )}
                </div>

                {/* Upload Controls */}
                <div>
                  <input
                    ref={coverImageRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e, 'cover')}
                    className="hidden"
                  />
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => coverImageRef.current?.click()}
                      disabled={coverImage.uploading}
                      className="flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {coverImage.file ? 'Change' : 'Upload'}
                    </button>
                    {coverImage.file && (
                      <button
                        type="button"
                        onClick={() => removeImage('cover')}
                        disabled={coverImage.uploading}
                        className="px-3 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {coverImage.ipfsUrl ? 'Uploaded to IPFS ✓' : 'Max 5MB. JPEG, PNG, WebP, or GIF'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Profile...
                </>
              ) : (
                'Create Profile'
              )}
            </button>
          </div>
        </form>

        {/* Info */}
        <div className="px-6 pb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">🔗 Blockchain Integration</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Images are uploaded to IPFS for decentralized storage</li>
              <li>• Profile data is stored on the Solana blockchain</li>
              <li>• Make sure you have SOL for transaction fees</li>
              <li>• Check the debug panel if transaction fails</li>
            </ul>
          </div>
          
          {/* Demo Mode Warning */}
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-yellow-50 rounded-lg p-4 mt-4">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-900">Development Mode</h4>
                  <p className="text-xs text-yellow-800 mt-1">
                    If the smart contract is not deployed, the app will run in demo mode with simulated transactions.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 