"use client"

import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ReactNode
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cn("flex items-center space-x-1 text-sm text-muted-foreground", className)}>
      <Home className="h-4 w-4" />
      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-1">
          <ChevronRight className="h-4 w-4" />
          {item.href ? (
            <a
              href={item.href}
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              {item.icon}
              {item.label}
            </a>
          ) : (
            <span className="flex items-center gap-1">
              {item.icon}
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  )
}

