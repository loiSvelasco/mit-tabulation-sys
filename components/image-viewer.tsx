"use client"

import { useState } from "react"
import Image from "next/image"
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

  return (
    <>
      <div className={`relative group ${className}`}>
        <div className="relative w-full h-full overflow-hidden rounded-md">
          <Image
            src={src || "/placeholder.svg"}
            alt={alt}
            fill
            style={{ objectFit: "cover" }}
            sizes="(max-width: 768px) 100vw, 50vw"
          />
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
          {/* Added DialogTitle for accessibility, but visually hidden */}
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
          <div className="relative w-full h-[90vh] flex items-center justify-center">
            <Image
              src={src || "/placeholder.svg"}
              alt={alt}
              fill
              style={{ objectFit: "contain" }}
              sizes="90vw"
              quality={90}
              priority
              className="p-4"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
