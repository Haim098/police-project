"use client"

import { useState, useEffect } from "react"
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

  ScanLine,
  ScreenShare,
  ScreenShareOff,
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
  const [currentLocation, setCurrentLocation] = useState("רחוב דיזנגוף 50, תל אביב")
  const [unitId, setUnitId] = useState("6686c4a6-4296-4dcc-ad6d-6df415b925f6") // יחידה 001
  const [lastAnalysis, setLastAnalysis] = useState<any>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [isMockMode, setIsMockMode] = useState(false)
  const [activeDetections, setActiveDetections] = useState<any[]>([])

  // Live AI Analysis hook
  const {
    isConnected: aiConnected,
    isAnalyzing,
    startLiveAnalysis,
    stopLiveAnalysis,
    sendFrame
  } = useLiveAnalysis({
    unitId,
    onAnalysisResult: (result) => {
      console.log('🔍 AI Analysis result:', result)
      const analysisData = result.analysis || result;
      setLastAnalysis(analysisData)

      if (analysisData && analysisData.detections) {
        const validDetections = analysisData.detections.filter(d => d.type !== 'none' && d.bounding_box)
        setActiveDetections(validDetections)
      } else {
        setActiveDetections([])
      }
      
      if (result.isMock) {
        setIsMockMode(true)
      }
      
      if (analysisData && analysisData.urgent && analysisData.detections.length > 0) {
        const detection = analysisData.detections[0]
        
        // Ensure detection object is valid before sending
        if (detection && detection.type && detection.severity && typeof detection.confidence === 'number') {
        sendDetection(
          detection.type as Detection['type'],
          detection.severity as Detection['severity'],
          detection.confidence
          );
        } else {
          console.warn('⚠️ Invalid detection object received from AI, not sending to DB:', detection);
        }
      }
    },
    onStatusChange: (status) => {
      console.log('🎯 Live Analysis status:', status)
    },
    onError: (error) => {
      setAiError(error.message)
    }
  })
  
  const [detections, setDetections] = useState<Detection[]>([])
  const [instructions, setInstructions] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [wsConnected, setWsConnected] = useState(false)

  // Helper to check if any video stream is active
  const isStreamActive = isCameraOn || isScreenSharing;

  useEffect(() => {
    loadDetections()
    loadInstructions()
    setupWebSocket()
    
    // Monitor battery level
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
    
    updateConnectionStatus()
    window.addEventListener('online', updateConnectionStatus)
    window.addEventListener('offline', updateConnectionStatus)
    
    // Monitor location
    let watchId: number | undefined
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          // Update with real coordinates
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          setCurrentLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
          
          // Update unit location in database
          updateUnitLocation(lat, lng)
        },
        (error) => {
          console.error('Location error:', error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
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

  const setupWebSocket = async () => {
    try {
      websocketService.connect('http://localhost:3001')
      
      // Wait a bit for connection to establish
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      try {
        await websocketService.registerUnit(unitId)
        setWsConnected(true)
        console.log('✅ WebSocket connected and unit registered')
      } catch (registrationError) {
        console.warn('⚠️ Registration failed, but continuing:', registrationError)
        // Even if registration fails, consider connected if socket is connected
        setWsConnected(websocketService.connected || false)
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

    } catch (error) {
      console.error('WebSocket setup failed:', error)
      setWsConnected(false)
    }
  }

  const loadDetections = async () => {
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

  const sendDetection = async (type: Detection['type'], severity: Detection['severity'], confidence: number) => {
    try {
      const { error } = await supabase
        .from('detections')
        .insert({
          unit_id: unitId,
          type,
          confidence,
          severity,
          acknowledged: false
        })

      if (error) throw error
      
      // Also log as an event
      await supabase
        .from('events')
        .insert({
          unit_id: unitId,
          type: 'detection',
          data: {
            detection_type: type,
            severity,
            confidence,
            location: currentLocation
          }
        })

      // alert(`זיהוי ${type} נשלח למרכז השליטה`)
    } catch (error) {
      console.error('Error sending detection:', error)
      // alert('שגיאה בשליחת הזיהוי')
      setAiError("שגיאה בשליחת זיהוי למרכז הבקרה.")
    }
  }

  const updateUnitStatus = async (status: 'active' | 'emergency' | 'inactive') => {
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
    } catch (error) {
      console.error('Error updating unit status:', error)
    }
  }

  const updateUnitLocation = async (lat: number, lng: number) => {
    try {
      const { error } = await supabase
        .from('units')
        .update({ 
          lat,
          lng,
          last_update: new Date().toISOString()
        })
        .eq('id', unitId)

      if (error) throw error
    } catch (error) {
      console.error('Error updating unit location:', error)
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
      case "person":
        return <Users className="w-5 h-5 text-blue-500" />
      case "smoke":
        return <Eye className="w-5 h-5 text-gray-600" />
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
        await sendDetection(detection.type, detection.severity, detection.confidence)
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
    // alert("התראת חירום נשלחה למרכז השליטה!")
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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4" dir="rtl" suppressHydrationWarning>
      <div className="max-w-md mx-auto space-y-4" suppressHydrationWarning>
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

        {/* Header Status Bar */}
        <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-medium">יחידה 001</span>
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

        {/* Active Detections List */}
        {activeDetections.length > 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                זיהויים פעילים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activeDetections.map((detection, index) => (
                  <div key={index} className={`p-2 rounded border-l-4 ${getSeverityBorderColor(detection.severity)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getDetectionIcon(detection.type)}
                        <span className="font-medium">{detection.description}</span>
                      </div>
                      <Badge variant="outline">{Math.round(detection.confidence * 100)}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
                  message: 'יחידה 001 מבקשת ליצור קשר',
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

      </div>
    </div>
  )
}
