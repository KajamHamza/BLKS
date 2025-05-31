'use client'

import { useState, useEffect } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { config } from '@/config'
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

export default function DebugPanel() {
  const { connection } = useConnection()
  const { publicKey, connected } = useWallet()
  const [isOpen, setIsOpen] = useState(false)
  const [debugInfo, setDebugInfo] = useState({
    networkHealth: 'checking',
    programExists: 'checking',
    solBalance: 0,
    walletConnected: false,
    rpcEndpoint: '',
  })

  const PROGRAM_ID = new PublicKey(config.solana.programId)

  useEffect(() => {
    if (connected && publicKey) {
      checkSystemHealth()
    }
  }, [connected, publicKey])

  const checkSystemHealth = async () => {
    try {
      // Check network health
      const slot = await connection.getSlot()
      
      // Check program exists
      const programInfo = await connection.getAccountInfo(PROGRAM_ID)
      const programExists = programInfo !== null
      
      // Check SOL balance
      const balance = await connection.getBalance(publicKey!)
      const solBalance = balance / LAMPORTS_PER_SOL
      
      // Get RPC endpoint
      const rpcEndpoint = (connection as any)._rpcEndpoint || 'Unknown'
      
      setDebugInfo({
        networkHealth: slot > 0 ? 'healthy' : 'unhealthy',
        programExists: programExists ? 'yes' : 'no',
        solBalance,
        walletConnected: connected,
        rpcEndpoint,
      })
    } catch (error) {
      console.error('Debug check failed:', error)
      setDebugInfo(prev => ({
        ...prev,
        networkHealth: 'error',
        programExists: 'error',
      }))
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'yes':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'unhealthy':
      case 'no':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500 animate-spin" />
    }
  }

  const getRecommendation = () => {
    if (debugInfo.programExists === 'no') {
      return {
        type: 'error',
        message: 'Program not deployed',
        solution: 'The smart contract is not deployed on devnet. This is likely a demo/test program ID.'
      }
    }
    
    if (debugInfo.solBalance < 0.01) {
      return {
        type: 'warning',
        message: 'Low SOL balance',
        solution: 'Get devnet SOL from a faucet: https://faucet.solana.com/'
      }
    }
    
    if (debugInfo.networkHealth === 'error') {
      return {
        type: 'error',
        message: 'Network issues',
        solution: 'Check your internet connection and try switching RPC endpoints'
      }
    }

    return {
      type: 'success',
      message: 'System ready',
      solution: 'Everything looks good for blockchain interactions'
    }
  }

  if (!connected) return null

  const recommendation = getRecommendation()

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-sm">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg">
        {/* Header */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 rounded-t-lg hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center space-x-2">
            {getStatusIcon(recommendation.type === 'success' ? 'healthy' : 'error')}
            <span className="text-sm font-medium">Debug Panel</span>
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {/* Content */}
        {isOpen && (
          <div className="p-4 space-y-4">
            {/* Quick Status */}
            <div className={`p-3 rounded-lg ${
              recommendation.type === 'success' ? 'bg-green-50 border border-green-200' :
              recommendation.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start space-x-2">
                {getStatusIcon(recommendation.type === 'success' ? 'healthy' : 'error')}
                <div>
                  <p className="text-sm font-medium text-gray-900">{recommendation.message}</p>
                  <p className="text-xs text-gray-600 mt-1">{recommendation.solution}</p>
                </div>
              </div>
            </div>

            {/* Detailed Info */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900">System Status</h4>
              
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>Network Health:</span>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(debugInfo.networkHealth)}
                    <span>{debugInfo.networkHealth}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Program Exists:</span>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(debugInfo.programExists)}
                    <span>{debugInfo.programExists}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>SOL Balance:</span>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(debugInfo.solBalance >= 0.01 ? 'yes' : 'no')}
                    <span>{debugInfo.solBalance.toFixed(4)} SOL</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Network:</span>
                  <span>{config.solana.network}</span>
                </div>
              </div>
            </div>

            {/* Program Info */}
            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500 break-all">
                Program ID: {config.solana.programId}
              </p>
              {publicKey && (
                <p className="text-xs text-gray-500 break-all mt-1">
                  Wallet: {publicKey.toString()}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex space-x-2">
              <button
                onClick={checkSystemHealth}
                className="flex-1 px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
              {debugInfo.solBalance < 0.01 && (
                <button
                  onClick={() => window.open('https://faucet.solana.com/', '_blank')}
                  className="flex-1 px-3 py-2 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Get SOL
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 