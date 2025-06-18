const express = require('express')
const { GoogleGenerativeAI, Modality } = require('@google/generative-ai')
const router = express.Router()

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Emergency analysis prompt in Hebrew
const EMERGENCY_ANALYSIS_PROMPT = `
אתה מערכת AI מתקדמת לניתוח וידאו בזמן אמת עבור כוחות חירום והצלה בישראל. משימתך היא לזהות סכנות, נפגעים, ופרטים קריטיים בזירת אירוע רב נפגעים.

נתח כל מסגרת וידאו בקפידה וחפש אחר המרכיבים הבאים. היה ספציפי ככל האפשר:

🔥 **סכנות אש ופיצוץ:**
    - אש גלויה ולהבות.
    - עשן: הבחן בין עשן שחור (בעירת חומרים פלסטיים/כימיים) לבין עשן לבן (אדים/חומרים אורגניים). ציין צבע וסמיכות.
    - בלוני גז או מכלים דומים בעלי פוטנציאל פיצוץ.
    - רכבים בוערים: התרע על סכנת פיצוץ או הימצאות אנשים לכודים.

👥 **אנשים ונפגעים:**
    - זיהוי וספירת אנשים: נסה להבחין בין ילדים, נשים, גברים, ומבוגרים אם אפשרי.
    - הערכת מצב נפגעים: חפש סימנים ויזואליים ראשוניים כמו דימום בולט, חוסר תנועה, או מצוקה נראית לעין.
    - סימני חיים ונוכחות (במיוחד בתוך מבנים):
        - חפצים המעידים על נוכחות אנשים: צעצועים, בגדי ילדים, עגלות תינוק.
        - סימנים ספציфиים המעידים על נוכחות תינוקות/ילדים.

🏠 **מצב מבנים:**
    - נזק מבני כללי: הריסה חלקית, קריסה, סדקים משמעותיים בקירות.
    - דלתות: ציין מצב (סגורה, פתוחה, שבורה, חסומה). הערך אם מהווה נתיב כניסה אפשרי או מסוכן.
    - חלונות: ציין מצב (שבורים, פתוחים, סגורים).
    - סכנות מבניות: דלתות או חלונות שבורים שעלולים ליפול, קירות לא יציבים, תקרות פגועות.
    - נסה לזהות פרטי מיקום בתוך מבנה אם נראים: מספרי דלתות, שלטים.

⚡ **מפגעים חשמליים:**
    - חוטי חשמל חשופים, קרועים או פגומים.
    - שנאים או ארונות חשמל פגועים.
    - סימני קצר חשמלי (ניצוצות).

🚨 **איומים וסכנות נוספות:**
    - כל איום או סכנה מיידית אחרת שלא פורטה לעיל.

**פורמט תגובה:**
עליך לספק תגובה בפורמט JSON בלבד. אם לא זוהה דבר משמעותי, השב אובייקט JSON ריק או עם \`"urgent": false\` וללא זיהויים.

\`\`\`json
{
  "urgent": true/false, // האם קיימת סכנה מיידית או ממצא קריטי?
  "detections": [
    {
      "type": "fire | smoke_black | smoke_white | person_adult | person_child | person_casualty | structural_damage | door_open | door_closed | door_broken | electrical_hazard | explosion_risk_vehicle | explosion_risk_cylinder | signs_of_life_children | other_hazard",
      "severity": "low | medium | high | critical", // רמת החומרה
      "confidence": 0.0-1.0, // רמת הביטחון בזיהוי
      "description": "תיאור מפורט בעברית של מה שזוהה. כלול פרטים רלוונטיים מהניתוח.",
      "location_in_frame": "תיאור מיקום הזיהוי בתוך מסגרת הוידאו (לדוגמה: 'בצד ימין למעלה', 'במרכז התמונה, ליד הדלת האדומה'). חפש ציוני דרך.",
      "action_required": "המלצה לפעולה מיידית עבור הכוח בשטח (לדוגמה: 'בדוק מצב הנפגע', 'התרחק מהאזור', 'חפש מקור חשמל לניתוק')."
    }
    // ניתן להוסיף זיהויים נוספים במערך זה
  ],
  "instructions": [
    // הנחיות קוליות וטקסטואליות קריטיות וספציפיות למצב, לדוגמה:
    // "שים לב, זוהתה שריפה! נסה לנתק את זרם החשמל בארון לפני כניסה."
    // "התראה! זוהו סימנים המעידים על הימצאות ילדים בתוך המבנה. חפש אותם בזהירות."
    // "סכנת פיצוץ! הדלת סגורה ויש עשן כבד. פתיחת הדלת עלולה לגרום לפיצוץ עקב חדירת חמצן – היזהר!"
    // "עשן שחור כבד! מעיד ככל הנראה על חומרים בוערים. הימנע משאיפה, חפש נתיב יציאה בטוח."
    // "זוהו חוטי חשמל חשופים. אל תתקרב! נסה לאתר את ארון החשמל ולנתק את הזרם."
  ],
  "priority": "low | medium | high | critical" // עדיפות כללית של המצב
}
\`\`\`

**דגשים חשובים:**
- ספק הנחיות קצרות וברורות במידת האפשר.
- התמקד בזיהויים בעלי משמעות לבטיחות והצלת חיים.
- אם יש מספר זיהויים, כלול את כולם במערך \`detections\`.
- עבור \`instructions\`, ספק עד 3 הנחיות קריטיות ביותר בהתאם לממצאים.
`

