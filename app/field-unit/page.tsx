"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Camera,
  Mic,
  MicOff,
  Video,
  VideoOff,
  AlertTriangle,
  Shield,
  Phone,
  MessageSquare,
  Navigation,
  Battery,
  Signal,
  Eye,
  Flame,
  Users,
  Zap,
  Building,
  MapPin,
  ScanLine,
  ScreenShare,
  ScreenShareOff,
  Lightbulb,
  AlertCircle,
  Car,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { supabase, Detection, Event } from "@/lib/supabase"
import websocketService from "@/lib/websocket"
import { useCamera } from "@/hooks/use-camera"
import { useLiveAnalysis } from "@/hooks/use-live-analysis"
import config from "@/config"
import { PriorityAlertDisplay } from '@/components/priority-alert-display'
import { VoiceAlertManager } from '@/components/voice-alert-manager'
import { SituationSummary } from '@/components/situation-summary'

export default function FieldUnit() {
  // Camera hook
  const {
    videoRef,
    isCameraOn,
    isScreenSharing,
    activeStreamType,
    isRecording: isCameraRecording,
    isPermissionGranted,
    startCamera,
    stopCamera,
    startScreenShare,
    stopStream,
    startRecording,
    stopRecording,
    captureFrame,
    startAutoCapture,
    stopAutoCapture,
    error: cameraError
  } = useCamera()

  // State definitions
  const [isMicOn, setIsMicOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [batteryLevel, setBatteryLevel] = useState(78)
  const [signalStrength, setSignalStrength] = useState(4)
  const [currentLocation, setCurrentLocation] = useState("ממתין למיקום...")
  const [unitId, setUnitId] = useState("") // יטען מהמסד נתונים או יוגדר ע"י המשתמש
  const [unitName, setUnitName] = useState("יחידה חדשה")
  const [unitType, setUnitType] = useState<'police' | 'fire' | 'medical' | 'civil_defense'>('police')
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('checking')
  const [lastAnalysis, setLastAnalysis] = useState<any>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [isMockMode, setIsMockMode] = useState(false)
  const [activeDetections, setActiveDetections] = useState<any[]>([])
  const [detectionTimers, setDetectionTimers] = useState<Map<string, NodeJS.Timeout>>(new Map())
  const [currentTime, setCurrentTime] = useState('')
  const [messageToControl, setMessageToControl] = useState('')
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(true)
  const [quickRecommendations, setQuickRecommendations] = useState<string[]>([])
  const [analysisFeatures, setAnalysisFeatures] = useState<any>(null)
  const [sessionStats, setSessionStats] = useState<any>(null)
  const [memoryAnalysis, setMemoryAnalysis] = useState<any>(null)
  const [newThreats, setNewThreats] = useState<string[]>([])
  const [missingPeople, setMissingPeople] = useState<string[]>([])
  const [soundAlerts, setSoundAlerts] = useState(true)
  const [lastVoiceAlert, setLastVoiceAlert] = useState<string | null>(null)

  // Live AI Analysis hook
  const {
    isConnected: aiConnected,
    isAnalyzing,
    startLiveAnalysis,
    stopLiveAnalysis,
    sendFrame
  } = useLiveAnalysis({
    unitId,
    voiceAlertsEnabled,
    onAnalysisResult: (result) => {
      console.log('🔍 Advanced AI Analysis result:', result)
      
      // Update last analysis for display
      setLastAnalysis(result)
      
      // Update memory analysis
      if (result.memoryAnalysis) {
        setMemoryAnalysis(result.memoryAnalysis)
      }
      
      // Update new threats
      if (result.newThreats) {
        setNewThreats(result.newThreats)
      }
      
      // Update missing people
      if (result.missingPeople) {
        setMissingPeople(result.missingPeople)
      }
      
      // Update session stats
      setSessionStats((prev: any) => ({
        ...prev,
        duration: result.statistics?.sessionDuration || prev?.duration || '0',
        detections: result.statistics || prev?.detections
      }))
      
      // Update active detections for display
      if (result.detections && result.detections.length > 0) {
        const newDetections = result.detections.map((det: any) => ({
          ...det,
          id: `${det.type}_${Date.now()}_${Math.random()}`,
          timestamp: new Date().toISOString()
        }))
        
        // Add each detection with timeout
        newDetections.forEach(detection => {
          addDetectionWithTimeout(detection)
        })
      }
      
      // Process detections
      result.detections?.forEach((det: any) => {
        if (det.severity === 'critical' || det.confidence > 0.8) {
          console.log('🚨 Critical detection:', det)
          sendDetection(det)
        }
      })
      
      // Handle urgent alerts
      if (result.urgent && result.detections) {
        const criticalDetections = result.detections.filter((d: any) => 
          d.severity === 'critical' || d.type === 'fire' || d.type === 'explosion'
        )
        
        if (criticalDetections.length > 0) {
          sendDetection(criticalDetections[0])
          
          if (soundAlerts) {
            playAlertSound()
          }
        }
      }
    },
    onVoiceAlert: (alert) => {
      console.log('🔊 Voice alert:', alert)
      
      // Extract text from alert object
      const alertText = typeof alert === 'string' ? alert : alert.text || ''
      const priority = typeof alert === 'string' ? 'medium' : (alert.priority || 'medium')
      
      setLastVoiceAlert(alertText)
      
      // Show visual alert
      if (alertText && alertText.length > 0) {
        addDetectionWithTimeout({
          id: `voice_${Date.now()}`,
          type: 'voice_alert',
          description: alertText,
          severity: priority === 'critical' ? 'critical' : priority === 'high' ? 'high' : 'medium',
          confidence: 1.0,
          location: 'התראה קולית',
          timestamp: new Date().toISOString()
        })
        
        // Add to voice alert manager
        if ((window as any).voiceAlertManager) {
          (window as any).voiceAlertManager.addVoiceAlert(
            alertText,
            priority === 'urgent' ? 'critical' : priority,
            'ai'
          )
        }
      }
    },
    onQuickRecommendations: (recommendations) => {
      setQuickRecommendations(recommendations)
    },
    onStatusChange: (status) => {
      console.log('📡 AI Status:', status)
    },
    onReady: (data) => {
      console.log('✅ AI Ready:', data)
      setAnalysisFeatures(data.features)
    },
    onError: (error) => {
      console.error('❌ AI Error:', error)
    }
  })
  
  const [detections, setDetections] = useState<Detection[]>([])
  const [instructions, setInstructions] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [wsConnected, setWsConnected] = useState(false)

  // Helper to check if any video stream is active
  const isStreamActive = isCameraOn || isScreenSharing;

  // Load saved unit data from localStorage on component mount
  useEffect(() => {
    const savedUnitId = localStorage.getItem('rescuerLens_unitId')
    const savedUnitName = localStorage.getItem('rescuerLens_unitName')
    const savedUnitType = localStorage.getItem('rescuerLens_unitType')
    
    if (savedUnitId) {
      setUnitId(savedUnitId)
    }
    if (savedUnitName) {
      setUnitName(savedUnitName)
    }
    if (savedUnitType) {
      setUnitType(savedUnitType as 'police' | 'fire' | 'medical' | 'civil_defense')
    }
    
    // התחלת תהליך הטעינה רק לאחר טעינת localStorage
    setTimeout(() => {
      loadUnitData()
    }, 100)
  }, [])

  useEffect(() => {
    loadDetections()
    loadInstructions()
    
    // Setup WebSocket only after we have unitId
    if (unitId) {
    setupWebSocket()
    }
    
    // Check location permission
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setLocationPermission(result.state)
        result.addEventListener('change', () => {
          setLocationPermission(result.state)
        })
      })
    }
    
    // Monitor battery
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100))
        
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100))
        })
      })
    }
    
    // Monitor network connection
    const updateConnectionStatus = () => {
      if (navigator.onLine) {
        // Simulate signal strength based on connection type
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
        if (connection) {
          const effectiveType = connection.effectiveType
          if (effectiveType === '4g') setSignalStrength(4)
          else if (effectiveType === '3g') setSignalStrength(3)
          else if (effectiveType === '2g') setSignalStrength(2)
          else setSignalStrength(1)
        } else {
          setSignalStrength(navigator.onLine ? 4 : 0)
        }
      } else {
        setSignalStrength(0)
      }
    }
    
    // Keep unit active by sending periodic heartbeat
    const heartbeatInterval = setInterval(() => {
      if (unitId && wsConnected) {
        updateUnitStatus('active')
      }
    }, 60000) // Every minute
    
    updateConnectionStatus()
    window.addEventListener('online', updateConnectionStatus)
    window.addEventListener('offline', updateConnectionStatus)
    
    // Cleanup on unmount
    return () => {
      clearInterval(heartbeatInterval)
      window.removeEventListener('online', updateConnectionStatus)
      window.removeEventListener('offline', updateConnectionStatus)
    }
    
    // Monitor location
    let watchId: number | undefined
    if ('geolocation' in navigator) {
      // First, try to get current position to request permission
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          setLocationPermission('granted')
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          
          // Get address and update location
          await updateUnitLocation(lat, lng)
          
          // Now start watching position
          watchId = navigator.geolocation.watchPosition(
            async (position) => {
              const lat = position.coords.latitude
              const lng = position.coords.longitude
              await updateUnitLocation(lat, lng)
            },
            (error) => {
              console.error('Location error:', error)
              setLocationPermission('denied')
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 30000
            }
          )
        },
        (error) => {
          console.error('Initial location error:', error)
          setLocationPermission('denied')
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    }
    
    // Subscribe to real-time updates for this unit
    const detectionsSubscription = supabase
      .channel('unit_detections')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'detections',
        filter: `unit_id=eq.${unitId}`
      }, () => {
        loadDetections()
      })
      .subscribe()

    const instructionsSubscription = supabase
      .channel('unit_instructions')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'events',
        filter: `unit_id=eq.${unitId}`
      }, () => {
        loadInstructions()
      })
      .subscribe()

    return () => {
      detectionsSubscription.unsubscribe()
      instructionsSubscription.unsubscribe()
      websocketService.disconnect()
      window.removeEventListener('online', updateConnectionStatus)
      window.removeEventListener('offline', updateConnectionStatus)
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [unitId])

  // Update current time every second
  useEffect(() => {
    // Set initial time only on client side
    setCurrentTime(new Date().toLocaleTimeString('he-IL'))
    
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('he-IL'))
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const setupWebSocket = async () => {
    try {
      websocketService.connect('http://localhost:3001')
      
      // Wait a bit for connection to establish
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // רק נרשם אם יש unitId
      if (unitId) {
      try {
        await websocketService.registerUnit(unitId)
        setWsConnected(true)
        console.log('✅ WebSocket connected and unit registered')
        
        // Mark unit as active when connecting
        await updateUnitStatus('active')
      } catch (registrationError) {
        console.warn('⚠️ Registration failed, but continuing:', registrationError)
        // Even if registration fails, consider connected if socket is connected
        setWsConnected(websocketService.connected || false)
        }
      } else {
        // מחובר ל-WebSocket אבל לא רשום כיחידה
        setWsConnected(websocketService.connected || false)
        console.log('🔌 WebSocket connected but no unit registration (no unitId)')
      }

      // Listen for commands from control center
      websocketService.onMessage('command_received', (data) => {
        console.log('Command received:', data)
        alert(`הוראה ממרכז השליטה: ${data.message}`)
        loadInstructions()
      })

      // Listen for new instructions
      websocketService.onMessage('new_instruction', (data) => {
        console.log('New instruction:', data)
        loadInstructions()
      })

      // Listen for real-time command updates
      websocketService.onMessage('command_received', (data) => {
        console.log('📨 Command received from control center:', data)
        
        // Show notification
        alert(`הודעה ממרכז השליטה: ${data.message}`)
        
        // Reload instructions to show the new message
        loadInstructions()
      })

    } catch (error) {
      console.error('WebSocket setup failed:', error)
      setWsConnected(false)
    }
  }

  const loadDetections = async () => {
    // אל תטען איתורים אם אין unitId
    if (!unitId) {
      setDetections([])
      return
    }
    
    try {
      const { data, error } = await supabase
        .from('detections')
        .select('*')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error
      setDetections(data || [])
    } catch (error) {
      console.error('Error loading detections:', error)
    }
  }

  const loadInstructions = async () => {
    // אל תטען הוראות אם אין unitId
    if (!unitId) {
      setInstructions([])
      setLoading(false)
      return
    }
    
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('unit_id', unitId)
        .eq('type', 'alert')
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error
      setInstructions(data || [])
    } catch (error) {
      console.error('Error loading instructions:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendDetection = async (
    detection: any, 
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    isUrgent: boolean = false
  ) => {
    if (!unitId || !location) return

    try {
      console.log('📤 Sending detection:', detection)

      const { data, error } = await supabase
        .from('detections')
        .insert({
          unit_id: unitId,
          type: detection.type,
          confidence: detection.confidence || 0.95, // Default to high confidence if not provided
          severity,
          acknowledged: false
        })
        .select()
        .single()

      if (error) throw error
      
      // Also log as an event
      await supabase
        .from('events')
        .insert({
          unit_id: unitId,
          type: 'detection',
          data: {
            detection_type: detection.type,
            severity,
            confidence: detection.confidence,
            location: currentLocation
          }
        })

      // Send real-time notification to control centers via WebSocket
      if (wsConnected && data) {
        console.log('📡 Sending detection notification via WebSocket:', data)
        websocketService.sendMessage('detection_created', {
          ...data,
          unit_name: unitName,
          location: currentLocation
        })
        
        // Send urgent alert for critical detections
        if (severity === 'critical') {
          websocketService.sendMessage('urgent_alert', {
            unitId,
            unitName,
            message: `זיהוי דחוף: ${detection.type} ביחידה ${unitName}`,
            detection: data,
            location: currentLocation
          })
        }
      }

      console.log(`✅ Detection ${detection.type} sent successfully to control center`)
    } catch (error) {
      console.error('Error sending detection:', error)
      setAiError("שגיאה בשליחת זיהוי למרכז הבקרה.")
    }
  }

  const updateUnitStatus = async (status: 'active' | 'emergency' | 'inactive') => {
    // אל תעדכן סטטוס אם אין unitId
    if (!unitId) {
      console.warn('Cannot update status: no unitId')
      return
    }
    
    try {
      const { error } = await supabase
        .from('units')
        .update({ 
          status,
          battery_level: batteryLevel,
          signal_strength: signalStrength * 25 // Convert 1-4 to percentage
        })
        .eq('id', unitId)

      if (error) throw error

      // Send status update via WebSocket
      if (wsConnected) {
        websocketService.sendMessage('unit_status_change', {
          unitId,
          unitName,
          status,
          batteryLevel,
          signalStrength,
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error('Error updating unit status:', error)
    }
  }

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${config.googleMaps.apiKey}&language=he`
      )
      const data = await response.json()
      
      if (data.status === 'OK' && data.results.length > 0) {
        return data.results[0].formatted_address
      }
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    } catch (error) {
      console.error('Reverse geocoding error:', error)
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    }
  }

  const updateUnitLocation = async (lat: number, lng: number) => {
    // אל תעדכן מיקום אם אין unitId
    if (!unitId) {
      console.warn('Cannot update location: no unitId')
      return
    }
    
    try {
      // Get address from coordinates
      const address = await reverseGeocode(lat, lng)
      setCurrentLocation(address)
      
      const { error } = await supabase
        .from('units')
        .update({ 
          lat,
          lng,
          last_update: new Date().toISOString()
        })
        .eq('id', unitId)

      if (error) throw error
      
      // Also send location update through WebSocket for real-time tracking
      if (wsConnected) {
        websocketService.sendMessage('location_update', {
          unitId,
          lat,
          lng,
          address,
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error('Error updating unit location:', error)
    }
  }

  const loadUnitData = async () => {
    try {
      // אם אין unitId, ניצור יחידה חדשה
      if (!unitId) {
        console.log('🆕 No unitId found, creating new unit...')
        await createNewUnit()
        return
      }

      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('id', unitId)
        .single()

      if (error) {
        console.error('Error loading unit data:', error)
        // אם היחידה לא נמצאה, ניצור יחידה חדשה
        if (error.code === 'PGRST116') {
          console.log('🆕 Unit not found, creating new unit...')
          await createNewUnit()
        }
        return
      }

      if (data) {
        setUnitName(data.name || 'יחידה חדשה')
        setUnitType(data.type || 'police')
        // Don't override battery/signal if we have real-time data
        if (!('getBattery' in navigator)) {
          setBatteryLevel(data.battery_level || 78)
        }
        if (!navigator.onLine) {
          setSignalStrength(Math.round((data.signal_strength || 100) / 25))
        }
      }
    } catch (error) {
      console.error('Error in loadUnitData:', error)
    }
  }

  const createNewUnit = async () => {
    try {
      const newUnitName = `יחידה ${Date.now().toString().slice(-4)}`
      
      const { data, error } = await supabase
        .from('units')
        .insert([
          {
            name: newUnitName,
            type: unitType,
            status: 'active',
            battery_level: batteryLevel,
            signal_strength: signalStrength * 25, // Convert back to percentage
            location: null
          }
        ])
        .select()
        .single()

      if (error) throw error

      if (data) {
        setUnitId(data.id)
        setUnitName(data.name)
        console.log('✅ Created new unit:', data)
        
        // שמירה ב-localStorage לשימוש עתידי
        localStorage.setItem('rescuerLens_unitId', data.id)
        localStorage.setItem('rescuerLens_unitName', data.name)
        localStorage.setItem('rescuerLens_unitType', data.type)
        
        // טעינת נתונים לאחר יצירת היחידה
        await loadDetections()
        await loadInstructions()
        
        // הגדרת WebSocket מחדש עם ה-unitId החדש
        await setupWebSocket()
      }
    } catch (error) {
      console.error('Error creating new unit:', error)
      alert('שגיאה ביצירת יחידה חדשה. אנא נסה שוב.')
    }
  }

  const getUnitTypeIcon = (type: string) => {
    switch (type) {
      case "police":
        return <Shield className="w-4 h-4" />
      case "fire":
        return <Flame className="w-4 h-4" />
      case "medical":
        return <Users className="w-4 h-4" />
      case "civil_defense":
        return <Building className="w-4 h-4" />
      default:
        return <Shield className="w-4 h-4" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "border-red-500 bg-red-50"
      case "high":
        return "border-orange-500 bg-orange-50"
      case "medium":
        return "border-yellow-500 bg-yellow-50"
      case "low":
        return "border-blue-500 bg-blue-50"
      default:
        return "border-gray-500 bg-gray-50"
    }
  }

  const getSeverityBorderColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "border-red-500"
      case "high":
        return "border-orange-500"
      case "medium":
        return "border-yellow-500"
      default:
        return "border-gray-400"
    }
  }

  const getDetectionIcon = (type: string) => {
    switch (type) {
      case "fire":
        return <Flame className="w-5 h-5 text-red-500" />
      case "smoke":
        return <Eye className="w-5 h-5 text-gray-600" />
      case "person":
        return <Users className="w-5 h-5 text-blue-500" />
      case "child":
        return <Users className="w-5 h-5 text-cyan-500" />
      case "gas_tank":
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case "wire":
        return <Zap className="w-5 h-5 text-yellow-500" />
      case "structural_damage":
        return <Building className="w-5 h-5 text-orange-500" />
      default:
        return <AlertTriangle className="w-5 h-5 text-red-500" />
    }
  }

  const analyzeFrame = async () => {
    console.log('🤖 Starting AI analysis...')
    
    if (!wsConnected) {
      console.log('❌ WebSocket not connected')
      alert('לא מחובר לשרת AI')
      return
    }

    if (!isStreamActive) {
      console.log('❌ Camera or screen share not on')
      alert('אנא הפעל את המצלמה או שתף מסך לפני ניתוח AI')
      return
    }

    try {
      console.log('📸 Capturing frame for AI analysis...')
      
      // Capture current frame from video
      const frameData = captureFrame()
      if (!frameData) {
        console.log('❌ Failed to capture frame')
        setAiError('שגיאה בלכידת תמונה מהמצלמה')
        return
      }

      console.log(`🤖 Sending frame to AI server (${frameData.length} chars)...`)

      const response = await fetch('http://localhost:3001/api/ai/analyze-frame', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          unitId,
          frame: frameData // Real frame data from camera
        })
      })

      console.log('🤖 AI server response status:', response.status)
      const result = await response.json()
      console.log('🤖 AI server response:', result)
      
      if (result.success && result.analysis.detections.length > 0) {
        const detection = result.analysis.detections[0]
        console.log('🎯 Detection found:', detection)
        
        // Auto-send detection to database if significant
        if (detection.type !== 'none') {
        await sendDetection(detection)
        }
        
        // alert(`AI זיהה: ${detection.description}\nרמת ביטחון: ${Math.round(detection.confidence * 100)}%`)
      } else if (!result.success) {
        setAiError(result.message || 'שגיאה לא ידועה משרת AI')
      } else {
        console.log('✅ No detections found')
        // alert('AI לא זיהה איומים באזור')
      }
    } catch (error) {
      console.error('🚨 AI Analysis failed:', error)
      setAiError('שגיאה בניתוח AI. בדוק את חיבור הרשת.')
    }
  }

  const emergencyCall = () => {
    updateUnitStatus('emergency')
    sendEmergencyMessage()
  }

  const sendMessageToControl = async () => {
    if (!messageToControl.trim() || !unitId) {
      return
    }
    
    try {
      // Send via WebSocket for real-time delivery
      if (wsConnected) {
        websocketService.sendMessage('send_message_to_control', {
          unitId,
          unitName,
          message: messageToControl,
          location: currentLocation,
          urgency: 'normal'
        })
        console.log('📤 Message sent to control center via WebSocket')
      }
      
      // Also save to database
      await supabase
        .from('events')
        .insert({
          unit_id: unitId,
          type: 'message_to_control',
          data: {
            message: messageToControl,
            from: 'field_unit',
            unit_name: unitName,
            location: currentLocation,
            priority: 'normal'
          }
        })
      
      setMessageToControl('')
      alert('הודעה נשלחה למרכז השליטה')
    } catch (error) {
      console.error('Error sending message to control:', error)
      alert('שגיאה בשליחת ההודעה')
    }
  }

  const sendEmergencyMessage = async () => {
    if (!unitId) return
    
    const emergencyMsg = `התראת חירום מיחידה ${unitName} - זקוק לסיוע מיידי!`
    
    try {
      // Send urgent message via WebSocket
      if (wsConnected) {
        websocketService.sendMessage('urgent_alert', {
          unitId,
          unitName,
          message: emergencyMsg,
          location: currentLocation,
          type: 'emergency_call'
        })
        console.log('🚨 Emergency message sent via WebSocket')
      }
      
      // Also save to database
      await supabase
        .from('events')
        .insert({
          unit_id: unitId,
          type: 'emergency_alert',
          data: {
            message: emergencyMsg,
            from: 'field_unit',
            unit_name: unitName,
            location: currentLocation,
            priority: 'critical'
          }
        })
      
      alert('התראת חירום נשלחה למרכז השליטה!')
    } catch (error) {
      console.error('Error sending emergency message:', error)
      alert('שגיאה בשליחת התראת החירום')
    }
  }

  const toggleRecording = () => {
    if (isCameraRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const toggleLiveAnalysis = async () => {
    if (isAnalyzing) {
      console.log('🛑 Stopping Live AI Analysis...')
      stopLiveAnalysis()
      stopAutoCapture()
    } else {
      if (!isStreamActive) {
        alert('אנא הפעל את המצלמה או שתף מסך לפני הפעלת ניתוח AI')
        return
      }
      
      console.log('🎥 Starting Live AI Analysis...')
      startLiveAnalysis()
      
      // Start auto-capture and send frames to AI
      startAutoCapture((frameData) => {
        sendFrame(frameData)
      }, 2000) // Send frame every 2 seconds
    }
  }

  const handleStopStream = () => {
    if (isAnalyzing) {
      toggleLiveAnalysis()
    }
    stopStream()
  }

  const requestLocationPermission = async () => {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        })
      })
      
      setLocationPermission('granted')
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      setCurrentLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
      updateUnitLocation(lat, lng)
      
    } catch (error) {
      console.error('Location permission denied:', error)
      setLocationPermission('denied')
    }
  }

  // Alert sound function using Web Speech API
  const playAlertSound = () => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel()
      
      const utterance = new SpeechSynthesisUtterance('אזהרה! זוהתה סכנה!')
      utterance.lang = 'he-IL'
      utterance.rate = 1.3
      utterance.pitch = 1.2
      utterance.volume = 1.0
      
      // Try to get Hebrew voice
      const voices = window.speechSynthesis.getVoices()
      const hebrewVoice = voices.find(voice => voice.lang.startsWith('he'))
      if (hebrewVoice) {
        utterance.voice = hebrewVoice
      }
      
      window.speechSynthesis.speak(utterance)
    }
  }

  // Auto-cleanup detections after 5 seconds
  const addDetectionWithTimeout = useCallback((detection: any) => {
    const detectionId = detection.id || `${detection.type}_${Date.now()}_${Math.random()}`
    const detectionWithId = { ...detection, id: detectionId }
    
    // Clear existing timer if any
    const existingTimer = detectionTimers.get(detectionId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }
    
    // Add detection
    setActiveDetections(prev => {
      // Check for duplicates based on type and description
      const isDuplicate = prev.some(d => 
        d.type === detection.type && 
        d.description === detection.description &&
        Date.now() - new Date(d.timestamp).getTime() < 3000 // Within 3 seconds
      )
      
      if (isDuplicate) {
        console.log('🚫 Duplicate detection prevented:', detection.type)
        return prev
      }
      
      const updated = [detectionWithId, ...prev]
      return updated.slice(0, 8) // Keep last 8 detections
    })
    
    // Set timer to remove detection after 5 seconds
    const timer = setTimeout(() => {
      setActiveDetections(prev => prev.filter(d => d.id !== detectionId))
      setDetectionTimers(prev => {
        const newMap = new Map(prev)
        newMap.delete(detectionId)
        return newMap
      })
      console.log('🗑️ Auto-removed detection:', detectionId)
    }, 5000)
    
    // Store timer
    setDetectionTimers(prev => new Map(prev).set(detectionId, timer))
  }, [detectionTimers])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      detectionTimers.forEach(timer => clearTimeout(timer))
    }
  }, [detectionTimers])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4" dir="rtl" suppressHydrationWarning>
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto space-y-4" suppressHydrationWarning>
        {/* No Unit Warning */}
        {!unitId && (
          <Alert className="bg-blue-600 text-white border-blue-700">
            <Shield className="h-5 w-5" />
            <AlertDescription className="font-bold">
              יוצר יחידה חדשה במערכת...
            </AlertDescription>
          </Alert>
        )}

        {/* Mock Mode Warning */}
        {isMockMode && (
          <Alert className="bg-yellow-500 text-black border-yellow-600">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription className="font-bold">
              מצב הדגמה פעיל - הניתוח אינו אמיתי
            </AlertDescription>
          </Alert>
        )}

        {/* Low Battery Warning */}
        {batteryLevel < 20 && (
          <Alert className="bg-red-600 text-white border-red-700">
            <Battery className="h-5 w-5" />
            <AlertDescription className="font-bold">
              אזהרה: סוללה נמוכה ({batteryLevel}%)
            </AlertDescription>
          </Alert>
        )}

        {/* No Server Connection Warning */}
        {!wsConnected && (
          <Alert className="bg-orange-600 text-white border-orange-700">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription className="font-bold">
              אין חיבור לשרת - ניתוח AI לא זמין
            </AlertDescription>
          </Alert>
        )}

        {/* Location Permission Warning */}
        {locationPermission === 'denied' && (
          <Alert className="bg-red-600 text-white border-red-700">
            <MapPin className="h-5 w-5" />
            <AlertDescription className="font-bold">
              הרשאת מיקום נדחתה - מרכז השליטה לא יוכל לעקוב אחר היחידה
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-2 text-white border-white hover:bg-white hover:text-red-600"
                onClick={requestLocationPermission}
              >
                בקש הרשאה שוב
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Location Permission Prompt */}
        {locationPermission === 'prompt' && (
          <Alert className="bg-blue-600 text-white border-blue-700">
            <MapPin className="h-5 w-5" />
            <AlertDescription className="font-bold">
              נדרשת הרשאת מיקום למעקב בזמן אמת
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-2 text-white border-white hover:bg-white hover:text-blue-600"
                onClick={requestLocationPermission}
              >
                אפשר מיקום
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Header Status Bar */}
        <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-medium">{unitName}</span>
            {unitId && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs px-2 py-1 h-6"
                onClick={async () => {
                  const confirmed = confirm('האם אתה בטוח שברצונך לנקות את הנתונים וליצור יחידה חדשה?')
                  if (confirmed) {
                    // Clear localStorage
                    localStorage.removeItem('rescuerLens_unitId')
                    localStorage.removeItem('rescuerLens_unitName')
                    localStorage.removeItem('rescuerLens_unitType')
                    
                    // Reset state
                    setUnitId('')
                    setUnitName('יחידה חדשה')
                    setUnitType('police')
                    
                    // Create new unit
                    await createNewUnit()
                    
                    alert('יחידה חדשה נוצרה בהצלחה!')
                  }
                }}
              >
                🔄 יחידה חדשה
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Signal className="w-4 h-4" />
              <span className="text-xs">{signalStrength}/4</span>
            </div>
            <div className="flex items-center gap-1">
              <Battery className="w-4 h-4" />
              <span className="text-xs">{batteryLevel}%</span>
            </div>
            <div className={`w-2 h-2 rounded-full ${isCameraRecording ? "bg-red-500 animate-pulse" : "bg-gray-500"}`}></div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs">{wsConnected ? 'מחובר' : 'לא מחובר'}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${aiConnected ? 'bg-blue-500' : 'bg-gray-500'} ${isAnalyzing ? 'animate-pulse' : ''}`} />
              <span className="text-xs">AI {isAnalyzing ? 'פעיל' : 'כבוי'}</span>
            </div>
          </div>
        </div>

        {/* Camera View */}
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-0">
            <div className="bg-black rounded-lg aspect-video flex items-center justify-center relative">
              {/* Video element - always present but hidden when camera is off */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover rounded-lg ${isStreamActive ? 'block' : 'hidden'}`}
              />
              
              {/* Camera off overlay */}
              {!isStreamActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-white text-center p-4">
                    <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">{isPermissionGranted ? 'מצלמה ושיתוף כבויים' : 'יש צורך בהרשאות'}</p>
                    <p className="text-sm opacity-75 mb-4">
                      {isPermissionGranted ? 'בחר מקור וידאו להתחלה' : 'אנא אפשר גישה למצלמה'}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Camera error display */}
              {cameraError && (
                <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs">
                  {cameraError}
                </div>
              )}

              {/* Recording indicator */}
              {isCameraRecording && (
                <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  REC
                </div>
              )}

              {/* AI Scanning overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <ScanLine className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 text-green-400 opacity-30 animate-pulse" />
              </div>

              {/* AI Bounding Boxes Overlay */}
              <div className="absolute inset-0">
                {activeDetections.map((detection, index) => {
                  if (!detection.bounding_box) return null;
                  const { x, y, width, height } = detection.bounding_box
                  return (
                    <div
                      key={index}
                      className="absolute border-2 border-yellow-400 pointer-events-none"
                      style={{
                        left: `${x * 100}%`,
                        top: `${y * 100}%`,
                        width: `${width * 100}%`,
                        height: `${height * 100}%`,
                      }}
                    >
                      <span className="bg-yellow-400 text-black text-xs font-bold p-1 absolute -top-5 left-0">
                        {detection.description}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Location overlay */}
              <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                {currentLocation}
              </div>
            </div>
          </CardContent>
        </Card>



        {/* Camera Control Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={isCameraOn ? "destructive" : "default"}
            onClick={isCameraOn ? handleStopStream : startCamera}
            className="h-12"
            disabled={isScreenSharing}
          >
            {isCameraOn ? <Camera className="w-4 h-4 mr-1" /> : <Video className="w-4 h-4 mr-1" />}
            {isCameraOn ? "כבה מצלמה" : "הפעל מצלמה"}
          </Button>

          <Button
            variant={isScreenSharing ? "destructive" : "default"}
            onClick={isScreenSharing ? handleStopStream : startScreenShare}
            className={`h-12 ${isScreenSharing ? 'bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
            disabled={isCameraOn}
          >
            {isScreenSharing ? <ScreenShareOff className="w-4 h-4 mr-1" /> : <ScreenShare className="w-4 h-4 mr-1" />}
            {isScreenSharing ? "הפסק שיתוף" : "שתף מסך"}
          </Button>
          
          <Button
            variant={isCameraRecording ? "destructive" : "default"}
            onClick={toggleRecording}
            className="h-12"
            disabled={!isStreamActive}
          >
            {isCameraRecording ? <VideoOff className="w-4 h-4 mr-1" /> : <Video className="w-4 h-4 mr-1" />}
            {isCameraRecording ? "עצור הקלטה" : "התחל הקלטה"}
          </Button>
        </div>

        {/* Emergency Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="destructive"
            onClick={emergencyCall}
            className="h-16 text-lg font-bold"
          >
            <AlertTriangle className="w-6 h-6 mr-2" />
            חירום!
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              if (wsConnected) {
                websocketService.sendMessage('unit_message', {
                  unitId,
                  message: `${unitName} מבקשת ליצור קשר`,
                  timestamp: new Date().toISOString()
                })
                alert('בקשת קשר נשלחה למרכז השליטה')
              } else {
                alert('לא מחובר למרכז השליטה')
              }
            }}
            className="h-16"
          >
            <Phone className="w-6 h-6 mr-2" />
            קשר מרכז
          </Button>
        </div>

        {/* AI Analysis Buttons */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ScanLine className="w-5 h-5" />
              ניתוח AI
              {lastAnalysis && (
                <Badge className={`mr-2 ${lastAnalysis.urgent ? 'bg-red-600' : 'bg-green-600'}`}>
                  {lastAnalysis.urgent ? 'דחוף' : 'רגיל'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Live Analysis Toggle */}
            <Button
              onClick={toggleLiveAnalysis}
              className={`w-full h-12 ${isAnalyzing ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              disabled={!isStreamActive}
            >
              <ScanLine className={`w-5 h-5 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
              {!isStreamActive ? 'הפעל מקור וידאו' :
               isAnalyzing ? 'עצור ניתוח חי' : 'התחל ניתוח חי'}
            </Button>

            {/* AI Status and Errors */}
            {aiError && (
              <Alert className="border-red-500 bg-red-950">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-red-300">
                  שגיאת AI: {aiError}
                </AlertDescription>
              </Alert>
            )}

            {/* AI Features Display */}
            {analysisFeatures && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`p-2 rounded ${analysisFeatures.peopleDetection ? 'bg-green-900' : 'bg-gray-700'}`}>
                  <Users className="w-4 h-4 mb-1" />
                  זיהוי אנשים
                </div>
                <div className={`p-2 rounded ${analysisFeatures.fireAndSmokeAnalysis ? 'bg-green-900' : 'bg-gray-700'}`}>
                  <Flame className="w-4 h-4 mb-1" />
                  ניתוח אש ועשן
                </div>
                <div className={`p-2 rounded ${analysisFeatures.electricalHazards ? 'bg-green-900' : 'bg-gray-700'}`}>
                  <Zap className="w-4 h-4 mb-1" />
                  סכנות חשמל
                </div>
                <div className={`p-2 rounded ${analysisFeatures.voiceAlerts ? 'bg-green-900' : 'bg-gray-700'}`}>
                  <MessageSquare className="w-4 h-4 mb-1" />
                  התראות קוליות
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Detections */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ScanLine className="w-5 h-5" />
              זיהויי AI אחרונים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-40">
              <div className="space-y-2">
                {detections.map((detection) => (
                  <div
                    key={detection.id}
                    className={`p-3 rounded-lg border ${getSeverityColor(detection.severity)}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                      {getDetectionIcon(detection.type)}
                        <span className="font-medium text-sm text-gray-900">
                          {detection.type === 'fire' && 'שריפה'}
                          {detection.type === 'smoke' && 'עשן'}
                          {detection.type === 'person' && 'אדם'}
                          {detection.type === 'structural_damage' && 'נזק מבני'}
                          {detection.type === 'electrical_hazard' && 'סכנה חשמלית'}
                          {detection.type === 'explosion_risk' && 'סכנת פיצוץ'}
                          {detection.type === 'vehicle' && 'רכב'}
                          {detection.type === 'none' && 'ללא זיהוי'}
                        </span>
                      </div>
                      <Badge variant={detection.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                        {Math.round(detection.confidence * 100)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">
                      {new Date(detection.created_at || '').toLocaleTimeString('he-IL')}
                    </p>
                  </div>
                ))}
                
                {detections.length === 0 && (
                  <div className="text-center text-gray-400 py-4">
                    <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">אין זיהויים חדשים</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Priority Alert Display - Combined with Active Detections */}
        <PriorityAlertDisplay 
          detections={activeDetections}
          className="mb-4"
        />

        {/* Voice Alert Manager */}
        <VoiceAlertManager 
          enabled={voiceAlertsEnabled}
          onToggleEnabled={setVoiceAlertsEnabled}
          className="mb-4"
        />

        {/* Situation Summary */}
        <SituationSummary 
          statistics={lastAnalysis?.statistics}
          memoryAnalysis={lastAnalysis?.memoryAnalysis}
          sessionStats={sessionStats}
          hazardTrend={lastAnalysis?.statistics?.hazardTrend}
          className="mb-4"
        />

        {/* Instructions from Control Center */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              הודעות ממרכז השליטה
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {instructions.map((instruction) => (
                  <Alert key={instruction.id} className="border-blue-500 bg-blue-50">
                    <AlertDescription className="text-sm text-gray-900">
                      {instruction.data?.message || 'הודעה ממרכז השליטה'}
                      </AlertDescription>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(instruction.created_at || '').toLocaleTimeString('he-IL')}
                    </div>
                  </Alert>
                ))}
                
                {instructions.length === 0 && (
                  <div className="text-center text-gray-400 py-4">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">אין הודעות חדשות</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Send Message to Control Center */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              שליחת הודעה למרכז השליטה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="כתוב הודעה למרכז השליטה..."
                value={messageToControl}
                onChange={(e) => setMessageToControl(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    sendMessageToControl()
                  }
                }}
              />
              <Button
                onClick={sendMessageToControl}
                disabled={!messageToControl.trim() || !wsConnected}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
            </div>
            {!wsConnected && (
              <p className="text-xs text-red-400">
                ⚠️ לא מחובר למרכז השליטה - ההודעה תישמר למאוחר יותר
              </p>
            )}
          </CardContent>
        </Card>

        {/* Status Info */}
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400">יחידה</p>
                <p className="font-bold flex items-center gap-2">
                  {getUnitTypeIcon(unitType)}
                  {unitName}
                </p>
        </div>
              <div>
                <p className="text-xs text-gray-400">סטטוס</p>
                <p className="font-bold text-green-400">פעיל</p>
            </div>
              <div>
                <p className="text-xs text-gray-400">מיקום נוכחי</p>
                <p className="font-bold text-sm flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {currentLocation || 'ממתין למיקום...'}
                </p>
            </div>
              <div>
                <p className="text-xs text-gray-400">זמן מקומי</p>
                <p className="font-bold">{currentTime}</p>
              </div>
            </div>
            {locationPermission === 'denied' && (
              <div className="mt-3 p-2 bg-red-900/50 rounded text-xs text-red-200">
                ⚠️ הרשאת מיקום נדחתה - מרכז השליטה לא יראה את מיקומך
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Recommendations */}
        {quickRecommendations.length > 0 && (
          <Card className="bg-yellow-900 border-yellow-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                המלצות דחופות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {quickRecommendations.map((rec, index) => (
                  <Alert key={index} className="bg-yellow-800 border-yellow-600">
                    <AlertDescription className="text-yellow-100 font-medium">
                      {index + 1}. {rec}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Advanced AI Analysis Results */}
        {lastAnalysis && lastAnalysis.statistics && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="w-5 h-5" />
                סטטיסטיקות זיהוי
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {/* People Statistics */}
                <div>
                  <p className="text-sm font-medium mb-2">אנשים שזוהו:</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>סה"כ:</span>
                      <span className="font-bold">{lastAnalysis.statistics.people.total}</span>
                    </div>
                    {lastAnalysis.statistics.people.children > 0 && (
                      <div className="flex justify-between text-yellow-400">
                        <span>ילדים:</span>
                        <span className="font-bold">{lastAnalysis.statistics.people.children}</span>
                      </div>
                    )}
                    {lastAnalysis.statistics.people.injured > 0 && (
                      <div className="flex justify-between text-red-400">
                        <span>פצועים:</span>
                        <span className="font-bold">{lastAnalysis.statistics.people.injured}</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Hazards Statistics */}
                <div>
                  <p className="text-sm font-medium mb-2">סכנות שזוהו:</p>
                  <div className="space-y-1 text-xs">
                    {lastAnalysis.statistics.hazards.fires > 0 && (
                      <div className="flex justify-between text-red-400">
                        <span>שריפות:</span>
                        <span className="font-bold">{lastAnalysis.statistics.hazards.fires}</span>
                      </div>
                    )}
                    {lastAnalysis.statistics.hazards.gasLeaks > 0 && (
                      <div className="flex justify-between text-orange-400">
                        <span>דליפות גז:</span>
                        <span className="font-bold">{lastAnalysis.statistics.hazards.gasLeaks}</span>
                      </div>
                    )}
                    {lastAnalysis.statistics.hazards.electricalHazards > 0 && (
                      <div className="flex justify-between text-yellow-400">
                        <span>סכנות חשמל:</span>
                        <span className="font-bold">{lastAnalysis.statistics.hazards.electricalHazards}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Risk Assessment */}
              {lastAnalysis.riskAssessment && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">רמת סיכון כללית:</span>
                    <Badge 
                      className={
                        lastAnalysis.riskAssessment.overallRisk === 'critical' ? 'bg-red-600' :
                        lastAnalysis.riskAssessment.overallRisk === 'high' ? 'bg-orange-600' :
                        lastAnalysis.riskAssessment.overallRisk === 'medium' ? 'bg-yellow-600' :
                        'bg-green-600'
                      }
                    >
                      {lastAnalysis.riskAssessment.overallRisk === 'critical' ? 'קריטי' :
                       lastAnalysis.riskAssessment.overallRisk === 'high' ? 'גבוה' :
                       lastAnalysis.riskAssessment.overallRisk === 'medium' ? 'בינוני' : 'נמוך'}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Memory-Based Analysis Display */}
        {(sessionStats || memoryAnalysis) && (
          <Card className="bg-purple-900 border-purple-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-purple-400" />
                ניתוח מבוסס זיכרון
                {sessionStats?.duration && (
                  <Badge className="bg-purple-700">{sessionStats.duration} שניות</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Session Statistics */}
              {sessionStats && (
                <div className="bg-purple-800/50 rounded p-3">
                  <p className="text-sm font-medium mb-2">סטטיסטיקות סשן:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span>משך סריקה:</span>
                      <span className="font-bold">{sessionStats.duration || 0} שניות</span>
                    </div>
                    <div className="flex justify-between">
                      <span>אנשים במעקב:</span>
                      <span className="font-bold">{sessionStats.totalPeople || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>סכנות פעילות:</span>
                      <span className="font-bold text-orange-400">{sessionStats.activeHazards || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>אירועים קריטיים:</span>
                      <span className="font-bold text-red-400">{sessionStats.criticalEvents || 0}</span>
                    </div>
                  </div>
                </div>
              )}

                              {/* Memory Analysis Warnings */}
                {memoryAnalysis?.timeBasedWarnings?.length > 0 && (
                <div className="bg-red-900/50 rounded p-3">
                  <p className="text-sm font-medium mb-2 text-red-300">⚠️ אזהרות מבוססות זמן:</p>
                  <div className="space-y-1 text-xs">
                    {memoryAnalysis.timeBasedWarnings.map((warning: string, idx: number) => (
                      <Alert key={idx} className="bg-red-800 border-red-600 py-1">
                        <AlertDescription className="text-red-200">
                          {warning}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}

              {/* Predicted Dangers */}
              {memoryAnalysis?.predictedDangers?.length > 0 && (
                <div className="bg-orange-900/50 rounded p-3">
                  <p className="text-sm font-medium mb-2 text-orange-300">🔮 סכנות צפויות:</p>
                  <div className="space-y-1 text-xs">
                    {memoryAnalysis.predictedDangers.map((danger: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2">
                        <AlertTriangle className="w-3 h-3 text-orange-400 mt-0.5" />
                        <span className="text-orange-200">{danger}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* People Tracking Updates */}
              {memoryAnalysis?.trackingUpdates?.peopleCount && (
                <div className="bg-blue-900/50 rounded p-3">
                  <p className="text-sm font-medium mb-2 text-blue-300">👥 עדכוני מעקב:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span>סה"כ במעקב:</span>
                      <span className="font-bold">{memoryAnalysis.trackingUpdates.peopleCount.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>זוהו לאחרונה:</span>
                      <span className="font-bold text-green-400">+{memoryAnalysis.trackingUpdates.peopleCount.newlyDetected}</span>
                    </div>
                    {memoryAnalysis.trackingUpdates.peopleCount.missing > 0 && (
                      <div className="flex justify-between col-span-2">
                        <span className="text-red-300">נעדרים מהפריים:</span>
                        <span className="font-bold text-red-400">{memoryAnalysis.trackingUpdates.peopleCount.missing}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* New Threats and Missing People Alerts */}
        {(newThreats.length > 0 || missingPeople.length > 0) && (
          <Card className="bg-red-900 border-red-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
                התראות מיוחדות
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {newThreats.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 text-red-300">🆕 איומים חדשים:</p>
                  <div className="space-y-1">
                    {newThreats.map((threat, idx) => (
                      <Alert key={idx} className="bg-red-800 border-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-red-200">
                          {threat}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}
              
              {missingPeople.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 text-orange-300">🔍 אנשים שנעלמו:</p>
                  <div className="space-y-1">
                    {missingPeople.map((person, idx) => (
                      <Alert key={idx} className="bg-orange-800 border-orange-600">
                        <Users className="h-4 w-4" />
                        <AlertDescription className="text-orange-200">
                          {person}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}
