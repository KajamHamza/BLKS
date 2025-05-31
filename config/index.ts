// Configuration file for environment variables and constants

export const config = {
  // Solana Configuration
  solana: {
    network: (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet-beta' | 'testnet') || 'devnet',
    programId: process.env.NEXT_PUBLIC_PROGRAM_ID || '4jSY2cSGsnft5hEUMq3abVKTnoo9bBZJC4Zxx5NYYZ4p',
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || undefined, // Use default wallet adapter RPC
  },

  // IPFS/Pinata Configuration - Using real JWT token for production uploads
  ipfs: {
    pinataJwt: process.env.NEXT_PUBLIC_PINATA_JWT || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJiNDg0ODE0Yi0wN2VkLTQ2MGUtYTI3NS00YWU2YTRlMTgwMzMiLCJlbWFpbCI6ImhhbXphLmthamFtQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ike0QzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiI0MTFjMGU5YTY5Y2RmMDI0NGE3MCIsInNjb3BlZEtleVNlY3JldCI6ImVlZWYzMjUyZjE1ZTY2NWQzYThlN2I5YTc1N2VkMGZlYTM0OTdiNTE5ZDQxYTUwNGVhOGRmNDgwMTk1ZTY1ZmIiLCJleHAiOjE3Nzk2NTEyMjB9.unC6qdIlulLOjq5bNMoLNVaJRx17d9zNZD9QEQUHGD8',
    gateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
    apiUrl: 'https://api.pinata.cloud',
    // Enable real IPFS uploads (set to false for mock/testing)
    useRealIPFS: true,
  },

  // App Configuration
  app: {
    name: 'Blocks',
    description: 'Decentralized Social Media Platform',
    version: '1.0.0',
    maxFileSize: 5 * 1024 * 1024, // 5MB
    supportedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },

  // UCR Configuration
  ucr: {
    tiers: {
      topContributor: 420,
      valuableContributor: 69,
      averageContributor: 1,
      lowValue: -3,
      spamUser: -10,
    },
  },

  // Post Rating Configuration
  postRating: {
    bronze: 5,
    silver: 20,
    gold: 50,
    platinum: 150,
    diamond: 500,
    ace: 1000,
    conqueror: 1000000,
  },
}

// Helper functions
export const isDevMode = () => process.env.NODE_ENV === 'development'
export const isProduction = () => process.env.NODE_ENV === 'production'

// Validation functions
export const validateConfig = () => {
  const errors: string[] = []
  const warnings: string[] = []

  if (!config.solana.programId) {
    errors.push('NEXT_PUBLIC_PROGRAM_ID is required')
  }

  if (!config.ipfs.pinataJwt) {
    errors.push('NEXT_PUBLIC_PINATA_JWT is required for real IPFS uploads')
  }

  // JWT token format validation
  if (config.ipfs.pinataJwt && !config.ipfs.pinataJwt.startsWith('eyJ')) {
    warnings.push('Pinata JWT token format may be invalid (should start with "eyJ")')
  }

  if (errors.length > 0) {
    console.error('Configuration errors:', errors)
  }

  if (warnings.length > 0) {
    console.warn('Configuration warnings:', warnings)
  }

  return errors.length === 0
}

// Initialize configuration validation
if (typeof window !== 'undefined') {
  // Only validate on client side
  validateConfig()
}

export default config 