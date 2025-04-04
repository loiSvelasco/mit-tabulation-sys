'use client'

import { redirect } from 'next/navigation'
import React, { useEffect } from 'react'
import AuthTabs from '@/components/auth/AuthTabs'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'

const AuthenticatePage = () => {
  const router = useRouter();
  const { data: session, isPending, refetch } = authClient.useSession() || { data: null, isPending: false, refetch: () => {} };

  useEffect(() => {
    if (!isPending && session) {
      router.push("/dashboard");
    }
  }, [session, isPending, router]);
  // If not authenticated, render the AuthTabs component
  return <AuthTabs />
}

export default AuthenticatePage