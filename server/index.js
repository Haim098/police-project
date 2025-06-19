const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// --- Start of Forensic Environment Variable Loading ---
console.log('--- Initializing Environment (Forensic Mode) ---');
const envPath = path.resolve(__dirname, '.env');
console.log(`[ENV] Attempting to load environment variables from: ${envPath}`);

if (fs.existsSync(envPath)) {
    console.log('[ENV] File found. Reading raw buffer...');
    const buffer = fs.readFileSync(envPath);
    console.log(`[ENV] Raw Buffer (first 64 bytes): <${buffer.slice(0, 64).toString('hex')}>`);
    
    // --- Encoding detection & conversion ---
    // If the file starts with UTF-16LE BOM (FF FE) or UTF-16BE BOM (FE FF),
    // convert it to UTF-8 so that dotenv.parse can read it properly.
    let content;
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        console.log('[ENV] UTF-16LE BOM detected. Converting buffer to UTF-8...');
        content = buffer.toString('utf16le');
        // remove BOM (first 2 bytes) after decoding
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }
    } else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
        console.warn('[ENV] UTF-16BE BOM detected. Consider saving .env as UTF-8 or UTF-16LE. Attempting naive byte-swap conversion...');
        // Swap byte order to convert BE -> LE for decoding
        const swapped = Buffer.alloc(buffer.length - 2);
        for (let i = 2; i < buffer.length; i += 2) {
            swapped[i - 2] = buffer[i + 1];
            swapped[i - 1] = buffer[i];
        }
        content = swapped.toString('utf16le');
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }
    } else {
        // Default to UTF-8
        content = buffer.toString('utf8');
        // Remove UTF-8 BOM if present
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
            console.log('[ENV] UTF-8 BOM detected and removed.');
        }
    }

    console.log(`[ENV] Content after decoding, wrapped in quotes: "${content}"`);

    // Parse the sanitized content
    const parsed = dotenv.parse(content);

    if (Object.keys(parsed).length === 0) {
         console.error('[ENV] CRITICAL: Failed to parse any variables from .env file. Please check the raw buffer and string output above for invisible characters or formatting errors.');
    } else {
        console.log('[ENV] Variables parsed successfully:', Object.keys(parsed).join(', '));
        // Manually assign to process.env
        for (const key in parsed) {
            if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
                process.env[key] = parsed[key];
            }
        }
        console.log('[ENV] Environment variables have been loaded into process.env.');
    }
} else {
    console.error(`[ENV] CRITICAL: .env file not found at path: ${envPath}`);
}
console.log('--- Environment Initialized ---');

// Forcing a check immediately after loading
console.log(`[Final ENV Check] NEXT_PUBLIC_SUPABASE_URL is: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET'}`);
console.log(`[Final ENV Check] GEMINI_API_KEY is: ${process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET'}`);


// We must require other modules AFTER dotenv has run.
const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')
const helmet = require('helmet')

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

// Serve static files (including socket.io client)
app.use(express.static(path.join(__dirname, 'public')))

// Serve test files
app.get('/test-map', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'test-map.html'))
})

app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'test-websocket.html'))
})

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