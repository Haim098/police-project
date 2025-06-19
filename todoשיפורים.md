# תוכנית עבודה מסודרת - שיפורי RescuerLens 🚀

## סקירת המצב הנוכחי

המערכת עובדת בצורה בסיסית עם חיבור ל-Supabase, ניתוח AI חי, ותקשורת בזמן אמת בין יחידות השטח למרכז השליטה.
אך ישנם מספר רב של שיפורים נדרשים לפני שהמערכת תהיה מוכנה לשימוש מבצעי.

---

## 🎯 סטטוס נוכחי - Phase 2 הושלמה בהצלחה! ✅

### Phase 1 - תיקונים קריטיים ✅ (הושלם)
1. תיקון backend connections
2. הסרת ערכים סטטיים
3. תיקון כפתורים לא פעילים

### Phase 2 - מימוש הושלם בהצלחה! ✅

#### 1. אינטגרציית Google Maps ✅
- [x] התקנת @react-google-maps/api
- [x] יצירת קומפוננטת MapView
- [x] הוספת המפה למרכז השליטה
- [x] תמיכה בתצוגת tabs למפות נפרדות
- [ ] הגדרת מפתח API בקובץ .env.local (דרוש מהמשתמש)

#### 2. תמיכה במעקב מיקום מרובה יחידות ✅
- [x] עדכון פונקציית updateUnitLocation לשליחה דרך WebSocket
- [x] הוספת מאזין לעדכוני מיקום במרכז השליטה
- [x] בדיקת הרשאות מיקום והתראה במקרה של דחייה
- [x] הוספת tabs לתצוגת מפות נפרדות לכל יחידה
- [x] תמיכה בעדכוני מיקום בזמן אמת למספר יחידות
- [x] תיקון שגיאות TypeScript (getUnitTypeIcon, currentTime)
- [x] שיפור תצוגת מידע המיקום ביחידת השטח
- [x] **תיקון שגיאות Supabase** - הוספת עמודות lat, lng, last_update לטבלת units
- [x] **תיקון שגיאת Hydration** - תיקון עדכון הזמן בצד הלקוח
- [x] **הוספת בקשת הרשאת מיקום** - כפתור לבקשת הרשאה + בקשה אוטומטית
- [x] **שיפור מעקב מיקום** - בקשת הרשאה אוטומטית עם fallback
- [x] **תיקון UI במרכז השליטה** - תיקון הסתרת כפתורי הטאבים מאחורי המפה
- [x] **שיפור עיצוב הטאבים** - הוספת border ו-z-index לבהירות טובה יותר

#### 3. שידור וידאו בין יחידות 🔄 (בהמתנה לפאזה הבאה)

---

## 🚀 הוראות הרצה

### הרצת האפליקציה:
```bash
# הרצת השרת הקדמי על פורט 3002
pnpm dev -- --port 3002

# הרצת השרת האחורי על פורט 3001 (בטרמינל נפרד)
cd server
npm start
```

### גישה למערכת:
- **עמוד ראשי**: http://localhost:3002
- **מרכז שליטה**: http://localhost:3002/control-center  
- **יחידת שטח**: http://localhost:3002/field-unit

