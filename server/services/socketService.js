const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Store connected clients
const connectedUnits = new Map()
const connectedControlCenters = new Map()

function initializeSocketService(io) {
  console.log('🔌 Initializing WebSocket service...')

  io.on('connection', (socket) => {
    console.log(`👤 Client connected: ${socket.id}`)

    // Handle unit registration
    socket.on('register_unit', (data) => {
      const { unitId } = data
      socket.join(`unit_${unitId}`)
      socket.unitId = unitId
      connectedUnits.set(unitId, socket.id)
      
      socket.emit('registered', {
        unitId,
        message: 'Unit registered successfully'
      })
      
      console.log(`🚨 Unit ${unitId} registered`)
    })

    // Handle control center registration
    socket.on('register_control_center', (data) => {
      socket.join('control_center')
      socket.clientType = 'control_center'
      
      socket.emit('registered', {
        message: 'Control center registered successfully'
      })
      
      console.log(`🏢 Control center registered`)
    })

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`👋 Client disconnected: ${socket.id}`)
      
      if (socket.unitId) {
        connectedUnits.delete(socket.unitId)
      }
    })
  })

  console.log('✅ WebSocket service initialized')
}

// Export functions for external use
module.exports = {
  initializeSocketService,
  getConnectedUnits: () => Array.from(connectedUnits.keys())
} 