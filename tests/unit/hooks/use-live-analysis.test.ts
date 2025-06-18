import { renderHook, act } from '@testing-library/react'
import { useLiveAnalysis } from '@/hooks/use-live-analysis'

// Mock the websocket service
jest.mock('@/lib/websocket', () => ({
  connect: jest.fn(),
  connected: false,
  sendMessage: jest.fn(),
  onMessage: jest.fn(),
  offMessage: jest.fn(),
}))

import websocketService from '@/lib/websocket'

describe('useLiveAnalysis Hook', () => {
  const mockProps = {
    unitId: 'test-unit-001',
    onAnalysisResult: jest.fn(),
    onStatusChange: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mock implementations
    ;(websocketService.connected as any) = false
    ;(websocketService.connect as jest.Mock).mockClear()
    ;(websocketService.sendMessage as jest.Mock).mockClear()
    ;(websocketService.onMessage as jest.Mock).mockClear()
    ;(websocketService.offMessage as jest.Mock).mockClear()
  })

  describe('Initialization', () => {
    test('should initialize with default state', () => {
      const { result } = renderHook(() => useLiveAnalysis(mockProps))
      
      expect(result.current.isConnected).toBe(false)
      expect(result.current.isAnalyzing).toBe(false)
      expect(result.current.sessionId).toBeNull()
    })
  })

  describe('Starting Live Analysis', () => {
    test('should start live analysis successfully', async () => {
      // Mock successful connection
      ;(websocketService.connected as any) = true
      ;(websocketService.connect as jest.Mock).mockResolvedValue(true)

      const { result } = renderHook(() => useLiveAnalysis(mockProps))
      
      await act(async () => {
        await result.current.startLiveAnalysis()
      })

      expect(mockProps.onStatusChange).toHaveBeenCalledWith('connecting')
      expect(websocketService.sendMessage).toHaveBeenCalledWith('start_live_analysis', {
        unitId: mockProps.unitId
      })
    })

    test('should handle connection failure', async () => {
      // Mock connection failure
      ;(websocketService.connect as jest.Mock).mockRejectedValue(new Error('Connection failed'))

      const { result } = renderHook(() => useLiveAnalysis(mockProps))
      
      await act(async () => {
        await result.current.startLiveAnalysis()
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.isAnalyzing).toBe(false)
      expect(mockProps.onStatusChange).toHaveBeenCalledWith('disconnected')
    })

    test('should not start if already active', async () => {
      const { result } = renderHook(() => useLiveAnalysis(mockProps))
      
      // Manually set active state
      await act(async () => {
        await result.current.startLiveAnalysis()
      })

      const sendMessageCallCount = (websocketService.sendMessage as jest.Mock).mock.calls.length

      // Try to start again
      await act(async () => {
        await result.current.startLiveAnalysis()
      })

      // Should not call sendMessage again
      expect((websocketService.sendMessage as jest.Mock).mock.calls.length).toBe(sendMessageCallCount)
    })
  })

  describe('Receiving Analysis Results', () => {
    test('should handle live_analysis_ready event', async () => {
      const { result } = renderHook(() => useLiveAnalysis(mockProps))
      
      // Mock the onMessage to simulate receiving ready event
      let readyHandler: Function
      ;(websocketService.onMessage as jest.Mock).mockImplementation((event, handler) => {
        if (event === 'live_analysis_ready') {
          readyHandler = handler
        }
      })

      await act(async () => {
        await result.current.startLiveAnalysis()
      })

      // Simulate receiving ready event
      act(() => {
        readyHandler({
          sessionId: 'test-session-123',
          message: 'Live analysis ready',
          isMock: false
        })
      })

      expect(result.current.isConnected).toBe(true)
      expect(result.current.isAnalyzing).toBe(true)
      expect(result.current.sessionId).toBe('test-session-123')
      expect(mockProps.onStatusChange).toHaveBeenCalledWith('ready')
    })

    test('should handle live_analysis_result event', async () => {
      const mockAnalysisResult = {
        urgent: true,
        detections: [{
          type: 'fire',
          severity: 'critical',
          confidence: 0.95,
          description: 'זוהתה שריפה פעילה',
          location: 'חלק מרכזי',
          action_required: 'פנה מהאזור'
        }],
        instructions: ['דווח למרכז השליטה', 'פנה מהאזור'],
        priority: 'critical',
        timestamp: new Date().toISOString()
      }

      const { result } = renderHook(() => useLiveAnalysis(mockProps))
      
      // Mock the onMessage to simulate receiving result event
      let resultHandler: Function
      ;(websocketService.onMessage as jest.Mock).mockImplementation((event, handler) => {
        if (event === 'live_analysis_result') {
          resultHandler = handler
        }
      })

      await act(async () => {
        await result.current.startLiveAnalysis()
      })

      // Simulate receiving analysis result
      act(() => {
        resultHandler({
          analysis: mockAnalysisResult
        })
      })

      expect(mockProps.onAnalysisResult).toHaveBeenCalledWith(mockAnalysisResult)
    })

    test('should trigger vibration for urgent results', async () => {
      const vibrateSpy = jest.spyOn(navigator, 'vibrate')
      
      const urgentResult = {
        urgent: true,
        detections: [{
          type: 'fire',
          severity: 'critical',
          confidence: 0.95,
          description: 'זוהתה שריפה פעילה',
          location: 'חלק מרכזי',
          action_required: 'פנה מהאזור מיידית'
        }],
        instructions: [],
        priority: 'critical',
        timestamp: new Date().toISOString()
      }

      const { result } = renderHook(() => useLiveAnalysis(mockProps))
      
      let resultHandler: Function
      ;(websocketService.onMessage as jest.Mock).mockImplementation((event, handler) => {
        if (event === 'live_analysis_result') {
          resultHandler = handler
        }
      })

      await act(async () => {
        await result.current.startLiveAnalysis()
      })

      act(() => {
        resultHandler({ analysis: urgentResult })
      })

      expect(vibrateSpy).toHaveBeenCalledWith([200, 100, 200, 100, 200])
    })
  })

  describe('Stopping Live Analysis', () => {
    test('should stop live analysis properly', () => {
      const { result } = renderHook(() => useLiveAnalysis(mockProps))
      
      act(() => {
        result.current.stopLiveAnalysis()
      })

      expect(websocketService.sendMessage).toHaveBeenCalledWith('stop_live_analysis', {})
      expect(websocketService.offMessage).toHaveBeenCalledWith('live_analysis_ready')
      expect(websocketService.offMessage).toHaveBeenCalledWith('live_analysis_result')
      expect(result.current.isConnected).toBe(false)
      expect(result.current.isAnalyzing).toBe(false)
      expect(result.current.sessionId).toBeNull()
      expect(mockProps.onStatusChange).toHaveBeenCalledWith('disconnected')
    })

    test('should handle stop when not active gracefully', () => {
      const { result } = renderHook(() => useLiveAnalysis(mockProps))
      
      // Stop without starting
      act(() => {
        result.current.stopLiveAnalysis()
      })

      // Should not crash or throw errors
      expect(result.current.isAnalyzing).toBe(false)
    })
  })

  describe('Sending Frames', () => {
    test('should send frame when analysis is active', async () => {
      const { result } = renderHook(() => useLiveAnalysis(mockProps))
      
      // Mock active session
      let readyHandler: Function
      ;(websocketService.onMessage as jest.Mock).mockImplementation((event, handler) => {
        if (event === 'live_analysis_ready') {
          readyHandler = handler
        }
      })

      await act(async () => {
        await result.current.startLiveAnalysis()
      })

      act(() => {
        readyHandler({ sessionId: 'test-session' })
      })

      const mockFrameData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD'
      
      act(() => {
        const success = result.current.sendFrame(mockFrameData)
        expect(success).toBe(true)
      })

      expect(websocketService.sendMessage).toHaveBeenCalledWith('live_analysis_frame', {
        frameData: '/9j/4AAQSkZJRgABAQAAAQABAAD'
      })
    })

    test('should not send frame when analysis is inactive', () => {
      const { result } = renderHook(() => useLiveAnalysis(mockProps))
      
      const mockFrameData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD'
      
      act(() => {
        const success = result.current.sendFrame(mockFrameData)
        expect(success).toBe(false)
      })

      expect(websocketService.sendMessage).not.toHaveBeenCalledWith('live_analysis_frame', expect.anything())
    })
  })

  describe('Error Handling', () => {
    test('should handle websocket errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      ;(websocketService.sendMessage as jest.Mock).mockImplementation(() => {
        throw new Error('WebSocket error')
      })

      const { result } = renderHook(() => useLiveAnalysis(mockProps))
      
      await act(async () => {
        await result.current.startLiveAnalysis()
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start live analysis:'),
        expect.any(Error)
      )
      
      consoleErrorSpy.mockRestore()
    })

    test('should handle frame sending errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      const { result } = renderHook(() => useLiveAnalysis(mockProps))
      
      // Set up active session
      let readyHandler: Function
      ;(websocketService.onMessage as jest.Mock).mockImplementation((event, handler) => {
        if (event === 'live_analysis_ready') {
          readyHandler = handler
        }
      })

      await act(async () => {
        await result.current.startLiveAnalysis()
      })

      act(() => {
        readyHandler({ sessionId: 'test-session' })
      })

      // Mock sendMessage to throw error
      ;(websocketService.sendMessage as jest.Mock).mockImplementation(() => {
        throw new Error('Send error')
      })

      act(() => {
        const success = result.current.sendFrame('data:image/jpeg;base64,test')
        expect(success).toBe(false)
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error sending frame:'),
        expect.any(Error)
      )
      
      consoleErrorSpy.mockRestore()
    })
  })
}) 