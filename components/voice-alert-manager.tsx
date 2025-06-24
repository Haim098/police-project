'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Volume2, 
  VolumeX, 
  Mic, 
  MicOff,
  AlertTriangle,
  MessageSquare,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceAlert {
  id: string
  text: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  timestamp: number
  spoken: boolean
  source: 'ai' | 'control' | 'system'
}

interface VoiceAlertManagerProps {
  enabled?: boolean
  onToggleEnabled?: (enabled: boolean) => void
  className?: string
}

export const VoiceAlertManager: React.FC<VoiceAlertManagerProps> = ({
  enabled = true,
  onToggleEnabled,
  className
}) => {
  const [voiceEnabled, setVoiceEnabled] = useState(enabled)
  const [isListening, setIsListening] = useState(false)
  const [voiceAlerts, setVoiceAlerts] = useState<VoiceAlert[]>([])
  const [currentlySpeaking, setCurrentlySpeaking] = useState<string | null>(null)
  const [audioQueue, setAudioQueue] = useState<VoiceAlert[]>([])
  const recognitionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Initialize audio context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return () => {
      audioContextRef.current?.close()
    }
  }, [])

  // Voice commands recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'he-IL'

      recognitionRef.current.onresult = (event: any) => {
        const last = event.results.length - 1
        const transcript = event.results[last][0].transcript.toLowerCase()
        
        // Voice commands
        if (transcript.includes('השתק') || transcript.includes('שקט')) {
          setVoiceEnabled(false)
          window.speechSynthesis.cancel()
        } else if (transcript.includes('הפעל קול') || transcript.includes('דבר')) {
          setVoiceEnabled(true)
        } else if (transcript.includes('חזור') || transcript.includes('שוב')) {
          // Repeat last alert
          const lastAlert = voiceAlerts[0]
          if (lastAlert) {
            speakAlert(lastAlert)
          }
        }
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }
    }
  }, [voiceAlerts])

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }, [isListening])

  const speakAlert = useCallback(async (alert: VoiceAlert) => {
    if (!voiceEnabled) return

    setCurrentlySpeaking(alert.id)

    try {
      // Try Gemini TTS first
      const response = await fetch('http://localhost:3001/api/ai/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: alert.text,
          urgency: alert.priority,
          emotion: alert.priority === 'critical' ? 'urgent' : 'calm'
        })
      })

      if (response.ok && audioContextRef.current) {
        const data = await response.json()

        if (data.audio) {
          console.log('🗣️ Playing Gemini TTS', {
            voice: data.format,
            bytes: data.audio.length
          })

          // Decode base64 audio returned from server
          const audioData = atob(data.audio)
          const arrayBuffer = new ArrayBuffer(audioData.length)
          const view = new Uint8Array(arrayBuffer)
          for (let i = 0; i < audioData.length; i++) {
            view[i] = audioData.charCodeAt(i)
          }

          // Play with Web Audio API for better control
          const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
          const source = audioContextRef.current.createBufferSource()
          source.buffer = audioBuffer
          
          // Add gain node for volume control
          const gainNode = audioContextRef.current.createGain()
          gainNode.gain.value = alert.priority === 'critical' ? 1.0 : 0.8
          
          source.connect(gainNode)
          gainNode.connect(audioContextRef.current.destination)
          
          source.onended = () => {
            setCurrentlySpeaking(null)
            setVoiceAlerts(prev => 
              prev.map(a => a.id === alert.id ? { ...a, spoken: true } : a)
            )
          }
          
          source.start(0)
          return // Success – skip fallback
        } else {
          console.warn('Gemini TTS response missing audio, falling back to Web Speech API')
        }
      } else if (response.status === 501) {
        // Expected - TTS not implemented, fall through to Web Speech API
        console.log('Gemini TTS not available, using Web Speech API')
      } else {
        throw new Error('TTS service error')
      }
    } catch (error) {
      console.log('TTS error, falling back to Web Speech API:', error)
    }
    
    // Fallback to Web Speech API
    try {
      const utterance = new SpeechSynthesisUtterance(alert.text)
      utterance.lang = 'he-IL'
      utterance.rate = alert.priority === 'critical' ? 1.4 : 1.2
      utterance.pitch = alert.priority === 'critical' ? 1.3 : 1.1
      utterance.volume = 1.0
      
      utterance.onend = () => {
        setCurrentlySpeaking(null)
        setVoiceAlerts(prev => 
          prev.map(a => a.id === alert.id ? { ...a, spoken: true } : a)
        )
      }
      
      window.speechSynthesis.speak(utterance)
    } catch (error) {
      console.error('Error speaking alert:', error)
      setCurrentlySpeaking(null)
    }
  }, [voiceEnabled])

  // Process audio queue
  useEffect(() => {
    if (audioQueue.length > 0 && !currentlySpeaking) {
      const nextAlert = audioQueue[0]
      setAudioQueue(prev => prev.slice(1))
      speakAlert(nextAlert)
    }
  }, [audioQueue, currentlySpeaking, speakAlert])

  // Add new alert
  const addVoiceAlert = useCallback((text: string, priority: VoiceAlert['priority'] = 'medium', source: VoiceAlert['source'] = 'ai') => {
    const newAlert: VoiceAlert = {
      id: `alert-${Date.now()}`,
      text,
      priority,
      timestamp: Date.now(),
      spoken: false,
      source
    }
    
    setVoiceAlerts(prev => [newAlert, ...prev].slice(0, 10)) // Keep last 10
    
    // Add to queue if critical or high priority
    if (priority === 'critical' || priority === 'high') {
      setAudioQueue(prev => [...prev, newAlert])
    }
  }, [])

  // Toggle voice
  const toggleVoice = useCallback(() => {
    const newEnabled = !voiceEnabled
    setVoiceEnabled(newEnabled)
    onToggleEnabled?.(newEnabled)
    
    if (!newEnabled) {
      window.speechSynthesis.cancel()
      setCurrentlySpeaking(null)
      setAudioQueue([])
    }
  }, [voiceEnabled, onToggleEnabled])

  const getPriorityColor = (priority: VoiceAlert['priority']) => {
    switch (priority) {
      case 'critical': return 'bg-red-600'
      case 'high': return 'bg-orange-600'
      case 'medium': return 'bg-yellow-600'
      case 'low': return 'bg-blue-600'
    }
  }

  const getSourceIcon = (source: VoiceAlert['source']) => {
    switch (source) {
      case 'ai': return <Zap className="w-3 h-3" />
      case 'control': return <MessageSquare className="w-3 h-3" />
      case 'system': return <AlertTriangle className="w-3 h-3" />
    }
  }

  // Expose addVoiceAlert method via ref
  useEffect(() => {
    (window as any).voiceAlertManager = { addVoiceAlert }
  }, [addVoiceAlert])

  return (
    <Card className={cn('bg-gray-800 border-gray-700', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            מערכת התראות קוליות
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isListening ? 'destructive' : 'outline'}
              onClick={toggleListening}
              className="h-8"
            >
              {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant={voiceEnabled ? 'default' : 'outline'}
              onClick={toggleVoice}
              className="h-8"
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {/* Current speaking indicator */}
        {currentlySpeaking && (
          <Alert className="mb-3 bg-green-900 border-green-700">
            <Volume2 className="h-4 w-4 animate-pulse" />
            <AlertDescription className="text-green-200">
              מדבר כעת...
            </AlertDescription>
          </Alert>
        )}
        
        {/* Voice commands hint */}
        {isListening && (
          <Alert className="mb-3 bg-blue-900 border-blue-700">
            <Mic className="h-4 w-4" />
            <AlertDescription className="text-blue-200 text-xs">
              פקודות קוליות: "השתק", "הפעל קול", "חזור"
            </AlertDescription>
          </Alert>
        )}
        
        {/* Alert history */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {voiceAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'flex items-start gap-2 p-2 rounded-lg border transition-all',
                alert.spoken ? 'opacity-60' : '',
                currentlySpeaking === alert.id ? 'ring-2 ring-green-500' : '',
                alert.priority === 'critical' ? 'border-red-600 bg-red-950' :
                alert.priority === 'high' ? 'border-orange-600 bg-orange-950' :
                alert.priority === 'medium' ? 'border-yellow-600 bg-yellow-950' :
                'border-blue-600 bg-blue-950'
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getSourceIcon(alert.source)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-100 break-words">
                  {alert.text}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={cn(getPriorityColor(alert.priority), 'text-xs')}>
                    {alert.priority === 'critical' ? 'קריטי' :
                     alert.priority === 'high' ? 'גבוה' :
                     alert.priority === 'medium' ? 'בינוני' : 'נמוך'}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {new Date(alert.timestamp).toLocaleTimeString('he-IL')}
                  </span>
                  {alert.spoken && (
                    <Badge variant="outline" className="text-xs">
                      נאמר
                    </Badge>
                  )}
                </div>
              </div>
              {!alert.spoken && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => speakAlert(alert)}
                  className="h-8 w-8 p-0"
                >
                  <Volume2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          
          {voiceAlerts.length === 0 && (
            <div className="text-center text-gray-400 py-4">
              <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">אין התראות קוליות</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default VoiceAlertManager 