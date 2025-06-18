const { spawn } = require('child_process')
const { createClient } = require('@supabase/supabase-js')

// Test environment configuration
process.env.NODE_ENV = 'test'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key'

let serverProcess

// Setup test database
async function setupTestDatabase() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  )

  // Clean test data
  try {
    await supabase.from('detections').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('events').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('units').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    // Insert test data
    await supabase.from('units').insert([
      {
        id: '6686c4a6-4296-4dcc-ad6d-6df415b925f6',
        name: 'יחידה 001',
        type: 'police',
        status: 'active',
        officer_name: 'שוטר בדיקה',
        battery_level: 78,
        signal_strength: 100,
        last_update: new Date().toISOString()
      }
    ])
    
    console.log('✅ Test database setup complete')
  } catch (error) {
    console.warn('⚠️ Database setup failed (might be expected in CI):', error.message)
  }
}

// Start test server
async function startTestServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['server/index.js'], {
      env: { ...process.env, PORT: 3001 },
      stdio: 'pipe'
    })

    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('Server running on port 3001')) {
        resolve()
      }
    })

    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString())
    })

    setTimeout(() => {
      reject(new Error('Server startup timeout'))
    }, 30000)
  })
}

// Global setup
beforeAll(async () => {
  await setupTestDatabase()
  await startTestServer()
}, 60000)

// Global teardown
afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill()
  }
}, 10000)

// Test utilities for integration tests
global.integrationUtils = {
  supabase: createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  ),
  
  serverUrl: 'http://localhost:3001',
  
  async waitForServer(timeout = 10000) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(`${this.serverUrl}/health`)
        if (response.ok) return true
      } catch (error) {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('Server health check timeout')
  },
  
  async cleanDatabase() {
    await this.supabase.from('detections').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await this.supabase.from('events').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  },
  
  createTestDetection: (unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6') => ({
    unit_id: unitId,
    type: 'fire',
    confidence: 0.85,
    severity: 'critical',
    acknowledged: false
  })
} 