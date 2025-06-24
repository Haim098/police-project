"use client"

import { useState, useEffect } from "react"
import {
  AlertTriangle,
  Users,
  MapPin,
  Video,
  MessageSquare,
  Shield,
  Flame,
  Zap,
  Building,
  Eye,
  Clock,
  Signal,
  Settings,
  Bell,
  Activity,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { supabase, Unit, Detection } from "@/lib/supabase"
import websocketService from "@/lib/websocket"
import { Badge } from "@/components/ui/badge"
import MapView from '@/components/map-view'

export default function ControlCenter() {
  const [activeUnits, setActiveUnits] = useState<Unit[]>([])
  const [detections, setDetections] = useState<Detection[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [soundAlerts, setSoundAlerts] = useState(true)
  const [message, setMessage] = useState("")
  const [wsConnected, setWsConnected] = useState(false)
  const [selectedMapTab, setSelectedMapTab] = useState<string>('all')

  // Load units from Supabase and setup WebSocket
  useEffect(() => {
    loadUnits()
    loadDetections()
    setupWebSocket()
    
    // Clean up inactive units every 2 minutes
    const cleanupInterval = setInterval(cleanupInactiveUnits, 2 * 60 * 1000)
    
    // Initial cleanup after 10 seconds
    const initialCleanup = setTimeout(cleanupInactiveUnits, 10000)
    
    // Subscribe to real-time updates
    const unitsSubscription = supabase
      .channel('units')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, (payload) => {
        console.log('🔄 Units table change detected:', payload)
        loadUnits()
      })
      .subscribe()

    const detectionsSubscription = supabase
      .channel('detections')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'detections' }, (payload) => {
        console.log('🔍 Detections table change detected:', payload)
        loadDetections()
        
        // Play alert sound for new critical detections
        if (payload.eventType === 'INSERT' && payload.new?.severity === 'critical' && soundAlerts) {
          playAlertSound()
        }
      })
      .subscribe()

    const eventsSubscription = supabase
      .channel('events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (payload) => {
        console.log('📨 New event detected:', payload)
        
        // Handle messages from field units
        if (payload.new?.type === 'message_to_control') {
          const eventData = payload.new.data as any
          alert(`הודעה מיחידה ${eventData?.unit_name || 'לא ידוע'}: ${eventData?.message}`)
        }
        
        // Handle emergency alerts
        if (payload.new?.type === 'emergency_alert') {
          const eventData = payload.new.data as any
          alert(`🚨 התראת חירום: ${eventData?.message}`)
          if (soundAlerts) {
            playAlertSound()
          }
        }
      })
      .subscribe()

    return () => {
      unitsSubscription.unsubscribe()
      detectionsSubscription.unsubscribe()
      eventsSubscription.unsubscribe()
      websocketService.disconnect()
      clearInterval(cleanupInterval)
      clearTimeout(initialCleanup)
    }
  }, [])

  const setupWebSocket = async () => {
    try {
      websocketService.connect('http://localhost:3001')
      await websocketService.registerControlCenter('control-operator-1')
      setWsConnected(true)

      // Listen for real-time unit updates
      websocketService.onMessage('unit_status_changed', (data) => {
        console.log('Unit status changed:', data)
        loadUnits() // Reload units when status changes
      })

      // Listen for new detections
      websocketService.onMessage('new_detection', (data) => {
        console.log('New detection:', data)
        loadDetections()
        
        // Play sound alert if enabled
        if (soundAlerts && data.detection?.severity === 'critical') {
          playAlertSound()
        }
      })

      // Listen for urgent alerts
      websocketService.onMessage('urgent_alert', (data) => {
        console.log('🚨 Urgent alert received:', data)
        alert(`התראה דחופה: ${data.message}`)
        if (soundAlerts) {
          playAlertSound()
        }
        
        // Reload detections to show the new urgent detection
        loadDetections()
      })

      // Listen for location updates from units
      websocketService.onMessage('location_update', (data) => {
        console.log('📍 Location update received:', data)
        // Update unit location in real-time
        setActiveUnits(prev => prev.map(unit => 
          unit.id === data.unitId 
            ? { ...unit, lat: data.lat, lng: data.lng, last_update: data.timestamp }
            : unit
        ))
      })

      // Listen for live detection alerts from AI analysis
      websocketService.onMessage('live_detection_alert', (data) => {
        console.log('🤖 Live detection alert received:', data)
        
        // Show notification for significant live detections
        if (data.detection && (data.detection.severity === 'critical' || data.detection.severity === 'high')) {
          alert(`זיהוי חי: ${data.detection.description}`)
          if (soundAlerts) {
            playAlertSound()
          }
        }
        
        // Reload detections to show any new ones that might have been saved
        loadDetections()
      })

      // Listen for detection creation notifications
      websocketService.onMessage('detection_created', (data) => {
        console.log('📡 Detection created notification received:', data)
        
        // Reload detections to show the new detection
        loadDetections()
        
        // Show alert for critical detections
        if (data.severity === 'critical' && soundAlerts) {
          playAlertSound()
        }
      })

      // Listen for messages from field units
      websocketService.onMessage('unit_message_received', (data) => {
        console.log('💬 Message from field unit:', data)
        alert(`הודעה מ${data.unitName || 'יחידה'}: ${data.message}`)
      })

      // Listen for advanced AI detection alerts
      websocketService.onMessage('advanced_detection_alert', (data) => {
        console.log('🤖 Advanced AI detection alert:', data)
        
        // Play alert sound for critical detections
        if (soundAlerts && data.summary.overallRisk === 'critical') {
          playAlertSound()
        }
        
        // Show notification
        const criticalCount = data.criticalDetections.length
        const hazardTypes = [...new Set(data.criticalDetections.map((d: any) => d.type))].join(', ')
        
        alert(`🚨 התראת AI מתקדמת מ${data.unitName || data.unitId}:\n` +
              `רמת סיכון: ${data.summary.overallRisk === 'critical' ? 'קריטית' : 
                            data.summary.overallRisk === 'high' ? 'גבוהה' : 'בינונית'}\n` +
              `${criticalCount} איומים זוהו: ${hazardTypes}\n` +
              `אנשים בסכנה: ${data.summary.people.total} (${data.summary.people.injured} פצועים)\n` +
              `פעולות מומלצות: ${data.quickActions.join(', ')}`)
        
        // Reload detections to show new data
        loadDetections()
        loadUnits()
      })

    } catch (error) {
      console.error('WebSocket setup failed:', error)
      setWsConnected(false)
    }
  }

  const playAlertSound = () => {
    // Simple beep sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 1000
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  }

  const loadUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('status', 'active')  // Only load active units
        .order('last_update', { ascending: false })

      if (error) throw error
      
      // Convert lat/lng to numbers if they come as strings
      const processedUnits = (data || []).map(unit => ({
        ...unit,
        lat: typeof unit.lat === 'string' ? parseFloat(unit.lat) : unit.lat,
        lng: typeof unit.lng === 'string' ? parseFloat(unit.lng) : unit.lng
      }))
      
      setActiveUnits(processedUnits)
      console.log(`📊 Loaded ${processedUnits.length} active units`)
      console.log('📍 Units with locations:', processedUnits.filter(u => u.lat && u.lng).map(u => ({
        name: u.name,
        lat: u.lat,
        lng: u.lng,
        latType: typeof u.lat,
        lngType: typeof u.lng
      })))
    } catch (error) {
      console.error('Error loading units:', error)
    } finally {
      setLoading(false)
    }
  }

  const cleanupInactiveUnits = async () => {
    try {
      // Mark units as inactive if they haven't been updated in the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      
      const { data, error } = await supabase
        .from('units')
        .update({ status: 'inactive' })
        .eq('status', 'active')
        .lt('last_update', fiveMinutesAgo)
        .select()

      if (error) throw error
      
      if (data && data.length > 0) {
        console.log(`🧹 Marked ${data.length} inactive units:`, data.map(u => u.name))
        alert(`נוקו ${data.length} יחידות לא פעילות`)
        // Reload units after cleanup
        loadUnits()
      } else {
        console.log('🧹 No inactive units found to clean up')
        alert('אין יחידות לא פעילות לניקוי')
      }
    } catch (error) {
      console.error('Error cleaning up inactive units:', error)
      alert('שגיאה בניקוי יחידות לא פעילות')
    }
  }

  const loadDetections = async () => {
    try {
      const { data, error } = await supabase
        .from('detections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setDetections(data || [])
    } catch (error) {
      console.error('Error loading detections:', error)
    }
  }

  const getDetectionIcon = (type: string) => {
    switch (type) {
      case "fire":
        return <Flame className="w-5 h-5 text-red-500" />;
      case "smoke":
        return <Eye className="w-5 h-5 text-gray-500" />;
      case "person":
        return <Users className="w-5 h-5 text-blue-500" />;
      case "structural_damage":
        return <Building className="w-5 h-5 text-orange-500" />;
      case "electrical_hazard":
        return <Zap className="w-5 h-5 text-yellow-500" />;
      case "vehicle":
        return <AlertTriangle className="w-5 h-5 text-indigo-500" />; // Or a car icon if available
      default:
        return <Shield className="w-5 h-5 text-gray-400" />;
    }
  };

  const getDetectionText = (detection: Detection) => {
    switch (detection.type) {
      case "fire":
        return "זיהוי שריפה פעילה";
      case "smoke":
        return "זיהוי עשן";
      case "person":
        return "זיהוי אדם באזור סכנה";
      case "structural_damage":
        return "נזק מבני זוהה";
      case "electrical_hazard":
        return "זוהתה סכנה חשמלית";
      case "vehicle":
        return "זוהה רכב חשוד/בוער";
      case "none":
        return "אין זיהויים מיוחדים";
      default:
        return `זיהוי מסוג: ${detection.type}`;
    }
  };

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500"
      case "emergency":
        return "bg-red-500"
      case "inactive":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500"
      case "high":
        return "bg-orange-500"
      case "medium":
        return "bg-yellow-500"
      case "low":
        return "bg-blue-500"
      default:
        return "bg-gray-500"
    }
  }

  const acknowledgeDetection = async (detectionId: number) => {
    try {
      const { error } = await supabase
        .from('detections')
        .update({ acknowledged: true })
        .eq('id', detectionId)

      if (error) throw error
      loadDetections() // Refresh the list
    } catch (error) {
      console.error('Error acknowledging detection:', error)
    }
  }

  const sendMessage = async () => {
    if (!message.trim()) return
    
    try {
      const targetUnits = selectedUnits.length > 0 ? selectedUnits : activeUnits.map(u => u.id)
      
      // Send via WebSocket for real-time delivery
      if (wsConnected) {
        for (const unitId of targetUnits) {
          console.log(`📤 Sending command to unit ${unitId}:`, message)
          websocketService.sendMessage('send_command', {
            unitId,
            command: 'message',
            message: message
          })
        }
      }
      
      // Also save to database
      for (const unitId of targetUnits) {
        await supabase
          .from('events')
          .insert({
            unit_id: unitId,
            type: 'alert',
            data: {
              message: message,
              from: 'control_center',
              priority: 'normal'
            }
          })
      }
      
      setMessage("")
      alert(`הודעה נשלחה ל-${targetUnits.length} יחידות ${wsConnected ? '(בזמן אמת)' : '(נשמר במסד הנתונים)'}`)
    } catch (error) {
      console.error('Error sending message:', error)
      alert('שגיאה בשליחת ההודעה')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl" suppressHydrationWarning>
        <div className="text-center" suppressHydrationWarning>
          <Eye className="w-12 h-12 text-red-600 animate-spin mx-auto mb-4" />
          <p className="text-lg">טוען נתונים...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl" suppressHydrationWarning>
      <div className="max-w-[1920px] mx-auto space-y-6" suppressHydrationWarning>
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-red-600 p-3 rounded-lg">
                <Eye className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">RescuerLens - מרכז שליטה</h1>
                <p className="text-gray-600">ניהול וקואורדינציה של כוחות חירום</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {activeUnits.filter((u) => u.status === "active").length}
                </div>
                <div className="text-sm text-gray-600">יחידות פעילות</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {detections.filter((d) => !d.acknowledged && d.severity === "critical").length}
                </div>
                <div className="text-sm text-gray-600">התראות קריטיות</div>
              </div>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                <Switch checked={soundAlerts} onCheckedChange={setSoundAlerts} />
                <span className="text-sm">התראות קוליות</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className={wsConnected ? 'text-green-600' : 'text-red-600'}>
                  {wsConnected ? 'מחובר לשרת' : 'לא מחובר'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={cleanupInactiveUnits}
                className="text-xs"
              >
                🧹 נקה יחידות
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Map View */}
          <div className="lg:col-span-2">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  מפת יחידות
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 flex flex-col min-h-0">
                {activeUnits.length > 0 ? (
                  <div className="flex flex-col h-full">
                    {/* Tabs Header */}
                    <div className="px-4 pt-4 pb-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 flex-shrink-0">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                            selectedMapTab === 'all' 
                              ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-300' 
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 shadow-sm'
                          }`}
                          onClick={() => setSelectedMapTab('all')}
                        >
                          <span className="flex items-center gap-2">
                            🗺️ כל היחידות ({activeUnits.length})
                            {selectedMapTab === 'all' && (
                              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                            )}
                          </span>
                        </button>
                        {activeUnits.map((unit) => (
                          <button
                            key={unit.id}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                              selectedMapTab === unit.id 
                                ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-300' 
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 shadow-sm'
                            }`}
                            onClick={() => setSelectedMapTab(unit.id)}
                          >
                            <span className="flex items-center gap-2">
                              {unit.type === 'police' && '👮'}
                              {unit.type === 'fire' && '🚒'}
                              {unit.type === 'medical' && '🚑'}
                              {unit.type === 'civil_defense' && '🛡️'}
                              {unit.name}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                  
                    {/* Map Content */}
                    <div className="flex-1 min-h-0 relative">
                      {/* Selected Tab Indicator */}
                      <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg shadow-md border">
                        <span className="text-xs font-medium text-gray-700">
                          {selectedMapTab === 'all' 
                            ? `מציג כל היחידות (${activeUnits.length})` 
                            : `מציג יחידה: ${activeUnits.find(u => u.id === selectedMapTab)?.name}`
                          }
                        </span>
                      </div>
                      
                      <MapView 
                        units={selectedMapTab === 'all' ? activeUnits : activeUnits.filter(u => u.id === selectedMapTab)} 
                        selectedUnitId={selectedUnits[0]}
                        onUnitClick={(unitId) => {
                          setSelectedUnits(prev => 
                            prev.includes(unitId) 
                              ? prev.filter(id => id !== unitId)
                              : [...prev, unitId]
                          )
                        }}
                        height="100%"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>אין יחידות פעילות כרגע</p>
                    </div>
                </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Units List */}
          <div className="lg:col-span-1">
            <Card className="h-[600px]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  יחידות פעילות ({activeUnits.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[520px] p-4">
                  <div className="space-y-3">
                    {activeUnits.map((unit) => (
                      <Card
                        key={unit.id}
                        className={`p-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                          selectedUnits.includes(unit.id) ? "ring-2 ring-blue-500" : ""
                        }`}
                        onClick={() => {
                          setSelectedUnits(prev => 
                            prev.includes(unit.id) 
                              ? prev.filter(id => id !== unit.id)
                              : [...prev, unit.id]
                          )
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(unit.status)}`}></div>
                            <div>
                              <div className="font-medium text-sm">{unit.name}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                            {getUnitTypeIcon(unit.type)}
                                {unit.type === 'police' && 'משטרה'}
                                {unit.type === 'fire' && 'כיבוי אש'}
                                {unit.type === 'medical' && 'רפואה'}
                                {unit.type === 'civil_defense' && 'הגנה אזרחית'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500">
                              🔋 {unit.battery_level || 0}%
                            </div>
                            <div className="text-xs text-gray-500">
                              📶 {unit.signal_strength || 0}%
                            </div>
                          </div>
                        </div>
                        {unit.location?.address && (
                          <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {unit.location.address}
                          </div>
                        )}
                      </Card>
                    ))}
                    
                    {activeUnits.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>אין יחידות פעילות כרגע</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Alerts & Detections */}
          <div className="lg:col-span-1">
            <Card className="h-[600px]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  התראות ואיתורים
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[520px] p-4">
                  <div className="space-y-3">
                    {detections.map((detection) => (
                      <div key={detection.id} className={`p-3 rounded-lg flex items-center justify-between border-l-4 ${getSeverityColor(detection.severity)}`}>
                        <div className="flex items-center gap-3">
                          {getDetectionIcon(detection.type)}
                          <div>
                            <p className="font-bold">{getDetectionText(detection)}</p>
                            <p className="text-xs text-gray-500">
                              יחידה {detection.unit_id.substring(0, 3)} | {new Date(detection.created_at).toLocaleTimeString('he-IL')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={detection.severity === 'critical' ? 'destructive' : 'secondary'}>
                            ביטחון {Math.round(detection.confidence * 100)}%
                          </Badge>
                          {!detection.acknowledged && (
                            <Button size="sm" onClick={() => acknowledgeDetection(detection.id)}>
                              אישור
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {detections.length === 0 && (
                      <div className="text-center text-gray-400 py-8">
                        <Bell className="mx-auto w-10 h-10 mb-2" />
                        <p>אין התראות חדשות</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Control Panel */}
        <div className="grid md:grid-cols-3 gap-6">
            <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                בקרת וידאו
                </CardTitle>
              </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => {
                  if (selectedUnits.length === 0) {
                    alert('אנא בחר יחידות לצפייה בזרמי הוידאו שלהן')
                    return
                  }
                  // TODO: Implement multi-stream viewer
                  alert(`פתיחת צפייה ב-${selectedUnits.length} זרמי וידאו...\nפיצ׳ר זה בפיתוח`)
                }}
              >
                צפה בכל הזרמים
              </Button>
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => {
                  // TODO: Implement screen recording
                  alert('הקלטת מסך מרכז השליטה...\nפיצ׳ר זה בפיתוח')
                }}
              >
                הקלט מסך מרכז
              </Button>
              <div className="text-sm text-gray-600 text-center">
                {selectedUnits.length} יחידות נבחרות
                    </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                תקשורת
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input 
                placeholder="הקלד הודעה..." 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <Button className="w-full" onClick={sendMessage}>
                שלח הודעה ({selectedUnits.length > 0 ? selectedUnits.length : activeUnits.length} יחידות)
              </Button>
              <div className="text-xs text-gray-500 text-center">
                {selectedUnits.length > 0 ? 'שליחה ליחידות נבחרות' : 'שליחה לכל היחידות'}
                </div>
              </CardContent>
            </Card>

            <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                הגדרות מהירות
                </CardTitle>
              </CardHeader>
            <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                <span className="text-sm">עדכון אוטומטי</span>
                <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                <span className="text-sm">התראות דחופות</span>
                <Switch checked={soundAlerts} onCheckedChange={setSoundAlerts} />
                    </div>
              <Button className="w-full" variant="outline" size="sm">
                הגדרות מתקדמות
              </Button>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  )
}
