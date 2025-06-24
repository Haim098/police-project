"use client"

import Link from "next/link"
import { Shield, Eye } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ActiveUnit {
  id: string
  name: string
  type: "police" | "fire" | "medical" | "homefront"
  location: { lat: number; lng: number; address: string }
  status: "active" | "responding" | "available"
  lastUpdate: string
  videoActive: boolean
}

interface AlertType {
  id: string
  unitId: string
  type: "fire" | "explosion" | "casualties" | "electrical" | "structural" | "people"
  severity: "low" | "medium" | "high" | "critical"
  message: string
  timestamp: string
  location: string
}

interface Detection {
  type: string
  confidence: number
  description: string
  recommendation: string
}

export default function HomePage() {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-900 via-gray-900 to-red-900 flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="max-w-4xl mx-auto text-center space-y-8">
        {/* Logo and Title */}
        <div className="space-y-4">
          <div className="bg-red-600 p-6 rounded-full w-24 h-24 mx-auto flex items-center justify-center">
            <Eye className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">RescuerLens</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            העיניים שלך בשטח חירום - מערכת מתקדמת לניהול כוחות חירום עם בינה מלאכותית
          </p>
        </div>

        {/* Interface Selection */}
        <div className="grid md:grid-cols-1 gap-8 mt-12">
          {/* Field Unit */}
          <Card className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors">
            <CardHeader className="text-center pb-4">
              <div className="bg-red-600 p-4 rounded-full w-16 h-16 mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">יחידה בשטח</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-gray-300">ממשק נייד לכוחות חירום בשטח עם זיהוי AI והנחיות בזמן אמת</p>
              <ul className="text-sm text-gray-400 space-y-2 text-right">
                <li>• הקלטת וידאו חי למרכז</li>
                <li>• זיהוי סכנות בבינה מלאכותית</li>
                <li>• קבלת הנחיות מהמרכז</li>
                <li>• כפתורי חירום מהירים</li>
                <li>• מיקום GPS מדויק</li>
              </ul>
              <Link href="/field-unit">
                <Button className="w-full bg-red-600 hover:bg-red-700 text-lg py-6">
                  <Shield className="w-5 h-5 ml-2" />
                  כניסה ליחידה בשטח
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-8">יכולות המערכת</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gray-800 bg-opacity-50 p-6 rounded-lg">
              <Eye className="w-8 h-8 text-blue-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">זיהוי AI מתקדם</h3>
              <p className="text-gray-300 text-sm">זיהוי אוטומטי של סכנות, נפגעים ומצבי חירום בזמן אמת</p>
            </div>
            <div className="bg-gray-800 bg-opacity-50 p-6 rounded-lg">
              <Eye className="w-8 h-8 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">וידאו חי</h3>
              <p className="text-gray-300 text-sm">שידור וידאו איכותי מהשטח למרכז השליטה</p>
            </div>
            <div className="bg-gray-800 bg-opacity-50 p-6 rounded-lg">
              <Eye className="w-8 h-8 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">תיאום כוחות</h3>
              <p className="text-gray-300 text-sm">ניהול ותיאום יעיל של מספר יחידות בו-זמנית</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
