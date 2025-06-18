import { useState, useEffect, useRef, useCallback } from 'react'

interface CameraHookReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isPermissionGranted: boolean
  isCameraOn: boolean
  isRecording: boolean
  startCamera: () => Promise<void>
  stopCamera: () => void
  startRecording: () => void
  stopRecording: () => void
  captureFrame: () => string | null
  startAutoCapture: (onFrame: (frameData: string) => void, intervalMs?: number) => void
  stopAutoCapture: () => void
  error: string | null
}

export function useCamera(): CameraHookReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const autoCaptureIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const [isPermissionGranted, setIsPermissionGranted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check camera permissions on mount
  useEffect(() => {
    checkCameraPermissions()
  }, [])

  const checkCameraPermissions = async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName })
      setIsPermissionGranted(permission.state === 'granted')
      
      permission.addEventListener('change', () => {
        setIsPermissionGranted(permission.state === 'granted')
      })
    } catch (err) {
      console.warn('Permission API not supported, will request on camera access')
    }
  }

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      console.log('🎥 Starting camera...')
      
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'environment' // Back camera for field units
        },
        audio: true
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      console.log('🎥 Stream obtained:', stream)
      console.log('🎥 Video tracks:', stream.getVideoTracks().map(t => `${t.label} (${t.getSettings().width}x${t.getSettings().height})`))
      
      if (videoRef.current) {
        console.log('🎥 Setting video srcObject...')
        videoRef.current.srcObject = stream
        
        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current
          if (!video) {
            reject(new Error('Video ref became null'))
            return
          }
          
          const onLoadedMetadata = () => {
            console.log('🎥 Video metadata loaded')
            console.log(`🎥 Video dimensions: ${video.videoWidth}x${video.videoHeight}`)
            video.removeEventListener('loadedmetadata', onLoadedMetadata)
            resolve()
          }
          
          const onError = (e: Event) => {
            console.error('🎥 Video error:', e)
            video.removeEventListener('error', onError)
            reject(new Error('Video loading failed'))
          }
          
          video.addEventListener('loadedmetadata', onLoadedMetadata)
          video.addEventListener('error', onError)
          
          // If metadata is already loaded
          if (video.readyState >= 1) {
            onLoadedMetadata()
          }
        })
        
        await videoRef.current.play()
        console.log('🎥 Video playing')
      } else {
        console.error('🎥 Video ref is null')
        throw new Error('Video element not found')
      }
      
      setIsCameraOn(true)
      setIsPermissionGranted(true)
      console.log('📹 Camera started successfully')
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera'
      setError(errorMessage)
      setIsCameraOn(false)
      console.error('Camera access failed:', err)
      
      // Handle specific permission errors
      if (errorMessage.includes('Permission denied')) {
        setError('אנא אפשר גישה למצלמה בהגדרות הדפדפן')
      } else if (errorMessage.includes('NotFoundError')) {
        setError('לא נמצאה מצלמה במכשיר')
      } else {
        setError('שגיאה בהפעלת המצלמה')
      }
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop()
      })
      streamRef.current = null
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    
    setIsCameraOn(false)
    setIsRecording(false)
    setError(null)
    console.log('📹 Camera stopped')
  }, [])

  const startRecording = useCallback(() => {
    if (!streamRef.current) {
      setError('מצלמה לא פעילה')
      return
    }

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp8,opus'
      })
      
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000) // Record in 1-second chunks
      setIsRecording(true)
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Here we can send chunks to the server
          console.log('📹 Recording chunk available:', event.data.size, 'bytes')
        }
      }
      
      mediaRecorder.onstart = () => {
        console.log('📹 Recording started')
      }
      
      mediaRecorder.onstop = () => {
        console.log('📹 Recording stopped')
        setIsRecording(false)
      }
      
    } catch (err) {
      setError('שגיאה בהתחלת הקלטה')
      console.error('Recording failed:', err)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
  }, [isRecording])

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !isCameraOn) {
      setError('מצלמה לא פעילה')
      console.error('📸 Camera not active or video ref missing')
      return null
    }

    const video = videoRef.current
    
    // Check if video has loaded and has dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError('וידאו לא מוכן עדיין')
      console.error('📸 Video not ready - no dimensions')
      return null
    }

    try {
      const canvas = document.createElement('canvas')
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      console.log(`📸 Capturing frame: ${canvas.width}x${canvas.height}`)
      
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setError('שגיאה ביצירת תמונה')
        return null
      }
      
      ctx.drawImage(video, 0, 0)
      const frameData = canvas.toDataURL('image/jpeg', 0.8)
      
      console.log('📸 Frame captured:', frameData.length, 'characters')
      
      // Verify we have actual image data (not just empty canvas)
      if (frameData.length < 1000) {
        console.warn('📸 Frame seems empty, might be black')
      }
      
      return frameData
      
    } catch (err) {
      setError('שגיאה בלכידת תמונה')
      console.error('Frame capture failed:', err)
      return null
    }
  }, [isCameraOn])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  const startAutoCapture = useCallback((onFrame: (frameData: string) => void, intervalMs: number = 2000) => {
    if (autoCaptureIntervalRef.current) {
      clearInterval(autoCaptureIntervalRef.current)
    }

    console.log(`📸 Starting auto-capture every ${intervalMs}ms`)
    autoCaptureIntervalRef.current = setInterval(() => {
      if (isCameraOn) {
        const frameData = captureFrame()
        if (frameData) {
          onFrame(frameData)
        }
      }
    }, intervalMs)
  }, [isCameraOn, captureFrame])

  const stopAutoCapture = useCallback(() => {
    if (autoCaptureIntervalRef.current) {
      console.log('📸 Stopping auto-capture')
      clearInterval(autoCaptureIntervalRef.current)
      autoCaptureIntervalRef.current = null
    }
  }, [])

  // Cleanup auto-capture on unmount
  useEffect(() => {
    return () => {
      stopAutoCapture()
    }
  }, [stopAutoCapture])

  return {
    videoRef,
    isPermissionGranted,
    isCameraOn,
    isRecording,
    startCamera,
    stopCamera,
    startRecording,
    stopRecording,
    captureFrame,
    startAutoCapture,
    stopAutoCapture,
    error
  }
} 