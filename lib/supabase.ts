import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database tables
export interface Unit {
  id: string
  name: string
  type: 'police' | 'medical' | 'fire' | 'civil_defense'
  status: 'active' | 'inactive' | 'emergency'
  location?: {
    lat: number
    lng: number
    address?: string
  }
  battery_level?: number
  signal_strength?: number
  created_at?: string
  updated_at?: string
}

export interface Detection {
  id: string
  unit_id: string
  type: 'fire' | 'smoke_black' | 'smoke_white' | 'person_adult' | 'person_child' | 'person_casualty' | 'structural_damage' | 'door_open' | 'door_closed' | 'door_broken' | 'electrical_hazard' | 'explosion_risk_vehicle' | 'explosion_risk_cylinder' | 'signs_of_life_children' | 'other_hazard' | 'smoke' | 'person' | 'child' | 'gas_tank' | 'wire'
  confidence: number
  bbox?: {
    x: number
    y: number
    width: number
    height: number
  }
  frame_url?: string
  acknowledged?: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  created_at?: string
}

export interface Event {
  id: string
  unit_id: string
  type: 'telemetry' | 'alert' | 'status_change' | 'detection'
  data: Record<string, any>
  created_at?: string
} 