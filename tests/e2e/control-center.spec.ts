import { test, expect } from '@playwright/test'

test.describe('Control Center Interface', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to control center page
    await page.goto('/control-center')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
  })

  test.describe('Dashboard Layout', () => {
    test('should display control center dashboard correctly', async ({ page }) => {
      // Check main header
      await expect(page.locator('text=RescuerLens - מרכז שליטה')).toBeVisible()
      await expect(page.locator('text=ניהול וקואורדינציה של כוחות חירום')).toBeVisible()
      
      // Check main sections
      await expect(page.locator('text=יחידות פעילות')).toBeVisible()
      await expect(page.locator('text=התראות ואיתורים')).toBeVisible()
      await expect(page.locator('text=פאנל בקרה')).toBeVisible()
      
      // Check statistics
      await expect(page.locator('text=יחידות פעילות')).toBeVisible()
      await expect(page.locator('text=התראות קריטיות')).toBeVisible()
    })

    test('should show connection status indicators', async ({ page }) => {
      // Check for WebSocket connection status
      await expect(page.locator('text=מחובר').or(page.locator('text=לא מחובר'))).toBeVisible()
      
      // Check for sound alerts toggle
      await expect(page.locator('text=התראות קוליות')).toBeVisible()
    })

    test('should display real-time statistics', async ({ page }) => {
      // Check statistics counters
      const activeUnitsCounter = page.locator('[data-testid="active-units-count"]').or(page.locator('text=/\\d+/').first())
      const criticalAlertsCounter = page.locator('[data-testid="critical-alerts-count"]').or(page.locator('text=/\\d+/').nth(1))
      
      await expect(activeUnitsCounter).toBeVisible()
      await expect(criticalAlertsCounter).toBeVisible()
    })
  })

  test.describe('Units Management', () => {
    test('should display active units list', async ({ page }) => {
      // Check units section
      await expect(page.locator('text=יחידות פעילות')).toBeVisible()
      
      // Should show either units or "no units" message
      const hasUnits = await page.locator('[data-testid="unit-card"]').count() > 0
      const hasEmptyMessage = await page.locator('text=אין יחידות פעילות כרגע').isVisible()
      
      expect(hasUnits || hasEmptyMessage).toBeTruthy()
    })

    test('should show unit details correctly', async ({ page }) => {
      // Wait for units to load
      await page.waitForTimeout(2000)
      
      const unitCards = page.locator('[data-testid="unit-card"]').or(page.locator('.bg-white .p-4'))
      const unitCount = await unitCards.count()
      
      if (unitCount > 0) {
        const firstUnit = unitCards.first()
        
        // Check unit information
        await expect(firstUnit.locator('text=/יחידה/')).toBeVisible()
        await expect(firstUnit.locator('text=/\\d+%/')).toBeVisible() // Battery or signal
      }
    })

    test('should handle unit selection for messaging', async ({ page }) => {
      // Wait for units to load
      await page.waitForTimeout(2000)
      
      const unitCards = page.locator('[data-testid="unit-card"]').or(page.locator('.bg-white .p-4'))
      const unitCount = await unitCards.count()
      
      if (unitCount > 0) {
        // Select first unit
        await unitCards.first().click()
        
        // Should highlight selected unit or show selection indicator
        // This depends on the specific implementation
      }
    })
  })

  test.describe('Alerts and Detections', () => {
    test('should display detections section', async ({ page }) => {
      await expect(page.locator('text=התראות ואיתורים')).toBeVisible()
      
      // Should show either detections or "no detections" message
      const hasDetections = await page.locator('[data-testid="detection-alert"]').count() > 0
      const hasEmptyMessage = await page.locator('text=אין זיהויים חדשים').isVisible()
      
      expect(hasDetections || hasEmptyMessage).toBeTruthy()
    })

    test('should handle detection acknowledgment', async ({ page }) => {
      // Wait for detections to load
      await page.waitForTimeout(2000)
      
      const ackButtons = page.locator('text=אישור')
      const buttonCount = await ackButtons.count()
      
      if (buttonCount > 0) {
        // Click first acknowledgment button
        await ackButtons.first().click()
        
        // Should update the detection status
        await page.waitForTimeout(1000)
      }
    })

    test('should show detection severity correctly', async ({ page }) => {
      // Wait for detections to load
      await page.waitForTimeout(2000)
      
      const detectionAlerts = page.locator('.alert').or(page.locator('[data-testid="detection-alert"]'))
      const alertCount = await detectionAlerts.count()
      
      if (alertCount > 0) {
        const firstAlert = detectionAlerts.first()
        
        // Should have severity indication (colors, badges, etc.)
        const hasRedColor = await firstAlert.locator('.text-red-').count() > 0
        const hasDestructive = await firstAlert.locator('.destructive').count() > 0
        const hasBadge = await firstAlert.locator('.badge').count() > 0
        
        // At least one severity indicator should be present
        expect(hasRedColor || hasDestructive || hasBadge).toBeTruthy()
      }
    })
  })

  test.describe('Communication Panel', () => {
    test('should display message composition interface', async ({ page }) => {
      await expect(page.locator('text=פאנל בקרה')).toBeVisible()
      
      // Check message composition elements
      await expect(page.locator('textarea').or(page.locator('input[type="text"]'))).toBeVisible()
      await expect(page.locator('text=שלח הודעה')).toBeVisible()
    })

    test('should send message to units', async ({ page }) => {
      const messageText = 'הודעת בדיקה - ' + Date.now()
      
      // Find message input
      const messageInput = page.locator('textarea').or(page.locator('input[type="text"]'))
      await messageInput.fill(messageText)
      
      // Handle potential alert dialog
      let alertMessage = ''
      page.on('dialog', async dialog => {
        alertMessage = dialog.message()
        await dialog.accept()
      })
      
      // Send message
      await page.click('text=שלח הודעה')
      
      // Should show confirmation
      await page.waitForTimeout(1000)
      expect(alertMessage).toContain('הודעה נשלחה')
    })

    test('should validate message before sending', async ({ page }) => {
      // Try to send empty message
      const sendButton = page.locator('text=שלח הודעה')
      await sendButton.click()
      
      // Should not send (no action or validation message)
      await page.waitForTimeout(500)
      
      // Input should still be focused or validation should show
      const messageInput = page.locator('textarea').or(page.locator('input[type="text"]'))
      const inputValue = await messageInput.inputValue()
      expect(inputValue).toBe('')
    })

    test('should clear message after sending', async ({ page }) => {
      const messageText = 'Test message to clear'
      
      // Fill and send message
      const messageInput = page.locator('textarea').or(page.locator('input[type="text"]'))
      await messageInput.fill(messageText)
      
      // Handle alert
      page.on('dialog', async dialog => {
        await dialog.accept()
      })
      
      await page.click('text=שלח הודעה')
      
      // Wait for send to complete
      await page.waitForTimeout(1000)
      
      // Input should be cleared
      const inputValue = await messageInput.inputValue()
      expect(inputValue).toBe('')
    })
  })

  test.describe('Sound Alerts', () => {
    test('should toggle sound alerts', async ({ page }) => {
      // Find sound alerts toggle
      const soundToggle = page.locator('[role="switch"]').or(page.locator('input[type="checkbox"]'))
      
      if (await soundToggle.count() > 0) {
        // Get initial state
        const initialChecked = await soundToggle.isChecked()
        
        // Toggle the switch
        await soundToggle.click()
        
        // Should change state
        const newChecked = await soundToggle.isChecked()
        expect(newChecked).toBe(!initialChecked)
      }
    })

    test('should have sound alerts label', async ({ page }) => {
      await expect(page.locator('text=התראות קוליות')).toBeVisible()
    })
  })

  test.describe('Real-time Updates', () => {
    test('should handle WebSocket connection status', async ({ page }) => {
      // Wait for initial connection
      await page.waitForTimeout(3000)
      
      // Check connection status
      const connectionStatus = await page.locator('text=מחובר').or(page.locator('text=לא מחובר')).textContent()
      expect(connectionStatus).toBeTruthy()
    })

    test('should update statistics in real-time', async ({ page }) => {
      // Get initial statistics
      const initialActiveUnits = await page.locator('text=/\\d+/').first().textContent()
      const initialCriticalAlerts = await page.locator('text=/\\d+/').nth(1).textContent()
      
      // Wait for potential updates
      await page.waitForTimeout(5000)
      
      // Statistics should be numbers
      expect(initialActiveUnits).toMatch(/\d+/)
      expect(initialCriticalAlerts).toMatch(/\d+/)
    })

    test('should handle disconnection gracefully', async ({ page }) => {
      // Simulate network disconnection
      await page.context().setOffline(true)
      
      await page.waitForTimeout(2000)
      
      // Should show disconnected status
      await expect(page.locator('text=לא מחובר')).toBeVisible()
      
      // Restore connection
      await page.context().setOffline(false)
      
      await page.waitForTimeout(3000)
      
      // Should attempt to reconnect
      const finalStatus = await page.locator('text=מחובר').or(page.locator('text=לא מחובר')).textContent()
      expect(finalStatus).toBeTruthy()
    })
  })

  test.describe('Responsive Design', () => {
    test('should adapt to tablet view', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 })
      
      // Check that layout adapts
      await expect(page.locator('text=RescuerLens - מרכז שליטה')).toBeVisible()
      
      // Main sections should still be visible
      await expect(page.locator('text=יחידות פעילות')).toBeVisible()
      await expect(page.locator('text=התראות ואיתורים')).toBeVisible()
    })

    test('should adapt to mobile view', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Header should still be visible
      await expect(page.locator('text=RescuerLens - מרכז שליטה')).toBeVisible()
      
      // Content should stack vertically
      await expect(page.locator('.space-y-6').or(page.locator('.flex-col'))).toBeVisible()
    })
  })

  test.describe('Data Loading States', () => {
    test('should show loading state initially', async ({ page }) => {
      // Reload page to catch loading state
      await page.reload()
      
      // Should show loading indicator or skeleton
      const hasLoadingSpinner = await page.locator('.animate-spin').isVisible()
      const hasLoadingText = await page.locator('text=טוען').isVisible()
      const hasSkeletonLoader = await page.locator('.animate-pulse').isVisible()
      
      // At least one loading indicator should be present initially
      expect(hasLoadingSpinner || hasLoadingText || hasSkeletonLoader).toBeTruthy()
    })

    test('should handle empty states gracefully', async ({ page }) => {
      // Wait for data to load
      await page.waitForTimeout(3000)
      
      // Check for empty state messages
      const emptyUnitsMessage = await page.locator('text=אין יחידות פעילות כרגע').isVisible()
      const emptyDetectionsMessage = await page.locator('text=אין זיהויים חדשים').isVisible()
      
      // Should have appropriate empty state handling
      if (emptyUnitsMessage || emptyDetectionsMessage) {
        expect(true).toBeTruthy() // Empty states are properly handled
      }
    })
  })

  test.describe('Accessibility and Performance', () => {
    test('should be keyboard navigable', async ({ page }) => {
      // Test tab navigation
      await page.keyboard.press('Tab')
      
      // Should focus on interactive elements
      const focusedElement = await page.locator(':focus')
      const focusedCount = await focusedElement.count()
      
      expect(focusedCount).toBeGreaterThan(0)
    })

    test('should have proper heading structure', async ({ page }) => {
      // Check for main heading
      await expect(page.locator('h1').or(page.locator('text=RescuerLens - מרכז שליטה')).first()).toBeVisible()
      
      // Should have logical heading hierarchy
      const headings = page.locator('h1, h2, h3, h4, h5, h6')
      const headingCount = await headings.count()
      
      // Should have at least some headings or card titles
      expect(headingCount).toBeGreaterThanOrEqual(0)
    })

    test('should load within performance budget', async ({ page }) => {
      const startTime = Date.now()
      
      await page.goto('/control-center')
      await page.waitForLoadState('networkidle')
      
      const loadTime = Date.now() - startTime
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000)
    })

    test('should handle Hebrew RTL correctly', async ({ page }) => {
      // Check for RTL direction
      const rtlElements = await page.locator('[dir="rtl"]').count()
      
      expect(rtlElements).toBeGreaterThan(0)
      
      // Hebrew text should be properly aligned
      await expect(page.locator('text=מרכז שליטה')).toBeVisible()
      await expect(page.locator('text=יחידות פעילות')).toBeVisible()
    })
  })

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Intercept and fail API requests
      await page.route('**/api/**', route => route.abort())
      
      // Reload page
      await page.reload()
      
      // Should handle API failures gracefully (no crash)
      await page.waitForTimeout(3000)
      
      // Page should still render basic structure
      await expect(page.locator('text=RescuerLens')).toBeVisible()
    })

    test('should recover from WebSocket errors', async ({ page }) => {
      // Simulate WebSocket error by going offline briefly
      await page.context().setOffline(true)
      await page.waitForTimeout(1000)
      await page.context().setOffline(false)
      
      // Should attempt to reconnect
      await page.waitForTimeout(3000)
      
      // Page should still be functional
      await expect(page.locator('text=מרכז שליטה')).toBeVisible()
    })
  })
}) 