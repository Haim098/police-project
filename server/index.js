const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')
const helmet = require('helmet')
require('dotenv').config()

const app = express()
const server = http.createServer(app)

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}))

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}

app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Socket.IO setup
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3002"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
})

// Import route handlers
const { router: aiRouter, setupLiveAnalysis } = require('./routes/ai')
const unitRoutes = require('./routes/units')
const { initializeSocketService } = require('./services/socketService')

// Routes
app.use('/api/ai', aiRouter)
app.use('/api/units', unitRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    server: 'RescuerLens',
    services: ['websocket', 'ai', 'live_analysis']
  })
})

// Initialize Live Analysis WebSocket integration
console.log('🎥 Live Analysis WebSocket server initialized')
setupLiveAnalysis(io)

// Initialize Socket.IO service
initializeSocketService(io)

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found'
  })
})

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`🚀 RescuerLens Server running on port ${PORT}`)
  console.log('📡 WebSocket server ready')
  console.log('🤖 AI Proxy initialized')
  console.log('🔥 Emergency response system active')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

module.exports = { app, server, io } 