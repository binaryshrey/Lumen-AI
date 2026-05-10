"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Play, Plus } from "lucide-react"
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
import {
  PIPELINE_NODES,
  type AgentNodeData,
  type AgentStatus,
  type Workflow,
} from "@/lib/workflow-types"
import { createWorkflow, getWorkflow } from "@/lib/api"

// ── Transform backend order → frontend Workflow ─────────────────────────────

type NodeTemplate = (typeof PIPELINE_NODES)[number]

function applyNodeState(
  template: NodeTemplate | Omit<AgentNodeData, "status" | "duration">,
  nodeStates: Record<string, Record<string, unknown>>,
): AgentNodeData {
  const state = nodeStates[template.id] || {}
  return {
    ...template,
    status: (state.status as AgentStatus) || "idle",
    duration: (state.duration as number) || 0,
    outputPreview:
      (state.outputPreview as string) || template.outputPreview,
    metric:
      (state.metric as { label: string; value: string }) || template.metric,
    children: ("children" in template && template.children)
      ? template.children.map((child) => applyNodeState(child, nodeStates))
      : undefined,
  }
}

function orderToWorkflow(order: Record<string, unknown>): Workflow {
  const nodeStates = (order.node_states as Record<string, Record<string, unknown>>) || {}
  const nodes = PIPELINE_NODES.map((t) => applyNodeState(t, nodeStates))

  let currentNodeIndex = -1
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    if (n.status === "running" || n.children?.some((c) => c.status === "running")) {
      currentNodeIndex = i
      break
    }
  }

  return {
    id: order.id as string,
    description: order.description as string,
    targetMinutes: order.target_minutes as number,
    status: (order.status as AgentStatus) || "idle",
    nodes,
    currentNodeIndex,
    createdAt: new Date(order.created_at as string).getTime(),
  }
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Page() {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState("")
  const [duration, setDuration] = useState("")
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startPolling = useCallback((orderId: string) => {
    window.history.replaceState(null, "", `/workflows/${orderId}`)

    if (pollRef.current) clearInterval(pollRef.current)

    pollRef.current = setInterval(async () => {
      try {
        const order = await getWorkflow(orderId)
        setWorkflow(orderToWorkflow(order))
        if (order.status === "completed" || order.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch {
        // ignore
      }
    }, 2000)
  }, [])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleCreate = async () => {
    setLoading(true)
    try {
      const order = await createWorkflow(description, parseInt(duration))
      setWorkflow(orderToWorkflow(order))
      startPolling(order.id)
      setOpen(false)
      setDescription("")
      setDuration("")
    } catch (e) {
      console.error("Failed to create workflow:", e)
    } finally {
      setLoading(false)
    }
  }

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
                disabled={!description.trim() || !duration || loading}
                onClick={handleCreate}
              >
                <Play className="size-4 fill-current" />
                {loading ? "Creating..." : "Begin Workflow"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="flex flex-1 flex-col overflow-hidden p-4 pt-0">
        <WorkflowCanvas workflow={workflow} />
      </div>
    </PageShell>
  )
}
