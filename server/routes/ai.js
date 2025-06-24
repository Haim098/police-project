const express = require('express')
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai')
const router = express.Router()
const config = require('../../config.js');
const geminiLiveService = require('../services/geminiLiveService');

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

חשוב מאוד! השתמש רק בסוגי הזיהוי הבאים (רשימה מוגבלת מבסיס הנתונים):
- "fire" - לשריפות פעילות, להבות
- "smoke" - לעשן מכל סוג (שחור, לבן, כבד, קל)
- "person" - לאנשים (מבוגרים, נפגעים, לכודים)
- "child" - לילדים (זיהוי ספציפי לקטינים)
- "gas_tank" - לבלוני גז, מיכלי דלק מסוכנים
- "wire" - לחוטים חשמליים חשופים, כבלים מסוכנים
- "structural_damage" - לנזק מבני (כולל מבנים קרוסים, פגועים, לא יציבים, קירות שבורים)

אל תשתמש בסוגים אחרים! במיוחד אל תשתמש ב:
- electrical_hazard (השתמש ב-wire במקום)
- explosion_risk (השתמש ב-gas_tank במקום)
- vehicle (לא נתמך כרגע)
- buildingCollapse או damagedBuilding (השתמש ב-structural_damage במקום)

נתח את התמונה וחפש:
🔥 שריפות, עשן (שחור/לבן), להבות
👥 אנשים בסיכון, נפגעים, ילדים, מבוגרים
🏠 נזק מבני, קירות שבורים, מבנים פגועים או קרוסים
⚡ חוטי חשמל חשופים, סכנות חשמליות  
💥 חומרים מסוכנים, בלוני גז, סכנת פיצוץ

דוגמאות לשימוש נכון:
- מבנה קרוס/פגוע/לא יציב → "type": "structural_damage"
- אדם מבוגר/נפגע/בסכנה/לכוד → "type": "person"  
- ילד/קטין/ילדה → "type": "child"
- בלון גז/מיכל דלק/גז → "type": "gas_tank"
- חוט חשמל חשוף/כבל פגוע → "type": "wire"

