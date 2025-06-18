'use client'

import { useState, useRef, useCallback } from 'react'
import websocketService from '@/lib/websocket'

interface LiveAnalysisResult {
  urgent: boolean
  detections: Array<{
    type: string
    severity: string
    confidence: number
    description: string
    location: string
    action_required: string
  }>
  instructions: string[]
  priority: string
  timestamp: string
  session_id?: string
  isMock?: boolean
}

interface UseLiveAnalysisProps {
  unitId: string
  onAnalysisResult?: (result: LiveAnalysisResult) => void
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'ready' | 'analyzing') => void
}

export function useLiveAnalysis({ unitId, onAnalysisResult, onStatusChange }: UseLiveAnalysisProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const sessionIdRef = useRef<string | null>(null)
  const isActivatedRef = useRef(false)

  const startLiveAnalysis = useCallback(async () => {
    if (isActivatedRef.current) {
      console.log('Live analysis already active')
      return
    }

    try {
      onStatusChange?.('connecting')
      console.log('🎥 Starting live AI analysis...')
      
      // Connect to Socket.IO if not connected
      if (!websocketService.connected) {
        websocketService.connect()
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000)
          
          websocketService.onMessage('connect', () => {
            clearTimeout(timeout)
            resolve(true)
          })
          
          websocketService.onMessage('connect_error', (error) => {
            clearTimeout(timeout)
            reject(error)
          })
        })
      }

      // Set up live analysis listeners
      websocketService.onMessage('live_analysis_ready', (data) => {
        sessionIdRef.current = data.sessionId
        setIsConnected(true)
        setIsAnalyzing(true)
        isActivatedRef.current = true
        onStatusChange?.('ready')
        console.log('🤖 Live AI analysis ready:', data.message)
        
        if (data.isMock) {
          console.log('🎭 Using mock analysis mode')
        }
      })

      websocketService.onMessage('live_analysis_result', (data) => {
        const { analysis } = data
        console.log('🔍 Live analysis result:', analysis)
        
        if (onAnalysisResult) {
          onAnalysisResult(analysis)
        }
        
        if (analysis.urgent) {
          console.log('🚨 URGENT detection:', analysis.detections)
          // Trigger device vibration for urgent alerts
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200])
          }
        }
      })

      // Start live analysis
      websocketService.sendMessage('start_live_analysis', { unitId })
      onStatusChange?.('analyzing')
      
    } catch (error) {
      console.error('🚨 Failed to start live analysis:', error)
      onStatusChange?.('disconnected')
      setIsConnected(false)
      setIsAnalyzing(false)
      isActivatedRef.current = false
    }
  }, [unitId, onAnalysisResult, onStatusChange])

  const stopLiveAnalysis = useCallback(() => {
    if (!isActivatedRef.current) {
      console.log('Live analysis not active')
      return
    }

    console.log('🛑 Stopping live AI analysis...')
    
    try {
      websocketService.sendMessage('stop_live_analysis', {})
      
      // Clean up listeners
      websocketService.offMessage('live_analysis_ready')
      websocketService.offMessage('live_analysis_result')
      
      setIsConnected(false)
      setIsAnalyzing(false)
      isActivatedRef.current = false
      sessionIdRef.current = null
      onStatusChange?.('disconnected')
      
    } catch (error) {
      console.error('🚨 Error stopping live analysis:', error)
    }
  }, [onStatusChange])

  const sendFrame = useCallback((frameData: string) => {
    if (!isActivatedRef.current || !sessionIdRef.current) {
      return false
    }

    try {
      // Send frame via Socket.IO
      websocketService.sendMessage('live_analysis_frame', {
        frameData: frameData.split(',')[1] // Remove data:image/jpeg;base64, prefix
      })
      return true
    } catch (error) {
      console.error('🚨 Error sending frame:', error)
      return false
    }
  }, [])

  return {
    isConnected,
    isAnalyzing,
    sessionId: sessionIdRef.current,
    startLiveAnalysis,
    stopLiveAnalysis,
    sendFrame
  }
} 