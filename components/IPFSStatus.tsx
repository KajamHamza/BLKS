'use client'

import { useState, useEffect } from 'react'
import { testPinataConnection, testPinataGateway, testSpecificPinataUrl } from '@/utils/ipfs'
import { config } from '@/config'
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function IPFSStatus() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading')
  const [gatewayStatus, setGatewayStatus] = useState<'loading' | 'connected' | 'error'>('loading')
  const [details, setDetails] = useState<string>('')
  const [isVisible, setIsVisible] = useState(false)
  const [specificUrlTest, setSpecificUrlTest] = useState<any>(null)

  useEffect(() => {
    checkIPFSStatus()
  }, [])

  const checkIPFSStatus = async () => {
    try {
      console.log('🔍 Testing PINATA connection...')
      
      // Test API connection
      const apiConnected = await testPinataConnection()
      console.log(`📡 PINATA API: ${apiConnected ? 'Connected' : 'Failed'}`)
      
      // Test Gateway connection
      const gatewayConnected = await testPinataGateway()
      console.log(`🌐 PINATA Gateway: ${gatewayConnected ? 'Connected' : 'Failed'}`)
      
      // Test the specific failing URL
      const specificUrl = 'https://gateway.pinata.cloud/ipfs/QmdwykLtbe9UJ75id8zSKPFUPt3TnCyV4gdWcfHP5hWVdY'
      console.log('🎯 Testing specific failing PINATA URL...')
      const specificTest = await testSpecificPinataUrl(specificUrl)
      setSpecificUrlTest(specificTest)
      
      setStatus(apiConnected ? 'connected' : 'error')
      setGatewayStatus(gatewayConnected ? 'connected' : 'error')
      
      if (!apiConnected && !gatewayConnected) {
        setDetails('Both PINATA API and Gateway are unreachable')
      } else if (!apiConnected) {
        setDetails('PINATA API unreachable, but Gateway works')
      } else if (!gatewayConnected) {
        setDetails('PINATA Gateway unreachable, but API works')
      } else {
        setDetails('PINATA fully operational')
      }
    } catch (error) {
      console.error('IPFS status check failed:', error)
      setStatus('error')
      setGatewayStatus('error')
      setDetails('Failed to test PINATA connectivity')
    }
  }

  // Show status for a few seconds, then fade out if successful
  useEffect(() => {
    setIsVisible(true)
    if (status === 'connected') {
      const timer = setTimeout(() => setIsVisible(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [status])

  if (!isVisible && status === 'connected') return null

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-500 ${
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
    }`}>
      <div className={`rounded-lg p-3 shadow-lg border ${
        status === 'loading' || gatewayStatus === 'loading' ? 'bg-blue-50 border-blue-200' :
        status === 'connected' && gatewayStatus === 'connected' ? 'bg-green-50 border-green-200' :
        status === 'connected' || gatewayStatus === 'connected' ? 'bg-yellow-50 border-yellow-200' :
        'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-center space-x-2">
          {status === 'loading' || gatewayStatus === 'loading' ? (
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
          ) : status === 'connected' && gatewayStatus === 'connected' ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : status === 'connected' || gatewayStatus === 'connected' ? (
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <div>
            <p className={`text-sm font-medium ${
              status === 'loading' || gatewayStatus === 'loading' ? 'text-blue-900' :
              status === 'connected' && gatewayStatus === 'connected' ? 'text-green-900' :
              status === 'connected' || gatewayStatus === 'connected' ? 'text-yellow-900' :
              'text-red-900'
            }`}>
              {status === 'loading' || gatewayStatus === 'loading' ? 'Testing PINATA...' :
               status === 'connected' && gatewayStatus === 'connected' ? 'PINATA Connected' :
               status === 'connected' || gatewayStatus === 'connected' ? 'PINATA Partial' :
               'PINATA Disconnected'}
            </p>
            <p className={`text-xs ${
              status === 'loading' || gatewayStatus === 'loading' ? 'text-blue-700' :
              status === 'connected' && gatewayStatus === 'connected' ? 'text-green-700' :
              status === 'connected' || gatewayStatus === 'connected' ? 'text-yellow-700' :
              'text-red-700'
            }`}>
              {details || 'Checking connectivity...'}
            </p>
            <div className="flex space-x-2 mt-1">
              <span className={`text-xs px-1 py-0.5 rounded ${
                status === 'connected' ? 'bg-green-100 text-green-800' :
                status === 'error' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                API: {status === 'loading' ? '...' : status === 'connected' ? '✓' : '✗'}
              </span>
              <span className={`text-xs px-1 py-0.5 rounded ${
                gatewayStatus === 'connected' ? 'bg-green-100 text-green-800' :
                gatewayStatus === 'error' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                Gateway: {gatewayStatus === 'loading' ? '...' : gatewayStatus === 'connected' ? '✓' : '✗'}
              </span>
            </div>
          </div>
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Program ID: {config.solana.programId.slice(0, 8)}...
            </p>
            <p className="text-xs text-gray-500">
              Network: {config.solana.network}
            </p>
            <p className="text-xs text-gray-500">
              Gateway: {config.ipfs.gateway}
            </p>
            <button 
              onClick={checkIPFSStatus}
              className="text-xs text-blue-600 hover:text-blue-800 mt-1"
            >
              🔄 Retest PINATA
            </button>
          </div>
        )}
      </div>
    </div>
  )
} 