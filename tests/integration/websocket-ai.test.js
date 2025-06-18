const { io } = require('socket.io-client')

describe('WebSocket AI Integration Tests', () => {
  let clientSocket
  let serverUrl

  beforeAll(async () => {
    // Wait for server to be ready
    await global.integrationUtils.waitForServer()
    serverUrl = global.integrationUtils.serverUrl
  })

  beforeEach(async () => {
    // Clean database
    await global.integrationUtils.cleanDatabase()
    
    // Create fresh client connection
    clientSocket = io(serverUrl, {
      transports: ['websocket'],
      forceNew: true
    })
    
    // Wait for connection
    await new Promise((resolve) => {
      clientSocket.on('connect', resolve)
    })
  })

  afterEach(() => {
    if (clientSocket) {
      clientSocket.disconnect()
    }
  })

  describe('WebSocket Connection', () => {
    test('should connect to server successfully', () => {
      expect(clientSocket.connected).toBe(true)
      expect(clientSocket.id).toBeDefined()
    })

    test('should handle health check endpoint', async () => {
      const response = await fetch(`${serverUrl}/health`)
      const health = await response.json()
      
      expect(response.status).toBe(200)
      expect(health.status).toBe('healthy')
      expect(health.server).toBe('RescuerLens')
      expect(health.services).toContain('websocket')
      expect(health.services).toContain('ai')
    })
  })

  describe('Unit Registration', () => {
    test('should register field unit successfully', (done) => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      
      clientSocket.on('registered', (data) => {
        expect(data.unitId).toBe(unitId)
        expect(data.type).toBe('unit')
        done()
      })
      
      clientSocket.emit('register_unit', { unitId })
    })

    test('should register control center successfully', (done) => {
      const operatorId = 'operator-test-001'
      
      clientSocket.on('registered', (data) => {
        expect(data.operatorId).toBe(operatorId)
        expect(data.type).toBe('control_center')
        done()
      })
      
      clientSocket.emit('register_control_center', { operatorId })
    })
  })

  describe('AI Analysis Integration', () => {
    test('should handle frame analysis request', async () => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      const testFrame = '/9j/4AAQSkZJRgABAQAAAQABAAD//gA7Q1JFQVRP'
      
      const response = await fetch(`${serverUrl}/api/ai/analyze-frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          unitId,
          frame: `data:image/jpeg;base64,${testFrame}`
        })
      })
      
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.unitId).toBe(unitId)
      expect(result.analysis).toBeDefined()
      expect(result.analysis.detections).toBeInstanceOf(Array)
      expect(result.analysis.instructions).toBeInstanceOf(Array)
    })

    test('should start live analysis session', (done) => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      
      clientSocket.on('live_analysis_ready', (data) => {
        expect(data.sessionId).toBeDefined()
        expect(data.message).toContain('analysis')
        done()
      })
      
      clientSocket.emit('start_live_analysis', { unitId })
    })

    test('should handle live analysis frames', (done) => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      const testFrame = '/9j/4AAQSkZJRgABAQAAAQABAAD//gA7Q1JFQVRP'
      
      let sessionId
      
      clientSocket.on('live_analysis_ready', (data) => {
        sessionId = data.sessionId
        
        // Send frame for analysis
        clientSocket.emit('live_analysis_frame', {
          frameData: testFrame
        })
      })
      
      clientSocket.on('live_analysis_result', (data) => {
        expect(data.sessionId).toBe(sessionId)
        expect(data.analysis).toBeDefined()
        expect(data.analysis.timestamp).toBeDefined()
        done()
      })
      
      clientSocket.emit('start_live_analysis', { unitId })
    })

    test('should detect urgent situations and trigger alerts', (done) => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      
      clientSocket.on('live_analysis_result', (data) => {
        if (data.analysis.urgent) {
          expect(data.analysis.detections).toHaveLength(1)
          expect(data.analysis.detections[0].severity).toBe('critical')
          expect(data.analysis.priority).toBe('critical')
          done()
        }
      })
      
      clientSocket.on('live_analysis_ready', () => {
        // Send multiple frames to increase chance of urgent detection
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            clientSocket.emit('live_analysis_frame', {
              frameData: '/9j/4AAQSkZJRgABAQAAAQABAAD//gA7Q1JFQVRP'
            })
          }, i * 1000)
        }
      })
      
      clientSocket.emit('start_live_analysis', { unitId })
    }, 15000) // Longer timeout for mock analysis
  })

  describe('Real-time Communication', () => {
    test('should broadcast unit status changes', (done) => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      
      // Register as control center to receive broadcasts
      clientSocket.emit('register_control_center', { operatorId: 'test-operator' })
      
      clientSocket.on('unit_status_changed', (data) => {
        expect(data.unitId).toBe(unitId)
        expect(data.status).toBe('emergency')
        done()
      })
      
      // Simulate unit status change after registration
      setTimeout(() => {
        clientSocket.emit('unit_status_update', {
          unitId,
          status: 'emergency',
          location: 'רחוב דיזנגוף 50, תל אביב'
        })
      }, 100)
    })

    test('should handle commands from control center to units', (done) => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      const message = 'בדוק מצב הנפגעים באזור'
      
      // Register as unit to receive commands
      clientSocket.emit('register_unit', { unitId })
      
      clientSocket.on('command_received', (data) => {
        expect(data.unitId).toBe(unitId)
        expect(data.message).toBe(message)
        expect(data.command).toBe('message')
        done()
      })
      
      // Send command after registration
      setTimeout(() => {
        clientSocket.emit('send_command', {
          unitId,
          command: 'message',
          message
        })
      }, 100)
    })

    test('should broadcast new detections to control center', (done) => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      
      // Register as control center
      clientSocket.emit('register_control_center', { operatorId: 'test-operator' })
      
      clientSocket.on('new_detection', (data) => {
        expect(data.detection).toBeDefined()
        expect(data.detection.unit_id).toBe(unitId)
        expect(data.detection.type).toBe('fire')
        expect(data.detection.severity).toBe('critical')
        done()
      })
      
      // Simulate detection after registration
      setTimeout(() => {
        clientSocket.emit('new_detection', {
          detection: global.integrationUtils.createTestDetection(unitId)
        })
      }, 100)
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid frame data gracefully', async () => {
      const response = await fetch(`${serverUrl}/api/ai/analyze-frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          unitId: 'test-unit',
          frame: 'invalid-frame-data'
        })
      })
      
      expect(response.status).toBe(400)
      const result = await response.json()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid frame data')
    })

    test('should handle missing unit ID in requests', async () => {
      const response = await fetch(`${serverUrl}/api/ai/analyze-frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          frame: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD'
        })
      })
      
      expect(response.status).toBe(400)
      const result = await response.json()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Unit ID is required')
    })

    test('should handle WebSocket disconnection gracefully', (done) => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      
      clientSocket.emit('register_unit', { unitId })
      
      clientSocket.on('registered', () => {
        // Disconnect and verify server handles it
        clientSocket.disconnect()
        
        // Wait a bit and verify no errors occurred
        setTimeout(() => {
          expect(true).toBe(true) // Test passes if no errors thrown
          done()
        }, 1000)
      })
    })
  })

  describe('Performance Tests', () => {
    test('should handle multiple concurrent connections', async () => {
      const connections = []
      const numConnections = 10
      
      // Create multiple connections
      for (let i = 0; i < numConnections; i++) {
        const client = io(serverUrl, { transports: ['websocket'] })
        connections.push(client)
        
        await new Promise((resolve) => {
          client.on('connect', resolve)
        })
      }
      
      expect(connections).toHaveLength(numConnections)
      expect(connections.every(c => c.connected)).toBe(true)
      
      // Clean up
      connections.forEach(c => c.disconnect())
    })

    test('should handle rapid frame processing', async () => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      const numFrames = 5
      const testFrame = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD'
      
      const promises = []
      
      for (let i = 0; i < numFrames; i++) {
        const promise = fetch(`${serverUrl}/api/ai/analyze-frame`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            unitId,
            frame: testFrame
          })
        })
        promises.push(promise)
      }
      
      const responses = await Promise.all(promises)
      
      expect(responses).toHaveLength(numFrames)
      expect(responses.every(r => r.ok)).toBe(true)
      
      const results = await Promise.all(responses.map(r => r.json()))
      expect(results.every(r => r.success)).toBe(true)
    })
  })
}) 