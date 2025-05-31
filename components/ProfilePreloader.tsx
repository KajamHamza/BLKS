'use client'

import { useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useBlocksProgram } from '@/hooks/useBlocksProgram'

export function ProfilePreloader() {
  const { publicKey, connected } = useWallet()
  const { preloadProfile } = useBlocksProgram()

  useEffect(() => {
    if (connected && publicKey) {
      // Preload profile with a small delay to ensure connection is stable
      const timer = setTimeout(() => {
        preloadProfile()
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [connected, publicKey, preloadProfile])

  // This component doesn't render anything
  return null
} 