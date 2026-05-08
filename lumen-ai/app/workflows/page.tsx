"use client"

import { useState } from "react"
import { Plus, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PageShell } from "@/components/page-shell"
import { WorkflowCanvas } from "@/components/workflow-canvas"

export default function Page() {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState("")
  const [duration, setDuration] = useState("")

  return (
    <PageShell
      title="Workflows"
      headerAction={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Plus className="size-4" />
              New Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New Workflow</DialogTitle>
              <DialogDescription>
                Describe the dataset you need. The pipeline will fetch, filter,
                and curate videos matching your specification.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Dataset description
                </label>
                <Textarea
                  id="description"
                  placeholder="e.g. outdoor cooking videos, daytime lighting, minimal camera shake, no visible logos"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="duration" className="text-sm font-medium">
                  Target duration
                </label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger id="duration" className="w-full">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="300">5 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full gap-2"
                disabled={!description.trim() || !duration}
                onClick={() => {
                  setOpen(false)
                }}
              >
                <Play className="size-4 fill-current" />
                Begin Workflow
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="flex flex-1 flex-col p-4 pt-0">
        <WorkflowCanvas />
      </div>
    </PageShell>
  )
}
