"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ImageIcon, Upload, X } from "lucide-react"
import Image from "next/image"

interface ImageUploadProps {
  imageUrl?: string | null
  onImageUpload: (file: File) => Promise<string>
  onImageRemove: () => void
  size?: "sm" | "md" | "lg"
  className?: string
}

export function ImageUpload({ imageUrl, onImageUpload, onImageRemove, size = "md", className = "" }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Determine dimensions based on size prop
  const getDimensions = () => {
    switch (size) {
      case "sm":
        return { width: 60, height: 60 }
      case "lg":
        return { width: 150, height: 150 }
      case "md":
      default:
        return { width: 100, height: 100 }
    }
  }

  const { width, height } = getDimensions()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!validTypes.includes(file.type)) {
      setError("Please upload a valid image file (JPEG, PNG, WebP, or GIF)")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size should be less than 5MB")
      return
    }

    setError(null)
    setIsUploading(true)

    try {
      await onImageUpload(file)
    } catch (err) {
      setError("Failed to upload image")
      console.error(err)
    } finally {
      setIsUploading(false)
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemoveImage = () => {
    onImageRemove()
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div
        className="relative flex items-center justify-center bg-muted rounded-md overflow-hidden"
        style={{ width, height }}
      >
        {imageUrl ? (
          <>
            <Image
              src={imageUrl || "/placeholder.svg"}
              alt="Uploaded image"
              fill
              style={{ objectFit: "cover" }}
              sizes={`${width}px`}
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-80 hover:opacity-100"
              onClick={handleRemoveImage}
            >
              <X className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <div className="text-muted-foreground">
            {isUploading ? (
              <div className="animate-pulse">Uploading...</div>
            ) : (
              <ImageIcon className="h-8 w-8 opacity-50" />
            )}
          </div>
        )}
      </div>

      {!imageUrl && (
        <div className="mt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="image-upload"
          />
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="h-3 w-3 mr-1" />
            Upload
          </Button>
        </div>
      )}

      {error && <p className="text-destructive text-xs mt-1">{error}</p>}
    </div>
  )
}
