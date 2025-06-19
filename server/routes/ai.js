const express = require('express')
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai')
const router = express.Router()
const config = require('../../config.js');

// Initialize AI lazily to ensure environment variables are loaded
let genAI;
let model;

function getAiModel() {
  if (!model) {
    const geminiApiKey = config.gemini.apiKey;
    if (!geminiApiKey) {
      console.error("CRITICAL: GEMINI_API_KEY is not set in config.js. AI features will not work.");
      return null;
    }
    
    genAI = new GoogleGenerativeAI(geminiApiKey);
    model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.2,
      },
      // Disable safety settings for this specific use case
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });
  }
  return model;
}

// Emergency analysis prompt in Hebrew
const EMERGENCY_ANALYSIS_PROMPT = `
אתה מערכת AI מתקדמת לזיהוי חירום עבור כוחות הביטחון בישראל. אתה רואה תמונה שצולמה מיחידת שטח.

נתח את התמונה וחפש:
🔥 שריפות, עשן (שחור/לבן), להבות
👥 אנשים בסיכון, נפגעים, ילדים, מבוגרים
🏠 נזק מבני, קירות שבורים, דלתות שבורות
⚡ חוטי חשמל חשופים, סכנות חשמליות  
💥 חומרים מסוכנים, בלוני גז, רכבים בוערים
🚨 כל איום או סכנה אחרת

השב אך ורק בפורמט JSON הבא. אל תוסיף שום טקסט או הסבר לפני או אחרי ה-JSON.
{
  "urgent": true/false,
  "detections": [
    {
      "type": "fire/smoke/person/structural_damage/electrical_hazard/explosion_risk/none",
      "severity": "low/medium/high/critical/none", 
      "confidence": 0.0-1.0,
      "description": "תיאור קצר בעברית של מה שזוהה. אם לא זוהה כלום, כתוב 'ללא זיהוי'.",
      "location": "מיקום כללי של הזיהוי בתמונה (למשל, 'במרכז התמונה', 'בצד שמאל למעלה').",
      "action_required": "פעולה נדרשת מהכוח בשטח, או 'אין צורך בפעולה מיידית'.",
      "bounding_box": { "x": 0.0-1.0, "y": 0.0-1.0, "width": 0.0-1.0, "height": 0.0-1.0 }
    }
  ],
  "instructions": [
    "הנחיה אחת ברורה וקצרה לכוח בשטח",
    "הנחיה נוספת אם נדרש"
  ],
  "priority": "low/medium/high/critical"
}

אם לא זיהית שום דבר משמעותי, השב עם "type": "none" ו-"severity": "none".
`