const mockScenarios = [
    // Fire and Explosion Risks
    {
        type: 'fire',
        severity: 'critical',
        confidence: 0.95,
        description: 'אש גלויה ולהבות גבוהות מתפשטות במהירות במבנה.',
        location_in_frame: 'מרכז התמונה, קומה שנייה של הבניין השמאלי',
        action_required: 'התרחק מיידית! דווח על היקף השריפה והאם יש לכודים.',
        instructions: [
            "סכנת התפשטות מהירה! פנה את כל האזרחים מהסביבה הקרובה.",
            "בדוק אפשרות לניתוק מקורות גז וחשמל אם ניתן לעשות זאת בבטחה.",
            "הערך כיוון רוח והשפעה על התפשטות האש והעשן."
        ],
        priority: 'critical',
        urgent: true,
    },
    {
        type: 'smoke_black',
        severity: 'high',
        confidence: 0.88,
        description: 'עשן שחור וסמיך מיתמר מחלונות הקומה הראשונה. ריח חריף של פלסטיק שרוף.',
        location_in_frame: 'חלק תחתון של המבנה המרכזי, יוצא מחלונות',
        action_required: 'הימנע משאיפת העשן! השתמש בציוד מגן נשימתי. חפש נתיב יציאה בטוח.',
        instructions: [
            "עשן שחור מעיד על בעירת חומרים מסוכנים. אין להיכנס ללא מיגון מתאים!",
            "אזהר כוחות נוספים לגבי סוג העשן.",
            "בדוק אם יש אנשים באזור המושפע מהעשן."
        ],
        priority: 'high',
        urgent: true,
    },
    {
        type: 'explosion_risk_cylinder',
        severity: 'critical',
        confidence: 0.92,
        description: 'זוהו מספר בלוני גז גדולים בסמוך למקור אש. חלקם נראים נפוחים.',
        location_in_frame: 'בצד ימין של הרכב הבוער, ליד קיר המבנה',
        action_required: 'סכנת פיצוץ מיידית! פנה את האזור ברדיוס נרחב. אל תנסה לכבות.',
        instructions: [
            "סכנת פיצוץ חמורה! הרחק את כולם למרחק בטוח של לפחות 100 מטר.",
            "דווח מיידית למרכז על הימצאות בלוני גז באזור האש.",
            "אין להתיז מים ישירות על בלונים חמים."
        ],
        priority: 'critical',
        urgent: true,
    },
    // People and Casualties
    {
        type: 'person_casualty',
        severity: 'critical',
        confidence: 0.85,
        description: 'אדם שוכב ללא תנועה ליד הכניסה למבנה. נראה דימום מאזור הרגל.',
        location_in_frame: 'משמאל לדלת הכניסה הראשית, על המדרכה',
        action_required: 'גש לנפגע בזהירות, הערך מצב הכרה ונשימה. דווח על מצבו.',
        instructions: [
            "בדוק הכרה ונשימה. התחל בפעולות החייאה במידת הצורך.",
            "עצור דימומים פורצים. דווח על מספר נפגעים ומצבם.",
            "ודא שהאזור בטוח לפני הטיפול."
        ],
        priority: 'critical',
        urgent: true,
    },
    {
        type: 'person_child',
        severity: 'high',
        confidence: 0.75,
        description: 'ילד כבן 5 נראה מבוהל ומסתתר מאחורי רכב חונה.',
        location_in_frame: 'מאחורי הרכב הכחול בצד שמאל של הרחוב',
        action_required: 'גש לילד בזהירות, הרגע אותו וודא שהוא בטוח. חפש הורים או אפוטרופוס.',
        instructions: [
            "דבר אל הילד בקול רגוע ומרגיע.",
            "בדוק אם הילד פצוע או במצוקה.",
            "נסה לאתר את הוריו או מבוגר אחראי."
        ],
        priority: 'high',
        urgent: true,
    },
    {
        type: 'signs_of_life_children',
        severity: 'medium',
        confidence: 0.70,
        description: 'צעצועים ובגדי ילדים מפוזרים ליד דלת דירה פתוחה חלקית בקומה שלישית.',
        location_in_frame: 'קומה שלישית, דירה אמצעית, ניתן לראות צעצועים דרך הדלת',
        action_required: 'יש סימנים להימצאות ילדים בדירה. בצע סריקה בזהירות מוגברת.',
        instructions: [
            "הודע על סימנים אפשריים לילדים לכודים.",
            "בצע כניסה שקטה ובדוק חדרים בקפידה.",
            "קרא בקול ושאל אם יש מישהו בפנים."
        ],
        priority: 'medium',
        urgent: false,
    },
    // Structural Damage
    {
        type: 'structural_damage',
        severity: 'high',
        confidence: 0.80,
        description: 'קיר חיצוני של מבנה נראה סדוק ומעוות. חלק מהלבנים נפלו.',
        location_in_frame: 'הקיר הימני של המבנה הגבוה, ליד הפינה',
        action_required: 'התרחק מהקיר מחשש לקריסה. אבטח את האזור ומנע גישה.',
        instructions: [
            "סכנת קריסה! אל תתקרב לקיר הפגוע.",
            "הצב סרטי אזהרה והרחק אזרחים.",
            "דווח על הנזק למרכז והמתן להערכת מהנדס."
        ],
        priority: 'high',
        urgent: true,
    },
    {
        type: 'door_broken',
        severity: 'medium',
        confidence: 0.90,
        description: 'דלת כניסה למחסן שבורה ותלויה על ציר אחד. נתיב כניסה אפשרי אך מסוכן.',
        location_in_frame: 'דלת המחסן האפור בקצה החצר',
        action_required: 'היכנס בזהירות רבה אם נדרש. שים לב ליציבות הדלת והמשקוף.',
        instructions: [
            "הדלת אינה יציבה, היזהר בעת מעבר.",
            "בדוק אם יש סכנות נוספות מאחורי הדלת לפני כניסה מלאה.",
            "דווח על מצב הדלת."
        ],
        priority: 'medium',
        urgent: false,
    },
    // Electrical Hazards
    {
        type: 'electrical_hazard',
        severity: 'critical',
        confidence: 0.85,
        description: 'חוטי חשמל קרועים חשופים על הרצפה ליד שלולית מים. נראים ניצוצות קלים.',
        location_in_frame: 'על המדרכה ליד עמוד תאורה שנפל, קרוב לשלולית',
        action_required: 'סכנת התחשמלות חמורה! אל תתקרב ואל תיגע במים. הרחק את כולם.',
        instructions: [
            "סכנת מוות! אין להתקרב לחוטים או למים!",
            "הזעק מיידית את חברת החשמל לניתוק הזרם.",
            "חסום את האזור ברדיוס גדול."
        ],
        priority: 'critical',
        urgent: true,
    },
    // No detection (important for testing "all clear" scenarios)
    {
        type: 'none',
        severity: 'low',
        confidence: 0.99,
        description: 'השטח נראה פנוי מסכנות מיידיות.',
        location_in_frame: 'כללי',
        action_required: 'המשך בסיור ובמעקב.',
        instructions: ["הכל נראה שקט כרגע. המשך בזהירות."],
        priority: 'low',
        urgent: false,
    }
];

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
      const selectedScenario = mockScenarios[Math.floor(Math.random() * mockScenarios.length)];
      
      const analysis = {
        urgent: selectedScenario.type === 'none' ? false : selectedScenario.urgent,
        detections: selectedScenario.type === 'none' ? [] : [{
          type: selectedScenario.type,
          severity: selectedScenario.severity,
          confidence: selectedScenario.confidence,
          description: selectedScenario.description,
          location_in_frame: selectedScenario.location_in_frame,
          action_required: selectedScenario.action_required,
        }],
        instructions: selectedScenario.instructions,
        priority: selectedScenario.priority,
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        isMock: true
      };
      
      socket.emit('live_analysis_result', {
        sessionId,
        analysis
      });
    }
  }, 5000);
  
  socket.on('disconnect', () => {
    clearInterval(mockInterval);
  });
}

