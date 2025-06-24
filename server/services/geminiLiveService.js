const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const config = require('../../config.js');
const WebSocket = require('ws');

class GeminiLiveService {
  constructor() {
    this.sessions = new Map();
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = null;
    this.initializeClient();
    
    // מערכת זיכרון לכל סשן
    this.sessionMemories = new Map();
  }

  initializeClient() {
    const apiKey = config.gemini.apiKey;
    if (!apiKey) {
      console.error("❌ GEMINI_API_KEY not found in config.js");
      return;
    }
    
    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      
      // נסיון ראשון עם Gemini 2.0 Flash
      try {
        this.model = this.genAI.getGenerativeModel({ 
          model: 'gemini-2.0-flash',
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.2,
          },
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
        console.log("✅ Gemini Live Service initialized with version 2.0-flash");
      } catch (modelError) {
        console.warn("⚠️ Failed to load Gemini 2.0 Flash, falling back to 1.5 Flash:", modelError.message);
        // Fallback למודל 1.5
        this.model = this.genAI.getGenerativeModel({ 
          model: 'gemini-1.5-flash',
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.2,
          },
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
        console.log("✅ Gemini Live Service initialized with fallback version 1.5-flash");
      }
    } catch (error) {
      console.error("❌ Failed to initialize Gemini client:", error);
    }
  }

  // מערכת זיכרון לסשן
  initializeSessionMemory(sessionId) {
    this.sessionMemories.set(sessionId, {
      // היסטוריית זיהויים
      detectionHistory: [],
      
      // מעקב אחר אובייקטים
      trackedObjects: new Map(),
      
      // מעקב אחר אנשים
      trackedPeople: new Map(),
      
      // הקשר סביבתי
      environmentContext: {
        hasElectricity: true,
        hasGasLeak: false,
        fireSpreadDirection: null,
        structuralIntegrity: 'stable',
        evacuationRoutes: [],
        hazardZones: []
      },
      
      // המלצות שניתנו
      givenRecommendations: [],
      
      // מטריקות זמן
      sessionStartTime: Date.now(),
      lastAnalysisTime: null,
      
      // סטטיסטיקות מצטברות
      cumulativeStats: {
        totalPeopleDetected: new Set(),
        injuredPeopleTracked: new Set(),
        hazardsIdentified: new Set(),
        criticalEventsTimeline: []
      }
    });
  }

  getEnhancedSystemPrompt(sessionMemory) {
    const memoryContext = sessionMemory ? this.formatMemoryContext(sessionMemory) : '';
    
    return `אתה מערכת AI מתקדמת למומחה חילוץ והצלה עבור כוחות החירום בישראל. אתה מנתח תמונות בזמן אמת עם זיכרון מלא של כל מה שראית עד כה.

${memoryContext}

תפקידך המורחב:
1. 🔥 **זיהוי מתקדם עם זיכרון** - זכור כל אובייקט, אדם ומפגע שזיהית
2. 📊 **ניתוח השוואתי** - השווה למה שראית בפריימים קודמים וזהה שינויים
3. 🎯 **מעקב אחר אובייקטים** - עקוב אחר תנועת אנשים ושינויים בסביבה
4. 💡 **המלצות מומחה** - תן המלצות מבוססות על ההקשר המלא והידע המצטבר
5. ⚠️ **חיזוי סכנות** - צפה סכנות עתידיות בהתבסס על מה שראית

חשוב מאוד! השתמש רק בסוגי הזיהוי הבאים (רשימה מוגבלת מבסיס הנתונים):
- "fire" - לשריפות פעילות, להבות
- "smoke" - לעשן מכל סוג (שחור, לבן, כבד, קל)
- "person" - לאנשים (כולל מבוגרים, נפגעים, לכודים)
- "child" - לילדים (זיהוי ספציפי לקטינים)
- "gas_tank" - לבלוני גז, מיכלי דלק מסוכנים
- "wire" - לחוטים חשמליים חשופים, כבלים מסוכנים
- "structural_damage" - לנזק מבני (כולל מבנים קרוסים, פגועים, לא יציבים, קירות שבורים)

אל תשתמש בסוגים אחרים! במיוחד אל תשתמש ב:
- buildingCollapse (השתמש ב-structural_damage במקום)
- damagedBuilding (השתמש ב-structural_damage במקום)
- electrical_hazard (השתמש ב-wire במקום)
- explosion_risk (השתמש ב-gas_tank במקום)
- vehicle (לא נתמך כרגע)

דוגמאות לשימוש נכון:
- מבנה קרוס/פגוע/לא יציב → "type": "structural_damage"
- אדם מבוגר/נפגע/בסכנה/לכוד → "type": "person"  
- ילד/קטין/ילדה → "type": "child"
- בלון גז/מיכל דלק/גז → "type": "gas_tank"
- חוט חשמל חשוף/כבל פגוע → "type": "wire"

יכולות זיהוי מומחה עם זיכרון:

🔥 **ניתוח אש ועשן מתקדם**:
- זכור היכן ראית אש/עשן בפריימים קודמים
- נתח כיוון התפשטות והאצה
- זהה אם העשן הופך כהה יותר (החמרה במצב)
- חשב זמן משוער עד הגעת האש לאזורים אחרים
- אם ראית מיכל גז בעבר - התרע על סכנת פיצוץ מתקרבת

👥 **מעקב אחר אנשים**:
- זהה אם זה אותו אדם שראית קודם (לפי מיקום, לבוש, תכונות)
- עדכן ספירה מדויקת - אל תספור אותו אדם פעמיים
- עקוב אחר מצב פצועים - האם יש החמרה/שיפור
- זהה אם מישהו שהיה בתנועה הפסיק לזוז (סכנה!)
- דווח על אנשים חדשים שנכנסו לאזור הסכנה

🏠 **ניתוח מבני מתפתח** (structural_damage):
- השווה ליציבות שראית קודם
- זהה סדקים חדשים או הרחבה של קיימים
- הערך זמן עד קריסה אפשרית
- עדכן נתיבי מילוט בהתאם לשינויים
- אם דלת שהייתה פתוחה נסגרה - ייתכן שמישהו לכוד

⚡ **מפגעי חשמל** (wire):
- אם ראית ארון חשמל - האם עדיין יש זרם?
- עקוב אחר ניצוצות או קשתות חוזרות
- אם המצב החמיר - המלץ על ניתוק מיידי
- חשב מרחק בטוח מעודכן

💥 **חומרים מסוכנים** (gas_tank):
- אם ראית בלון גז + עכשיו יש אש = התראה מיידית!
- עקוב אחר דליפות - האם מתרחבות?
- חשב זמן עד סכנה קריטית
- זכור מיקום של חומרים מסוכנים גם אם לא נראים כעת

📍 **המלצות מומחה מבוססות זיכרון**:
- "זהירות! לפני 30 שניות ראיתי בלון גז בפינה השמאלית - התרחק!"
- "יש החמרה! העשן הפך משחור - סכנת הרעלה מוגברת!"
- "שים לב! היו 3 ילדים בחדר הזה - ראיתי רק 2 כעת!"
- "הסדק בקיר התרחב - פנה מיד! קריסה צפויה!"
- "האש מתקדמת מהר יותר - נותרו כ-2 דקות לפינוי!"

החזר תשובה בפורמט JSON מורחב הכולל היסטוריה וניתוח השוואתי:
{
  "currentFrame": {
    "urgent": true/false,
    "urgentVoiceAlert": "הודעה קולית דחופה",
    "detections": [
      {
        "type": "fire/smoke/person/structural_damage/electrical_hazard/explosion_risk/vehicle/none",
        "severity": "low/medium/high/critical/none",
        "confidence": 0.0-1.0,
        "description": "תיאור מפורט בעברית",
        "location": "מיקום מדויק בתמונה",
        "count": "מספר אובייקטים מסוג זה (אם רלוונטי)",
        "estimatedAge": "גיל משוער (רק לאנשים)",
        "condition": "מצב הפציעה (רק לאנשים)",
        "immediateAction": "פעולה מיידית נדרשת",
        "bounding_box": { "x": 0.0-1.0, "y": 0.0-1.0, "width": 0.0-1.0, "height": 0.0-1.0 }
      }
    ],
    "newThreats": ["איומים חדשים שלא היו קודם"],
    "missingPeople": ["אנשים שנעלמו מהפריים"],
    "changedConditions": ["שינויים משמעותיים מפריימים קודמים"]
  },
  "memoryAnalysis": {
    "timeBasedWarnings": ["אזהרות מבוססות זמן"],
    "predictedDangers": ["סכנות צפויות בדקות הקרובות"],
    "trackingUpdates": {
      "peopleCount": {
        "total": מספר,
        "newlyDetected": מספר,
        "missing": מספר,
        "conditionChanges": ["שינויים במצב אנשים"]
      },
      "hazardProgression": ["התפתחות מפגעים"]
    }
  },
  "expertRecommendations": {
    "immediate": ["פעולות דחופות מבוססות זיכרון"],
    "predictive": ["פעולות מונעות למניעת סכנה עתידית"],
    "tactical": ["המלצות טקטיות מבוססות ניסיון"],
    "equipment": ["ציוד נדרש בהתבסס על מה שנראה"]
  },
  "statistics": {
    "sessionDuration": "זמן מתחילת הסריקה",
    "totalPeopleEverSeen": מספר,
    "criticalEventsCount": מספר,
    "hazardTrend": "improving/stable/deteriorating"
  }
}

זכור: אתה המומחה בשטח! השתמש בזיכרון שלך כדי להציל חיים!`;
  }

  formatMemoryContext(memory) {
    if (!memory || memory.detectionHistory.length === 0) {
      return "זו הסריקה הראשונה - אין היסטוריה קודמת.";
    }

    const lastDetections = memory.detectionHistory.slice(-5); // 5 פריימים אחרונים
    const peopleInfo = Array.from(memory.trackedPeople.entries())
      .map(([id, info]) => `${id}: ${info.description}, מצב: ${info.condition}`)
      .join('\n');
    
    const hazardsInfo = Array.from(memory.trackedObjects.entries())
      .filter(([_, obj]) => obj.type.includes('hazard'))
      .map(([id, info]) => `${id}: ${info.description}`)
      .join('\n');

    return `
זיכרון מצטבר מהסריקה:
- זמן סריקה: ${Math.floor((Date.now() - memory.sessionStartTime) / 1000)} שניות
- סה"כ אנשים שזוהו: ${memory.cumulativeStats.totalPeopleDetected.size}
- מפגעים פעילים: ${memory.cumulativeStats.hazardsIdentified.size}
- אנשים במעקב: ${peopleInfo || 'אין'}
- מפגעים במעקב: ${hazardsInfo || 'אין'}
- מצב חשמל: ${memory.environmentContext.hasElectricity ? 'פעיל' : 'מנותק'}
- סכנת גז: ${memory.environmentContext.hasGasLeak ? 'יש דליפה!' : 'אין'}
`;
  }

  getAdvancedSystemPrompt() {
    return `אתה מערכת AI מתקדמת לזיהוי וניתוח מצבי חירום עבור כוחות הביטחון בישראל. אתה מנתח תמונות בזמן אמת מיחידת שטח.

תפקידך:
1. לזהות סכנות ואיומים בזמן אמת
2. לספק הנחיות ברורות וקצרות בעברית לכוח בשטח
3. להתריע על סכנות מיידיות
4. לספק המלצות פעולה מפורטות

יכולות זיהוי מתקדמות:

🔥 זיהוי שריפות ועשן:
- הבחן בין עשן שחור (חומרים כימיים/פלסטיים מסוכנים) לעשן לבן (אדים/חומרים אורגניים)
- זהה להבות גלויות וכיוון התפשטות
- הערך סכנת התפשטות וזמן פינוי משוער

👥 זיהוי וספירת אנשים:
- זהה והבחן: ילדים (גיל משוער), נשים, גברים, מבוגרים
- ספור במדויק מספר אנשים בסצנה
- זהה פצועים: דימום נראה, חוסר תנועה, תנוחות חריגות
- זהה סימני חיים: תנועה, נשימה נראית

🏠 הערכת מצב מבנים:
- דלתות: פתוחות/סגורות/שבורות/חסומות
- הערך יציבות: סדקים, נטייה, סכנת קריסה
- זהה נתיבי כניסה/יציאה בטוחים
- זהה סימנים לנוכחות אנשים: צעצועים, בגדים, ציוד אישי

⚡ מפגעים חשמליים:
- חוטי חשמל חשופים/קרועים
- ניצוצות או קשתות חשמליות
- ארונות חשמל פגועים/פתוחים
- מרחק בטוח נדרש

💥 חומרים מסוכנים:
- בלוני גז (גודל, צבע, מצב)
- מכלי דלק/כימיקלים
- רכבים בוערים - סכנת פיצוץ
- חומרים חשודים/לא מזוהים

📍 מיקום ונתונים:
- קומה משוערת (לפי חלונות/מבנה)
- סימני זיהוי: מספרי דירה, שלטים
- גישה לכוחות נוספים

החזר תשובה **אך ורק** בפורמט JSON הבא:
{
  "urgent": true/false,
  "urgentVoiceAlert": "הודעה קולית קצרה ודחופה (רק אם urgent=true)",
  "detections": [
    {
      "type": "fire/smoke/person/child/gas_tank/wire/structural_damage",
      "subType": "פירוט נוסף (black_smoke/white_smoke/child/adult/etc)",
      "severity": "critical/high/medium/low",
      "confidence": 0.0-1.0,
      "description": "תיאור מפורט ומדויק",
      "location": "מיקום מדויק בסצנה",
      "count": מספר (לאנשים/פריטים),
      "estimatedAge": "גיל משוער (לאנשים)",
      "condition": "מצב (לפצועים)",
      "immediateAction": "פעולה מיידית נדרשת"
    }
  ],
  "recommendations": {
    "immediate": ["פעולה דחופה 1", "פעולה דחופה 2"],
    "safety": ["אזהרת בטיחות 1", "אזהרת בטיחות 2"],
    "medical": ["טיפול רפואי נדרש"],
    "evacuation": ["הנחיות פינוי"],
    "equipment": ["ציוד נדרש"]
  },
  "statistics": {
    "people": {
      "total": 0,
      "children": 0,
      "adults": 0,
      "elderly": 0,
      "injured": 0,
      "trapped": 0
    },
    "hazards": {
      "fires": 0,
      "gasLeaks": 0,
      "electricalHazards": 0,
      "structuralDamages": 0
    }
  },
  "voiceInstructions": [
    "הנחיה קולית 1",
    "הנחיה קולית 2"
  ],
  "riskAssessment": {
    "overallRisk": "critical/high/medium/low",
    "timeToEvacuate": "זמן משוער בדקות",
    "spreadRisk": "סיכון התפשטות high/medium/low"
  }
}

דוגמאות להודעות קוליות דחופות:
- "זהירות! שריפה פעילה! פנה מיד דרך היציאה המערבית!"
- "סכנת חיים! 3 ילדים לכודים בקומה השנייה! דרוש סיוע מיידי!"
- "התרחק! בלון גז בסכנת פיצוץ! מרחק מינימום 50 מטר!"
- "עשן שחור רעיל! חבוש מסכה מיד!"
- "זהירות! קריסת תקרה צפויה! צא מהמבנה!"
- "חוט חשמל חי! אל תתקרב! נתק חשמל ראשי!"

תמיד דבר בעברית ברורה ותמציתית. בחירום - קצר וחד!`;
  }

  async createSession(sessionId, options = {}) {
    try {
      console.log('🎥 Creating Gemini Live session:', sessionId);
      
      // Initialize session memory
      this.initializeSessionMemory(sessionId);
      const memory = this.sessionMemories.get(sessionId);
      
      // Use enhanced system prompt with memory
      const systemPrompt = this.getEnhancedSystemPrompt(memory);
      
      // Create model with memory-aware configuration
      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 0.9,
          topK: 1,
          topP: 1,
          maxOutputTokens: 2048,
        },
        systemInstruction: systemPrompt
      });

