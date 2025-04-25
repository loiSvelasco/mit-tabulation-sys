"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Maximize2, X } from "lucide-react"

interface ImageViewerProps {
  src: string
  alt: string
  className?: string
}

export function ImageViewer({ src, alt, className = "" }: ImageViewerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <>
      <div className={`relative group ${className}`}>
        {/* Remove the fill property and use width/height with object-contain instead */}
        <div className="relative w-full overflow-hidden rounded-md">
          <img
            src={src || "/placeholder.svg"}
            alt={alt}
            className={`w-full h-auto max-h-[400px] object-contain ${
              isLoaded ? "opacity-100" : "opacity-0"
            } transition-opacity duration-300`}
            onLoad={() => setIsLoaded(true)}
          />
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20 min-h-[200px]">
              <div className="animate-pulse h-8 w-8 rounded-full bg-muted"></div>
            </div>
          )}
        </div>
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/50 hover:bg-black/70 text-white"
          onClick={() => setIsOpen(true)}
          aria-label="View full size image"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-black/90 border-none">
          {/* Added DialogTitle for accessibility */}
          <DialogTitle className="sr-only">Full size image of {alt}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="absolute top-2 right-2 z-50 text-white bg-black/50 hover:bg-black/70"
            aria-label="Close full size image"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center justify-center p-4 h-[90vh]">
            <img src={src || "/placeholder.svg"} alt={alt} className="max-w-full max-h-full object-contain" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
