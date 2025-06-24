'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Users, 
  Flame, 
  AlertTriangle, 
  Building,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Statistics {
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

interface MemoryAnalysis {
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

interface SituationSummaryProps {
  statistics?: Statistics
  memoryAnalysis?: MemoryAnalysis
  sessionStats?: any
  hazardTrend?: 'improving' | 'stable' | 'deteriorating'
  className?: string
}

export const SituationSummary: React.FC<SituationSummaryProps> = ({
  statistics,
  memoryAnalysis,
  sessionStats,
  hazardTrend = 'stable',
  className
}) => {
  const criticalMetrics = useMemo(() => {
    if (!statistics) return []
    
    const metrics = []
    
    // People metrics
    if (statistics.people.trapped > 0) {
      metrics.push({
        label: 'לכודים',
        value: statistics.people.trapped,
        icon: Users,
        color: 'text-red-500',
        priority: 1
      })
    }
    
    if (statistics.people.injured > 0) {
      metrics.push({
        label: 'פצועים',
        value: statistics.people.injured,
        icon: Users,
        color: 'text-orange-500',
        priority: 2
      })
    }
    
    if (statistics.people.children > 0) {
      metrics.push({
        label: 'ילדים',
        value: statistics.people.children,
        icon: Users,
        color: 'text-yellow-500',
        priority: 3
      })
    }
    
    // Hazard metrics
    if (statistics.hazards.fires > 0) {
      metrics.push({
        label: 'שריפות',
        value: statistics.hazards.fires,
        icon: Flame,
        color: 'text-red-500',
        priority: 1
      })
    }
    
    if (statistics.hazards.gasLeaks > 0) {
      metrics.push({
        label: 'דליפות גז',
        value: statistics.hazards.gasLeaks,
        icon: AlertTriangle,
        color: 'text-orange-500',
        priority: 2
      })
    }
    
    return metrics.sort((a, b) => a.priority - b.priority)
  }, [statistics])

  const getTrendIcon = () => {
    switch (hazardTrend) {
      case 'improving':
        return <TrendingDown className="w-4 h-4 text-green-500" />
      case 'deteriorating':
        return <TrendingUp className="w-4 h-4 text-red-500" />
      default:
        return <Activity className="w-4 h-4 text-yellow-500" />
    }
  }

  const getTrendText = () => {
    switch (hazardTrend) {
      case 'improving':
        return 'משתפר'
      case 'deteriorating':
        return 'מחמיר'
      default:
        return 'יציב'
    }
  }

  if (!statistics && !memoryAnalysis && !sessionStats) {
    return null
  }

  return (
    <Card className={cn('bg-gray-800 border-gray-700', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            סיכום מצב
          </span>
          {sessionStats?.duration && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" />
              <span>{sessionStats.duration} שניות</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Critical Metrics Grid */}
        {criticalMetrics.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {criticalMetrics.map((metric, idx) => (
              <div
                key={idx}
                className="bg-gray-900 rounded-lg p-3 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">{metric.label}</span>
                  <metric.icon className={cn('w-4 h-4', metric.color)} />
                </div>
                <div className="text-2xl font-bold">
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Overall Status */}
        {statistics && (
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">מצב כללי</span>
              <div className="flex items-center gap-2">
                {getTrendIcon()}
                <Badge 
                  variant="outline" 
                  className={cn(
                    'text-xs',
                    hazardTrend === 'improving' ? 'border-green-500 text-green-400' :
                    hazardTrend === 'deteriorating' ? 'border-red-500 text-red-400' :
                    'border-yellow-500 text-yellow-400'
                  )}
                >
                  {getTrendText()}
                </Badge>
              </div>
            </div>
            
            {/* People Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">סה"כ אנשים:</span>
                <span className="font-bold">{statistics.people.total}</span>
              </div>
              
              {/* Danger Progress */}
              {statistics.hazards.fires + statistics.hazards.gasLeaks > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">רמת סכנה:</span>
                    <span className="text-red-400">
                      {statistics.hazards.fires + statistics.hazards.gasLeaks} מפגעים פעילים
                    </span>
                  </div>
                  <Progress 
                    value={Math.min((statistics.hazards.fires + statistics.hazards.gasLeaks) * 25, 100)} 
                    className="h-2"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Time-Based Warnings */}
        {memoryAnalysis?.timeBasedWarnings && memoryAnalysis.timeBasedWarnings.length > 0 && (
          <Alert className="bg-red-900 border-red-700">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="space-y-1">
              {memoryAnalysis.timeBasedWarnings.map((warning, idx) => (
                <div key={idx} className="text-sm text-red-200">
                  • {warning}
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {/* Tracking Updates */}
        {memoryAnalysis?.trackingUpdates?.peopleCount && (
          <div className="bg-blue-900/50 rounded-lg p-3 border border-blue-700">
            <div className="text-sm font-medium mb-2 text-blue-300">עדכוני מעקב:</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {memoryAnalysis.trackingUpdates.peopleCount.total}
                </div>
                <div className="text-gray-400">במעקב</div>
              </div>
              {memoryAnalysis.trackingUpdates.peopleCount.newlyDetected > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    +{memoryAnalysis.trackingUpdates.peopleCount.newlyDetected}
                  </div>
                  <div className="text-gray-400">חדשים</div>
                </div>
              )}
              {memoryAnalysis.trackingUpdates.peopleCount.missing > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">
                    -{memoryAnalysis.trackingUpdates.peopleCount.missing}
                  </div>
                  <div className="text-gray-400">נעדרים</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Session Statistics */}
        {sessionStats && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {sessionStats.totalPeople > 0 && (
              <div className="bg-gray-900 rounded p-2">
                <span className="text-gray-400">אנשים שזוהו:</span>
                <span className="font-bold ml-1">{sessionStats.totalPeople}</span>
              </div>
            )}
            {sessionStats.activeHazards > 0 && (
              <div className="bg-gray-900 rounded p-2">
                <span className="text-gray-400">סכנות:</span>
                <span className="font-bold ml-1 text-orange-400">{sessionStats.activeHazards}</span>
              </div>
            )}
            {sessionStats.criticalEvents > 0 && (
              <div className="bg-gray-900 rounded p-2 col-span-2">
                <span className="text-gray-400">אירועים קריטיים:</span>
                <span className="font-bold ml-1 text-red-400">{sessionStats.criticalEvents}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default SituationSummary 