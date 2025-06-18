describe('Database Integration Tests', () => {
  let supabase

  beforeAll(() => {
    supabase = global.integrationUtils.supabase
  })

  beforeEach(async () => {
    // Clean database before each test
    await global.integrationUtils.cleanDatabase()
  })

  describe('Units Management', () => {
    test('should insert and retrieve units', async () => {
      const testUnit = {
        id: '12345678-1234-1234-1234-123456789012',
        name: 'יחידה בדיקה',
        type: 'police',
        status: 'active',
        officer_name: 'שוטר בדיקה',
        battery_level: 85,
        signal_strength: 90,
        location: 'רחוב הרצל 1, תל אביב'
      }

      // Insert unit
      const { data: insertData, error: insertError } = await supabase
        .from('units')
        .insert(testUnit)
        .select()

      expect(insertError).toBeNull()
      expect(insertData).toHaveLength(1)
      expect(insertData[0].name).toBe(testUnit.name)

      // Retrieve unit
      const { data: selectData, error: selectError } = await supabase
        .from('units')
        .select('*')
        .eq('id', testUnit.id)
        .single()

      expect(selectError).toBeNull()
      expect(selectData.id).toBe(testUnit.id)
      expect(selectData.name).toBe(testUnit.name)
      expect(selectData.type).toBe(testUnit.type)
    })

    test('should update unit status', async () => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      
      // Update status
      const { error: updateError } = await supabase
        .from('units')
        .update({ 
          status: 'emergency',
          battery_level: 45 
        })
        .eq('id', unitId)

      expect(updateError).toBeNull()

      // Verify update
      const { data, error } = await supabase
        .from('units')
        .select('status, battery_level')
        .eq('id', unitId)
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('emergency')
      expect(data.battery_level).toBe(45)
    })

    test('should list active units', async () => {
      // Insert multiple units
      const units = [
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'יחידה 1',
          type: 'police',
          status: 'active',
          officer_name: 'שוטר 1'
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'יחידה 2',
          type: 'fire',
          status: 'inactive',
          officer_name: 'כבאי 1'
        },
        {
          id: '33333333-3333-3333-3333-333333333333',
          name: 'יחידה 3',
          type: 'medical',
          status: 'active',
          officer_name: 'פרמדיק 1'
        }
      ]

      await supabase.from('units').insert(units)

      // Get only active units
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('status', 'active')
        .order('name')

      expect(error).toBeNull()
      expect(data).toHaveLength(3) // 2 new + 1 existing from setup
      expect(data.every(unit => unit.status === 'active')).toBe(true)
    })
  })

  describe('Detections Management', () => {
    test('should create and retrieve detections', async () => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      const detection = {
        unit_id: unitId,
        type: 'fire',
        confidence: 0.92,
        severity: 'critical',
        acknowledged: false,
        description: 'זוהתה שריפה פעילה',
        location: 'רחוב דיזנגוף 50'
      }

      // Insert detection
      const { data: insertData, error: insertError } = await supabase
        .from('detections')
        .insert(detection)
        .select()

      expect(insertError).toBeNull()
      expect(insertData).toHaveLength(1)
      expect(insertData[0].type).toBe(detection.type)
      expect(insertData[0].unit_id).toBe(unitId)

      // Retrieve detections for unit
      const { data: selectData, error: selectError } = await supabase
        .from('detections')
        .select('*')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false })

      expect(selectError).toBeNull()
      expect(selectData.length).toBeGreaterThan(0)
      expect(selectData[0].type).toBe(detection.type)
    })

    test('should acknowledge detections', async () => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      
      // Create detection
      const { data: detection } = await supabase
        .from('detections')
        .insert(global.integrationUtils.createTestDetection(unitId))
        .select()
        .single()

      expect(detection.acknowledged).toBe(false)

      // Acknowledge detection
      const { error: updateError } = await supabase
        .from('detections')
        .update({ acknowledged: true })
        .eq('id', detection.id)

      expect(updateError).toBeNull()

      // Verify acknowledgment
      const { data: updatedDetection, error } = await supabase
        .from('detections')
        .select('acknowledged')
        .eq('id', detection.id)
        .single()

      expect(error).toBeNull()
      expect(updatedDetection.acknowledged).toBe(true)
    })

    test('should filter critical unacknowledged detections', async () => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      
      // Create multiple detections
      const detections = [
        { ...global.integrationUtils.createTestDetection(unitId), severity: 'critical', acknowledged: false },
        { ...global.integrationUtils.createTestDetection(unitId), severity: 'medium', acknowledged: false },
        { ...global.integrationUtils.createTestDetection(unitId), severity: 'critical', acknowledged: true }
      ]

      await supabase.from('detections').insert(detections)

      // Get critical unacknowledged detections
      const { data, error } = await supabase
        .from('detections')
        .select('*')
        .eq('severity', 'critical')
        .eq('acknowledged', false)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].severity).toBe('critical')
      expect(data[0].acknowledged).toBe(false)
    })
  })

  describe('Events Management', () => {
    test('should create and retrieve events', async () => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      const event = {
        unit_id: unitId,
        type: 'alert',
        data: {
          message: 'הודעה ממרכז השליטה',
          from: 'control_center',
          priority: 'high'
        }
      }

      // Insert event
      const { data: insertData, error: insertError } = await supabase
        .from('events')
        .insert(event)
        .select()

      expect(insertError).toBeNull()
      expect(insertData).toHaveLength(1)
      expect(insertData[0].type).toBe(event.type)
      expect(insertData[0].data.message).toBe(event.data.message)

      // Retrieve events for unit
      const { data: selectData, error: selectError } = await supabase
        .from('events')
        .select('*')
        .eq('unit_id', unitId)
        .eq('type', 'alert')
        .order('created_at', { ascending: false })

      expect(selectError).toBeNull()
      expect(selectData.length).toBeGreaterThan(0)
      expect(selectData[0].data.message).toBe(event.data.message)
    })

    test('should handle different event types', async () => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      
      const events = [
        {
          unit_id: unitId,
          type: 'alert',
          data: { message: 'הודעת התראה' }
        },
        {
          unit_id: unitId,
          type: 'detection',
          data: { detection_type: 'fire', confidence: 0.85 }
        },
        {
          unit_id: unitId,
          type: 'status_change',
          data: { old_status: 'active', new_status: 'emergency' }
        }
      ]

      await supabase.from('events').insert(events)

      // Get events by type
      const { data: alerts } = await supabase
        .from('events')
        .select('*')
        .eq('unit_id', unitId)
        .eq('type', 'alert')

      const { data: detections } = await supabase
        .from('events')
        .select('*')
        .eq('unit_id', unitId)
        .eq('type', 'detection')

      expect(alerts).toHaveLength(1)
      expect(detections).toHaveLength(1)
      expect(alerts[0].data.message).toBe('הודעת התראה')
      expect(detections[0].data.detection_type).toBe('fire')
    })
  })

  describe('Real-time Subscriptions', () => {
    test('should receive real-time updates for detections', (done) => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      
      // Set up subscription
      const subscription = supabase
        .channel('test_detections')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'detections',
            filter: `unit_id=eq.${unitId}`
          }, 
          (payload) => {
            expect(payload.new.unit_id).toBe(unitId)
            expect(payload.new.type).toBe('smoke')
            subscription.unsubscribe()
            done()
          }
        )
        .subscribe()

      // Insert new detection after subscription is set up
      setTimeout(async () => {
        await supabase
          .from('detections')
          .insert({
            ...global.integrationUtils.createTestDetection(unitId),
            type: 'smoke'
          })
      }, 100)
    }, 10000)

    test('should receive real-time updates for unit status', (done) => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      
      // Set up subscription
      const subscription = supabase
        .channel('test_units')
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'units',
            filter: `id=eq.${unitId}`
          }, 
          (payload) => {
            expect(payload.new.status).toBe('emergency')
            subscription.unsubscribe()
            done()
          }
        )
        .subscribe()

      // Update unit status after subscription is set up
      setTimeout(async () => {
        await supabase
          .from('units')
          .update({ status: 'emergency' })
          .eq('id', unitId)
      }, 100)
    }, 10000)
  })

  describe('Data Integrity', () => {
    test('should enforce foreign key constraints', async () => {
      const invalidUnitId = '99999999-9999-9999-9999-999999999999'
      
      // Try to insert detection with invalid unit_id
      const { error } = await supabase
        .from('detections')
        .insert({
          unit_id: invalidUnitId,
          type: 'fire',
          confidence: 0.85,
          severity: 'critical',
          acknowledged: false
        })

      // Should fail due to foreign key constraint
      expect(error).toBeTruthy()
      expect(error.code).toBe('23503') // Foreign key violation
    })

    test('should handle concurrent updates correctly', async () => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      
      // Simulate concurrent battery updates
      const updates = [
        supabase.from('units').update({ battery_level: 75 }).eq('id', unitId),
        supabase.from('units').update({ battery_level: 80 }).eq('id', unitId),
        supabase.from('units').update({ battery_level: 85 }).eq('id', unitId)
      ]

      const results = await Promise.allSettled(updates)
      
      // All updates should succeed (last one wins)
      expect(results.every(r => r.status === 'fulfilled')).toBe(true)

      // Verify final state
      const { data } = await supabase
        .from('units')
        .select('battery_level')
        .eq('id', unitId)
        .single()

      expect([75, 80, 85]).toContain(data.battery_level)
    })
  })

  describe('Performance Tests', () => {
    test('should handle bulk operations efficiently', async () => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      const numDetections = 50
      
      // Create bulk detections
      const detections = Array.from({ length: numDetections }, (_, i) => ({
        ...global.integrationUtils.createTestDetection(unitId),
        description: `בדיקה מספר ${i + 1}`
      }))

      const startTime = Date.now()
      
      const { data, error } = await supabase
        .from('detections')
        .insert(detections)
        .select()

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(error).toBeNull()
      expect(data).toHaveLength(numDetections)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })

    test('should query large datasets efficiently', async () => {
      const unitId = '6686c4a6-4296-4dcc-ad6d-6df415b925f6'
      
      // Create many detections
      const detections = Array.from({ length: 100 }, () => 
        global.integrationUtils.createTestDetection(unitId)
      )
      await supabase.from('detections').insert(detections)

      const startTime = Date.now()
      
      // Query with filtering and pagination
      const { data, error } = await supabase
        .from('detections')
        .select('*')
        .eq('unit_id', unitId)
        .eq('severity', 'critical')
        .order('created_at', { ascending: false })
        .limit(20)

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(error).toBeNull()
      expect(data.length).toBeLessThanOrEqual(20)
      expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
    })
  })
}) 