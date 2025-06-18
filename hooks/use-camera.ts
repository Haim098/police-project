import { useState, useEffect, useRef, useCallback } from 'react'

// Add screen sharing types
type StreamType = 'camera' | 'screen' | null

interface CameraHookReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isPermissionGranted: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
  activeStreamType: StreamType
  isRecording: boolean
  startCamera: () => Promise<void>
  stopCamera: () => void
  startScreenShare: () => Promise<void>
  stopStream: () => void
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
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [activeStreamType, setActiveStreamType] = useState<StreamType>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkCameraPermissions = async () => {
      try {
        if (navigator.permissions && 'query' in navigator.permissions) {
          const permission = await navigator.permissions.query({ name: 'camera' as PermissionName })
          setIsPermissionGranted(permission.state === 'granted')
          
          permission.onchange = () => {
            setIsPermissionGranted(permission.state === 'granted')
          }
        }
      } catch (err) {
        console.warn('Permission API not supported, will request on camera access')
      }
    }
    checkCameraPermissions()
  }, [])

  const stopAutoCapture = useCallback(() => {
    if (autoCaptureIntervalRef.current) {
      clearInterval(autoCaptureIntervalRef.current)
      autoCaptureIntervalRef.current = null
    }
    console.log('📸 Auto-capture stopped')
  }, [])

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    stopAutoCapture()
    setIsCameraOn(false)
    setIsScreenSharing(false)
    setActiveStreamType(null)
    setIsRecording(false)
    setError(null)
    console.log('📹 Stream stopped')
  }, [stopAutoCapture])

  const startStream = useCallback(async (type: 'camera' | 'screen') => {
    if (streamRef.current) {
      stopStream()
    }

    try {
      setError(null)
      console.log(`🎥 Starting ${type} stream...`)

      let stream: MediaStream;
      if (type === 'camera') {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'environment' },
          audio: true
        })
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15 } },
          audio: true
        })
      }
      
      streamRef.current = stream
      console.log(`🎥 Stream obtained for ${type}:`, stream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        stream.getVideoTracks()[0].onended = () => {
          console.log(`🎥 ${type} stream ended by user.`)
          stopStream()
        }

        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current
          if (!video) return reject(new Error('Video ref became null'))
          
          const onLoadedMetadata = () => {
            console.log('🎥 Video metadata loaded')
            video.removeEventListener('loadedmetadata', onLoadedMetadata)
            resolve()
          }
          
          video.addEventListener('loadedmetadata', onLoadedMetadata)
          if (video.readyState >= 1) onLoadedMetadata()
        })
        
        await videoRef.current.play()
        console.log('🎥 Video playing')
      } else {
        throw new Error('Video element not found')
      }
      
      if (type === 'camera') {
        setIsCameraOn(true)
        setIsPermissionGranted(true)
      } else {
        setIsScreenSharing(true)
      }
      setActiveStreamType(type)
      console.log(`📹 ${type} stream started successfully`)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to access ${type}`
      setError(errorMessage)
      if (type === 'camera') setIsCameraOn(false)
      if (type === 'screen') setIsScreenSharing(false)
      console.error(`${type} access failed:`, err)
      
      if (errorMessage.includes('Permission denied') || errorMessage.includes('The user chose not to share the screen')) {
        setError(`אנא אפשר גישה ל${type === 'camera' ? 'מצלמה' : 'שיתוף מסך'}`)
      } else {
        setError(`שגיאה בהפעלת ${type === 'camera' ? 'מצלמה' : 'שיתוף מסך'}`)
      }
    }
  }, [stopStream])

  const startCamera = useCallback(async () => {
    await startStream('camera')
  }, [startStream])

  const startScreenShare = useCallback(async () => {
    await startStream('screen')
  }, [startStream])
  
  const stopCamera = useCallback(() => {
    if (activeStreamType === 'camera') {
      stopStream()
    }
  }, [activeStreamType, stopStream])

  const startRecording = useCallback(() => {
    if (!streamRef.current) {
      setError('מצלמה או שיתוף מסך לא פעילים')
      return
    }

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current)
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
      
      mediaRecorder.onstart = () => console.log('📹 Recording started')
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
    }
  }, [isRecording])

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || (!isCameraOn && !isScreenSharing)) {
      console.error('📸 No active stream or video ref missing')
      return null
    }

    const video = videoRef.current
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('📸 Video not ready - no dimensions')
      return null
    }

    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/jpeg', 0.8)
    } catch (err) {
      console.error('Frame capture failed:', err)
      return null
    }
  }, [isCameraOn, isScreenSharing])

  const startAutoCapture = useCallback((onFrame: (frameData: string) => void, intervalMs: number = 2000) => {
    if (autoCaptureIntervalRef.current) {
      clearInterval(autoCaptureIntervalRef.current)
    }
    autoCaptureIntervalRef.current = setInterval(() => {
      const frameData = captureFrame()
      if (frameData) {
        onFrame(frameData)
      }
    }, intervalMs)
    console.log(`📸 Starting auto-capture every ${intervalMs}ms`)
  }, [captureFrame])

  useEffect(() => {
    return () => stopStream()
  }, [stopStream])

  return {
    videoRef,
    isPermissionGranted,
    isCameraOn,
    isScreenSharing,
    activeStreamType,
    isRecording,
    startCamera,
    stopCamera,
    startScreenShare,
    stopStream,
    startRecording,
    stopRecording,
    captureFrame,
    startAutoCapture,
    stopAutoCapture,
    error,
  }
} 