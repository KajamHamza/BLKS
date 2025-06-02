'use client'

import { useState, useRef } from 'react'
import { X, Image, MapPin, Smile, Wallet, Upload } from 'lucide-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useBlocksProgram, Profile } from '@/hooks/useBlocksProgram'
import { uploadToIPFS, validateImageFile, createPreviewUrl, revokePreviewUrl } from '@/utils/ipfs'
import { toast } from 'react-hot-toast'
import ClientOnly from './ClientOnly'

interface CreatePostProps {
  onClose: () => void
  onSuccess: () => void
  connected: boolean
  userProfile: Profile | null
  onNeedProfile: () => void
}

interface ImageUpload {
  file: File
  previewUrl: string
  ipfsUrl?: string
  uploading: boolean
}

export default function CreatePost({ onClose, onSuccess, connected, userProfile, onNeedProfile }: CreatePostProps) {
  const { createPost } = useBlocksProgram()
  const [content, setContent] = useState('')
  const [imageUploads, setImageUploads] = useState<ImageUpload[]>([])
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!connected) {
      return
    }
    
    if (!userProfile) {
      onNeedProfile()
      return
    }
    
    if (!content.trim()) {
      toast.error('Please enter some content for your post')
      return
    }

    // Check if any images are still uploading
    const stillUploading = imageUploads.some(upload => upload.uploading)
    if (stillUploading) {
      toast.error('Please wait for all images to finish uploading')
      return
    }

    setLoading(true)
    try {
      // Get all uploaded IPFS URLs
      const ipfsUrls = imageUploads
        .filter(upload => upload.ipfsUrl)
        .map(upload => upload.ipfsUrl!)
      
      await createPost(content, ipfsUrls)
      
      // Clean up preview URLs
      imageUploads.forEach(upload => {
        revokePreviewUrl(upload.previewUrl)
      })
      
      onSuccess()
    } catch (error) {
      console.error('Failed to create post:', error)
      toast.error('Failed to create post. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    if (files.length === 0) return
    
    // Limit to 4 images total
    const currentCount = imageUploads.length
    const maxNew = Math.max(0, 4 - currentCount)
    const filesToProcess = files.slice(0, maxNew)
    
    if (files.length > maxNew) {
      toast.error(`You can only upload ${maxNew} more image(s). Maximum 4 images per post.`)
    }

    filesToProcess.forEach(async (file) => {
      // Validate file
      const validationError = validateImageFile(file)
      if (validationError) {
        toast.error(validationError)
        return
      }

      // Create preview and add to uploads
      const previewUrl = createPreviewUrl(file)
      const newUpload: ImageUpload = {
        file,
        previewUrl,
        uploading: true
      }

      setImageUploads(prev => [...prev, newUpload])

      try {
        // Upload to IPFS
        toast.loading(`Uploading ${file.name} to IPFS...`, { id: `upload-${file.name}` })
        
        const result = await uploadToIPFS(file)
        
        // Update the upload with IPFS URL
        setImageUploads(prev => prev.map(upload => 
          upload.file === file 
            ? { ...upload, ipfsUrl: result.url, uploading: false }
            : upload
        ))

        toast.success(`${file.name} uploaded successfully!`, { id: `upload-${file.name}` })
        
      } catch (error) {
        console.error('Failed to upload image:', error)
        toast.error(`Failed to upload ${file.name}`, { id: `upload-${file.name}` })
        
        // Remove failed upload
        setImageUploads(prev => prev.filter(upload => upload.file !== file))
        revokePreviewUrl(previewUrl)
      }
    })

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeImage = (index: number) => {
    const upload = imageUploads[index]
    if (upload) {
      revokePreviewUrl(upload.previewUrl)
      setImageUploads(prev => prev.filter((_, i) => i !== index))
    }
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
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

              {/* Image upload area */}
              {imageUploads.length === 0 && (
                <div className="mt-4 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-2">Add images to your post</p>
                  <button
                    type="button"
                    onClick={triggerFileSelect}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Choose files from your device
                  </button>
                  <p className="text-xs text-gray-400 mt-1">
                    Supports JPEG, PNG, WebP, GIF • Max 5MB per image • Up to 4 images
                  </p>
                </div>
              )}

              {/* Images preview */}
              {imageUploads.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {imageUploads.map((upload, index) => (
                    <div key={index} className="relative">
                      <img
                        src={upload.previewUrl}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      
                      {/* Upload status overlay */}
                      {upload.uploading && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                          <div className="text-white text-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2"></div>
                            <p className="text-xs">Uploading to IPFS...</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Success indicator */}
                      {!upload.uploading && upload.ipfsUrl && (
                        <div className="absolute top-2 left-2 bg-green-500 text-white rounded-full p-1">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      
                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        disabled={upload.uploading}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={triggerFileSelect}
                disabled={imageUploads.length >= 4}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  imageUploads.length >= 4
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                }`}
                title={imageUploads.length >= 4 ? 'Maximum 4 images per post' : 'Upload images from your device'}
              >
                <Upload className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {imageUploads.length >= 4 ? 'Max images' : 'Upload Images'}
                </span>
              </button>
              
              {imageUploads.length > 0 && (
                <span className="text-xs text-gray-500">
                  {imageUploads.length}/4 images
                </span>
              )}
              
              <button
                type="button"
                className="text-blue-500 hover:text-blue-600 transition-colors"
                title="Add location (coming soon)"
                disabled
              >
                <MapPin className="h-5 w-5 opacity-50" />
              </button>
              <button
                type="button"
                className="text-blue-500 hover:text-blue-600 transition-colors"
                title="Add emoji (coming soon)"
                disabled
              >
                <Smile className="h-5 w-5 opacity-50" />
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
                disabled={!content.trim() || loading || imageUploads.some(upload => upload.uploading)}
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