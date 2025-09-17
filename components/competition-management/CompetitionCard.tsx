"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { 
  MoreHorizontal, 
  Calendar, 
  Users, 
  Target, 
  Edit, 
  Trash2, 
  Play, 
  Pause,
  Eye,
  Settings,
  Lock
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

interface Competition {
  id: number
  name: string
  is_active: boolean
  created_at: string
}

interface CompetitionCardProps {
  competition: Competition
  onAction: (action: string, competition: Competition) => void
  showActions?: boolean
  variant?: "default" | "compact"
}

export function CompetitionCard({ 
  competition, 
  onAction, 
  showActions = true,
  variant = "default"
}: CompetitionCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleAction = async (action: string) => {
    setIsLoading(true)
    try {
      await onAction(action, competition)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy")
    } catch {
      return "Invalid date"
    }
  }

  const getStatusColor = (isActive: boolean) => {
    return isActive ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-800 border-gray-200"
  }

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />
  }

  if (variant === "compact") {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-sm truncate">{competition.name}</h3>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getStatusColor(competition.is_active)}`}
                    >
                      {getStatusIcon(competition.is_active)}
                      <span className="ml-1">{competition.is_active ? "Active" : "Inactive"}</span>
                    </Badge>
                    {!competition.is_active && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Lock className="h-3 w-3 mr-1" />
                              <span>Edit locked</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Activate this competition to enable editing</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>ID: #{competition.id}</span>
                  <span>Created {formatDate(competition.created_at)}</span>
                </div>
              </div>
            </div>
            
            {showActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={isLoading}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleAction("select")}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  
                  {competition.is_active ? (
                    <DropdownMenuItem onClick={() => handleAction("edit")}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuItem disabled className="opacity-50">
                            <Lock className="h-4 w-4 mr-2" />
                            Edit (Disabled)
                          </DropdownMenuItem>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Activate this competition first to edit it</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  {!competition.is_active && (
                    <>
                      <DropdownMenuItem onClick={() => handleAction("activate")}>
                        <Play className="h-4 w-4 mr-2" />
                        Activate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAction("activate-and-edit")}>
                        <Edit className="h-4 w-4 mr-2" />
                        Activate & Edit
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  <DropdownMenuItem 
                    onClick={() => handleAction("delete")}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{competition.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Calendar className="h-3 w-3" />
              Created {formatDate(competition.created_at)}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={`${getStatusColor(competition.is_active)}`}
            >
              {getStatusIcon(competition.is_active)}
              <span className="ml-1">{competition.is_active ? "Active" : "Inactive"}</span>
            </Badge>
            {!competition.is_active && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Lock className="h-3 w-3 mr-1" />
                      <span>Edit locked</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Activate this competition to enable editing</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {showActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={isLoading}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleAction("select")}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  
                  {competition.is_active ? (
                    <DropdownMenuItem onClick={() => handleAction("edit")}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuItem disabled className="opacity-50">
                            <Lock className="h-4 w-4 mr-2" />
                            Edit (Disabled)
                          </DropdownMenuItem>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Activate this competition first to edit it</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  {!competition.is_active && (
                    <>
                      <DropdownMenuItem onClick={() => handleAction("activate")}>
                        <Play className="h-4 w-4 mr-2" />
                        Activate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAction("activate-and-edit")}>
                        <Edit className="h-4 w-4 mr-2" />
                        Activate & Edit
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  <DropdownMenuItem 
                    onClick={() => handleAction("delete")}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Competition ID</span>
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
            #{competition.id}
          </span>
        </div>
        
        {showActions && (
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => handleAction("select")}
              disabled={isLoading}
            >
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
            
            {!competition.is_active && (
              <Button 
                size="sm" 
                className="flex-1"
                onClick={() => handleAction("activate")}
                disabled={isLoading}
              >
                <Play className="h-4 w-4 mr-2" />
                Activate
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
