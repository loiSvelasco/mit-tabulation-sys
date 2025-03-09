'use client'

import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react';

const Dashboard = () => {
  const router = useRouter();
  const { data: session, isPending, refetch } = authClient.useSession() || { data: null, isPending: true, refetch: () => {} };


  useEffect(() => {
    if (!session && !isPending) {
      router.replace("/auth");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return <p>Loading...</p>; // Prevent rendering invalid states
  }

  return (
    <>
      <h1>Welcome!</h1>
      <ul>
        <li>Name: {session?.user?.name}</li>
        <li>Email: {session?.user?.email}</li>
        {/* <li>Image: {user?.image} </li> */}
      </ul>
    </>
  )
}

export default Dashboard;
