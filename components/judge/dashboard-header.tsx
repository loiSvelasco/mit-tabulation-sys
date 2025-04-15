"use client"

import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

interface DashboardHeaderProps {
  judgeName: string
  onLogout: () => void
}

export function DashboardHeader({ judgeName, onLogout }: DashboardHeaderProps) {
  return (
    <header className="bg-primary text-primary-foreground py-3 px-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Judge Terminal</h1>
          <p className="text-sm opacity-90">Welcome, {judgeName}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onLogout} className="flex items-center gap-1">
          <LogOut size={16} />
          <span>Logout</span>
        </Button>
      </div>
    </header>
  )
}