// Legacy analyze-frame endpoint (still available for manual analysis)
router.post('/analyze-frame', async (req, res) => {
  try {
    const { unitId, frame } = req.body

    if (!unitId) {
      return res.status(400).json({
        error: 'Unit ID is required'
      });
    }

    console.log(`📸 Manual frame analysis for unit ${unitId}`);

    // Check if we have real frame data
    if (frame && frame !== 'mock_frame_data' && frame.startsWith('data:image')) {
      if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️ Gemini API key not found, using mock analysis');
        return performMockAnalysis(unitId, res);
      }

      try {
        const frameImage = processFrameData(frame);
        if (!frameImage) {
          throw new Error('Invalid frame data format');
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        const result = await model.generateContent([
          EMERGENCY_ANALYSIS_PROMPT,
          frameImage
        ]);
        
        const response = await result.response;
        const analysisText = response.text();
        
        // Try to parse JSON response
        let analysisResponse;
        try {
          const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysisResponse = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found in response');
          }
        } catch (parseError) {
          analysisResponse = {
            urgent: false,
            detections: [],
            instructions: ['בדוק ידנית', 'דווח למרכז השליטה'],
            priority: 'low'
          };
        }

        return res.json({
          success: true,
          unitId,
          analysis: {
            ...analysisResponse,
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