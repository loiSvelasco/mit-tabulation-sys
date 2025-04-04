'use client'

import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react';
import FullPageLoader from '@/components/auth/loader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { LaptopMinimalCheck } from 'lucide-react';
import CompetitionSettings from '@/components/competition-settings';
import DataManagement from '@/components/data-management';
import JudgeScoring from '@/components/judge-scoring';
import Results from '@/components/results';


const Dashboard = () => {
  const router = useRouter();
  const { data: session, isPending, refetch } = authClient.useSession() || { data: null, isPending: true, refetch: () => {} };
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session && !isPending) {
      router.replace("/auth");
    } else {
      setIsLoading(false);
    }
  }, [session, isPending, router]);

  const user = session?.user;

  if (isLoading || isPending) {
    return <FullPageLoader />
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <span className="inline-flex items-center gap-2  text-2xl font-bold">Setup Competition</span>
        <Button asChild>
          <Link href="/judge"><LaptopMinimalCheck /> View Judge Dashboard </Link>
        </Button>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid grid-cols-4 mb-8">
          <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="settings">Competition Settings</TabsTrigger>
          <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="scoring">Judge Scoring</TabsTrigger>
          <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="results">Results</TabsTrigger>
          <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="data">Data Management</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <CompetitionSettings />
        </TabsContent>

        <TabsContent value="scoring">
          <JudgeScoring />
        </TabsContent>

        <TabsContent value="results">
          <Results />
        </TabsContent>

        <TabsContent value="data">
          <DataManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Dashboard;
