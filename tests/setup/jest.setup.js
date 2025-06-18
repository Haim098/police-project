import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'

// Mock WebRTC APIs for camera tests
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [
        {
          stop: jest.fn(),
          kind: 'video',
          enabled: true,
          getSettings: jest.fn().mockReturnValue({
            width: 1920,
            height: 1080,
            facingMode: 'environment'
          })
        }
      ],
      getVideoTracks: () => [
        {
          stop: jest.fn(),
          kind: 'video',
          enabled: true,
          getSettings: jest.fn().mockReturnValue({
            width: 1920,
            height: 1080,
            facingMode: 'environment'
          })
        }
      ],
      getAudioTracks: () => [
        {
          stop: jest.fn(),
          kind: 'audio',
          enabled: true,
          getSettings: jest.fn().mockReturnValue({
            sampleRate: 48000
          })
        }
      ]
    }),
    enumerateDevices: jest.fn().mockResolvedValue([
      { kind: 'videoinput', deviceId: 'camera1', label: 'Mock Camera' }
    ])
  }
})

// Mock Audio Context for alert sounds
global.AudioContext = jest.fn().mockImplementation(() => ({
  createOscillator: jest.fn(() => ({
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    frequency: { value: 1000 }
  })),
  createGain: jest.fn(() => ({
    connect: jest.fn(),
    gain: {
      setValueAtTime: jest.fn(),
      exponentialRampToValueAtTime: jest.fn()
    }
  })),
  destination: {},
  currentTime: 0
}))

// Mock Vibration API
Object.defineProperty(navigator, 'vibrate', {
  writable: true,
  value: jest.fn()
})

// Mock Canvas for frame capture
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  drawImage: jest.fn(),
  getImageData: jest.fn(),
  putImageData: jest.fn(),
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  beginPath: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn()
}))

HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD//gA7Q1JFQVRP'
)

// Mock Socket.IO Client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    id: 'mock-socket-id',
    connected: false,
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
  }))
}))

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn()
    }))
  }))
}))

// Suppress console warnings in tests
const originalWarn = console.warn
beforeAll(() => {
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.warn = originalWarn
})

// Global test utilities
global.testUtils = {
  createMockMediaStream: () => ({
    getTracks: () => [{ stop: jest.fn(), kind: 'video' }],
    getVideoTracks: () => [{ stop: jest.fn(), kind: 'video' }],
    getAudioTracks: () => [{ stop: jest.fn(), kind: 'audio' }]
  }),
  
  createMockVideoElement: () => ({
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    videoWidth: 640,
    videoHeight: 480,
    currentTime: 0,
    duration: 100,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }),
  
  mockCameraPermission: (granted = true) => {
    if (granted) {
      navigator.mediaDevices.getUserMedia.mockResolvedValue(global.testUtils.createMockMediaStream())
    } else {
      navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error('Permission denied'))
    }
  }
} 