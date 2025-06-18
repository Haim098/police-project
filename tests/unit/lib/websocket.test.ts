import { jest } from '@jest/globals'

// Mock Socket.IO client
const mockSocket = {
  connected: false,
  id: 'mock-socket-id',
  connect: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn()
}

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket)
}))

import { io } from 'socket.io-client'
import websocketService from '@/lib/websocket'

describe('WebSocket Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSocket.connected = false
    // Reset the service internal state by disconnecting
    websocketService.disconnect()
  })

  describe('Connection Management', () => {
    test('should connect to server successfully', () => {
      const serverUrl = 'http://localhost:3001'
      
      const socket = websocketService.connect(serverUrl)
      
      expect(io).toHaveBeenCalledWith(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        autoConnect: true
      })
      expect(socket).toBe(mockSocket)
    })

    test('should return existing socket if already connected', () => {
      mockSocket.connected = true
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      websocketService.connect()
      const secondSocket = websocketService.connect()
      
      expect(consoleSpy).toHaveBeenCalledWith('WebSocket already connected')
      expect(secondSocket).toBe(mockSocket)
      
      consoleSpy.mockRestore()
    })

    test('should handle successful connection event', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      websocketService.connect()
      
      // Simulate connect event
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1]
      connectHandler?.()
      
      expect(consoleSpy).toHaveBeenCalledWith('✅ WebSocket connected:', mockSocket.id)
      expect(websocketService.connected).toBe(true)
      
      consoleSpy.mockRestore()
    })

    test('should handle disconnect event', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      websocketService.connect()
      
      // Simulate disconnect event
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1]
      disconnectHandler?.('io server disconnect')
      
      expect(consoleSpy).toHaveBeenCalledWith('❌ WebSocket disconnected:', 'io server disconnect')
      expect(websocketService.connected).toBe(false)
      
      consoleSpy.mockRestore()
    })

    test('should handle connection errors', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      
      websocketService.connect()
      
      // Simulate connection error
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1]
      errorHandler?.(new Error('Connection failed'))
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('WebSocket connection error:', expect.any(Error))
      
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Unit Registration', () => {
    test('should register unit successfully', async () => {
      const unitId = 'test-unit-001'
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      websocketService.connect()
      
      // Mock the once method to simulate successful registration
      mockSocket.once.mockImplementation((event, callback) => {
        if (event === 'registered') {
          setTimeout(() => callback({ unitId, status: 'registered' }), 100)
        }
      })
      
      const registrationPromise = websocketService.registerUnit(unitId)
      
      expect(consoleSpy).toHaveBeenCalledWith(`📡 Registering unit: ${unitId}`)
      expect(mockSocket.emit).toHaveBeenCalledWith('register_unit', { unitId })
      
      const result = await registrationPromise
      expect(result).toEqual({ unitId, status: 'registered' })
      
      consoleSpy.mockRestore()
    })

    test('should handle registration timeout', async () => {
      const unitId = 'test-unit-001'
      
      websocketService.connect()
      
      // Don't simulate any response to cause timeout
      mockSocket.once.mockImplementation(() => {})
      
      await expect(websocketService.registerUnit(unitId)).rejects.toThrow('Registration timeout')
    })

    test('should reject if not connected', async () => {
      const unitId = 'test-unit-001'
      
      // Don't connect
      await expect(websocketService.registerUnit(unitId)).rejects.toThrow('WebSocket not connected')
    })
  })

  describe('Control Center Registration', () => {
    test('should register control center successfully', async () => {
      const operatorId = 'operator-001'
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      websocketService.connect()
      
      // Mock the on method to simulate successful registration
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'registered') {
          setTimeout(() => callback({ operatorId, status: 'registered' }), 100)
        }
      })
      
      const registrationPromise = websocketService.registerControlCenter(operatorId)
      
      expect(consoleSpy).toHaveBeenCalledWith('🏢 Registering control center')
      expect(mockSocket.emit).toHaveBeenCalledWith('register_control_center', { operatorId })
      
      await registrationPromise
      
      consoleSpy.mockRestore()
    })

    test('should handle control center registration timeout', async () => {
      websocketService.connect()
      
      // Don't simulate any response
      mockSocket.on.mockImplementation(() => {})
      
      await expect(websocketService.registerControlCenter()).rejects.toThrow('Registration timeout')
    })
  })

  describe('Message Handling', () => {
    test('should send message when connected', () => {
      websocketService.connect()
      // Simulate connected state
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1]
      connectHandler?.()
      
      const success = websocketService.sendMessage('test_event', { data: 'test' })
      
      expect(success).toBe(true)
      expect(mockSocket.emit).toHaveBeenCalledWith('test_event', { data: 'test' })
    })

    test('should not send message when disconnected', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const success = websocketService.sendMessage('test_event', { data: 'test' })
      
      expect(success).toBe(false)
      expect(consoleWarnSpy).toHaveBeenCalledWith('WebSocket not connected, cannot send message')
      expect(mockSocket.emit).not.toHaveBeenCalled()
      
      consoleWarnSpy.mockRestore()
    })

    test('should register message listeners', () => {
      const callback = jest.fn()
      
      websocketService.connect()
      websocketService.onMessage('test_event', callback)
      
      expect(mockSocket.on).toHaveBeenCalledWith('test_event', callback)
    })

    test('should remove message listeners', () => {
      const callback = jest.fn()
      
      websocketService.connect()
      websocketService.offMessage('test_event', callback)
      
      expect(mockSocket.off).toHaveBeenCalledWith('test_event', callback)
    })

    test('should remove all listeners for event', () => {
      websocketService.connect()
      websocketService.offMessage('test_event')
      
      expect(mockSocket.off).toHaveBeenCalledWith('test_event')
    })

    test('should handle listener registration when not connected', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const callback = jest.fn()
      
      websocketService.onMessage('test_event', callback)
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('WebSocket not connected')
      
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Reconnection Logic', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    test('should attempt reconnection on server disconnect', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      websocketService.connect()
      
      // Simulate server-initiated disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1]
      disconnectHandler?.('io server disconnect')
      
      // Fast-forward timers to trigger reconnection
      jest.advanceTimersByTime(2000)
      
      expect(mockSocket.connect).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Attempting to reconnect'))
      
      consoleSpy.mockRestore()
    })

    test('should stop reconnection after max attempts', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      
      websocketService.connect()
      
      // Simulate multiple connection errors
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1]
      
      // Trigger 5 connection errors (max attempts)
      for (let i = 0; i < 5; i++) {
        errorHandler?.(new Error('Connection failed'))
        jest.advanceTimersByTime(60000) // Advance enough to trigger all retries
      }
      
      // One more error should stop retries
      errorHandler?.(new Error('Connection failed'))
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Max reconnection attempts reached')
      
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Cleanup', () => {
    test('should disconnect properly', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      websocketService.connect()
      websocketService.disconnect()
      
      expect(consoleSpy).toHaveBeenCalledWith('🔌 Disconnecting WebSocket...')
      expect(mockSocket.disconnect).toHaveBeenCalled()
      expect(websocketService.connected).toBe(false)
      expect(websocketService.socketId).toBeUndefined()
      
      consoleSpy.mockRestore()
    })

    test('should handle disconnect when not connected', () => {
      // Should not throw error
      expect(() => websocketService.disconnect()).not.toThrow()
    })
  })

  describe('Properties', () => {
    test('should return correct connection status', () => {
      expect(websocketService.connected).toBe(false)
      
      websocketService.connect()
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1]
      connectHandler?.()
      
      expect(websocketService.connected).toBe(true)
    })

    test('should return socket ID when connected', () => {
      websocketService.connect()
      
      expect(websocketService.socketId).toBe(mockSocket.id)
    })

    test('should return undefined socket ID when not connected', () => {
      expect(websocketService.socketId).toBeUndefined()
    })
  })
}) 