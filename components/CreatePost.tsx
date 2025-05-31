'use client'

import { useState } from 'react'
import { X, Image, MapPin, Smile, Wallet } from 'lucide-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useBlocksProgram, Profile } from '@/hooks/useBlocksProgram'
import ClientOnly from './ClientOnly'

interface CreatePostProps {
  onClose: () => void
  onSuccess: () => void
  connected: boolean
  userProfile: Profile | null
  onNeedProfile: () => void
}

export default function CreatePost({ onClose, onSuccess, connected, userProfile, onNeedProfile }: CreatePostProps) {
  const { createPost } = useBlocksProgram()
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!connected) {
      // Should not reach here, but just in case
      return
    }
    
    if (!userProfile) {
      onNeedProfile()
      return
    }
    
    if (!content.trim()) return

    setLoading(true)
    try {
      await createPost(content, images)
      onSuccess()
    } catch (error) {
      console.error('Failed to create post:', error)
    } finally {
      setLoading(false)
    }
  }

  const addImage = () => {
    // For demo purposes, add a random image
    const randomId = Math.floor(Math.random() * 1000)
    setImages([...images, `https://picsum.photos/600/400?random=${randomId}`])
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  // Show wallet connection prompt if not connected
  if (!connected) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
          <div className="p-6 text-center">
            <div className="h-16 w-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Wallet className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Wallet</h3>
            <p className="text-gray-600 text-sm mb-6">
              You need to connect your Solana wallet to create posts
            </p>
            <div className="space-y-3">
              <ClientOnly fallback={<div className="h-9 w-full bg-gray-200 animate-pulse rounded"></div>}>
                <WalletMultiButton className="!w-full !bg-blue-600 hover:!bg-blue-700" />
              </ClientOnly>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show profile creation prompt if no profile
  if (!userProfile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
          <div className="p-6 text-center">
            <div className="h-16 w-16 bg-purple-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Image className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Your Profile First</h3>
            <p className="text-gray-600 text-sm mb-6">
              You need to create your profile before you can post content
            </p>
            <div className="space-y-3">
              <button
                onClick={onNeedProfile}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Create Profile
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create Post</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-start space-x-4">
            <img
              src={userProfile.profileImage}
              alt="Your profile"
              className="h-10 w-10 rounded-full object-cover"
            />
            <div className="flex-1">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's happening on the blockchain?"
                className="w-full h-32 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={500}
              />
              
              {/* Character count */}
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-500">
                  {content.length}/500 characters
                </span>
              </div>

              {/* Images preview */}
              {images.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {images.map((image, index) => (
                    <div key={index} className="relative">
                      <img
                        src={image}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={addImage}
                className="text-blue-500 hover:text-blue-600 transition-colors"
              >
                <Image className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="text-blue-500 hover:text-blue-600 transition-colors"
              >
                <MapPin className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="text-blue-500 hover:text-blue-600 transition-colors"
              >
                <Smile className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!content.trim() || loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
} 