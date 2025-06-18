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
  error: string | null
}

export function useCamera(): CameraHookReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  
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
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
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
      return null
    }

    try {
      const canvas = document.createElement('canvas')
      const video = videoRef.current
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setError('שגיאה ביצירת תמונה')
        return null
      }
      
      ctx.drawImage(video, 0, 0)
      const frameData = canvas.toDataURL('image/jpeg', 0.8)
      
      console.log('📸 Frame captured:', frameData.length, 'characters')
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
    error
  }
} 