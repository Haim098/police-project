'use client'

import React, { useMemo, useCallback, useState } from 'react'
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api'
import { Shield, Flame, Users, Building, MapPin } from 'lucide-react'
import config from '../config'

interface Unit {
  id: string
  name: string
  type: 'police' | 'fire' | 'medical' | 'civil_defense'
  status: 'active' | 'emergency' | 'inactive'
  lat?: number
  lng?: number
  battery_level?: number
  signal_strength?: number
}

interface MapViewProps {
  units: Unit[]
  selectedUnitId?: string
  onUnitClick?: (unitId: string) => void
  height?: string
}

const containerStyle = {
  width: '100%',
  height: '100%'
}

// Default center - Tel Aviv
const defaultCenter = {
  lat: 32.0853,
  lng: 34.7818
}

const getUnitIcon = (type: string, status: string) => {
  const baseUrl = 'https://maps.google.com/mapfiles/ms/icons/'
  
  // Choose color based on status
  const color = status === 'emergency' ? 'red' : status === 'active' ? 'green' : 'grey'
  
  // Choose icon based on type
  let icon = 'police'
  switch (type) {
    case 'fire':
      icon = 'firedept'
      break
    case 'medical':
      icon = 'hospitals'
      break
    case 'civil_defense':
      icon = 'info'
      break
  }
  
  return `${baseUrl}${color}-dot.png`
}

export default function MapView({ units, selectedUnitId, onUnitClick, height = '600px' }: MapViewProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null)

  // Log units for debugging
  console.log('🗺️ MapView received units:', units.map(u => ({
    name: u.name,
    lat: u.lat,
    lng: u.lng,
    latType: typeof u.lat,
    lngType: typeof u.lng,
    hasLocation: !!(u.lat && u.lng)
  })))

  const mapContainerStyle = useMemo(() => ({
    ...containerStyle,
    height
  }), [height])

  const center = useMemo(() => {
    // If units have locations, center on them
    const unitsWithLocation = units.filter(u => u.lat && u.lng)
    console.log(`🗺️ Found ${unitsWithLocation.length} units with location out of ${units.length} total units`)
    
    if (unitsWithLocation.length > 0) {
      const avgLat = unitsWithLocation.reduce((sum, u) => sum + (u.lat || 0), 0) / unitsWithLocation.length
      const avgLng = unitsWithLocation.reduce((sum, u) => sum + (u.lng || 0), 0) / unitsWithLocation.length
      const calculatedCenter = { lat: avgLat, lng: avgLng }
      console.log(`🗺️ Calculated map center:`, calculatedCenter)
      return calculatedCenter
    }
    console.log(`🗺️ No units with location, using default center:`, defaultCenter)
    return defaultCenter
  }, [units])

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
    
    // Fit bounds to show all units
    const bounds = new window.google.maps.LatLngBounds()
    units.forEach(unit => {
      if (unit.lat && unit.lng) {
        bounds.extend({ lat: unit.lat, lng: unit.lng })
      }
    })
    
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds)
    }
  }, [units])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  const handleMarkerClick = (unit: Unit) => {
    setSelectedUnit(unit)
    if (onUnitClick) {
      onUnitClick(unit.id)
    }
  }

  const apiKey = config.googleMaps.apiKey

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium mb-2">מפה לא זמינה</p>
          <p className="text-sm">נדרש Google Maps API Key</p>
        </div>
      </div>
    )
  }

  return (
    <LoadScript googleMapsApiKey={apiKey}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={12}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true,
        }}
      >
        {units.length === 0 ? (
          // No units message overlay
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center p-6 bg-white rounded-lg shadow-lg">
              <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">אין יחידות פעילות</h3>
              <p className="text-gray-600">לא נמצאו יחידות פעילות להצגה במפה</p>
            </div>
          </div>
        ) : units.filter(u => u.lat && u.lng).length === 0 ? (
          // Units exist but no locations message overlay
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center p-6 bg-white rounded-lg shadow-lg">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">אין נתוני מיקום</h3>
              <p className="text-gray-600">יש {units.length} יחידות פעילות אך ללא נתוני מיקום</p>
            </div>
          </div>
        ) : null}
        
        {units.map(unit => {
          console.log(`🎯 Processing unit ${unit.name}: lat=${unit.lat} (${typeof unit.lat}), lng=${unit.lng} (${typeof unit.lng})`)
          
          if (!unit.lat || !unit.lng) {
            console.log(`⚠️ Unit ${unit.name} has no location`)
            return null
          }
          
          // Ensure lat/lng are valid numbers
          const lat = typeof unit.lat === 'string' ? parseFloat(unit.lat) : unit.lat
          const lng = typeof unit.lng === 'string' ? parseFloat(unit.lng) : unit.lng
          
          if (isNaN(lat) || isNaN(lng)) {
            console.log(`⚠️ Unit ${unit.name} has invalid coordinates: lat=${unit.lat}, lng=${unit.lng}`)
            return null
          }
          
          console.log(`✅ Unit ${unit.name} will be displayed on map at ${lat}, ${lng}`)
          
          return (
            <Marker
              key={unit.id}
              position={{ lat: lat, lng: lng }}
              icon={getUnitIcon(unit.type, unit.status)}
              onClick={() => handleMarkerClick(unit)}
            />
          )
        })}
        
        {selectedUnit && selectedUnit.lat && selectedUnit.lng && (
          <InfoWindow
            position={{ lat: selectedUnit.lat, lng: selectedUnit.lng }}
            onCloseClick={() => setSelectedUnit(null)}
          >
            <div className="p-2 text-right" dir="rtl">
              <h3 className="font-bold text-lg mb-1">{selectedUnit.name}</h3>
              <p className="text-sm text-gray-600 mb-2">
                {selectedUnit.type === 'police' && 'משטרה'}
                {selectedUnit.type === 'fire' && 'כיבוי אש'}
                {selectedUnit.type === 'medical' && 'רפואה'}
                {selectedUnit.type === 'civil_defense' && 'הגנה אזרחית'}
              </p>
              <div className="space-y-1 text-sm">
                <div>סטטוס: <span className={`font-medium ${
                  selectedUnit.status === 'active' ? 'text-green-600' : 
                  selectedUnit.status === 'emergency' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {selectedUnit.status === 'active' && 'פעיל'}
                  {selectedUnit.status === 'emergency' && 'חירום'}
                  {selectedUnit.status === 'inactive' && 'לא פעיל'}
                </span></div>
                {selectedUnit.battery_level !== undefined && (
                  <div>סוללה: {selectedUnit.battery_level}%</div>
                )}
                {selectedUnit.signal_strength !== undefined && (
                  <div>אות: {selectedUnit.signal_strength}%</div>
                )}
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </LoadScript>
  )
} 