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

export type Detection = {
  id: number;
  created_at: string;
  unit_id: string;
  type: 'fire' | 'smoke' | 'person' | 'structural_damage' | 'electrical_hazard' | 'explosion_risk' | 'vehicle' | 'none';
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'none';
  acknowledged: boolean;
  location?: string;
  data?: any;
};

export type Event = {
  id: number;
  unit_id: string;
  type: 'telemetry' | 'alert' | 'status_change' | 'detection';
  data: Record<string, any>;
  created_at?: string;
}; 