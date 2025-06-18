import { renderHook, act } from '@testing-library/react'
import { useCamera } from '@/hooks/use-camera'

describe('useCamera Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.testUtils.mockCameraPermission(true)
  })

  describe('Camera Access', () => {
    test('should initialize with camera off', () => {
      const { result } = renderHook(() => useCamera())
      
      expect(result.current.isCameraOn).toBe(false)
      expect(result.current.isRecording).toBe(false)
      expect(result.current.isPermissionGranted).toBe(false)
      expect(result.current.error).toBeNull()
    })

    test('should start camera successfully', async () => {
      const { result } = renderHook(() => useCamera())
      
      await act(async () => {
        await result.current.startCamera()
      })

      expect(result.current.isCameraOn).toBe(true)
      expect(result.current.isPermissionGranted).toBe(true)
      expect(result.current.error).toBeNull()
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: { 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 }, 
          facingMode: 'environment' 
        },
        audio: true
      })
    })

    test('should handle camera permission denied', async () => {
      global.testUtils.mockCameraPermission(false)
      const { result } = renderHook(() => useCamera())
      
      await act(async () => {
        await result.current.startCamera()
      })

      expect(result.current.isCameraOn).toBe(false)
      expect(result.current.isPermissionGranted).toBe(false)
      expect(result.current.error).toContain('אנא אפשר גישה למצלמה')
    })

    test('should stop camera properly', async () => {
      const { result } = renderHook(() => useCamera())
      
      // Start camera first
      await act(async () => {
        await result.current.startCamera()
      })

      // Stop camera
      act(() => {
        result.current.stopCamera()
      })

      expect(result.current.isCameraOn).toBe(false)
      expect(result.current.isRecording).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('Video Recording', () => {
    test('should not start recording when camera is off', async () => {
      const { result } = renderHook(() => useCamera())
      
      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.isRecording).toBe(false)
      expect(result.current.error).toContain('מצלמה לא פעילה')
    })

    test('should start recording when camera is on', async () => {
      // Mock MediaRecorder
      global.MediaRecorder = jest.fn().mockImplementation(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        state: 'inactive'
      })) as any

      const { result } = renderHook(() => useCamera())
      
      // Start camera first
      await act(async () => {
        await result.current.startCamera()
      })

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.isRecording).toBe(true)
      expect(global.MediaRecorder).toHaveBeenCalled()
    })
  })

  describe('Frame Capture', () => {
    test('should capture frame when camera is active', () => {
      const { result } = renderHook(() => useCamera())
      
      // Mock video element
      const mockVideoRef = {
        current: {
          videoWidth: 640,
          videoHeight: 480,
          ...global.testUtils.createMockVideoElement()
        }
      }
      
      // Manually set the video ref
      result.current.videoRef.current = mockVideoRef.current as any

      act(() => {
        result.current.startCamera()
      })

      const frameData = result.current.captureFrame()
      
      expect(frameData).toContain('data:image/jpeg;base64,')
      expect(frameData).toContain('/9j/4AAQSkZJRgABAQAAAQABAAD//gA7Q1JFQVRP')
    })

    test('should return null when camera is off', () => {
      const { result } = renderHook(() => useCamera())
      
      const frameData = result.current.captureFrame()
      
      expect(frameData).toBeNull()
      expect(result.current.error).toContain('מצלמה לא פעילה')
    })

    test('should handle video not ready', () => {
      const { result } = renderHook(() => useCamera())
      
      // Mock video element without dimensions
      const mockVideoRef = {
        current: {
          videoWidth: 0,
          videoHeight: 0,
          ...global.testUtils.createMockVideoElement()
        }
      }
      
      result.current.videoRef.current = mockVideoRef.current as any

      act(() => {
        result.current.startCamera()
      })

      const frameData = result.current.captureFrame()
      
      expect(frameData).toBeNull()
      expect(result.current.error).toContain('וידאו לא מוכן עדיין')
    })
  })

  describe('Auto Capture', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    test('should start auto capture with callback', () => {
      const { result } = renderHook(() => useCamera())
      const mockCallback = jest.fn()
      
      // Mock video element
      const mockVideoRef = {
        current: {
          videoWidth: 640,
          videoHeight: 480,
          ...global.testUtils.createMockVideoElement()
        }
      }
      result.current.videoRef.current = mockVideoRef.current as any

      act(() => {
        result.current.startCamera()
        result.current.startAutoCapture(mockCallback, 1000)
      })

      // Fast-forward timer
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(mockCallback).toHaveBeenCalledWith(expect.stringContaining('data:image/jpeg;base64,'))
    })

    test('should stop auto capture', () => {
      const { result } = renderHook(() => useCamera())
      const mockCallback = jest.fn()
      
      act(() => {
        result.current.startAutoCapture(mockCallback, 1000)
        result.current.stopAutoCapture()
      })

      // Fast-forward timer
      act(() => {
        jest.advanceTimersByTime(2000)
      })

      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    test('should handle getUserMedia errors gracefully', async () => {
      navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(
        new DOMException('NotFoundError', 'No camera found')
      )

      const { result } = renderHook(() => useCamera())
      
      await act(async () => {
        await result.current.startCamera()
      })

      expect(result.current.error).toContain('לא נמצאה מצלמה במכשיר')
      expect(result.current.isCameraOn).toBe(false)
    })

    test('should clear error when successfully starting camera', async () => {
      const { result } = renderHook(() => useCamera())
      
      // First, cause an error
      navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(
        new Error('Permission denied')
      )
      
      await act(async () => {
        await result.current.startCamera()
      })
      
      expect(result.current.error).toBeTruthy()

      // Now, fix the error and try again
      global.testUtils.mockCameraPermission(true)
      
      await act(async () => {
        await result.current.startCamera()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.isCameraOn).toBe(true)
    })
  })

  describe('Cleanup', () => {
    test('should cleanup on unmount', () => {
      const { result, unmount } = renderHook(() => useCamera())
      const stopCameraSpy = jest.spyOn(result.current, 'stopCamera')
      
      unmount()
      
      expect(stopCameraSpy).toHaveBeenCalled()
    })
  })
}) 