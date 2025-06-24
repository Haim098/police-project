'use client'

import React, { useMemo } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  AlertTriangle, 
  Flame, 
  Users, 
  Zap, 
  Building,
  Eye,
  AlertCircle,
  Car
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Detection {
  type: 'fire' | 'smoke' | 'person' | 'child' | 'gas_tank' | 'wire' | 'structural_damage' | 'voice_alert'
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
  id?: string
  timestamp?: string
}

interface PriorityAlertDisplayProps {
  detections: Detection[]
  className?: string
}

const getDetectionIcon = (type: string) => {
  switch (type) {
    case 'fire':
      return <Flame className="w-5 h-5" />
    case 'smoke':
      return <Eye className="w-5 h-5" />
    case 'person':
      return <Users className="w-5 h-5" />
    case 'child':
      return <Users className="w-5 h-5" />
    case 'gas_tank':
      return <AlertCircle className="w-5 h-5" />
    case 'wire':
      return <Zap className="w-5 h-5" />
    case 'structural_damage':
      return <Building className="w-5 h-5" />
    case 'voice_alert':
      return <AlertTriangle className="w-5 h-5 text-purple-400" />
    default:
      return <AlertTriangle className="w-5 h-5" />
  }
}

const getSeverityStyles = (severity: string, isPrimary: boolean = false, isVoiceAlert: boolean = false) => {
  if (isVoiceAlert) {
    return {
      container: 'border-purple-600 bg-purple-950',
      icon: 'text-purple-500',
      badge: 'bg-purple-600 text-white',
      text: 'text-purple-100',
      animation: isPrimary ? 'animate-pulse' : ''
    }
  }
  
  const baseStyles = {
    critical: {
      container: 'border-red-600 bg-red-950',
      icon: 'text-red-500',
      badge: 'bg-red-600 text-white',
      text: 'text-red-100',
      animation: isPrimary ? 'animate-pulse' : ''
    },
    high: {
      container: 'border-orange-600 bg-orange-950',
      icon: 'text-orange-500',
      badge: 'bg-orange-600 text-white',
      text: 'text-orange-100',
      animation: ''
    },
    medium: {
      container: 'border-yellow-600 bg-yellow-950',
      icon: 'text-yellow-500',
      badge: 'bg-yellow-600 text-white',
      text: 'text-yellow-100',
      animation: ''
    },
    low: {
      container: 'border-blue-600 bg-blue-950',
      icon: 'text-blue-500',
      badge: 'bg-blue-600 text-white',
      text: 'text-blue-100',
      animation: ''
    }
  }
  
  return baseStyles[severity as keyof typeof baseStyles] || baseStyles.low
}

const AlertCard: React.FC<{
  detection: Detection
  isPrimary: boolean
  pulseAnimation: boolean
}> = ({ detection, isPrimary, pulseAnimation }) => {
  const isVoiceAlert = detection.type === 'voice_alert'
  const styles = getSeverityStyles(detection.severity, isPrimary, isVoiceAlert)
  
  return (
    <Alert 
      className={cn(
        'relative overflow-hidden transition-all duration-300',
        styles.container,
        styles.animation,
        isPrimary && 'ring-2 ring-offset-2 ring-offset-gray-900',
        isPrimary && detection.severity === 'critical' && 'ring-red-500',
        isPrimary && detection.severity === 'high' && 'ring-orange-500',
        pulseAnimation && 'animate-pulse'
      )}
    >
      {/* Priority indicator for primary alert */}
      {isPrimary && (
        <div className="absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8">
          <div className={cn(
            'absolute inset-0 rotate-45',
            detection.severity === 'critical' ? 'bg-red-600' : 
            detection.severity === 'high' ? 'bg-orange-600' : 'bg-yellow-600'
          )} />
        </div>
      )}
      
      <div className="flex items-start gap-3">
        <div className={cn('mt-1', styles.icon)}>
          {getDetectionIcon(detection.type)}
        </div>
        
        <div className="flex-1">
          <AlertTitle className={cn('text-lg font-bold mb-1', styles.text)}>
            {detection.description}
          </AlertTitle>
          
          <AlertDescription className={cn('space-y-2', styles.text)}>
            {/* Location */}
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">מיקום:</span>
              <span>{detection.location}</span>
            </div>
            
            {/* Immediate action if critical */}
            {detection.immediateAction && (
              <div className={cn(
                'font-bold text-base p-2 rounded',
                detection.severity === 'critical' ? 'bg-red-800' : 'bg-orange-800'
              )}>
                ⚡ {detection.immediateAction}
              </div>
            )}
            
            {/* Additional details */}
            <div className="flex items-center gap-3 text-xs">
              {!isVoiceAlert && (
                <Badge className={cn(styles.badge, 'text-xs')}>
                  {Math.round(detection.confidence * 100)}% ביטחון
                </Badge>
              )}
              
              {isVoiceAlert && (
                <Badge className={cn(styles.badge, 'text-xs')}>
                  התראה קולית
                </Badge>
              )}
              
              {detection.count && detection.count > 1 && (
                <Badge variant="outline" className="text-xs">
                  {detection.count} פריטים
                </Badge>
              )}
              
              {detection.condition && (
                <Badge variant="outline" className={cn(
                  'text-xs',
                  detection.condition.includes('קריטי') && 'border-red-500 text-red-400'
                )}>
                  {detection.condition}
                </Badge>
              )}
              
              {detection.timestamp && (
                <Badge variant="outline" className="text-xs">
                  {new Date(detection.timestamp).toLocaleTimeString('he-IL')}
                </Badge>
              )}
            </div>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  )
}

export const PriorityAlertDisplay: React.FC<PriorityAlertDisplayProps> = ({ 
  detections, 
  className 
}) => {
  const prioritizedDetections = useMemo(() => {
    const priorityMap: Record<string, number> = { 
      critical: 4, 
      high: 3, 
      medium: 2, 
      low: 1 
    }
    
    return [...detections].sort((a, b) => {
      // First sort by severity
      const severityDiff = priorityMap[b.severity] - priorityMap[a.severity]
      if (severityDiff !== 0) return severityDiff
      
      // Then by confidence
      return b.confidence - a.confidence
    })
  }, [detections])

  if (detections.length === 0) {
    return (
      <Card className={cn('bg-gray-800 border-gray-700', className)}>
        <CardContent className="p-8 text-center">
          <Eye className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400">אין התראות פעילות</p>
          <p className="text-sm text-gray-500 mt-1">המערכת סורקת באופן רציף</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('bg-gray-800 border-gray-700', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            התראות פעילות
          </span>
          <Badge variant="outline" className="text-xs">
            {prioritizedDetections.filter(d => d.severity === 'critical').length} קריטיות
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {prioritizedDetections.map((detection, idx) => (
            <AlertCard 
              key={`${detection.type}-${idx}`}
              detection={detection}
              isPrimary={idx === 0}
              pulseAnimation={detection.severity === 'critical'}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default PriorityAlertDisplay 