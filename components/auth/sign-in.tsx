"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function SignIn() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const router = useRouter()
  // const { data: session, isPending, refetch } = authClient.useSession() || { data: null, isPending: false, refetch: () => {} };

  // useEffect(() => {
  //   if (!isPending && session) {
  //     router.push("/dashboard");
  //   }
  // }, [session, isPending, router]);

  const handleSignIn = async () => {
    setLoading(true)

    await authClient.signIn.email({
      email,
      password,
      fetchOptions: {
        onResponse: () => setLoading(false),
        onRequest: () => setLoading(true),
        onError: () => {
          toast.error("Invalid credentials.")
          setLoading(false)
        },
        onSuccess: async () => {
          toast.success("Logged in successfully.")
          router.push("/dashboard")
        },
      },
    })
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSignIn()
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">Sign In</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Enter your email below to login to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              onChange={(e) => setEmail(e.target.value)}
              value={email}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center">
              <Label htmlFor="password">Password</Label>
              <Link href="#" className="ml-auto inline-block text-sm underline">
                Forgot your password?
              </Link>
            </div>

            <Input
              id="password"
              type="password"
              placeholder="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              onClick={() => {
                setRememberMe(!rememberMe)
              }}
            />
            <Label htmlFor="remember">Remember me</Label>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Login"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
