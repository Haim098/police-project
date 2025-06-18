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
  Volume2,
  VolumeX,
  Settings,
  ScanLine,
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
    isRecording: isCameraRecording,
    isPermissionGranted,
    startCamera,
    stopCamera,
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
      setLastAnalysis(result)
      
      // Store detection in database if it's urgent
      if (result.urgent && result.detections.length > 0) {
        const detection = result.detections[0]
        sendDetection(
          detection.type as Detection['type'],
          detection.severity as Detection['severity'],
          detection.confidence
        )
      }
    },
    onStatusChange: (status) => {
      console.log('🎯 Live Analysis status:', status)
    }
  })
  
  const [detections, setDetections] = useState<Detection[]>([])
  const [instructions, setInstructions] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [wsConnected, setWsConnected] = useState(false)

  useEffect(() => {
    loadDetections()
    loadInstructions()
    setupWebSocket()
    
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

      alert(`זיהוי ${type} נשלח למרכז השליטה`)
    } catch (error) {
      console.error('Error sending detection:', error)
      alert('שגיאה בשליחת הזיהוי')
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

    if (!isCameraOn) {
      console.log('❌ Camera not on')
      alert('אנא הפעל את המצלמה לפני ניתוח AI')
      return
    }

    try {
      console.log('📸 Capturing frame for AI analysis...')
      
      // Capture current frame from video
      const frameData = captureFrame()
      if (!frameData) {
        console.log('❌ Failed to capture frame')
        alert('שגיאה בלכידת תמונה מהמצלמה')
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
        
        // Auto-send detection to database
        await sendDetection(detection.type, detection.severity, detection.confidence)
        
        alert(`AI זיהה: ${detection.description}\nרמת ביטחון: ${Math.round(detection.confidence * 100)}%`)
      } else {
        console.log('✅ No detections found')
        alert('AI לא זיהה איומים באזור')
      }
    } catch (error) {
      console.error('🚨 AI Analysis failed:', error)
      alert('שגיאה בניתוח AI')
    }
  }

  const emergencyCall = () => {
    updateUnitStatus('emergency')
    alert("התראת חירום נשלחה למרכז השליטה!")
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
      if (!isCameraOn) {
        alert('אנא הפעל את המצלמה לפני הפעלת ניתוח AI')
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

  // Auto-send detections from live analysis to database
  useEffect(() => {
    if (lastAnalysis && lastAnalysis.detections.length > 0) {
      const detection = lastAnalysis.detections[0]
      console.log('🤖 Auto-sending live detection:', detection)
      
      // Send detection to database
      sendDetection(detection.type as Detection['type'], detection.severity, detection.confidence)
      
      // Show alert to user
      const alertMessage = `AI זיהה: ${detection.description}\n${detection.action_required}\nרמת ביטחון: ${Math.round(detection.confidence * 100)}%`
      
      if (detection.severity === 'critical') {
        alert('🚨 התראה דחופה! ' + alertMessage)
      } else {
        alert('⚠️ זיהוי AI: ' + alertMessage)
      }
    }
  }, [lastAnalysis])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4" dir="rtl" suppressHydrationWarning>
      <div className="max-w-md mx-auto space-y-4" suppressHydrationWarning>
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
                className={`w-full h-full object-cover rounded-lg ${isCameraOn ? 'block' : 'hidden'}`}
              />
              
              {/* Camera off overlay */}
              {!isCameraOn && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-white text-center p-4">
                    <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">{isPermissionGranted ? 'מצלמה כבויה' : 'יש צורך בהרשאה למצלמה'}</p>
                    <p className="text-sm opacity-75 mb-4">
                      {isPermissionGranted ? 'לחץ כדי להפעיל' : 'אנא אפשר גישה למצלמה'}
                    </p>
                    <Button 
                      onClick={startCamera} 
                      className="mt-2 bg-blue-600 hover:bg-blue-700"
                    >
                      <Video className="w-4 h-4 mr-2" />
                      הפעל מצלמה
                    </Button>
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
            onClick={isCameraOn ? stopCamera : startCamera}
            className="h-12"
          >
            {isCameraOn ? <Camera className="w-4 h-4 mr-1" /> : <Video className="w-4 h-4 mr-1" />}
            {isCameraOn ? "כבה מצלמה" : "הפעל מצלמה"}
          </Button>
          
          <Button
            variant={isCameraRecording ? "destructive" : "default"}
            onClick={toggleRecording}
            className="h-12"
            disabled={!isCameraOn}
          >
            {isCameraRecording ? <VideoOff className="w-4 h-4 mr-1" /> : <Video className="w-4 h-4 mr-1" />}
            {isCameraRecording ? "עצור הקלטה" : "התחל הקלטה"}
          </Button>

          <Button
            variant={isMicOn ? "default" : "outline"}
            onClick={() => setIsMicOn(!isMicOn)}
            className="h-12"
          >
            {isMicOn ? <Mic className="w-4 h-4 mr-1" /> : <MicOff className="w-4 h-4 mr-1" />}
            {isMicOn ? "מיק פעיל" : "מיק כבוי"}
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
            onClick={() => alert("מתקשר למרכז השליטה...")}
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
              disabled={!isCameraOn}
            >
              <ScanLine className={`w-5 h-5 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
              {!isCameraOn ? 'הפעל מצלמה לניתוח' :
               isAnalyzing ? 'עצור ניתוח חי' : 'התחל ניתוח חי'}
            </Button>
            
            {/* Manual Analysis Button */}
            <Button
              onClick={analyzeFrame}
              variant="outline"
              className="w-full h-12"
              disabled={!wsConnected || !isCameraOn}
            >
              <ScanLine className="w-5 h-5 mr-2" />
              {!wsConnected ? 'לא מחובר לשרת' : 
               !isCameraOn ? 'הפעל מצלמה לניתוח' : 
               'נתח מסגרת נוכחית'}
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

            {/* Last Analysis Display */}
            {lastAnalysis && (
              <div className="bg-gray-700 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">ניתוח אחרון</span>
                  <span className="text-xs text-gray-400">
                    {new Date(lastAnalysis.timestamp).toLocaleTimeString('he-IL')}
                  </span>
                </div>
                
                {lastAnalysis.detections.length > 0 ? (
                  <div className="space-y-2">
                    {lastAnalysis.detections.map((detection: any, index: number) => (
                      <div key={index} className={`p-2 rounded border ${getSeverityColor(detection.severity)}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {getDetectionIcon(detection.type)}
                          <span className="text-sm font-medium">{detection.description}</span>
                          <Badge variant="outline" className="text-xs">
                            {Math.round(detection.confidence * 100)}%
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600">{detection.action_required}</p>
                        {detection.location && (
                          <p className="text-xs text-gray-500">מיקום: {detection.location}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">לא זוהו איומים</p>
                )}

                {lastAnalysis.instructions.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-sm font-medium">הנחיות:</span>
                    {lastAnalysis.instructions.map((instruction: string, index: number) => (
                      <p key={index} className="text-xs text-gray-300">• {instruction}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Detection Buttons */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="w-5 h-5" />
              דיווח מהיר
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => sendDetection('fire', 'critical', 0.95)}
                className="justify-start text-red-400 border-red-400"
              >
                <Flame className="w-4 h-4 mr-2" />
                שריפה
              </Button>
              
              <Button
                variant="outline"
                onClick={() => sendDetection('person', 'high', 0.85)}
                className="justify-start text-blue-400 border-blue-400"
              >
                <Users className="w-4 h-4 mr-2" />
                נפגעים
              </Button>
              
              <Button
                variant="outline"
                onClick={() => sendDetection('smoke', 'medium', 0.80)}
                className="justify-start text-gray-400 border-gray-400"
              >
                <Eye className="w-4 h-4 mr-2" />
                עשן
              </Button>
              
              <Button
                variant="outline"
                onClick={() => sendDetection('structural_damage', 'high', 0.75)}
                className="justify-start text-orange-400 border-orange-400"
              >
                <Building className="w-4 h-4 mr-2" />
                נזק מבני
              </Button>
            </div>
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

        {/* Settings */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="w-5 h-5" />
            הגדרות
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">שמע</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAudioOn(!isAudioOn)}
              >
                {isAudioOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
        </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">רמת סוללה</span>
              <span className="text-sm">{batteryLevel}%</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">עוצמת אות</span>
              <span className="text-sm">{signalStrength}/4</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