### הגדרות נדרשות:
1. **מפתח Google Maps** - צריך להוסיף בקובץ `.env.local`:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-api-key-here
   ```

2. **Supabase** - אם יש צורך בחיבור למסד נתונים אמיתי

---

## 2. שיפורי אינטגרציה 🔗

### 2.1 Database Integration
- [ ] **סנכרון נתוני יחידות**
  - טעינת נתוני יחידה מה-DB בעת כניסה
  - עדכון אוטומטי של סטטוס/מיקום/סוללה
  - שמירת הקלטות וידאו ב-Supabase Storage

### 2.2 WebSocket Improvements
- [ ] **הודעות דו-כיווניות משופרות**
  - אישור קבלה של הודעות
  - סטטוס "נקרא/לא נקרא"
  - היסטוריית הודעות

### 2.3 AI Integration
- [ ] **תמיכה ב-Multi-Detection**
  - זיהוי מספר אובייקטים בפריים אחד
  - Bounding boxes מדויקים יותר
  - שמירת תמונות של זיהויים קריטיים

---

## 3. שיפורי UI/UX 🎨

### 3.1 עיצוב אחיד
- [ ] **סרגל עליון אחיד**
  - לוגו ושם המערכת בכל הדפים
  - ניווט מהיר בין ממשקים
  - פרופיל משתמש והתנתקות

### 3.2 נגישות ו-Mobile
- [ ] **Responsive Design**
  - התאמה למסכי טלפון
  - כפתורים גדולים יותר לשימוש בשטח
  - ממשק חשוך/בהיר

### 3.3 משוב ויזואלי
- [ ] **אנימציות וטרנזישנים**
  - Loading states מתאימים
  - התראות Toast במקום alert()
  - Progress bars להעלאות

---

## 4. פיצ'רים חדשים מתקדמים 🚀

### 4.1 מערכת מפות אינטראקטיבית
- [ ] **Mapbox/Google Maps Integration**
  - הצגת יחידות בזמן אמת על המפה
  - מסלולי נסיעה אופטימליים
  - אזורי סכנה מסומנים
  - Heatmap של אירועים

### 4.2 מערכת וידאו מתקדמת
- [ ] **WebRTC Streaming**
  - שידור חי ישיר בין יחידות למרכז
  - Multi-viewer במרכז השליטה
  - הקלטה ושמירה אוטומטית
  - Picture-in-Picture mode

### 4.3 מערכת התראות חיצוניות
- [ ] **Notifications**
  - SMS דרך Twilio לאירועים קריטיים
  - Email alerts דרך SendGrid
  - Push notifications לאפליקציה
  - WhatsApp integration

### 4.4 אנליטיקה ודוחות
- [ ] **Dashboard מתקדם**
  - סטטיסטיקות בזמן אמת
  - גרפים של מגמות
  - דוחות יומיים/שבועיים
  - ייצוא ל-PDF/Excel

---

## 5. אבטחה וביצועים 🛡️

### 5.1 Authentication
- [ ] **Supabase Auth**
  - כניסה עם email/password
  - Role-based permissions
  - Session management
  - 2FA support

### 5.2 Performance
- [ ] **אופטימיזציות**
  - Lazy loading לרכיבים כבדים
  - Image optimization
  - Caching strategies
  - Rate limiting

### 5.3 Security
- [ ] **הקשחת אבטחה**
  - HTTPS enforcement
  - Input validation
  - SQL injection prevention
  - XSS protection

---

## 6. בדיקות ואיכות 🧪

### 6.1 Testing
- [ ] **כיסוי בדיקות מלא**
  - Unit tests ל-hooks
  - Integration tests ל-API
  - E2E tests לתרחישי שימוש
  - Performance testing

### 6.2 Monitoring
- [ ] **מעקב ולוגים**
  - Error tracking (Sentry)
  - Performance monitoring
  - User analytics
  - Uptime monitoring

---

## 7. סדר עדיפויות מומלץ 📋

### Phase 1 - תיקונים דחופים (1-2 ימים)
1. תיקון חיבורי Backend
2. הסרת ערכים סטטיים
3. תיקון כפתורים לא פעילים

### Phase 2 - מימוש בתהליך 🏗️

#### 1. אינטגרציית Google Maps ✅
- [x] התקנת @react-google-maps/api
- [x] יצירת קומפוננטת MapView
- [x] הוספת המפה למרכז השליטה
- [x] תמיכה בתצוגת tabs למפות נפרדות
- [ ] הגדרת מפתח API בקובץ .env.local (דרוש מהמשתמש)

#### 2. תמיכה במעקב מיקום מרובה יחידות ✅
- [x] עדכון פונקציית updateUnitLocation לשליחה דרך WebSocket
- [x] הוספת מאזין לעדכוני מיקום במרכז השליטה
- [x] בדיקת הרשאות מיקום והתראה במקרה של דחייה
- [x] הוספת tabs לתצוגת מפות נפרדות לכל יחידה
- [x] תמיכה בעדכוני מיקום בזמן אמת למספר יחידות
- [x] תיקון שגיאות TypeScript (getUnitTypeIcon, currentTime)
- [x] שיפור תצוגת מידע המיקום ביחידת השטח
- [x] **תיקון שגיאות Supabase** - הוספת עמודות lat, lng, last_update לטבלת units
- [x] **תיקון שגיאת Hydration** - תיקון עדכון הזמן בצד הלקוח
- [x] **הוספת בקשת הרשאת מיקום** - כפתור לבקשת הרשאה + בקשה אוטומטית
- [x] **שיפור מעקב מיקום** - בקשת הרשאה אוטומטית עם fallback
- [x] **תיקון UI במרכז השליטה** - תיקון הסתרת כפתורי הטאבים מאחורי המפה
- [x] **שיפור עיצוב הטאבים** - הוספת border ו-z-index לבהירות טובה יותר

#### 3. שידור וידאו בין יחידות 🔄 (בהמתנה לפאזה הבאה)

### Phase 3 - פיצ'רים מתקדמים (1-2 שבועות)
1. מערכת התראות חיצוניות
2. אנליטיקה ודוחות
3. Mobile optimization

### Phase 4 - הקשחה ובדיקות (1 שבוע)
1. Security hardening
2. Performance optimization
3. Comprehensive testing

---

## 8. הערות חשובות 📌

- **עדיפות ראשונה**: לוודא שכל הפונקציונליות הבסיסית עובדת לפני הוספת פיצ'רים
- **בדיקות בשטח**: חשוב לבדוק עם משתמשי קצה אמיתיים
- **תיעוד**: כל שינוי צריך להיות מתועד היטב
- **Backwards compatibility**: לשמור על תאימות לאחור

---

## 9. משאבים נדרשים 🛠️

- **APIs**:
  - Mapbox/Google Maps API key
  - Twilio account
  - SendGrid account
  
- **Infrastructure**:
  - Vercel Pro (for better performance)
  - Supabase Pro (for better limits)
  - CDN for media files

- **Tools**:
  - Sentry for error tracking
  - Datadog for monitoring
  - GitHub Actions for CI/CD

---

**עם ישראל חי! 🇮🇱**
המערכת הזו תציל חיים - בואו נעשה אותה מושלמת! 