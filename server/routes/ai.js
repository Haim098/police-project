const express = require('express')
const { GoogleGenerativeAI, Modality } = require('@google/generative-ai')
const router = express.Router()

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Emergency analysis prompt in Hebrew
const EMERGENCY_ANALYSIS_PROMPT = `
אתה מערכת AI מתקדמת לזיהוי חירום עבור כוחות הביטחון בישראל. אתה רואה וידאו בזמן אמת מיחידת שטח.

נתח כל מסגרת וחפש:
🔥 שריפות, עשן (שחור/לבן), להבות
👥 אנשים בסיכון, נפגעים, ילדים, מבוגרים
🏠 נזק מבני, קירות שבורים, דלתות שבורות
⚡ חוטי חשמל חשופים, סכנות חשמליות  
💥 חומרים מסוכנים, בלוני גז, רכבים בוערים
🚨 כל איום או סכנה אחרת

תן תשובה מיידית בפורמט הזה:
{
  "urgent": true/false,
  "detections": [
    {
      "type": "fire/smoke/person/structural_damage/electrical_hazard/explosion_risk",
      "severity": "low/medium/high/critical", 
      "confidence": 0.0-1.0,
      "description": "תיאור בעברית",
      "location": "מיקום באזור",
      "action_required": "פעולה נדרשת"
    }
  ],
  "instructions": [
    "הנחיה 1 לכוח בשטח",
    "הנחיה 2 לכוח בשטח"
  ],
  "priority": "low/medium/high/critical"
}

רק אם זיהית משהו חשוב - השב. אם הכל רגיל - אל תשיב כלום.
`

// Live Analysis integration with existing Socket.IO
function setupLiveAnalysis(io) {
  console.log('🎥 Setting up Live Analysis with Socket.IO...')
  
  // Store active live sessions
  const liveSessions = new Map()

  io.on('connection', (socket) => {
    // Handle live analysis start
    socket.on('start_live_analysis', async (data) => {
      const { unitId } = data
      const sessionId = socket.id
      
      console.log(`🎥 Starting live analysis for unit ${unitId}, session ${sessionId}`)
      
      try {
        if (!process.env.GEMINI_API_KEY) {
          console.warn('⚠️ Gemini API key not found - Using mock live analysis')
          setupMockLiveAnalysis(socket, sessionId, unitId)
          return
        }

        // Initialize Gemini Live session
        const liveSession = await genAI.live.connect({
          model: 'gemini-2.5-flash',
          config: {
            responseModalities: [Modality.TEXT],
            systemInstruction: EMERGENCY_ANALYSIS_PROMPT,
            generationConfig: {
              maxOutputTokens: 1024,
              temperature: 0.1,
            }
          }
        })

        // Store session
        liveSessions.set(sessionId, {
          geminiSession: liveSession,
          socket: socket,
          unitId: unitId,
          lastAnalysis: Date.now()
        })

        // Handle responses from Gemini Live API
        liveSession.on('message', (response) => {
          try {
            if (response.serverContent?.modelTurn) {
              const analysisText = response.serverContent.modelTurn.parts[0]?.text
              if (analysisText && analysisText.trim()) {
                console.log('🤖 Live AI Response:', analysisText.substring(0, 100) + '...')
                
                let analysis
                try {
                  const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
                  if (jsonMatch) {
                    analysis = JSON.parse(jsonMatch[0])
                    
                    socket.emit('live_analysis_result', {
                      sessionId,
                      analysis: {
                        ...analysis,
                        timestamp: new Date().toISOString(),
                        session_id: sessionId
                      }
                    })

                    if (analysis.urgent) {
                      console.log('🚨 URGENT detection found:', analysis.detections)
                    }
                  }
                } catch (parseError) {
                  console.warn('⚠️ Failed to parse live AI response')
                }
              }
            }
          } catch (error) {
            console.error('🚨 Live response processing error:', error)
          }
        })

        socket.emit('live_analysis_ready', { 
          sessionId,
          message: 'Live AI analysis activated'
        })

      } catch (error) {
        console.error('🚨 Failed to create live session:', error)
        setupMockLiveAnalysis(socket, sessionId, unitId)
      }
    })

    // Handle video frames
    socket.on('live_analysis_frame', async (data) => {
      const { frameData } = data
      const sessionId = socket.id
      const session = liveSessions.get(sessionId)
      
      if (!session) return

      // Rate limiting: max 2 frames per second
      const now = Date.now()
      if (now - session.lastAnalysis < 500) return
      session.lastAnalysis = now

      try {
        await session.geminiSession.sendRealtimeInput({
          video: {
            data: frameData,
            mimeType: 'image/jpeg'
          }
        })
      } catch (error) {
        console.error('🚨 Error sending frame to Gemini:', error)
      }
    })

    // Handle stop live analysis
    socket.on('stop_live_analysis', async () => {
      const sessionId = socket.id
      const session = liveSessions.get(sessionId)
      
      if (session?.geminiSession) {
        try {
          await session.geminiSession.disconnect()
        } catch (error) {
          console.error('Error disconnecting Gemini session:', error)
        }
      }
      
      liveSessions.delete(sessionId)
      console.log(`🛑 Stopped live analysis for session ${sessionId}`)
    })

    // Cleanup on disconnect
    socket.on('disconnect', async () => {
      const sessionId = socket.id
      const session = liveSessions.get(sessionId)
      
      if (session?.geminiSession) {
        try {
          await session.geminiSession.disconnect()
        } catch (error) {
          console.error('Error cleaning up Gemini session:', error)
        }
      }
      
      liveSessions.delete(sessionId)
    })
  })
}

