const { createClient } = require('@supabase/supabase-js')
const { supabase: supaCfg } = require('../../config.js')

// Prefer private server-side variables, fallback to the public ones to avoid
// crashing the server if only those are set.
const supabase = createClient(supaCfg.url, supaCfg.anonKey)

// Store connected clients
const connectedUnits = new Map()
const connectedControlCenters = new Map()

// Store io instance for broadcasting
let ioInstance = null

function initializeSocketService(io) {
  console.log('🔌 Initializing WebSocket service...')
  
  // Store io instance for broadcasting
  ioInstance = io

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
      
      // Notify control centers about new unit
      socket.to('control_center').emit('unit_status_changed', {
        unitId,
        status: 'connected',
        timestamp: new Date().toISOString()
      })
    })

    // Handle control center registration
    socket.on('register_control_center', (data) => {
      socket.join('control_center')
      socket.clientType = 'control_center'
      connectedControlCenters.set(socket.id, data)
      
      socket.emit('registered', {
        message: 'Control center registered successfully'
      })
      
      console.log(`🏢 Control center registered`)
    })

    // Handle detection notifications from units
    socket.on('detection_created', (data) => {
      console.log('📡 Broadcasting detection to control centers:', data)
      
      // Broadcast to all control centers
      socket.to('control_center').emit('new_detection', {
        detection: data,
        timestamp: new Date().toISOString()
      })
    })

    // Handle urgent alerts
    socket.on('urgent_alert', (data) => {
      console.log('🚨 Broadcasting urgent alert:', data)
      
      // Broadcast to all control centers
      socket.to('control_center').emit('urgent_alert', {
        ...data,
        timestamp: new Date().toISOString()
      })
    })

    // Handle location updates
    socket.on('location_update', (data) => {
      console.log('📍 Broadcasting location update:', data)
      
      // Broadcast to all control centers
      socket.to('control_center').emit('location_update', data)
    })

    // Handle unit status changes
    socket.on('unit_status_change', (data) => {
      console.log('📊 Broadcasting unit status change:', data)
      
      // Broadcast to all control centers
      socket.to('control_center').emit('unit_status_changed', data)
    })

    // Handle messages from control center to specific units
    socket.on('send_command', (data) => {
      const { unitId, command, message } = data
      console.log(`📤 Sending command to unit ${unitId}:`, { command, message })
      
      // Send to specific unit
      socket.to(`unit_${unitId}`).emit('command_received', {
        command,
        message,
        from: 'control_center',
        timestamp: new Date().toISOString()
      })
    })

    // Handle messages from units to control center
    socket.on('send_message_to_control', (data) => {
      console.log('📡 Unit sending message to control center:', data)
      
      // Broadcast to all control centers
      socket.to('control_center').emit('unit_message_received', {
        ...data,
        timestamp: new Date().toISOString()
      })
    })

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`👋 Client disconnected: ${socket.id}`)
      
      if (socket.unitId) {
        connectedUnits.delete(socket.unitId)
        
        // Mark unit as inactive in database
        try {
          const { error } = await supabase
            .from('units')
            .update({ 
              status: 'inactive',
              last_update: new Date().toISOString()
            })
            .eq('id', socket.unitId)
          
          if (error) {
            console.error('Error updating unit status on disconnect:', error)
          } else {
            console.log(`📴 Unit ${socket.unitId} marked as inactive`)
          }
        } catch (error) {
          console.error('Error marking unit as inactive:', error)
        }
        
        // Notify control centers about unit disconnection
        socket.to('control_center').emit('unit_status_changed', {
          unitId: socket.unitId,
          status: 'disconnected',
          timestamp: new Date().toISOString()
        })
      }
      
      if (socket.clientType === 'control_center') {
        connectedControlCenters.delete(socket.id)
      }
    })
  })

  console.log('✅ WebSocket service initialized')
}

// Function to broadcast messages to all control centers
function broadcastToControlCenters(event, data) {
  if (ioInstance) {
    console.log(`📡 Broadcasting ${event} to all control centers:`, data)
    ioInstance.to('control_center').emit(event, data)
    return true
  }
  console.warn('❌ Cannot broadcast: ioInstance not available')
  return false
}

// Function to send message to specific unit
function sendToUnit(unitId, event, data) {
  if (ioInstance) {
    console.log(`📤 Sending ${event} to unit ${unitId}:`, data)
    ioInstance.to(`unit_${unitId}`).emit(event, data)
    return true
  }
  console.warn('❌ Cannot send to unit: ioInstance not available')
  return false
}

// Export functions for external use
module.exports = {
  initializeSocketService,
  getConnectedUnits: () => Array.from(connectedUnits.keys()),
  getConnectedControlCenters: () => Array.from(connectedControlCenters.keys()),
  broadcastToControlCenters,
  sendToUnit
} 