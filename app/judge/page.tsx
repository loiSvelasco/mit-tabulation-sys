"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function JudgePage() {
  const [accessCode, setAccessCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!accessCode.trim()) {
			toast.error("Please enter your access code.")
      return
    }

    setIsLoading(true)

    try {
      // This will be implemented in the future
      // For now, just show a message
      toast.success("Judge interface is still ongoing construction :))")

      // In the future, this will authenticate the judge and redirect to the scoring interface
      // router.push(`/judge/scoring?code=${accessCode}`)
    } catch (error) {
      toast.error("Authorization failed.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Judge Login</CardTitle>
          <CardDescription className="text-center">Enter your access code to continue</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                id="access-code"
                placeholder="Enter access code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="text-center text-lg uppercase tracking-widest"
                maxLength={6}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Verifying..." : "Continue"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