// Live Analysis integration with existing Socket.IO
function setupLiveAnalysis(io) {
  console.log('🎥 Setting up Live Analysis with Socket.IO...')
  
  // Ensure the AI model is initialized before setting up listeners
  if (!getAiModel()) {
    console.warn('⚠️ Gemini AI model could not be initialized. Live analysis will use mock data.');
  }

  const activeSockets = new Set()

  io.on('connection', (socket) => {
    let analysisInterval = null
    let isAnalyzing = false

    // Handle live analysis start
    socket.on('start_live_analysis', async (data) => {
      const { unitId } = data
      const sessionId = socket.id
      activeSockets.add(sessionId)
      
      console.log(`🎥 Live analysis started for unit ${unitId}, session ${sessionId}`)
      
      const aiModel = getAiModel();
      if (!aiModel) {
        console.warn('⚠️ Gemini API key not found in config.js - Using mock live analysis')
        setupMockLiveAnalysis(socket, sessionId, unitId)
        return
      }

      socket.emit('live_analysis_ready', { 
        sessionId,
        message: 'Live AI analysis activated. Ready for frames.'
      })
    })

    // Handle video frames
    socket.on('live_analysis_frame', async (data) => {
      const { frameData } = data
      const sessionId = socket.id
      
      if (!activeSockets.has(sessionId) || !frameData || isAnalyzing) {
        return
      }

      console.log(`🖼️ Received frame for analysis from session ${sessionId}`)

      try {
        isAnalyzing = true
        const frameImage = processFrameData(frameData)
        if (!frameImage) throw new Error('Invalid frame data')

        const aiModel = getAiModel();
        if (!aiModel) throw new Error('AI model is not available.');

        const result = await aiModel.generateContent([
          EMERGENCY_ANALYSIS_PROMPT,
          frameImage
        ])
        const response = result.response
        const analysisText = response.text()
        
        // More robust JSON parsing
        let analysis;
        try {
          // The AI sometimes wraps the JSON in ```json ... ```, so we extract it.
          const jsonMatch = analysisText.match(/```json\s*(\{[\s\S]*\})\s*```|(\{[\s\S]*\})/);
          if (!jsonMatch) {
            throw new Error('No JSON object found in the AI response.');
          }
          // Get the actual JSON string from the match (either group 1 or 2)
          const jsonString = jsonMatch[1] || jsonMatch[2];
          analysis = JSON.parse(jsonString);

        } catch (parseError) {
          console.error('🚨 Failed to parse JSON from AI response. Raw text:', analysisText);
          // We'll throw a new error to be caught by the outer block
          throw new Error(`Failed to parse AI response: ${parseError.message}`);
        }
        
        if (analysis) {
                    socket.emit('live_analysis_result', {
                      sessionId,
                      analysis: {
                        ...analysis,
                        timestamp: new Date().toISOString(),
                        session_id: sessionId
                      }
                    })

          if(analysis.detections && analysis.detections[0]?.type !== 'none') {
            console.log(`🤖 Live AI Response for ${sessionId}: ${analysis.detections[0].description}`)
            
            // Broadcast significant detections to control centers
            const significantDetection = analysis.detections[0]
            if (significantDetection.severity === 'critical' || significantDetection.severity === 'high') {
              socket.to('control_center').emit('live_detection_alert', {
                sessionId,
                unitId: socket.unitId,
                detection: significantDetection,
                analysis: analysis,
                timestamp: new Date().toISOString()
              })
              
              console.log(`🚨 Broadcasting live detection alert to control centers: ${significantDetection.type}`)
            }
          }
        } else {
          throw new Error('No valid analysis could be parsed from AI response.')
        }

      } catch (error) {
        console.error('🚨 Live analysis frame error:', error.message)
        socket.emit('live_analysis_error', {
          sessionId,
          message: `AI analysis failed: ${error.message}`
        })
      } finally {
        isAnalyzing = false
      }
    })

    // Handle stop live analysis
    socket.on('stop_live_analysis', async () => {
      const sessionId = socket.id
      activeSockets.delete(sessionId)
      if (analysisInterval) {
        clearInterval(analysisInterval)
        analysisInterval = null
      }
      isAnalyzing = false
      console.log(`🛑 Stopped live analysis for session ${sessionId}`)
    })

    // Cleanup on disconnect
    socket.on('disconnect', async () => {
      const sessionId = socket.id
      if (activeSockets.has(sessionId)) {
        activeSockets.delete(sessionId)
        console.log(`🔌 Cleaned up active session on disconnect: ${sessionId}`)
      }
      if (analysisInterval) {
        clearInterval(analysisInterval)
      }
      isAnalyzing = false
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
      const aiModel = getAiModel();
      if (!aiModel) {
        console.warn('⚠️ Gemini API key not found in config.js, using mock analysis')
        return performMockAnalysis(unitId, res)
      }

      try {
        const frameImage = processFrameData(frame)
        if (!frameImage) {
          throw new Error('Invalid frame data format')
        }

        const result = await aiModel.generateContent([
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
          console.warn('⚠️ Failed to parse AI response from manual analysis')
          return res.status(500).json({
            success: false,
            error: 'AI_RESPONSE_PARSE_ERROR',
            message: 'The AI returned a response that could not be understood.'
          })
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
        return res.status(500).json({ 
          success: false, 
          error: 'AI_ANALYSIS_FAILED', 
          message: aiError.message 
        })
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