      // Start chat session for frame analysis
      const chat = model.startChat({
        history: [],
      });

      const sessionData = {
        sessionId,
        model,
        chat,
        startTime: Date.now(),
        frameCount: 0,
        peopleTracked: new Set(),
        lastAnalysis: null,
        options
      };

      this.sessions.set(sessionId, sessionData);
      
      console.log('✅ Gemini Live session created with memory:', sessionId);
      return { success: true, sessionId };
    } catch (error) {
      console.error('❌ Error creating Gemini session:', error);
      throw error;
    }
  }

  async analyzeFrame(sessionId, frameData) {
    try {
      console.log(`🎥 Analyzing frame for session: ${sessionId}`);
      
      // בדיקה אם ה-session קיים, ואם לא - יצירה אוטומטית
      if (!this.sessions.has(sessionId)) {
        console.log(`⚠️ Session ${sessionId} not found, creating automatically...`);
        await this.createSession(sessionId, {
          unitId: sessionId, // השתמש ב-sessionId כ-unitId זמני
          features: {
            peopleDetection: true,
            fireAndSmokeAnalysis: true,
            structuralDamageAssessment: true
          }
        });
      }

      let session = this.sessions.get(sessionId);
      if (!session) {
        console.log(`🔄 Session ${sessionId} not found, creating new session...`);
        await this.createSession(sessionId);
        session = this.sessions.get(sessionId);
        if (!session) {
          throw new Error('Failed to create session');
        }
      }

      try {
        session.frameCount++;
        const currentTime = Date.now();
        const sessionDuration = Math.floor((currentTime - session.startTime) / 1000);

        // Convert base64 to image part
        const imagePart = {
          inlineData: {
            data: frameData,
            mimeType: 'image/jpeg'
          }
        };

        // Build context from previous analysis
        let context = '';
        if (session.lastAnalysis) {
          context = `\nניתוח קודם (לפני ${sessionDuration} שניות):
- אנשים שזוהו: ${session.lastAnalysis.currentFrame?.peopleCount?.total || 0}
- סכנות פעילות: ${session.lastAnalysis.currentFrame?.detections?.filter(d => d.severity === 'critical' || d.severity === 'high').length || 0}
- מיקומי אנשים קודמים: ${JSON.stringify(session.lastAnalysis.currentFrame?.detections?.filter(d => d.type === 'person').map(d => d.location) || [])}
`;
        }

        const prompt = `נתח את התמונה הזו. זוהי פריים ${session.frameCount} בסשן של ${sessionDuration} שניות.
${context}
זהה כל האיומים, ספור אנשים, והשווה למצב הקודם.
אם יש שינוי משמעותי או סכנה חדשה - סמן כדחוף והוסף הודעה קולית ברורה וקצרה.
החזר JSON בלבד.`;

        // Send to Gemini
        const result = await session.chat.sendMessage([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        // Try to parse JSON response
        let analysis;
        try {
          // Clean the response - remove markdown code blocks if present
          const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          analysis = JSON.parse(cleanedText);
        } catch (parseError) {
          console.error('Failed to parse Gemini response:', text);
          // Return a default structure
          analysis = {
            currentFrame: {
              urgent: false,
              urgentVoiceAlert: null,
              detections: [],
              peopleCount: { total: 0, children: 0, adults: 0, elderly: 0, injured: 0, trapped: 0 }
            },
            memoryAnalysis: {},
            expertRecommendations: { immediate: [], safety: [], medical: [], evacuation: [], equipment: [] },
            totalPeopleTracked: session.peopleTracked.size,
            sessionDuration: sessionDuration.toString()
          };
        }

        // Update session tracking
        if (analysis.currentFrame?.detections) {
          analysis.currentFrame.detections.forEach(detection => {
            if (detection.type === 'person') {
              session.peopleTracked.add(`${detection.location}_${session.frameCount}`);
            }
          });
        }

        analysis.totalPeopleTracked = session.peopleTracked.size;
        analysis.sessionDuration = sessionDuration.toString();

        // Update session memory
        this.updateSessionMemory(sessionId, analysis);

        session.lastAnalysis = analysis;

        return analysis;
      } catch (error) {
        console.error('Error analyzing frame:', error);
        throw error;
      }
    } catch (outerError) {
      console.error('Critical error in analyzeFrame:', outerError);
      throw outerError;
    }
  }

  async endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      console.log('🛑 Gemini session ended:', sessionId);
      return { success: true };
    }
    return { success: false, error: 'Session not found' };
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  // Generate voice instructions based on analysis
  generateVoiceAlert(analysis) {
    if (!analysis.urgent) return null;

    const alerts = [];
    
    // Priority alerts based on detections
    for (const detection of analysis.detections) {
      if (detection.severity === 'critical') {
        switch (detection.type) {
          case 'fire':
            alerts.push(`זהירות! ${detection.description}! ${detection.immediateAction}`);
            break;
          case 'trapped_person':
            alerts.push(`דחוף! ${detection.count} אנשים לכודים ${detection.location}!`);
            break;
          case 'gas_hazard':
            alerts.push(`סכנה! בלון גז! התרחק מיד!`);
            break;
          case 'electrical_hazard':
            alerts.push(`זהירות! סכנת התחשמלות! ${detection.immediateAction}`);
            break;
        }
      }
    }

    // Add urgent voice alert if provided
    if (analysis.urgentVoiceAlert) {
      alerts.unshift(analysis.urgentVoiceAlert);
    }

    return alerts.join(' ');
  }

  // Get concise recommendations for display
  getQuickRecommendations(analysis) {
    const quick = [];
    
    if (analysis.recommendations.immediate.length > 0) {
      quick.push(...analysis.recommendations.immediate.slice(0, 2));
    }
    
    if (analysis.recommendations.safety.length > 0) {
      quick.push(analysis.recommendations.safety[0]);
    }

    return quick;
  }

  // Format analysis for control center
  formatForControlCenter(analysis, unitId) {
    return {
      unitId,
      timestamp: analysis.timestamp,
      urgent: analysis.urgent,
      summary: {
        people: analysis.statistics.people,
        hazards: analysis.statistics.hazards,
        overallRisk: analysis.riskAssessment.overallRisk
      },
      criticalDetections: analysis.detections.filter(d => 
        d.severity === 'critical' || d.severity === 'high'
      ),
      voiceAlert: this.generateVoiceAlert(analysis),
      quickActions: this.getQuickRecommendations(analysis)
    };
  }

  async analyzeWithMemory(imageData, sessionId) {
    if (!this.model) {
      throw new Error("Gemini model not initialized");
    }

    // אתחול זיכרון אם צריך
    if (!this.sessionMemories.has(sessionId)) {
      this.initializeSessionMemory(sessionId);
    }

    const memory = this.sessionMemories.get(sessionId);
    const currentTime = Date.now();
    
    try {
      // הכנת ההנחיה עם הזיכרון
      const systemPrompt = this.getEnhancedSystemPrompt(memory);
      
      // הוספת ההיסטוריה האחרונה להקשר
      const recentHistory = memory.detectionHistory.slice(-3).map(h => 
        `[לפני ${Math.floor((currentTime - h.timestamp) / 1000)} שניות]: ${h.summary}`
      ).join('\n');
      
      const fullPrompt = `${systemPrompt}
      
היסטוריה אחרונה:
${recentHistory || 'אין היסטוריה'}

נתח את התמונה הנוכחית בהשוואה למה שראית קודם:`;

      const result = await this.model.generateContent([
        { text: fullPrompt },
        { inlineData: { data: imageData, mimeType: 'image/jpeg' } }
      ]);
      
      const response = await result.response;
      const analysisText = response.text();
      
      // פרסור התוצאה
      let analysis;
      try {
        // נסה לחלץ JSON מהתשובה
        const jsonMatch = analysisText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[1]);
        } else {
          // נסה לפרסר ישירות
          analysis = JSON.parse(analysisText);
        }
      } catch (e) {
        // אם נכשל, צור מבנה בסיסי
        analysis = this.createBasicAnalysisFromText(analysisText);
      }
      
      // עדכון הזיכרון עם הניתוח החדש
      this.updateSessionMemory(sessionId, analysis);
      
      // הוספת מידע מהזיכרון לתוצאה
      analysis.memoryEnhanced = true;
      analysis.sessionDuration = Math.floor((currentTime - memory.sessionStartTime) / 1000);
      analysis.totalPeopleTracked = memory.cumulativeStats.totalPeopleDetected.size;
      
      return analysis;
      
    } catch (error) {
      console.error('Error in memory-enhanced analysis:', error);
      
      // נסה fallback למודל 1.5
      if (error.message?.includes('model') || error.status === 404) {
        console.log('⚠️ Falling back to Gemini 1.5 Flash...');
        return await this.fallbackToOldModel(imageData, sessionId, memory);
      }
      
      throw error;
    }
  }

  async fallbackToOldModel(imageData, sessionId, memory) {
    try {
      // נסה עם המודל הישן
      const oldModel = this.genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.2,
        },
        safetySettings: this.model.safetySettings
      });
      
      const systemPrompt = this.getEnhancedSystemPrompt(memory);
      const result = await oldModel.generateContent([
        { text: systemPrompt },
        { inlineData: { data: imageData, mimeType: 'image/jpeg' } }
      ]);
      
      const response = await result.response;
      const analysisText = response.text();
      
      // פרסור ועיבוד כמו קודם
      let analysis = this.parseAnalysisResponse(analysisText);
      this.updateSessionMemory(sessionId, analysis);
      
      analysis.modelVersion = '1.5-flash-fallback';
      analysis.memoryEnhanced = true;
      
      return analysis;
      
    } catch (fallbackError) {
      console.error('Fallback model also failed:', fallbackError);
      // החזר ניתוח בסיסי
      return this.createEmergencyBasicAnalysis();
    }
  }

  updateSessionMemory(sessionId, newAnalysis) {
    const memory = this.sessionMemories.get(sessionId);
    if (!memory) return;
    
    const timestamp = Date.now();
    
    // הוסף להיסטוריה
    memory.detectionHistory.push({
      timestamp,
      analysis: newAnalysis,
      summary: this.createAnalysisSummary(newAnalysis)
    });
    
    // שמור רק 20 פריימים אחרונים
    if (memory.detectionHistory.length > 20) {
      memory.detectionHistory.shift();
    }
    
    // עדכן מעקב אנשים
    if (newAnalysis.currentFrame?.detections) {
      newAnalysis.currentFrame.detections.forEach(detection => {
        if (detection.type === 'person') {
          const personId = this.generatePersonId(detection);
          
          if (!memory.trackedPeople.has(personId)) {
            memory.cumulativeStats.totalPeopleDetected.add(personId);
          }
          
          memory.trackedPeople.set(personId, {
            lastSeen: timestamp,
            description: detection.description,
            condition: detection.condition || 'unknown',
            location: detection.location,
            history: [...(memory.trackedPeople.get(personId)?.history || []), timestamp]
          });
        }
        
        // עדכון מפגעים
        if (detection.severity === 'critical' || detection.type.includes('hazard')) {
          const hazardId = `${detection.type}_${detection.location}`;
          memory.cumulativeStats.hazardsIdentified.add(hazardId);
          
          memory.trackedObjects.set(hazardId, {
            type: detection.type,
            description: detection.description,
            firstSeen: memory.trackedObjects.get(hazardId)?.firstSeen || timestamp,
            lastSeen: timestamp,
            severity: detection.severity
          });
        }
      });
    }
    
    // נקה אנשים שלא נראו יותר מ-30 שניות
    const cutoffTime = timestamp - 30000;
    for (const [personId, data] of memory.trackedPeople.entries()) {
      if (data.lastSeen < cutoffTime) {
        memory.trackedPeople.delete(personId);
      }
    }
    
    // עדכן הקשר סביבתי
    if (newAnalysis.currentFrame?.detections) {
      const hasGas = newAnalysis.currentFrame.detections.some(d => 
        d.type.includes('gas') || d.description?.includes('גז')
      );
      const hasFire = newAnalysis.currentFrame.detections.some(d => 
        d.type === 'fire' || d.description?.includes('אש')
      );
      
      if (hasGas) memory.environmentContext.hasGasLeak = true;
      if (hasFire && memory.environmentContext.hasGasLeak) {
        // זוהתה סכנת פיצוץ!
        memory.cumulativeStats.criticalEventsTimeline.push({
          timestamp,
          event: 'EXPLOSION_RISK',
          description: 'זוהתה אש בקרבת דליפת גז!'
        });
      }
    }
    
    memory.lastAnalysisTime = timestamp;
  }

  generatePersonId(detection) {
    // יצירת ID ייחודי לאדם בהתבסס על מיקום ותיאור
    const location = detection.location || 'unknown';
    const clothing = detection.description?.match(/לובש[^,]*/)?.[0] || '';
    const age = detection.estimatedAge || '';
    return `person_${location}_${clothing}_${age}`.replace(/\s+/g, '_');
  }

  createAnalysisSummary(analysis) {
    const detections = analysis.currentFrame?.detections || [];
    const critical = detections.filter(d => d.severity === 'critical');
    const people = detections.filter(d => d.type === 'person');
    
    return `${people.length} אנשים, ${critical.length} סכנות קריטיות`;
  }

  parseAnalysisResponse(text) {
    try {
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      return JSON.parse(text);
    } catch (e) {
      return this.createBasicAnalysisFromText(text);
    }
  }

  createBasicAnalysisFromText(text) {
    // ניתוח טקסט בסיסי אם JSON נכשל
    const urgent = text.includes('דחוף') || text.includes('מיידי') || text.includes('סכנה');
    const hasFire = text.includes('אש') || text.includes('שריפה');
    const hasPeople = text.includes('אדם') || text.includes('אנשים') || text.includes('פצוע');
    
    return {
      currentFrame: {
        urgent,
        urgentVoiceAlert: urgent ? "זוהתה סכנה! בדוק את ההמלצות" : null,
        detections: [
          hasFire && { type: 'fire', severity: 'critical', description: 'זוהתה אש' },
          hasPeople && { type: 'person', severity: 'high', description: 'זוהה אדם' }
        ].filter(Boolean),
        newThreats: [],
        missingPeople: [],
        changedConditions: []
      },
      memoryAnalysis: {
        timeBasedWarnings: [],
        predictedDangers: [],
        trackingUpdates: {
          peopleCount: { total: 0, newlyDetected: 0, missing: 0, conditionChanges: [] },
          hazardProgression: []
        }
      },
      expertRecommendations: {
        immediate: ["סרוק את האזור בזהירות"],
        predictive: [],
        tactical: [],
        equipment: []
      },
      statistics: {
        sessionDuration: "0",
        totalPeopleEverSeen: 0,
        criticalEventsCount: 0,
        hazardTrend: "stable"
      }
    };
  }

  createEmergencyBasicAnalysis() {
    return {
      urgent: false,
      urgentVoiceAlert: null,
      error: "System temporarily unavailable",
      recommendations: ["המשך בזהירות", "הסתמך על הערכה אישית"],
      modelVersion: "emergency-basic"
    };
  }

  // מחיקת זיכרון כשהסשן מסתיים
  clearSessionMemory(sessionId) {
    this.sessionMemories.delete(sessionId);
    console.log(`🧹 Cleared memory for session ${sessionId}`);
  }

  // קבלת סטטיסטיקות זיכרון
  getSessionStats(sessionId) {
    const memory = this.sessionMemories.get(sessionId);
    if (!memory) return null;
    
    return {
      duration: Math.floor((Date.now() - memory.sessionStartTime) / 1000),
      totalPeople: memory.cumulativeStats.totalPeopleDetected.size,
      activeHazards: memory.cumulativeStats.hazardsIdentified.size,
      criticalEvents: memory.cumulativeStats.criticalEventsTimeline.length,
      currentlyTracking: {
        people: memory.trackedPeople.size,
        objects: memory.trackedObjects.size
      }
    };
  }
}

module.exports = new GeminiLiveService();
