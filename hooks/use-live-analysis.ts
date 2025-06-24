'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import websocketService from '@/lib/websocket'

interface Detection {
  type: 'fire' | 'smoke' | 'person' | 'child' | 'gas_tank' | 'wire' | 'structural_damage'
  subType?: string
  severity: 'low' | 'medium' | 'high' | 'critical' | 'none'
    confidence: number
    description: string
    location: string
  count?: number
  estimatedAge?: string
  condition?: string
  immediateAction?: string
    bounding_box?: {
      x: number
      y: number
      width: number
      height: number
    }
}

interface LiveAnalysisResult {
  urgent: boolean
  urgentVoiceAlert?: string
  detections: Detection[]
  recommendations?: {
    immediate: string[]
    safety: string[]
    medical: string[]
    evacuation: string[]
    equipment: string[]
  }
  statistics?: {
    people: {
      total: number
      children: number
      adults: number
      elderly: number
      injured: number
      trapped: number
    }
    hazards: {
      fires: number
      gasLeaks: number
      electricalHazards: number
      structuralDamages: number
    }
    sessionDuration?: string
  }
  memoryAnalysis?: {
    timeBasedWarnings?: string[]
    predictedDangers?: string[]
    trackingUpdates?: {
      peopleCount?: {
        total: number
        newlyDetected: number
        missing: number
        conditionChanges?: string[]
      }
      hazardProgression?: string[]
    }
  }
  newThreats?: string[]
  missingPeople?: string[]
  timestamp?: string
}

interface UseLiveAnalysisProps {
  unitId: string
  onAnalysisResult?: (result: LiveAnalysisResult) => void
  onVoiceAlert?: (alert: { text: string; priority: string }) => void
  onQuickRecommendations?: (recommendations: string[]) => void
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'ready' | 'analyzing') => void
  onReady?: (data: { sessionId: string; message: string; features?: any; isMock?: boolean }) => void
  onError?: (error: { message: string }) => void
  voiceAlertsEnabled?: boolean
}

