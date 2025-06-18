# TODO – RescuerLens Development

> סדר משימות בקווים כללים (Sprint-level). ניתן לתעדף מחדש לפי אילוצי צוות.

## 0. Kickoff & Setup ✅
- [X] Clone repo + התקנת תלויות (`pnpm i`)
- [X] קביעת סטנדרטים (ESLint, Prettier, Husky)
- [X] קובץ ENV לדוגמה (`.env.example`)

## 1. Supabase בסיסי (Sprint 1) ✅
- [X] חיבור לפרויקט `police-mvp`
- [X] יצירת טבלאות `units`, `detections`, `events`
- [X] הגדרת RLS + אינדקסים בסיסיים
- [X] מרכז שליטה מחובר לנתונים אמיתיים
- [X] יחידת שטח מחוברת לסופבייס
- [X] עדכוני זמן אמת בין מרכז ליחידות
- [X] Supabase Real-time subscriptions
- [ ] Supabase Auth (Magic Link)

## 2. Backend Gateway (Sprint 2) ✅
- [X] Node/Express service תחת `/server`
- [X] WebSocket (Socket.IO) – broker בין FE ל-Supabase
- [X] תקשורת בזמן אמת בין מרכז שליטה ליחידות
- [X] AI Mock API (ready for Gemini integration)
- [X] Units CRUD API endpoints
- [X] Detections CRUD API endpoints
- [X] Real-time alerts & urgent notifications
- [ ] Proxy ל-Gemini Live API (שימוש ב-`GEMINI_KEY` מ-env) - Ready for integration

## 3. Video Streaming MVP (Sprint 3) - ✅ PHASE 1 COMPLETED
- [X] **Camera Access Infrastructure**
  - [X] useCamera hook with full permissions handling
  - [X] Real-time video preview in Field Unit interface
  - [X] Camera on/off controls with error handling
  - [X] Frame capture for AI analysis (base64 format)
- [X] **Video Recording System**  
  - [X] Start/stop recording with MediaRecorder API
  - [X] Recording indicators and status display
  - [X] Integrated audio/video controls
- [X] **AI Integration Enhancement**
  - [X] Real frame capture from live camera feed
  - [X] Enhanced AI route with Gemini Vision support
  - [X] Fallback to mock analysis when needed
  - [X] Real camera data processing pipeline
- [ ] **WebRTC Implementation (Phase 2)**
  - [ ] WebRTC peer connection setup
  - [ ] Video streaming to Control Center
  - [ ] Signaling through existing WebSocket
- [ ] **Advanced Features (Phase 3)**
  - [ ] Automatic AI analysis every N seconds
  - [ ] Video recording storage and playback
  - [ ] Real-time video feed in Control Center

## 4. Control Center Real-Time (Sprint 4)
- [X] Real-time unit status display
- [X] Detection alerts with acknowledgment
- [X] Two-way messaging system
- [X] Audio alerts for urgent notifications
- [ ] חיבור MapBox/Leaflet והצגת יחידות בזמן אמת
- [ ] Interactive map with unit positions
- [ ] Geographic filtering & search
- [ ] Route optimization suggestions

## 5. AI Integration (Sprint 3.5) - ✅ SIGNIFICANTLY ENHANCED  
- [X] Mock AI analysis system
- [X] Detection confidence & severity scoring
- [X] AI analysis trigger button
- [X] **NEW: Real camera frame capture**
- [X] **NEW: Gemini Vision API integration ready**
- [X] **NEW: Base64 image processing**
- [X] **NEW: Enhanced error handling & fallback**
- [ ] Multi-detection support (multiple objects per frame)
- [ ] AI recommendation system  
- [ ] Performance optimization for real-time analysis

## 6. Notifications (Sprint 5)
- [ ] Edge Function → Twilio (SMS/WhatsApp)
- [ ] Edge Function → SendGrid (Email)
- [X] Toggle התראות קוליות במרכז שליטה
- [ ] Push notifications for mobile
- [ ] Escalation rules (auto-notify on no response)

## 7. Polish & QA (Sprint 6)
- [ ] Lighthouse + Performance audit
- [ ] בדיקות Cypress/E2E – תרחיש שידור מלא
- [ ] Security hardening (Helmet, rate-limit, CSP)
- [ ] Error handling & recovery
- [ ] User experience improvements
- [ ] Mobile responsiveness optimization

## 8. Deployment (Sprint 7)
- [ ] Vercel ➜ FE
- [ ] Fly.io/Render ➜ Backend
- [ ] Supabase – Managed
- [ ] Environment variables setup
- [ ] CI/CD pipeline
- [ ] Monitoring & logging

---

## 📊 Current Status Summary (Updated):

### ✅ COMPLETED:
- **Infrastructure**: Next.js + Supabase + WebSocket Server
- **Real-time Communication**: Bidirectional messaging between Control Center & Field Units
- **Database Integration**: Units, Detections, Events with real-time subscriptions
- **AI Mock System**: Ready for Gemini integration with realistic scenarios
- **User Interfaces**: Functional Control Center & Field Unit pages
- **🎥 NEW: Video System Phase 1**: Live camera access, recording, and frame capture
- **🤖 NEW: Enhanced AI Integration**: Real camera frames + Gemini Vision API ready

### 🚀 NEXT PRIORITIES:
1. **🎥 Video Streaming Phase 2**: WebRTC peer-to-peer connection for live streaming
2. **🗺️ Interactive Maps**: Geographic display of units and incidents  
3. **🔔 External Notifications**: SMS/Email alerts via Twilio/SendGrid
4. **🔑 Authentication**: Supabase Auth implementation

### 🏗️ TECHNICAL DEBT:
- [ ] Supabase Authentication system
- [ ] Error handling & recovery mechanisms  
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Comprehensive testing

**Last Updated**: Sprint 3 Phase 1 COMPLETED - Video infrastructure implemented
**Team Status**: Ready for Video Streaming Phase 2 (WebRTC) or Maps implementation

