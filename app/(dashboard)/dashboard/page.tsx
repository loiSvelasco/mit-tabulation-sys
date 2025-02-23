'use client'

import React, { useEffect } from 'react'
import { authClient } from '@/app/lib/auth-client'
import { useRouter } from 'next/navigation'

const Dashboard = () => {
  const router = useRouter();
  useEffect(() => {
    const checkSession = async () => {
      const { data: session } = await authClient.getSession()
      console.log(session?.user);
      if (!session?.user) {
        router.push('/auth')
      }
    }

    checkSession()
  }, [router])

  return (
    <>
      <h1>Dashboard</h1>
    </>
  )
}

export default Dashboard