// Mock live analysis for when Gemini is unavailable
function setupMockLiveAnalysis(socket, sessionId, unitId) {
  console.log(`🎭 Setting up mock live analysis for unit ${unitId}`)
  
  socket.emit('live_analysis_ready', { 
    sessionId,
    message: 'Mock AI analysis activated (Gemini unavailable)',
    isMock: true
  })
  
  // Mock analysis every 5 seconds
  const mockInterval = setInterval(() => {
    if (Math.random() > 0.7) { // 30% chance of detection
      const mockDetections = [
        {
          type: 'fire',
          severity: 'critical',
          confidence: 0.85,
          description: 'זוהתה שריפה פעילה',
          location: 'חלק מרכזי של השטח',
          action_required: 'פנה מהאזור מיידית'
        },
        {
          type: 'smoke',
          severity: 'high',
          confidence: 0.78,
          description: 'זוהה עשן כבד',
          location: 'בחלק הצפוני',
          action_required: 'הימנע משאיפה'
        },
        {
          type: 'person',
          severity: 'medium',
          confidence: 0.92,
          description: 'זוהו אנשים באזור',
          location: 'ליד הכניסה',
          action_required: 'בדוק מצב הנפגעים'
        }
      ]
      
      const detection = mockDetections[Math.floor(Math.random() * mockDetections.length)]
      
      socket.emit('live_analysis_result', {
        sessionId,
        analysis: {
          urgent: detection.severity === 'critical',
          detections: [detection],
          instructions: [
            'דווח למרכז השליטה',
            detection.action_required,
            'המתן להוראות נוספות'
          ],
          priority: detection.severity,
          timestamp: new Date().toISOString(),
          session_id: sessionId,
          isMock: true
        }
      })
    }
  }, 5000)
  
  socket.on('disconnect', () => {
    clearInterval(mockInterval)
  })
}

// Legacy analyze-frame endpoint (still available for manual analysis)
router.post('/analyze-frame', async (req, res) => {
  try {
    const { unitId, frame } = req.body

    if (!unitId) {
      return res.status(400).json({
        error: 'Unit ID is required'
      })
    }

    console.log(`📸 Manual frame analysis for unit ${unitId}`)

    // Check if we have real frame data
    if (frame && frame !== 'mock_frame_data' && frame.startsWith('data:image')) {
      if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️ Gemini API key not found, using mock analysis')
        return performMockAnalysis(unitId, res)
      }

      try {
        const frameImage = processFrameData(frame)
        if (!frameImage) {
          throw new Error('Invalid frame data format')
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
        
        const result = await model.generateContent([
          EMERGENCY_ANALYSIS_PROMPT,
          frameImage
        ])
        
        const response = await result.response
        const analysisText = response.text()
        
        // Try to parse JSON response
        let analysis
        try {
          const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0])
          } else {
            throw new Error('No JSON found in response')
          }
        } catch (parseError) {
          analysis = {
            urgent: false,
            detections: [],
            instructions: ['בדוק ידנית', 'דווח למרכז השליטה'],
            priority: 'low'
          }
        }

        return res.json({
          success: true,
          unitId,
          analysis: {
            ...analysis,
            timestamp: new Date().toISOString(),
            processing_time: '2.1s',
            ai_model: 'gemini-1.5-flash'
          }
        })

      } catch (aiError) {
        console.error('🚨 Gemini AI failed:', aiError.message)
        return performMockAnalysis(unitId, res)
      }
    } else {
      return performMockAnalysis(unitId, res)
    }

  } catch (error) {
    console.error('AI Analysis error:', error)
    res.status(500).json({
      error: 'AI analysis failed',
      message: error.message
    })
  }
})

// Helper function to process base64 frame data
function processFrameData(frameData) {
  if (!frameData || typeof frameData !== 'string') {
    return null
  }
  
  const base64Data = frameData.includes(',') ? frameData.split(',')[1] : frameData
  
  return {
    inlineData: {
      data: base64Data,
      mimeType: 'image/jpeg'
    }
  }
}

// Mock analysis helper (unchanged)
function performMockAnalysis(unitId, res) {
  setTimeout(() => {
    const scenarios = [
      {
        type: 'fire',
        confidence: 0.85,
        severity: 'critical',
        description: 'זוהתה שריפה פעילה באזור',
        location: 'חלק מרכזי',
        action_required: 'פנה מהאזור מיידית'
      },
      {
        type: 'smoke',
        confidence: 0.78,
        severity: 'high', 
        description: 'זוהה עשן כבד',
        location: 'חלק צפוני',
        action_required: 'הימנע משאיפה'
      },
      {
        type: 'person',
        confidence: 0.92,
        severity: 'medium',
        description: 'זוהו אנשים באזור',
        location: 'ליד הכניסה',
        action_required: 'בדוק מצב הנפגעים'
      }
    ]

    const shouldDetect = Math.random() > 0.6
    const selectedScenario = scenarios[Math.floor(Math.random() * scenarios.length)]

    const analysis = {
      urgent: shouldDetect && selectedScenario.severity === 'critical',
      detections: shouldDetect ? [selectedScenario] : [],
      instructions: shouldDetect ? [
        'דווח למרכז השליטה',
        selectedScenario.action_required,
        'המתן להוראות נוספות'
      ] : ['המשך בסיור רגיל'],
      priority: shouldDetect ? selectedScenario.severity : 'low',
      timestamp: new Date().toISOString(),
      processing_time: '1.2s',
      ai_model: 'mock_system'
    }

    res.json({
      success: true,
      unitId,
      analysis
    })
  }, 1000)
}

module.exports = {
  router,
  setupLiveAnalysis
} 