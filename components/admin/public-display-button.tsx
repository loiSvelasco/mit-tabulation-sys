"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExternalLink, Copy, Check, Tv2 } from "lucide-react"
import useCompetitionStore from "@/utils/useCompetitionStore"

export function PublicDisplayButton() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { selectedCompetitionId } = useCompetitionStore()

  const displayUrl = selectedCompetitionId ? `${window.location.origin}/display/${selectedCompetitionId}` : ""

  const handleCopy = () => {
    if (displayUrl) {
      navigator.clipboard.writeText(displayUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenDisplay = () => {
    if (displayUrl) {
      window.open(displayUrl, "_blank", "noopener,noreferrer")
    }
  }

  if (!selectedCompetitionId) {
    return null
  }

  return (
    <>
      <Button variant="outline" className="flex items-center gap-2" onClick={() => setOpen(true)}>
        <Tv2 className="h-4 w-4" />
        Public Display
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Public Display</DialogTitle>
            <DialogDescription>
              Share this link to display the competition on a large screen or projector.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="link">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="link">Link</TabsTrigger>
              <TabsTrigger value="qrcode">QR Code</TabsTrigger>
            </TabsList>

            <TabsContent value="link" className="mt-4">
              <div className="flex items-center space-x-2">
                <Input value={displayUrl} readOnly className="flex-1" />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopy}
                  title={copied ? "Copied!" : "Copy to clipboard"}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="qrcode" className="mt-4 flex justify-center">
              {displayUrl && (
                <div className="p-4 bg-white rounded-md">
                  <div className="w-48 h-48 bg-gray-200 flex items-center justify-center">
                    <span className="text-sm text-gray-500">QR Code will appear here</span>
                  </div>
                  <p className="text-center mt-2 text-sm text-gray-500">Scan to open the display on a mobile device</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="default" className="w-full sm:w-auto flex items-center gap-2" onClick={handleOpenDisplay}>
              <ExternalLink className="h-4 w-4" />
              Open Display
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