export function useLiveAnalysis({ 
  unitId, 
  onAnalysisResult, 
  onVoiceAlert,
  onQuickRecommendations,
  onStatusChange, 
  onReady, 
  onError,
  voiceAlertsEnabled = true
}: UseLiveAnalysisProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [features, setFeatures] = useState<any>(null)
  const [lastAnalysis, setLastAnalysis] = useState<any>(null)
  const [sessionStats, setSessionStats] = useState<any>(null)
  const [quickRecommendations, setQuickRecommendations] = useState<string[]>([])
  const sessionIdRef = useRef<string | null>(null)
  const isActivatedRef = useRef(false)
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Initialize Hebrew voice for alerts
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthRef.current = new SpeechSynthesisUtterance()
      speechSynthRef.current.lang = 'he-IL'
      speechSynthRef.current.rate = 1.2
      speechSynthRef.current.pitch = 1.1
      speechSynthRef.current.volume = 1.0
      
      // Get Hebrew voice if available
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices()
        const hebrewVoice = voices.find(voice => voice.lang.startsWith('he'))
        if (hebrewVoice && speechSynthRef.current) {
          speechSynthRef.current.voice = hebrewVoice
        }
      }
      
      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
  }, [])

  const speakAlert = useCallback(async (text: string, priority: string = 'medium') => {
    try {
      // Try to use Gemini TTS first
      const response = await fetch('http://localhost:3001/api/ai/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          urgency: priority,
          emotion: priority === 'critical' ? 'urgent' : priority === 'high' ? 'concerned' : 'calm'
        })
      })
      
      if (response.ok) {
        const { audio_config, enhanced_text } = await response.json()
        
        // Use the enhanced text and configuration with Web Speech API
        if (speechSynthRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
          // Cancel any ongoing speech
          window.speechSynthesis.cancel()
          
          // Apply Gemini's enhanced configuration
          speechSynthRef.current.rate = audio_config?.speech_rate || (priority === 'critical' ? 1.4 : 1.2)
          speechSynthRef.current.pitch = audio_config?.speech_pitch || (priority === 'critical' ? 1.3 : 1.1)
          speechSynthRef.current.volume = audio_config?.speech_volume || 1.0
          speechSynthRef.current.text = enhanced_text || text
          
          window.speechSynthesis.speak(speechSynthRef.current)
          return // Success with enhanced Web Speech API
        }
      } else if (response.status === 501) {
        // Expected - TTS not implemented, fall through to Web Speech API
        console.log('Gemini TTS not available, using Web Speech API')
      }
    } catch (error) {
      console.warn('Gemini TTS failed, falling back to Web Speech API:', error)
    }
    
    // Fallback to Web Speech API
    if (speechSynthRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel()
      
      // Set urgency based on priority
      if (priority === 'critical') {
        speechSynthRef.current.rate = 1.4
        speechSynthRef.current.pitch = 1.3
      } else if (priority === 'high') {
        speechSynthRef.current.rate = 1.3
        speechSynthRef.current.pitch = 1.2
      } else {
        speechSynthRef.current.rate = 1.2
        speechSynthRef.current.pitch = 1.1
      }
      
      speechSynthRef.current.text = text
      window.speechSynthesis.speak(speechSynthRef.current)
    }
  }, [])

  const startLiveAnalysis = useCallback(() => {
    if (isActivatedRef.current || !unitId) {
      console.log('Live analysis already active or no unit ID')
      return
    }

    console.log('🎥 Starting AI Live Analysis...')
    
        setIsConnected(true)
        setIsAnalyzing(true)
        isActivatedRef.current = true
    
    // Send start message
    websocketService.sendMessage('start_live_analysis', { unitId })
    
    // Listen for live analysis ready
    websocketService.onMessage('live_analysis_ready', (data) => {
      console.log('✅ Live AI ready:', data)
      setFeatures(data.features)
      speakAlert('מערכת ניתוח AI מתקדמת עם זיכרון פעילה', 'normal')
    })
    
    // Listen for analysis results with memory
    websocketService.onMessage('frame_analysis_result', (data) => {
      console.log('🔍 Frame analysis result:', data)
      
      setLastAnalysis(data)
      
      if (data.sessionStats) {
        setSessionStats(data.sessionStats)
      }
      
      // Handle new format with memory analysis
      if (data.currentFrame) {
        const result: LiveAnalysisResult = {
          urgent: data.currentFrame.urgent,
          urgentVoiceAlert: data.currentFrame.urgentVoiceAlert,
          detections: data.currentFrame.detections || [],
          recommendations: data.expertRecommendations,
          statistics: {
            people: {
              total: data.totalPeopleTracked || 0,
              children: 0,
              adults: 0,
              elderly: 0,
              injured: 0,
              trapped: 0
            },
            hazards: {
              fires: data.currentFrame.detections?.filter((d: any) => d.type === 'fire').length || 0,
              gasLeaks: data.currentFrame.detections?.filter((d: any) => d.type === 'smoke').length || 0,
              electricalHazards: data.currentFrame.detections?.filter((d: any) => d.type === 'electrical_hazard').length || 0,
              structuralDamages: data.currentFrame.detections?.filter((d: any) => d.type === 'structural_damage').length || 0
            },
            sessionDuration: data.sessionDuration || '0'
          },
          memoryAnalysis: data.memoryAnalysis,
          newThreats: data.currentFrame.newThreats,
          missingPeople: data.currentFrame.missingPeople
        }
        
        onAnalysisResult?.(result)
        
        // Handle urgent voice alerts from analysis
        if (data.currentFrame.urgent && data.currentFrame.urgentVoiceAlert) {
          onVoiceAlert?.({ 
            text: data.currentFrame.urgentVoiceAlert, 
            priority: 'urgent' 
          })
        }
      } else {
        // Handle old format for fallback
        const result: LiveAnalysisResult = {
          urgent: data.urgent || false,
          urgentVoiceAlert: data.urgentVoiceAlert,
          detections: data.detections || [],
          recommendations: {
            immediate: data.instructions || [],
            safety: [],
            medical: [],
            evacuation: [],
            equipment: []
          },
          timestamp: new Date().toISOString()
        }
        
        onAnalysisResult?.(result)
      }
    })
    
    // Listen for voice alerts
    websocketService.onMessage('voice_alert', (data) => {
      console.log('🔊 Voice alert:', data)
      const alertMessage = data.message || data.text || data
      const priority = data.priority || 'normal'
      
      // Send to component callback
      onVoiceAlert?.({ text: alertMessage, priority })
      
      // Also speak it locally if enabled
      if (voiceAlertsEnabled) {
        speakAlert(alertMessage, priority === 'urgent' ? 'urgent' : 'normal')
      }
    })
    
    // Listen for explosion warning
    websocketService.onMessage('emergency_explosion_warning', (data) => {
      console.log('💥 EXPLOSION WARNING:', data)
      // Force voice alert for critical warnings
      speakAlert(data.message + ' ' + data.action, 'urgent')
      // Add visual alert
      if (typeof window !== 'undefined') {
        alert(`⚠️ אזהרת חירום! ${data.message} ${data.action}`)
      }
    })
    
    // Listen for quick recommendations
    websocketService.onMessage('quick_recommendations', (data) => {
      console.log('💡 Quick recommendations:', data)
      setQuickRecommendations(data.recommendations)
    })
    
    // Listen for session stats
    websocketService.onMessage('session_stats', (data) => {
      console.log('📊 Session stats:', data)
      setSessionStats(data)
    })
    
    // Listen for errors
    websocketService.onMessage('live_analysis_error', (data) => {
      console.error('❌ Live analysis error:', data)
      setError(data.error)
      if (data.fallback) {
        speakAlert('מעבר למודל גיבוי', 'normal')
      }
    })
  }, [unitId, onAnalysisResult, voiceAlertsEnabled])

  const stopLiveAnalysis = useCallback(() => {
    if (!isActivatedRef.current) {
      console.log('Live analysis not active')
      return
    }

    console.log('🛑 Stopping live AI analysis...')
    
    try {
      // Stop speech synthesis
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      
      websocketService.sendMessage('stop_live_analysis', {})
      
      // Clean up listeners
      websocketService.offMessage('live_analysis_ready')
      websocketService.offMessage('frame_analysis_result')
      websocketService.offMessage('voice_alert')
      websocketService.offMessage('quick_recommendations')
      websocketService.offMessage('live_analysis_error')
      
      setIsConnected(false)
      setIsAnalyzing(false)
      setFeatures(null)
      isActivatedRef.current = false
      sessionIdRef.current = null
      onStatusChange?.('disconnected')
      
    } catch (error) {
      console.error('🚨 Error stopping live analysis:', error)
    }
  }, [onStatusChange])

  const sendFrame = useCallback((frameData: string) => {
    if (!isActivatedRef.current || !unitId) {
      return false
    }

    try {
      const framePayload = {
        unitId,
        frame: frameData.split(',')[1] // Remove data:image/jpeg;base64, prefix
      }
      console.log('📸 Sending frame to AI analysis, size:', framePayload.frame.length)
      
      // Send frame via Socket.IO with correct event name
      websocketService.sendMessage('analyze_frame', framePayload)
      return true
    } catch (error) {
      console.error('🚨 Error sending frame:', error)
      return false
    }
  }, [unitId])

  return {
    isConnected,
    isAnalyzing,
    sessionId: sessionIdRef.current,
    startLiveAnalysis,
    stopLiveAnalysis,
    sendFrame
  }
} 