import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import React from 'react'

const page = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4">
      <Card className="w-full max-w-3xl p-6 text-center shadow-lg">
        <CardContent>
          <img src="tabulation_logo.svg" className="mx-auto h-auto w-32" alt="" />
          <h3 className="text-2xl font-bold mb-4">rankx</h3>
          <p className="text-gray-400 mb-6">
            A streamlined tabulation system for juried competitions. Manage competitions, score contestants, and generate results effortlessly.
          </p>
          <p className="text-gray-400 mb-6 text-1xl">
          Made with 💖
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/auth">
              <Button className="px-6 py-3">Start a Competition</Button>
            </Link>
            <Link href="/judge">
              <Button variant="outline" className="px-6 py-3">Enter Scores</Button>
            </Link>
            {/* <Link href="/results">
              <Button variant="secondary" className="px-6 py-3">View Results</Button>
            </Link> */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default page