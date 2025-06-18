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

export default function ControlCenter() {
  const [activeUnits, setActiveUnits] = useState<Unit[]>([])
  const [detections, setDetections] = useState<Detection[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [soundAlerts, setSoundAlerts] = useState(true)
  const [message, setMessage] = useState("")
  const [wsConnected, setWsConnected] = useState(false)

  // Load units from Supabase and setup WebSocket
  useEffect(() => {
    loadUnits()
    loadDetections()
    setupWebSocket()
    
    // Subscribe to real-time updates
    const unitsSubscription = supabase
      .channel('units')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, () => {
        loadUnits()
      })
      .subscribe()

    const detectionsSubscription = supabase
      .channel('detections')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'detections' }, () => {
        loadDetections()
      })
      .subscribe()

    return () => {
      unitsSubscription.unsubscribe()
      detectionsSubscription.unsubscribe()
      websocketService.disconnect()
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
        console.log('Urgent alert:', data)
        alert(`התראה דחופה: ${data.message}`)
        if (soundAlerts) {
          playAlertSound()
        }
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
        .order('created_at', { ascending: false })

      if (error) throw error
      setActiveUnits(data || [])
    } catch (error) {
      console.error('Error loading units:', error)
    } finally {
      setLoading(false)
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

  const acknowledgeDetection = async (detectionId: string) => {
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
      alert(`הודעה נשלחה ל-${targetUnits.length} יחידות ${wsConnected ? '(בזמן אמת)' : '(לא מחובר לשרת)'}`)
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
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Map View */}
          <div className="lg:col-span-2">
            <Card className="h-[600px]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  מפת יחידות
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-gray-100 h-full rounded-b-lg relative overflow-hidden">
                  {/* Placeholder for MapBox component */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <MapPin className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">מפה תעלה בקרוב</p>
                      <p className="text-sm">יוצג כאן מיקום יחידות בזמן אמת</p>
                    </div>
                  </div>
                  
                  {/* Unit markers overlay */}
                  {activeUnits.map((unit, index) => (
                    <div
                      key={unit.id}
                      className="absolute bg-white rounded-full p-2 shadow-lg border-2 cursor-pointer hover:scale-110 transition-transform"
                      style={{
                        left: `${20 + index * 15}%`,
                        top: `${30 + index * 10}%`,
                        borderColor: unit.status === 'active' ? '#10b981' : '#6b7280'
                      }}
                    >
                      <div className="flex items-center justify-center">
                        {getUnitTypeIcon(unit.type)}
                      </div>
                    </div>
                  ))}
                </div>
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
                      <Alert
                        key={detection.id}
                        className={`border-l-4 ${
                          detection.acknowledged ? "opacity-60" : ""
                        } ${
                          detection.severity === "critical" ? "border-red-500" :
                          detection.severity === "high" ? "border-orange-500" :
                          detection.severity === "medium" ? "border-yellow-500" :
                          "border-blue-500"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-2 h-2 rounded-full ${getSeverityColor(detection.severity)}`}></div>
                              <span className="text-xs font-medium uppercase">
                                {detection.type === 'fire' && 'שריפה'}
                                {detection.type === 'smoke' && 'עשן'}
                                {detection.type === 'person' && 'אדם'}
                                {detection.type === 'child' && 'ילד'}
                                {detection.type === 'gas_tank' && 'מיכל גז'}
                                {detection.type === 'wire' && 'חוט חשמל'}
                                {detection.type === 'structural_damage' && 'נזק מבני'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {Math.round(detection.confidence * 100)}% ביטחון
                              </span>
                            </div>
                            <AlertDescription className="text-sm">
                              זוהה {detection.type === 'fire' && 'אש פעילה'}
                              {detection.type === 'smoke' && 'עשן כבד'}
                              {detection.type === 'person' && 'אדם'}
                              {detection.type === 'child' && 'ילד'}
                              {detection.type === 'gas_tank' && 'מיכל גז'}
                              {detection.type === 'wire' && 'חוט חשמל חשוף'}
                              {detection.type === 'structural_damage' && 'נזק מבני'}
                            </AlertDescription>
                            <div className="text-xs text-gray-400 mt-1">
                              {new Date(detection.created_at || '').toLocaleTimeString('he-IL')}
                            </div>
                          </div>
                          {!detection.acknowledged && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => acknowledgeDetection(detection.id)}
                            >
                              אישור
                            </Button>
                          )}
                        </div>
                      </Alert>
                    ))}
                    
                    {detections.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>אין זיהויים חדשים</p>
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
              <Button className="w-full" variant="outline">
                צפה בכל הזרמים
              </Button>
              <Button className="w-full" variant="outline">
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
