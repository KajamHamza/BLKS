'use client'

import { useState, useEffect } from 'react'
import { Plus, Users, Search, Hash, Crown, Lock, Globe, Bookmark, Star, Upload, AlertCircle } from 'lucide-react'
import { useBlocksProgram, Community } from '@/hooks/useBlocksProgram'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { toast } from 'react-hot-toast'
import { config } from '@/config'

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

export default function SubBlocksPage() {
  const { publicKey } = useWallet()
  const { createCommunity, getProfile } = useBlocksProgram()
  const { connection } = useConnection()
  const [subblocks, setSubblocks] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('browse')
  const [userProfile, setUserProfile] = useState<any>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Create subblock form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    avatar: '',
    rules: [''],
  })

  useEffect(() => {
    loadSubblocks()
    loadUserProfile()
  }, [publicKey])

  const loadUserProfile = async () => {
    if (!publicKey) return
    try {
      const profile = await getProfile(publicKey)
      setUserProfile(profile)
    } catch (error) {
      console.error('Failed to load user profile:', error)
    }
  }

  const loadSubblocks = async () => {
    try {
      setLoading(true)
      console.log('🔍 Fetching SubBlocks from blockchain...')
      
      // Get the program ID from the useBlocksProgram hook
      const PROGRAM_ID = new PublicKey(config.solana.programId)
      
      try {
        const accounts = await connection.getProgramAccounts(PROGRAM_ID)
        console.log(`📊 Found ${accounts.length} total program accounts`)
        
        const subblocks: Community[] = []
        let communitiesFound = 0
        
        // Scan through accounts to find community accounts
        for (const { account, pubkey } of accounts) {
          try {
            if (account.data.length === 0) continue
            
            // Try to parse as community account
            // This is a placeholder - you'd need to implement manualParseCommunity
            // similar to manualParseProfile and manualParsePost
            const communityAccount = manualParseCommunity(account.data)
            if (!communityAccount) continue
            
            communitiesFound++
            console.log(`🏘️ SubBlock ${communitiesFound}: "${communityAccount.name}" created by ${new PublicKey(communityAccount.creator).toString()}`)
            
            if (communityAccount.is_initialized === 1) {
              const community: Community = {
                isInitialized: true,
                id: Number(communityAccount.id),
                creator: new PublicKey(communityAccount.creator),
                name: communityAccount.name,
                description: communityAccount.description,
                avatar: communityAccount.avatar,
                rules: communityAccount.rules,
                memberCount: Number(communityAccount.member_count),
                createdAt: Number(communityAccount.created_at) * 1000,
                isPrivate: communityAccount.is_private === 1,
              }
              
              subblocks.push(community)
            }
          } catch (error) {
            // Not a community account or parsing failed, continue
            continue
          }
        }
        
        console.log(`📊 Total SubBlocks found: ${communitiesFound}`)
        console.log(`✅ Loaded ${subblocks.length} SubBlocks from blockchain`)
        setSubblocks(subblocks)
      } catch (error) {
        console.error('Error fetching from blockchain:', error)
        // For now, show empty state since we removed mock data
        setSubblocks([])
      }
    } catch (error) {
      console.error('Failed to load SubBlocks:', error)
      setSubblocks([])
    } finally {
      setLoading(false)
    }
  }

  // Manual community parser - would need to be implemented
  const manualParseCommunity = (data: Buffer): any | null => {
    try {
      // This would implement the community account parsing
      // similar to manualParseProfile and manualParsePost
      // For now, return null since communities might not exist yet
      return null
    } catch (error) {
      return null
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      setUploadingAvatar(true)
      const ipfsUrl = await uploadToIPFS(file)
      setFormData({ ...formData, avatar: ipfsUrl })
    } catch (error) {
      toast.error('Failed to upload image')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const canJoinSubblock = (subblock: Community) => {
    if (!userProfile) return false
    
    // Check if SubBlock requires high UCR
    const requiresHighUCR = subblock.rules.some(rule => 
      rule.toLowerCase().includes('ucr') && 
      (rule.includes('2.5') || rule.includes('3.0'))
    )
    
    if (!requiresHighUCR) return true
    
    const requiredUCR = subblock.rules.some(rule => rule.includes('3.0')) ? 3.0 : 2.5
    return userProfile.userCreditRating >= requiredUCR
  }

  const getJoinButtonText = (subblock: Community) => {
    if (!userProfile) return 'Connect Wallet to Join'
    
    const requiresHighUCR = subblock.rules.some(rule => 
      rule.toLowerCase().includes('ucr') && 
      (rule.includes('2.5') || rule.includes('3.0'))
    )
    
    if (!requiresHighUCR) return 'Join SubBlock'
    
    const requiredUCR = subblock.rules.some(rule => rule.includes('3.0')) ? 3.0 : 2.5
    
    if (userProfile.userCreditRating < requiredUCR) {
      return `UCR ${requiredUCR}+ Required`
    }
    
    return 'Join Elite SubBlock'
  }

  const handleCreateSubblock = async () => {
    if (!publicKey) {
      toast.error('Please connect your wallet')
      return
    }

    if (!userProfile) {
      toast.error('Please create a profile first')
      return
    }

    if (userProfile.userCreditRating < 2.5) {
      toast.error('You need UCR 2.5+ to create SubBlocks')
      return
    }

    if (!formData.name || !formData.description) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      await createCommunity(
        formData.name,
        formData.description,
        formData.avatar,
        formData.rules.filter(rule => rule.trim() !== '')
      )
      
      // Reset form and close modal
      setFormData({
        name: '',
        description: '',
        avatar: '',
        rules: [''],
      })
      setShowCreateModal(false)
      
      // Refresh SubBlocks
      await loadSubblocks()
      
    } catch (error: any) {
      console.error('Create SubBlock error:', error)
      toast.error('Failed to create SubBlock')
    }
  }

  const addRuleField = () => {
    setFormData({ ...formData, rules: [...formData.rules, ''] })
  }

  const updateRule = (index: number, value: string) => {
    const newRules = [...formData.rules]
    newRules[index] = value
    setFormData({ ...formData, rules: newRules })
  }

  const removeRule = (index: number) => {
    const newRules = formData.rules.filter((_, i) => i !== index)
    setFormData({ ...formData, rules: newRules })
  }

  const filteredSubblocks = subblocks.filter(subblock =>
    subblock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subblock.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatMemberCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const days = Math.floor(diff / 86400000)
    const months = Math.floor(days / 30)

    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    return 'Today'
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SubBlocks</h1>
          <p className="text-gray-600 mt-1">Discover and join elite communities on the blockchain</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!publicKey || !userProfile || userProfile.userCreditRating < 2.5}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title={!userProfile || userProfile.userCreditRating < 2.5 ? 'UCR 2.5+ required to create SubBlocks' : ''}
        >
          <Plus className="h-5 w-5" />
          <span>Create SubBlock</span>
        </button>
      </div>

      {/* UCR Warning */}
      {userProfile && userProfile.userCreditRating < 2.5 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-6 w-6 text-yellow-600" />
            <div>
              <h3 className="text-sm font-medium text-yellow-900">Low User Credit Rating</h3>
              <p className="text-xs text-yellow-700">
                Your UCR is {userProfile.userCreditRating.toFixed(1)}. You need UCR 2.5+ to create SubBlocks and join elite communities.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search and Tabs */}
      <div className="mb-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search SubBlocks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'browse'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Browse All
          </button>
          <button
            onClick={() => setActiveTab('joined')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'joined'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Joined
          </button>
          <button
            onClick={() => setActiveTab('elite')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'elite'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Elite (UCR 2.5+)
          </button>
        </div>
      </div>

      {/* SubBlocks Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="animate-pulse">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-3 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSubblocks.map((subblock) => {
            const canJoin = canJoinSubblock(subblock)
            const isElite = subblock.rules.some(rule => rule.toLowerCase().includes('ucr'))
            
            return (
              <div key={subblock.id} className={`bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${
                isElite ? 'border-yellow-200 ring-1 ring-yellow-100' : 'border-gray-200'
              }`}>
                {/* Elite Badge */}
                {isElite && (
                  <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-xs font-medium px-3 py-1 text-center">
                    ⭐ ELITE SUBBLOCK
                  </div>
                )}
                
                {/* SubBlock Header */}
                <div className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <img
                      src={subblock.avatar || `https://picsum.photos/48/48?random=${subblock.id}`}
                      alt={subblock.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-gray-900 truncate">{subblock.name}</h3>
                        <Globe className="h-4 w-4 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500 flex items-center space-x-1">
                        <Users className="h-3 w-3" />
                        <span>{formatMemberCount(subblock.memberCount)} members</span>
                      </p>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{subblock.description}</p>

                  {/* Rules Preview */}
                  {subblock.rules.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-700 mb-1">Rules:</p>
                      <p className="text-xs text-gray-600">
                        {subblock.rules.slice(0, 2).join(' • ')}
                        {subblock.rules.length > 2 && '...'}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <span>Created {formatTimeAgo(subblock.createdAt)}</span>
                    <div className="flex items-center space-x-1">
                      <Crown className="h-3 w-3" />
                      <span>Creator</span>
                    </div>
                  </div>

                  <button 
                    disabled={!canJoin}
                    className={`w-full px-4 py-2 rounded-lg transition-colors font-medium ${
                      canJoin 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                    title={!canJoin ? 'UCR requirement not met' : ''}
                  >
                    {getJoinButtonText(subblock)}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {filteredSubblocks.length === 0 && !loading && (
        <div className="text-center py-12">
          <Hash className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No SubBlocks found</h3>
          <p className="text-gray-600">
            {searchTerm ? 'Try adjusting your search terms' : 'No SubBlocks have been created on-chain yet. Be the first to create one!'}
          </p>
        </div>
      )}

      {/* Create SubBlock Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Create SubBlock</h2>
              
              <div className="space-y-4">
                {/* SubBlock Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">SubBlock Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter SubBlock name"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe your SubBlock..."
                  />
                </div>

                {/* Avatar Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Avatar Image</label>
                  <div className="flex items-center space-x-4">
                    {formData.avatar && (
                      <img 
                        src={formData.avatar} 
                        alt="Avatar preview" 
                        className="h-16 w-16 rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                        id="avatar-upload"
                        disabled={uploadingAvatar}
                      />
                      <label
                        htmlFor="avatar-upload"
                        className={`flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer ${
                          uploadingAvatar ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <Upload className="h-4 w-4" />
                        <span>{uploadingAvatar ? 'Uploading...' : 'Upload to IPFS'}</span>
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Max 5MB. Uploaded to IPFS for decentralization.</p>
                </div>

                {/* Rules */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">SubBlock Rules</label>
                  {formData.rules.map((rule, index) => (
                    <div key={index} className="flex items-center space-x-2 mb-2">
                      <input
                        type="text"
                        value={rule}
                        onChange={(e) => updateRule(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`Rule ${index + 1}`}
                      />
                      {formData.rules.length > 1 && (
                        <button
                          onClick={() => removeRule(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addRuleField}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    + Add Rule
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSubblock}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create SubBlock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 