import { redirect } from 'next/navigation'
import React from 'react'
import AuthTabs from '@/app/components/auth/AuthTabs'
import { authClient } from '@/app/lib/auth-client'

const AuthenticatePage = async () => {
	const { data: session } = await authClient.getSession()

  if (session?.user) {
    console.log(session.user)
    if (session.user.role === "admin") {
      redirect('/dashboard')
    } else {
      // Redirect to a default page for non-admin authenticated users
      redirect('/profile')
    }
  }

  // If not authenticated, render the AuthTabs component
  return <AuthTabs />
}

export default AuthenticatePage