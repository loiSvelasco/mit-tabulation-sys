"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Menu, X, Trophy, LaptopMinimalIcon as LaptopMinimalCheck, PlusCircle } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface HamburgerMenuProps {
  isCreatingNew: boolean
  onCreateNew: () => void
  onCancelCreate: () => void
  isLoadingCompetition: boolean
  className?: string
}

export function HamburgerMenu({ 
  isCreatingNew, 
  onCreateNew, 
  onCancelCreate, 
  isLoadingCompetition,
  className 
}: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleMenu = () => setIsOpen(!isOpen)

  const menuItems = [
    {
      label: "Manage Competitions",
      href: "/dashboard/competitions",
      icon: Trophy,
      variant: "outline" as const,
    },
    {
      label: "Monitor Scoring",
      href: "/dashboard/manage-competition",
      icon: LaptopMinimalCheck,
      variant: "outline" as const,
      target: "_blank",
    },
    {
      label: isCreatingNew ? "Cancel" : "Create New",
      onClick: isCreatingNew ? onCancelCreate : onCreateNew,
      icon: isCreatingNew ? X : PlusCircle,
      variant: isCreatingNew ? ("destructive" as const) : ("outline" as const),
      disabled: isLoadingCompetition,
    },
  ]

  return (
    <div className={cn("relative", className)}>
      {/* Hamburger Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={toggleMenu}
        className="flex items-center gap-2"
      >
        <Menu className="h-4 w-4" />
        Menu
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={toggleMenu}
          />
          
          {/* Menu Content */}
          <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="py-2">
              {menuItems.map((item, index) => (
                <div key={index}>
                  {item.href ? (
                    <Link href={item.href} target={item.target}>
                      <Button
                        variant={item.variant}
                        className="w-full justify-start rounded-none border-0 shadow-none h-auto py-3 px-4"
                        disabled={item.disabled}
                      >
                        <item.icon className="mr-3 h-4 w-4" />
                        {item.label}
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant={item.variant}
                      onClick={() => {
                        item.onClick?.()
                        toggleMenu()
                      }}
                      className="w-full justify-start rounded-none border-0 shadow-none h-auto py-3 px-4"
                      disabled={item.disabled}
                    >
                      <item.icon className="mr-3 h-4 w-4" />
                      {item.label}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