השב אך ורק בפורמט JSON הבא. אל תוסיף שום טקסט או הסבר לפני או אחרי ה-JSON.
{
  "urgent": true/false,
  "detections": [
    {
      "type": "fire/smoke/person/child/gas_tank/wire/structural_damage",
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
  console.log('🎥 Setting up Advanced Live Analysis with Socket.IO...')
  
  const activeSockets = new Set()

  io.on('connection', (socket) => {
    console.log('🔌 AI route: Socket connected:', socket.id)

    // Handle live analysis session
    socket.on('start_live_analysis', async (data) => {
      try {
        console.log('🎥 Starting live analysis for unit:', data.unitId)
        
        const session = await geminiLiveService.createSession(socket.id, {
          unitId: data.unitId,
          features: data.features
        })

        socket.emit('live_analysis_ready', {
          sessionId: socket.id,
          message: 'Live analysis ready',
          features: {
            peopleDetection: true,
            fireAndSmokeAnalysis: true,
            structuralDamageAssessment: true,
            objectIdentification: true,
            sceneUnderstanding: true,
            riskAssessment: true,
            voiceAlerts: true,
            memoryRetention: true,
            electricalHazards: true,
            explosionDetection: true,
            chemicalHazards: true,
            timeBasedAnalysis: true
          }
        })
      } catch (error) {
        console.error('Error starting live analysis:', error)
        socket.emit('live_analysis_error', {
          message: 'Failed to start live analysis',
          error: error.message
        })
      }
    })

    // Handle frame analysis
    socket.on('analyze_frame', async (data) => {
      try {
        if (!data.frame) {
          throw new Error('No frame data provided')
        }

        // Analyze frame with Gemini
        const analysis = await geminiLiveService.analyzeFrame(socket.id, data.frame)
        
        // Send analysis result
        socket.emit('frame_analysis_result', analysis)

        // If urgent, broadcast to control centers
        if (analysis.currentFrame?.urgent) {
          // Find high severity detections
          const criticalDetections = analysis.currentFrame.detections.filter(d => 
            d.severity === 'critical' || d.severity === 'high'
          )

          if (criticalDetections.length > 0) {
            io.emit('live_detection_alert', {
              unitId: data.unitId,
              detections: criticalDetections,
              urgentMessage: analysis.currentFrame.urgentVoiceAlert,
              timestamp: new Date().toISOString()
            })
          }
        }

        // Send voice alert if needed
        if (analysis.currentFrame?.urgentVoiceAlert) {
          socket.emit('voice_alert', {
            message: analysis.currentFrame.urgentVoiceAlert,
            priority: 'urgent'
          })
        }

        // Check for explosion warnings
        const explosionDetection = analysis.currentFrame?.detections?.find(d => 
          d.type === 'gas_tank' || 
          (d.type === 'fire' && d.description?.includes('פיצוץ'))
        )

        if (explosionDetection && explosionDetection.severity === 'critical') {
          socket.emit('emergency_explosion_warning', {
            message: 'זהירות! סכנת פיצוץ מיידית!',
            action: 'התרחק מהאזור מיד!',
            detection: explosionDetection
          })
        }

      } catch (error) {
        console.error('Error analyzing frame:', error)
        socket.emit('frame_analysis_error', {
          message: 'Failed to analyze frame',
          error: error.message
        })
      }
    })

    // Handle stop analysis
    socket.on('stop_live_analysis', async () => {
      try {
        await geminiLiveService.endSession(socket.id)
        socket.emit('live_analysis_stopped', {
          message: 'Live analysis stopped'
        })
      } catch (error) {
        console.error('Error stopping live analysis:', error)
      }
    })

    socket.on('disconnect', async () => {
      console.log('🔌 AI route: Socket disconnected:', socket.id)
      // Clean up session
      try {
        await geminiLiveService.endSession(socket.id)
      } catch (error) {
        console.error('Error cleaning up session:', error)
      }
    })
  })
  
  console.log('✅ Advanced Memory-Enhanced Live Analysis setup complete!')
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

// Gemini TTS endpoint - Using Gemini 2.5 Flash for natural Hebrew speech
router.post('/tts', async (req, res) => {
  try {
    const { text, priority = 'normal', emotion = 'urgent', rate = 'normal' } = req.body
    
    if (!text) {
      return res.status(400).json({ 
        error: 'Text is required',
        message: 'Please provide text to synthesize' 
      })
    }

    const aiModel = getAiModel()
    if (!aiModel) {
      return res.status(503).json({ 
        error: 'AI service unavailable',
        message: 'Gemini AI is not configured. Please check API key in config.js' 
      })
    }

    // Use Gemini to generate natural speech instructions
    const speechPrompt = `
אתה מערכת TTS מתקדמת לכוחות חירום. קבלת הודעה: "${text}"

צור הוראת דיבור טבעית בעברית עם הנחיות הבאות:
- עדיפות: ${priority}
- רגש: ${emotion}  
- מהירות: ${rate}

השב בפורמט JSON:
{
  "speech_text": "הטקסט המותאם לדיבור טבעי",
  "speech_rate": 0.8-1.5,
  "speech_pitch": 0.8-1.2,
  "speech_volume": 0.8-1.0,
  "emotion_markers": ["urgent", "calm", "authoritative"],
  "pronunciation_hints": ["מילה1:הגייה1", "מילה2:הגייה2"]
}

הקפד על:
- דיבור ברור וטבעי בעברית
- הדגשת מילות מפתח חשובות
- טון מתאים לחירום
- מהירות מותאמת לדחיפות
`

    const result = await aiModel.generateContent(speechPrompt)
    const response = await result.response
    const speechData = response.text()

    // Try to parse the JSON response
    let speechConfig
    try {
      const jsonMatch = speechData.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        speechConfig = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      // Fallback to basic configuration
      speechConfig = {
        speech_text: text,
        speech_rate: priority === 'urgent' ? 1.1 : 1.0,
        speech_pitch: priority === 'urgent' ? 1.1 : 1.0,
        speech_volume: 1.0,
        emotion_markers: [emotion],
        pronunciation_hints: []
      }
    }

    res.json({
      success: true,
      audio_config: speechConfig,
      original_text: text,
      enhanced_text: speechConfig.speech_text,
      fallback_available: true
    })

  } catch (error) {
    console.error('TTS generation error:', error)
    res.status(500).json({ 
      error: 'TTS generation failed',
      message: error.message,
      fallback_available: true
    })
  }
})

module.exports = {
  router,
  setupLiveAnalysis
} 