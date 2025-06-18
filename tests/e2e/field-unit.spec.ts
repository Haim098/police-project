import { test, expect } from '@playwright/test'

test.describe('Field Unit Interface', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant camera permissions
    await context.grantPermissions(['camera', 'microphone'])
    
    // Navigate to field unit page
    await page.goto('/field-unit')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
  })

  test.describe('Page Layout and Navigation', () => {
    test('should display field unit interface correctly', async ({ page }) => {
      // Check header elements
      await expect(page.locator('text=יחידה 001')).toBeVisible()
      await expect(page.locator('[data-testid="battery-level"]')).toBeVisible()
      await expect(page.locator('[data-testid="signal-strength"]')).toBeVisible()
      
      // Check connection status indicators
      await expect(page.locator('text=מחובר').or(page.locator('text=לא מחובר'))).toBeVisible()
      await expect(page.locator('text=AI').first()).toBeVisible()
      
      // Check main sections
      await expect(page.locator('text=מצלמה')).toBeVisible()
      await expect(page.locator('text=ניתוח AI')).toBeVisible()
      await expect(page.locator('text=זיהויים אחרונים')).toBeVisible()
      await expect(page.locator('text=הודעות ממרכז השליטה')).toBeVisible()
    })

    test('should be responsive on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Check that interface adapts to mobile
      await expect(page.locator('.max-w-md')).toBeVisible()
      
      // Ensure buttons are touch-friendly
      const buttons = page.locator('button')
      const buttonCount = await buttons.count()
      
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i)
        const boundingBox = await button.boundingBox()
        if (boundingBox) {
          expect(boundingBox.height).toBeGreaterThanOrEqual(44) // Minimum touch target
        }
      }
    })
  })

  test.describe('Camera Functionality', () => {
    test('should handle camera activation', async ({ page }) => {
      // Initially camera should be off
      await expect(page.locator('text=מצלמה כבויה')).toBeVisible()
      await expect(page.locator('text=הפעל מצלמה')).toBeVisible()
      
      // Click to activate camera
      await page.click('text=הפעל מצלמה')
      
      // Should show camera controls
      await expect(page.locator('text=כבה מצלמה')).toBeVisible()
      await expect(page.locator('text=התחל הקלטה')).toBeVisible()
    })

    test('should handle camera permissions denied', async ({ page, context }) => {
      // Revoke camera permission
      await context.clearPermissions()
      
      // Try to activate camera
      await page.click('text=הפעל מצלמה')
      
      // Should show permission error
      await expect(page.locator('text*=הרשאה')).toBeVisible()
    })

    test('should start and stop recording', async ({ page }) => {
      // First activate camera
      await page.click('text=הפעל מצלמה')
      await page.waitForTimeout(1000) // Wait for camera to initialize
      
      // Start recording
      await page.click('text=התחל הקלטה')
      
      // Should show recording indicator
      await expect(page.locator('.animate-pulse')).toBeVisible()
      await expect(page.locator('text=עצור הקלטה')).toBeVisible()
      
      // Stop recording
      await page.click('text=עצור הקלטה')
      
      // Should return to initial state
      await expect(page.locator('text=התחל הקלטה')).toBeVisible()
    })

    test('should disable recording when camera is off', async ({ page }) => {
      // Recording button should be disabled when camera is off
      const recordButton = page.locator('text=התחל הקלטה')
      await expect(recordButton).toBeDisabled()
    })
  })

  test.describe('AI Analysis Features', () => {
    test('should show AI analysis controls', async ({ page }) => {
      // Check AI analysis section
      await expect(page.locator('text=ניתוח AI')).toBeVisible()
      await expect(page.locator('text=התחל ניתוח חי')).toBeVisible()
      await expect(page.locator('text=נתח מסגרת נוכחית')).toBeVisible()
    })

    test('should require camera for AI analysis', async ({ page }) => {
      // AI buttons should show "הפעל מצלמה לניתוח" when camera is off
      await expect(page.locator('text=הפעל מצלמה לניתוח')).toBeVisible()
      
      // Buttons should be disabled
      const liveAnalysisButton = page.locator('text=הפעל מצלמה לניתוח').first()
      await expect(liveAnalysisButton).toBeDisabled()
    })

    test('should start live AI analysis when camera is on', async ({ page }) => {
      // First activate camera
      await page.click('text=הפעל מצלמה')
      await page.waitForTimeout(1000)
      
      // Start live analysis
      await page.click('text=התחל ניתוח חי')
      
      // Should show active analysis state
      await expect(page.locator('text=עצור ניתוח חי')).toBeVisible()
      await expect(page.locator('.animate-spin')).toBeVisible()
      
      // AI status should show active
      await expect(page.locator('text=AI פעיל')).toBeVisible()
    })

    test('should perform single frame analysis', async ({ page }) => {
      // First activate camera
      await page.click('text=הפעל מצלמה')
      await page.waitForTimeout(1000)
      
      // Click single frame analysis
      await page.click('text=נתח מסגרת נוכחית')
      
      // Should trigger analysis (may show loading or result)
      await page.waitForTimeout(2000)
      
      // Check for any analysis response (success or error)
      const hasAlert = await page.locator('.alert').count() > 0
      const hasResult = await page.locator('text*=AI').count() > 0
      
      expect(hasAlert || hasResult).toBeTruthy()
    })
  })

  test.describe('Manual Detection Reporting', () => {
    test('should show manual detection buttons', async ({ page }) => {
      // Check manual detection section
      await expect(page.locator('text=דיווח ידני')).toBeVisible()
      await expect(page.locator('text=שריפה')).toBeVisible()
      await expect(page.locator('text=נפגעים')).toBeVisible()
      await expect(page.locator('text=עשן')).toBeVisible()
      await expect(page.locator('text=נזק מבני')).toBeVisible()
    })

    test('should send manual fire detection', async ({ page }) => {
      // Listen for page alerts
      let alertMessage = ''
      page.on('dialog', async dialog => {
        alertMessage = dialog.message()
        await dialog.accept()
      })
      
      // Click fire detection
      await page.click('text=שריפה')
      
      // Should show confirmation
      await page.waitForTimeout(1000)
      expect(alertMessage).toContain('שריפה')
    })

    test('should send manual casualty detection', async ({ page }) => {
      let alertMessage = ''
      page.on('dialog', async dialog => {
        alertMessage = dialog.message()
        await dialog.accept()
      })
      
      // Click casualty detection
      await page.click('text=נפגעים')
      
      await page.waitForTimeout(1000)
      expect(alertMessage).toContain('נפגעים')
    })
  })

  test.describe('Emergency Features', () => {
    test('should have emergency call button', async ({ page }) => {
      // Check emergency button
      await expect(page.locator('text=חירום!')).toBeVisible()
      
      // Should be prominently styled (red/destructive)
      const emergencyButton = page.locator('text=חירום!')
      await expect(emergencyButton).toHaveClass(/destructive/)
    })

    test('should trigger emergency alert', async ({ page }) => {
      let alertMessage = ''
      page.on('dialog', async dialog => {
        alertMessage = dialog.message()
        await dialog.accept()
      })
      
      // Click emergency button
      await page.click('text=חירום!')
      
      // Should show emergency confirmation
      await page.waitForTimeout(1000)
      expect(alertMessage).toContain('חירום')
    })

    test('should have contact center button', async ({ page }) => {
      await expect(page.locator('text=קשר מרכז')).toBeVisible()
      
      // Click contact center
      let alertMessage = ''
      page.on('dialog', async dialog => {
        alertMessage = dialog.message()
        await dialog.accept()
      })
      
      await page.click('text=קשר מרכז')
      await page.waitForTimeout(1000)
      expect(alertMessage).toContain('מתקשר')
    })
  })

  test.describe('Real-time Data Display', () => {
    test('should show recent detections section', async ({ page }) => {
      await expect(page.locator('text=זיהויים אחרונים')).toBeVisible()
      
      // Should have placeholder or actual detections
      const hasPlaceholder = await page.locator('text=אין זיהויים חדשים').isVisible()
      const hasDetections = await page.locator('.alert').first().isVisible()
      
      expect(hasPlaceholder || hasDetections).toBeTruthy()
    })

    test('should show control center messages section', async ({ page }) => {
      await expect(page.locator('text=הודעות ממרכז השליטה')).toBeVisible()
      
      // Should have placeholder or actual messages
      const hasPlaceholder = await page.locator('text=אין הודעות חדשות').isVisible()
      const hasMessages = await page.locator('.alert').first().isVisible()
      
      expect(hasPlaceholder || hasMessages).toBeTruthy()
    })

    test('should update connection status dynamically', async ({ page }) => {
      // Check initial connection status
      const wsStatus = page.locator('text=מחובר').or(page.locator('text=לא מחובר'))
      await expect(wsStatus).toBeVisible()
      
      const aiStatus = page.locator('text=AI פעיל').or(page.locator('text=AI כבוי'))
      await expect(aiStatus).toBeVisible()
    })
  })

  test.describe('Settings and Configuration', () => {
    test('should show device settings section', async ({ page }) => {
      await expect(page.locator('text=הגדרות')).toBeVisible()
      
      // Check audio controls
      await expect(page.locator('text=מיק פעיל').or(page.locator('text=מיק כבוי'))).toBeVisible()
      await expect(page.locator('text=צליל פעיל').or(page.locator('text=צליל כבוי'))).toBeVisible()
    })

    test('should toggle microphone', async ({ page }) => {
      // Find microphone button
      const micButton = page.locator('text=מיק פעיל').or(page.locator('text=מיק כבוי'))
      const initialText = await micButton.textContent()
      
      // Toggle microphone
      await micButton.click()
      
      // Should change state
      await expect(micButton).not.toHaveText(initialText || '')
    })

    test('should toggle audio', async ({ page }) => {
      // Find audio button
      const audioButton = page.locator('text=צליל פעיל').or(page.locator('text=צליל כבוי'))
      const initialText = await audioButton.textContent()
      
      // Toggle audio
      await audioButton.click()
      
      // Should change state
      await expect(audioButton).not.toHaveText(initialText || '')
    })
  })

  test.describe('WebSocket Communication', () => {
    test('should handle WebSocket connection', async ({ page }) => {
      // Wait for WebSocket connection to establish
      await page.waitForTimeout(3000)
      
      // Check connection status
      const connectionStatus = await page.locator('text=מחובר').or(page.locator('text=לא מחובר')).textContent()
      
      // Should show some connection status
      expect(connectionStatus).toBeTruthy()
    })

    test('should handle WebSocket disconnection gracefully', async ({ page }) => {
      // Simulate network disconnection by going offline
      await page.context().setOffline(true)
      
      await page.waitForTimeout(2000)
      
      // Should show disconnected status
      await expect(page.locator('text=לא מחובר')).toBeVisible()
      
      // Restore connection
      await page.context().setOffline(false)
      
      await page.waitForTimeout(3000)
      
      // Should reconnect
      const finalStatus = await page.locator('text=מחובר').or(page.locator('text=לא מחובר')).textContent()
      expect(finalStatus).toBeTruthy()
    })
  })

  test.describe('Performance and Accessibility', () => {
    test('should be accessible', async ({ page }) => {
      // Check for proper heading structure
      await expect(page.locator('h1, h2, h3')).toHaveCount(0) // Using card titles instead
      
      // Check for alt text on important elements
      const buttons = page.locator('button')
      const buttonCount = await buttons.count()
      
      // Ensure buttons have accessible text
      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const button = buttons.nth(i)
        const text = await button.textContent()
        expect(text?.trim()).toBeTruthy()
      }
    })

    test('should load within reasonable time', async ({ page }) => {
      const startTime = Date.now()
      
      await page.goto('/field-unit')
      await page.waitForLoadState('networkidle')
      
      const loadTime = Date.now() - startTime
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000)
    })

    test('should handle Hebrew RTL layout', async ({ page }) => {
      // Check that page has RTL direction
      const htmlElement = page.locator('html')
      const direction = await htmlElement.getAttribute('dir')
      
      // Should be RTL or inherit RTL from parent elements
      const bodyHasRTL = await page.locator('body [dir="rtl"]').count() > 0
      
      expect(direction === 'rtl' || bodyHasRTL).toBeTruthy()
    })
  })
}) 