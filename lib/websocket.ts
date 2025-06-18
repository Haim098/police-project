import { io, Socket } from 'socket.io-client'

class WebSocketService {
  private socket: Socket | null = null
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  connect(serverUrl: string = 'http://localhost:3001') {
    if (this.socket?.connected) {
      console.log('WebSocket already connected')
      return this.socket
    }

    console.log('🔌 Connecting to WebSocket server...')

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      autoConnect: true
    })

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected:', this.socket?.id)
      this.isConnected = true
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason)
      this.isConnected = false
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect - attempt to reconnect
        this.reconnect()
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.reconnect()
    })

    return this.socket
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    
    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`)
    
    setTimeout(() => {
      this.socket?.connect()
    }, delay)
  }

  registerUnit(unitId: string) {
    if (!this.socket) {
      console.error('WebSocket not connected')
      return Promise.reject(new Error('WebSocket not connected'))
    }

    console.log(`📡 Registering unit: ${unitId}`)
    this.socket.emit('register_unit', { unitId })
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Registration timeout'))
      }, 5000)

      this.socket?.once('registered', (data) => {
        clearTimeout(timeout)
        console.log('Unit registered successfully:', data)
        resolve(data)
      })
    })
  }

  registerControlCenter(operatorId: string = 'operator1') {
    if (!this.socket) {
      console.error('WebSocket not connected')
      return
    }

    console.log('🏢 Registering control center')
    this.socket.emit('register_control_center', { operatorId })
    
    return new Promise((resolve, reject) => {
      this.socket?.on('registered', (data) => {
        console.log('Control center registered successfully:', data)
        resolve(data)
      })

      setTimeout(() => {
        reject(new Error('Registration timeout'))
      }, 5000)
    })
  }

  sendMessage(event: string, data: any) {
    if (!this.isConnected || !this.socket) {
      console.warn('WebSocket not connected, cannot send message')
      return false
    }

    this.socket.emit(event, data)
    return true
  }

  onMessage(event: string, callback: (data: any) => void) {
    if (!this.socket) {
      console.error('WebSocket not connected')
      return
    }

    this.socket.on(event, callback)
  }

  offMessage(event: string, callback?: (data: any) => void) {
    if (!this.socket) return
    
    if (callback) {
      this.socket.off(event, callback)
    } else {
      this.socket.off(event)
    }
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting WebSocket...')
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
    }
  }

  get connected() {
    return this.isConnected && this.socket?.connected
  }

  get socketId() {
    return this.socket?.id
  }
}

// Create singleton instance
const websocketService = new WebSocketService()

export default websocketService 