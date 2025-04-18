"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function JudgeLoginPage() {
  const [accessCode, setAccessCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/judge/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessCode }),
      })

      const data = await response.json()

      if (data.success) {
        // If we received a token in the response, set it manually as a cookie
        // This is a fallback in case the server-side cookie setting fails
        if (data.token) {
          document.cookie = `auth-token=${data.token}; path=/; max-age=${60 * 60 * 8}; ${
            process.env.NODE_ENV === "production" ? "secure;" : ""
          } httpOnly;`
        }

        // Redirect to the judge terminal with competition ID
        if (data.competitionId) {
          router.push(`/judge/terminal?competitionId=${data.competitionId}&judgeId=${data.judgeId}`)
        } else {
          router.push("/judge/dashboard")
        }
      } else {
        setError(data.message || "Authentication failed")
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("An error occurred during login. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Judge Login</CardTitle>
          <CardDescription>Enter your access code to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Input
                  id="accessCode"
                  placeholder="Enter your access code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="w-full"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-500">Contact the administrator if you don&apos;t have an access code.</p>
        </CardFooter>
      </Card>
    </div>
  )
}
