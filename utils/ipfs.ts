// IPFS utilities for uploading images
import { toast } from 'react-hot-toast'
import { config } from '@/config'

export interface UploadResult {
  hash: string
  url: string
}

// Production IPFS upload using Pinata API
export const uploadToIPFS = async (file: File): Promise<UploadResult> => {
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    // Add metadata for better organization
    const metadata = JSON.stringify({
      name: `blocks-${Date.now()}-${file.name}`,
      keyvalues: {
        app: 'blocks-social',
        type: 'profile-image',
        timestamp: Date.now().toString()
      }
    })
    formData.append('pinataMetadata', metadata)

    // Add pinning options
    const options = JSON.stringify({
      cidVersion: 0,
    })
    formData.append('pinataOptions', options)

    const response = await fetch(`${config.ipfs.apiUrl}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.ipfs.pinataJwt}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Pinata API error:', errorData)
      throw new Error(`Failed to upload to IPFS: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    
    return {
      hash: result.IpfsHash,
      url: `${config.ipfs.gateway}${result.IpfsHash}`
    }
  } catch (error) {
    console.error('IPFS upload failed:', error)
    throw new Error('Failed to upload image to IPFS. Please try again.')
  }
}

// Validate file type and size
export const validateImageFile = (file: File): string | null => {
  if (!config.app.supportedImageTypes.includes(file.type)) {
    return 'Please upload a valid image file (JPEG, PNG, WebP, or GIF)'
  }
  
  if (file.size > config.app.maxFileSize) {
    return 'Image must be less than 5MB'
  }
  
  return null
}

// Create a preview URL for uploaded file
export const createPreviewUrl = (file: File): string => {
  return URL.createObjectURL(file)
}

// Clean up preview URL
export const revokePreviewUrl = (url: string): void => {
  URL.revokeObjectURL(url)
}

// Test Pinata connection
export const testPinataConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${config.ipfs.apiUrl}/data/testAuthentication`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.ipfs.pinataJwt}`,
      },
    })
    
    return response.ok
  } catch (error) {
    console.error('Pinata connection test failed:', error)
    return false
  }
}

// Test PINATA gateway accessibility
export const testPinataGateway = async (): Promise<boolean> => {
  try {
    // Test with a known IPFS hash (IPFS logo)
    const testHash = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(`${config.ipfs.gateway}${testHash}`, {
      method: 'HEAD',
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    console.log(`🔍 PINATA Gateway test: ${response.ok ? 'SUCCESS' : 'FAILED'}`)
    return response.ok
  } catch (error) {
    console.error('PINATA Gateway test failed:', error)
    return false
  }
}

// Get alternative IPFS gateways for fallback
export const getAlternativeIPFSUrl = (originalUrl: string): string[] => {
  const alternatives = [
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
    'https://gateway.pinata.cloud/ipfs/'
  ]
  
  // Extract IPFS hash from the original URL
  const ipfsHash = originalUrl.split('/').pop()
  if (!ipfsHash) return []
  
  return alternatives.map(gateway => `${gateway}${ipfsHash}`)
}

// Validate and fix PINATA URLs
export const validateAndFixPinataUrl = async (url: string): Promise<string> => {
  if (!url || !url.includes('ipfs')) return url
  
  try {
    // Test the original URL first
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    
    const response = await fetch(url, { 
      method: 'HEAD', 
      signal: controller.signal 
    })
    
    clearTimeout(timeoutId)
    if (response.ok) {
      console.log(`✅ Original PINATA URL is accessible: ${url}`)
      return url
    }
  } catch (error) {
    console.log(`❌ Original PINATA URL failed: ${url}`)
  }
  
  // Try alternative gateways
  const alternatives = getAlternativeIPFSUrl(url)
  for (const altUrl of alternatives) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      
      const response = await fetch(altUrl, { 
        method: 'HEAD', 
        signal: controller.signal 
      })
      
      clearTimeout(timeoutId)
      if (response.ok) {
        console.log(`✅ Alternative IPFS gateway works: ${altUrl}`)
        return altUrl
      }
    } catch (error) {
      console.log(`❌ Alternative gateway failed: ${altUrl}`)
    }
  }
  
  console.log(`❌ All IPFS gateways failed for: ${url}`)
  return url // Return original if all fail
}

// Get file info from IPFS hash
export const getIPFSFileInfo = async (hash: string) => {
  try {
    const response = await fetch(`${config.ipfs.gateway}${hash}`, {
      method: 'HEAD'
    })
    
    return {
      exists: response.ok,
      contentType: response.headers.get('content-type'),
      size: response.headers.get('content-length')
    }
  } catch (error) {
    console.error('Failed to get IPFS file info:', error)
    return { exists: false, contentType: null, size: null }
  }
}

// Test specific PINATA URL that's failing
export const testSpecificPinataUrl = async (url: string): Promise<{
  accessible: boolean,
  status?: number,
  statusText?: string,
  contentType?: string,
  error?: string
}> => {
  try {
    console.log(`🔍 Testing specific PINATA URL: ${url}`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'Blocks-Social-App/1.0'
      }
    })
    
    clearTimeout(timeoutId)
    
    const result = {
      accessible: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type') || undefined
    }
    
    console.log(`📊 PINATA URL test result:`, result)
    return result
    
  } catch (error: any) {
    const result = {
      accessible: false,
      error: error.message || 'Unknown error'
    }
    
    console.log(`❌ PINATA URL test failed:`, result)
    return result
  }
}

// Convert PINATA URLs to faster alternative gateways
export const convertToFastestGateway = (url: string): string => {
  if (!url || !url.includes('ipfs')) return url
  
  // If it's a PINATA URL, convert to ipfs.io (usually faster)
  if (url.includes('gateway.pinata.cloud/ipfs/')) {
    const ipfsHash = url.split('/ipfs/')[1]
    if (ipfsHash) {
      const fastUrl = `https://ipfs.io/ipfs/${ipfsHash}`
      console.log(`🚀 Converting slow PINATA URL to faster gateway:`)
      console.log(`   Original: ${url}`)
      console.log(`   Fast: ${fastUrl}`)
      return fastUrl
    }
  }
  
  return url
} 