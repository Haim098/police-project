const express = require('express')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const router = express.Router()

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Helper function to process base64 frame data from camera
function processFrameData(frameData) {
  if (!frameData || typeof frameData !== 'string') {
    return null
  }
  
  // Extract base64 data (remove data:image/jpeg;base64, prefix if present)
  const base64Data = frameData.includes(',') ? frameData.split(',')[1] : frameData
  
  return {
    inlineData: {
      data: base64Data,
      mimeType: 'image/jpeg'
    }
  }
}

// AI Analysis endpoint - now handles real camera frames
router.post('/analyze-frame', async (req, res) => {
  try {
    const { unitId, frame } = req.body

    if (!unitId) {
      return res.status(400).json({
        error: 'Unit ID is required'
      })
    }

    console.log(`📸 Analyzing frame for unit ${unitId}`)
    console.log(`📊 Frame data: ${frame ? (frame.length > 50 ? 'Real camera data' : 'Mock data') : 'No data'}`)

    // Check if we have real frame data from camera
    if (frame && frame !== 'mock_frame_data' && frame.startsWith('data:image')) {
      // Real frame analysis with Gemini Vision
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
        
        const emergencyPrompt = `
        אתה מערכת AI לזיהוי חירום לכוחות הביטחון. נתח את התמונה ובדוק:
        1. שריפות או עשן
        2. אנשים בסיכון
        3. נזק מבני
        4. חומרים מסוכנים
        
        השב בפורמט JSON:
        {
          "detections": [{"type": "fire/smoke/person/structural_damage", "confidence": 0.85, "description": "תיאור", "severity": "low/medium/high/critical"}],
          "summary": "סיכום קצר בעברית", 
          "recommendations": ["המלצה 1", "המלצה 2"]
        }
        `

        const result = await model.generateContent([emergencyPrompt, frameImage])
        const response = await result.response
        const analysisText = response.text()
        
        console.log('🤖 Gemini AI response received')
        
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
          console.warn('⚠️ Failed to parse AI response, using summary')
          analysis = {
            detections: [],
            summary: analysisText.substring(0, 150) + '...',
            recommendations: ['בדוק ידנית', 'דווח למרכז השליטה']
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
        console.log('🔄 Falling back to mock analysis')
        return performMockAnalysis(unitId, res)
      }
    } else {
      // Mock analysis for testing
      console.log('🎭 Using mock analysis')
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

// Mock analysis helper function
function performMockAnalysis(unitId, res) {
  // Simulate AI processing time
  setTimeout(() => {
    const scenarios = [
      {
        type: 'fire',
        confidence: 0.85,
        severity: 'critical',
        description: 'זוהתה שריפה פעילה באזור'
      },
      {
        type: 'smoke',
        confidence: 0.78,
        severity: 'high', 
        description: 'זוהה עשן כבד'
      },
      {
        type: 'person',
        confidence: 0.92,
        severity: 'medium',
        description: 'זוהו אנשים באזור'
      },
      {
        type: 'structural_damage',
        confidence: 0.67,
        severity: 'high',
        description: 'זוהה נזק מבני'
      }
    ]

    // 40% chance for detection
    const shouldDetect = Math.random() > 0.6
    const selectedScenario = scenarios[Math.floor(Math.random() * scenarios.length)]

    const analysis = {
      detections: shouldDetect ? [selectedScenario] : [],
      summary: shouldDetect ? `AI זיהה: ${selectedScenario.description}` : 'לא זוהו איומים באזור',
      recommendations: shouldDetect ? [
        'דווח למרכז השליטה',
        'שמור על מרחק בטוח', 
        'המתן להוראות נוספות'
      ] : ['המשך בסיור רגיל'],
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

// AI Chat endpoint for instructions
router.post('/chat', async (req, res) => {
  try {
    const { message, unitId, context } = req.body

    if (!message || !unitId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['message', 'unitId']
      })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

    const chatPrompt = `
      אתה מערכת AI מתקדמת לסיוע לכוחות חירום. 
      יחידה ${unitId} שואלת: "${message}"
      
      ${context ? `הקשר נוסף: ${context}` : ''}
      
      תן תשובה קצרה, מדויקת ומעשית בעברית.
      התמקד בהוראות בטיחות ופעולות מיידיות נדרשות.
    `

    const result = await model.generateContent(chatPrompt)
    const response = await result.response
    const reply = response.text()

    res.json({
      success: true,
      unitId,
      message,
      reply,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('AI Chat error:', error)
    res.status(500).json({
      error: 'AI chat failed',
      message: error.message
    })
  }
})

// Health check for AI service
router.get('/health', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured')
    }

    res.json({
      status: 'healthy',
      ai_service: 'Gemini Pro',
      timestamp: new Date().toISOString(),
      capabilities: ['image_analysis', 'chat', 'emergency_detection']
    })
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    })
  }
})

module.exports = router 