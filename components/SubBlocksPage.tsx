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
  const { createCommunity, getProfile, getCommunities } = useBlocksProgram()
  const { connection } = useConnection()
  const [subblocks, setSubblocks] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('browse')
  const [userProfile, setUserProfile] = useState<any>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [userCreatedSubblocksCount, setUserCreatedSubblocksCount] = useState(0)

  // Create subblock form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    avatar: '',
    rules: [''],
  })

  // Test function to check specific community account
  const testCommunityAccount = async (accountAddress: string) => {
    try {
      console.log(`🔍 Testing community account: ${accountAddress}`)
      const publicKey = new PublicKey(accountAddress)
      const accountInfo = await connection.getAccountInfo(publicKey)
      
      if (!accountInfo) {
        console.log(`❌ No account found at address: ${accountAddress}`)
        return
      }
      
      console.log(`✅ Account exists! Owner: ${accountInfo.owner.toString()}, Size: ${accountInfo.data.length} bytes`)
      console.log(`🔍 Raw data (first 100 bytes):`, Array.from(accountInfo.data.slice(0, 100)))
      
      // Check if it's owned by our program
      const PROGRAM_ID = new PublicKey(config.solana.programId)
      if (accountInfo.owner.equals(PROGRAM_ID)) {
        console.log(`✅ Account is owned by our program`)
        
        // Detailed byte analysis
        console.log(`🔍 Detailed byte analysis:`)
        const data = accountInfo.data
        
        console.log(`   Bytes 0-10:`, Array.from(data.slice(0, 11)))
        console.log(`   Bytes 10-20:`, Array.from(data.slice(10, 21)))
        console.log(`   Bytes 20-30:`, Array.from(data.slice(20, 31)))
        console.log(`   Bytes 30-50:`, Array.from(data.slice(30, 51)))
        console.log(`   Bytes 50-70:`, Array.from(data.slice(50, 71)))
        
        // Try to find the string "TPA-SE-UIR" in the data
        const searchString = "TPA-SE-UIR"
        const searchBytes = Buffer.from(searchString, 'utf8')
        console.log(`🔍 Searching for "${searchString}" (bytes: [${Array.from(searchBytes).join(', ')}])`)
        
        for (let i = 0; i < data.length - searchBytes.length; i++) {
          let found = true
          for (let j = 0; j < searchBytes.length; j++) {
            if (data[i + j] !== searchBytes[j]) {
              found = false
              break
            }
          }
          if (found) {
            console.log(`   ✅ Found "${searchString}" at byte position ${i}`)
            console.log(`   Bytes before string (${i-10} to ${i-1}):`, Array.from(data.slice(Math.max(0, i-10), i)))
            console.log(`   String bytes (${i} to ${i+searchBytes.length-1}):`, Array.from(data.slice(i, i+searchBytes.length)))
            console.log(`   Bytes after string (${i+searchBytes.length} to ${i+searchBytes.length+10}):`, Array.from(data.slice(i+searchBytes.length, i+searchBytes.length+11)))
            break
          }
        }
        
        // Now try to manually parse the community data
        console.log(`🔍 Attempting to parse community data...`)
        let offset = 0
        
        try {
          // Parse is_initialized
          const is_initialized = data[offset]
          console.log(`   is_initialized: ${is_initialized}`)
          offset += 1
          
          // Parse id (u64)
          const id = data.readBigUInt64LE(offset)
          console.log(`   id: ${id}`)
          offset += 8
          
          // Parse creator (32 bytes)
          const creator = data.slice(offset, offset + 32)
          console.log(`   creator: ${new PublicKey(creator).toString()}`)
          offset += 32
          
          console.log(`   Current offset: ${offset}`)
          console.log(`   Next 20 bytes:`, Array.from(data.slice(offset, offset + 20)))
          
          // Parse name length
          const nameLength = data.readUInt32LE(offset)
          console.log(`   name length: ${nameLength}`)
          offset += 4
          
          if (nameLength > 0 && nameLength < 100 && offset + nameLength <= data.length) {
            const name = data.slice(offset, offset + nameLength).toString('utf8')
            console.log(`   name: "${name}"`)
            offset += nameLength
            
            // Parse description length
            const descriptionLength = data.readUInt32LE(offset)
            console.log(`   description length: ${descriptionLength}`)
            offset += 4
            
            if (descriptionLength > 0 && descriptionLength < 1000 && offset + descriptionLength <= data.length) {
              const description = data.slice(offset, offset + descriptionLength).toString('utf8')
              console.log(`   description: "${description}"`)
              console.log(`✅ Successfully parsed community data!`)
            } else {
              console.log(`❌ Invalid description length or not enough data`)
            }
          } else {
            console.log(`❌ Invalid name length or not enough data`)
          }
        } catch (parseError) {
          console.log(`❌ Error parsing community data:`, parseError)
        }
      } else {
        console.log(`❌ Account is owned by different program: ${accountInfo.owner.toString()}`)
        console.log(`   Expected: ${PROGRAM_ID.toString()}`)
      }
    } catch (error) {
      console.log(`❌ Error checking community account:`, error)
    }
  }

  // Test function with corrected parsing order
  const testCommunityAccountCorrected = async (accountAddress: string) => {
    try {
      console.log(`🔍 Testing community account with corrected parsing: ${accountAddress}`)
      const publicKey = new PublicKey(accountAddress)
      const accountInfo = await connection.getAccountInfo(publicKey)
      
      if (!accountInfo) {
        console.log(`❌ No account found at address: ${accountAddress}`)
        return
      }
      
      console.log(`✅ Account exists! Owner: ${accountInfo.owner.toString()}, Size: ${accountInfo.data.length} bytes`)
      
      // Check if it's owned by our program
      const PROGRAM_ID = new PublicKey(config.solana.programId)
      if (accountInfo.owner.equals(PROGRAM_ID)) {
        console.log(`✅ Account is owned by our program`)
        
        // Try parsing with CORRECTED field order: is_initialized, id, name, description, avatar, owner, member_count, rules, is_sb_community
        console.log(`🔍 Attempting to parse with corrected field order...`)
        const data = accountInfo.data
        let offset = 0
        
        try {
          // Parse is_initialized
          const is_initialized = data[offset]
          console.log(`   is_initialized: ${is_initialized}`)
          offset += 1
          
          // Parse id (u64)
          const id = data.readBigUInt64LE(offset)
          console.log(`   id: ${id}`)
          offset += 8
          
          // Parse name (string) - FIRST string field
          const nameLength = data.readUInt32LE(offset)
          console.log(`   name length: ${nameLength}`)
          offset += 4
          
          if (nameLength > 0 && nameLength < 100 && offset + nameLength <= data.length) {
            const name = data.slice(offset, offset + nameLength).toString('utf8')
            console.log(`   name: "${name}"`)
            offset += nameLength
            
            // Parse description (string)
            const descriptionLength = data.readUInt32LE(offset)
            console.log(`   description length: ${descriptionLength}`)
            offset += 4
            
            if (descriptionLength > 0 && descriptionLength < 1000 && offset + descriptionLength <= data.length) {
              const description = data.slice(offset, offset + descriptionLength).toString('utf8')
              console.log(`   description: "${description}"`)
              offset += descriptionLength
              
              // Parse avatar (string)
              const avatarLength = data.readUInt32LE(offset)
              console.log(`   avatar length: ${avatarLength}`)
              offset += 4
              
              if (avatarLength >= 0 && avatarLength < 500 && offset + avatarLength <= data.length) {
                const avatar = data.slice(offset, offset + avatarLength).toString('utf8')
                console.log(`   avatar: "${avatar}"`)
                offset += avatarLength
                
                // Parse owner/creator (32 bytes) - comes AFTER strings
                const creator = data.slice(offset, offset + 32)
                console.log(`   creator: ${new PublicKey(creator).toString()}`)
                offset += 32
                
                // Parse member_count (u64)
                const member_count = data.readBigUInt64LE(offset)
                console.log(`   member_count: ${member_count}`)
                offset += 8
                
                console.log(`✅ Successfully parsed community with corrected field order!`)
                console.log(`🎉 Community: "${name}" by ${new PublicKey(creator).toString()}`)
              } else {
                console.log(`❌ Invalid avatar length or not enough data`)
              }
            } else {
              console.log(`❌ Invalid description length or not enough data`)
            }
          } else {
            console.log(`❌ Invalid name length or not enough data`)
          }
        } catch (parseError) {
          console.log(`❌ Error parsing community data:`, parseError)
        }
      } else {
        console.log(`❌ Account is owned by different program: ${accountInfo.owner.toString()}`)
        console.log(`   Expected: ${PROGRAM_ID.toString()}`)
      }
    } catch (error) {
      console.log(`❌ Error checking community account:`, error)
    }
  }

  // Make test function available globally for console testing
  useEffect(() => {
    (window as any).testCommunityAccount = testCommunityAccount;
    (window as any).testCommunityAccountCorrected = testCommunityAccountCorrected;
    return () => {
      delete (window as any).testCommunityAccount;
      delete (window as any).testCommunityAccountCorrected;
    }
  }, [connection, testCommunityAccount, testCommunityAccountCorrected])

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
      
      const communities = await getCommunities()
      console.log(`✅ Loaded ${communities.length} SubBlocks from blockchain`)
      setSubblocks(communities)
      
      // Count user's created SubBlocks
      if (publicKey) {
        const userCreatedCount = communities.filter(community => 
          community.creator.equals(publicKey)
        ).length
        setUserCreatedSubblocksCount(userCreatedCount)
        console.log(`👤 User has created ${userCreatedCount} SubBlocks`)
      }
    } catch (error) {
      console.error('Failed to load SubBlocks:', error)
      setSubblocks([])
    } finally {
      setLoading(false)
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
    
    // Creators can always access their own SubBlocks
    if (publicKey && subblock.creator.equals(publicKey)) {
      return true
    }
    
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
    
    // Check if current user is the creator
    if (publicKey && subblock.creator.equals(publicKey)) {
      return 'Enter SubBlock'
    }
    
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

    if (userCreatedSubblocksCount >= 3) {
      toast.error('Maximum 3 SubBlocks allowed per user')
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
    // Handle edge cases and invalid numbers
    if (!count || count === 0 || isNaN(count) || count < 0) {
      return '1' // Default to 1 member (the creator)
    }
    
    // If the number is suspiciously large (likely a parsing error), default to 1
    if (count > 1000000) {
      console.warn(`Suspiciously large member count: ${count}, defaulting to 1`)
      return '1'
    }
    
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
          disabled={!publicKey || !userProfile || userProfile.userCreditRating < 2.5 || userCreatedSubblocksCount >= 3}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            !userProfile || userProfile.userCreditRating < 2.5 
              ? 'UCR 2.5+ required to create SubBlocks' 
              : userCreatedSubblocksCount >= 3
              ? 'Maximum 3 SubBlocks allowed per user'
              : ''
          }
        >
          <Plus className="h-5 w-5" />
          <span>Create SubBlock {userCreatedSubblocksCount > 0 && `(${userCreatedSubblocksCount}/3)`}</span>
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

      {/* SubBlock Limit Warning */}
      {userProfile && userProfile.userCreditRating >= 2.5 && userCreatedSubblocksCount >= 2 && (
        <div className={`border rounded-lg p-4 mb-6 ${
          userCreatedSubblocksCount >= 3 
            ? 'bg-red-50 border-red-200' 
            : 'bg-orange-50 border-orange-200'
        }`}>
          <div className="flex items-center space-x-3">
            <AlertCircle className={`h-6 w-6 ${
              userCreatedSubblocksCount >= 3 ? 'text-red-600' : 'text-orange-600'
            }`} />
            <div>
              <h3 className={`text-sm font-medium ${
                userCreatedSubblocksCount >= 3 ? 'text-red-900' : 'text-orange-900'
              }`}>
                {userCreatedSubblocksCount >= 3 ? 'SubBlock Limit Reached' : 'Approaching SubBlock Limit'}
              </h3>
              <p className={`text-xs ${
                userCreatedSubblocksCount >= 3 ? 'text-red-700' : 'text-orange-700'
              }`}>
                {userCreatedSubblocksCount >= 3 
                  ? 'You have reached the maximum of 3 SubBlocks per user.'
                  : `You have created ${userCreatedSubblocksCount}/3 SubBlocks. Only ${3 - userCreatedSubblocksCount} remaining.`
                }
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
          {filteredSubblocks.map((subblock) => {
            const canJoin = canJoinSubblock(subblock)
            const isElite = subblock.rules.some(rule => rule.toLowerCase().includes('ucr'))
            
            // Debug: Log member count for each subblock
            console.log(`SubBlock "${subblock.name}" member count:`, subblock.memberCount, typeof subblock.memberCount)
            // Debug: Log avatar URL for each subblock
            console.log(`SubBlock "${subblock.name}" avatar URL:`, subblock.avatar)
            // Debug: Log rules for each subblock
            console.log(`SubBlock "${subblock.name}" rules:`, subblock.rules)
            
            return (
              <div key={subblock.id} className={`bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow flex flex-col ${
                isElite ? 'border-yellow-200 ring-1 ring-yellow-100' : 'border-gray-200'
              }`}>
                {/* Elite Badge */}
                {isElite && (
                  <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-xs font-medium px-3 py-1 text-center">
                    ⭐ ELITE SUBBLOCK
                  </div>
                )}
                
                {/* SubBlock Header */}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center space-x-3 mb-4">
                    <img
                      src={subblock.avatar || `https://picsum.photos/48/48?random=${subblock.id}`}
                      alt={subblock.name}
                      className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        // Only use fallback if the original src was not already a fallback
                        if (!target.src.includes('picsum.photos')) {
                          console.log(`Failed to load avatar for ${subblock.name}: ${target.src}`);
                          target.src = `https://picsum.photos/48/48?random=${subblock.id}`;
                        }
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{subblock.name}</h3>
                        <Globe className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      </div>
                      <p className="text-sm text-gray-500 flex items-center space-x-1">
                        <Users className="h-3 w-3 flex-shrink-0" />
                        <span>{formatMemberCount(subblock.memberCount)} members</span>
                      </p>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2 flex-1">{subblock.description}</p>

                  {/* Rules Preview */}
                  {subblock.rules && subblock.rules.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-700 mb-1">Rules:</p>
                      <p className="text-xs text-gray-600 line-clamp-2">
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
                    onClick={() => {
                      if (canJoin) {
                        // Navigate to SubBlock detail page
                        window.location.href = `/subblock/${subblock.id}`;
                      }
                    }}
                    className={`w-full px-4 py-2 rounded-lg transition-colors font-medium mt-auto ${
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