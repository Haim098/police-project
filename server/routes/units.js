const express = require('express')
const { createClient } = require('@supabase/supabase-js')
const router = express.Router()

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Get all units - mock for now
router.get('/', async (req, res) => {
  try {
    const mockUnits = [
      { id: '1', name: 'Unit 1', status: 'active', location: { lat: 32.0853, lng: 34.7818 } },
      { id: '2', name: 'Unit 2', status: 'active', location: { lat: 32.0888, lng: 34.7806 } }
    ]

    res.json({
      success: true,
      units: mockUnits,
      count: mockUnits.length
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch units',
      message: error.message
    })
  }
})

// Get unit by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    if (!data) {
      return res.status(404).json({
        error: 'Unit not found',
        id
      })
    }

    res.json({
      success: true,
      unit: data
    })
  } catch (error) {
    console.error('Error fetching unit:', error)
    res.status(500).json({
      error: 'Failed to fetch unit',
      message: error.message
    })
  }
})

// Update unit status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params
    const { status, location, battery_level, signal_strength } = req.body

    const updateData = {
      updated_at: new Date().toISOString()
    }

    if (status) updateData.status = status
    if (location) updateData.location = location
    if (battery_level !== undefined) updateData.battery_level = battery_level
    if (signal_strength !== undefined) updateData.signal_strength = signal_strength

    const { data, error } = await supabase
      .from('units')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Emit real-time update
    const io = req.app.get('io')
    if (io) {
      io.emit('unit_updated', {
        unitId: id,
        unit: data,
        timestamp: new Date().toISOString()
      })
    }

    res.json({
      success: true,
      unit: data,
      updated_fields: Object.keys(updateData)
    })
  } catch (error) {
    console.error('Error updating unit:', error)
    res.status(500).json({
      error: 'Failed to update unit',
      message: error.message
    })
  }
})

// Create new detection
router.post('/:id/detections', async (req, res) => {
  try {
    const { id: unitId } = req.params
    const { type, confidence, severity, bbox, frame_url } = req.body

    if (!type || confidence === undefined || !severity) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['type', 'confidence', 'severity']
      })
    }

    const { data, error } = await supabase
      .from('detections')
      .insert({
        unit_id: unitId,
        type,
        confidence,
        severity,
        bbox,
        frame_url,
        acknowledged: false
      })
      .select()
      .single()

    if (error) throw error

    // Emit real-time detection
    const io = req.app.get('io')
    if (io) {
      io.emit('new_detection', {
        unitId,
        detection: data,
        timestamp: new Date().toISOString()
      })

      // Send urgent alert for critical detections
      if (severity === 'critical') {
        io.emit('urgent_alert', {
          unitId,
          detection: data,
          message: `התראה קריטית מיחידה ${unitId}: זוהה ${type}`,
          timestamp: new Date().toISOString()
        })
      }
    }

    res.status(201).json({
      success: true,
      detection: data
    })
  } catch (error) {
    console.error('Error creating detection:', error)
    res.status(500).json({
      error: 'Failed to create detection',
      message: error.message
    })
  }
})

// Get unit detections
router.get('/:id/detections', async (req, res) => {
  try {
    const { id: unitId } = req.params
    const { limit = 10 } = req.query

    const { data, error } = await supabase
      .from('detections')
      .select('*')
      .eq('unit_id', unitId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))

    if (error) throw error

    res.json({
      success: true,
      detections: data,
      count: data.length
    })
  } catch (error) {
    console.error('Error fetching detections:', error)
    res.status(500).json({
      error: 'Failed to fetch detections',
      message: error.message
    })
  }
})

// Send instruction to unit
router.post('/:id/instructions', async (req, res) => {
  try {
    const { id: unitId } = req.params
    const { message, type = 'instruction', priority = 'normal' } = req.body

    if (!message) {
      return res.status(400).json({
        error: 'Message is required'
      })
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        unit_id: unitId,
        type: 'alert',
        data: {
          message,
          instruction_type: type,
          priority,
          from: 'control_center'
        }
      })
      .select()
      .single()

    if (error) throw error

    // Emit real-time instruction
    const io = req.app.get('io')
    if (io) {
      io.to(`unit_${unitId}`).emit('new_instruction', {
        unitId,
        instruction: data,
        timestamp: new Date().toISOString()
      })
    }

    res.status(201).json({
      success: true,
      instruction: data
    })
  } catch (error) {
    console.error('Error sending instruction:', error)
    res.status(500).json({
      error: 'Failed to send instruction',
      message: error.message
    })
  }
})

module.exports = router 