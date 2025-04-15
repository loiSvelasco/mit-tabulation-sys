"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import FullPageLoader from "@/components/auth/loader"

export default function JudgePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the login page
    router.replace("/judge/login")
  }, [router])

  return <FullPageLoader />
}
