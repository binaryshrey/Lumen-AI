"use client"

import { useCallback, useRef, useState } from "react"
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

function hydrateNode(n: (typeof PIPELINE_NODES)[number]): AgentNodeData {
  return {
    ...n,
    status: "idle" as AgentStatus,
    duration: 0,
    children: n.children?.map((c) => ({
      ...c,
      status: "idle" as AgentStatus,
      duration: 0,
    })),
  }
}

function createWorkflow(description: string, targetMinutes: number): Workflow {
  return {
    id: crypto.randomUUID(),
    description,
    targetMinutes,
    status: "idle",
    nodes: PIPELINE_NODES.map(hydrateNode),
    currentNodeIndex: -1,
    createdAt: Date.now(),
  }
}

// ── Simulation data ─────────────────────────────────────────────────────────

type SimStep = {
  duration: number
  preview: string
  metric: { label: string; value: string }
}

// Flat nodes: order-parsing, ingest, search-index, deliver
const FLAT_SIM: Record<string, SimStep> = {
  "order-parsing": {
    duration: 1.8,
    preview: 'Parsed 6 keywords: ["outdoor", "cooking", "daytime", "natural", "food", "campfire"]. Thresholds set: aesthetic >= 0.6, semantic >= 0.5.',
    metric: { label: "TOKENS", value: "842" },
  },
  ingest: {
    duration: 3.2,
    preview: "Fetched 48 clips from Pexels (3 pages). Decoded 312 frames. 2 duplicates filtered by Bloom filter.",
    metric: { label: "CLIPS", value: "48" },
  },
  "search-index": {
    duration: 2.8,
    preview: "Generated 39 CLIP embeddings (768-dim). FAISS index built (M=32). 39 rows in DuckDB. 39 captions indexed.",
    metric: { label: "INDEXED", value: "39" },
  },
  deliver: {
    duration: 1.5,
    preview: "Packaged 39 clips (12.4 min total). Manifest ready. Avg aesthetic: 0.74, avg semantic: 0.68.",
    metric: { label: "DURATION", value: "12.4 min" },
  },
}

// ML Filters children
const CHILDREN_SIM: Record<string, SimStep> = {
  "ml-hard-gates": {
    duration: 1.2,
    preview: "Sharpness gate: 7 clips rejected (Laplacian < 0.1). Safety gate: all passed. 41/48 clips forwarded.",
    metric: { label: "REJECTED", value: "7" },
  },
  "ml-quality-scoring": {
    duration: 2.5,
    preview: "Scored 41 clips: avg aesthetic 0.71, avg semantic 0.64, avg motion 0.48. Captions generated for all clips.",
    metric: { label: "AVG SCORE", value: "0.68" },
  },
  "ml-decision": {
    duration: 0.8,
    preview: "Accept: 39 clips (> 0.55). Margin: 5 clips (0.35–0.55) → QA queue. Reject: 4 clips (< 0.35). Rate: 81.3%.",
    metric: { label: "ACCEPT RATE", value: "81.3%" },
  },
}

async function simulateNode(
  duration: number,
  onTick: (elapsed: number) => void,
) {
  const steps = 10
  const stepTime = (duration / steps) * 1000
  for (let s = 1; s <= steps; s++) {
    await new Promise((r) => setTimeout(r, stepTime))
    onTick((duration / steps) * s)
  }
}

export default function Page() {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState("")
  const [duration, setDuration] = useState("")
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const runningRef = useRef(false)

  const updateNode = (
    wf: Workflow,
    nodeIndex: number,
    patch: Partial<AgentNodeData>,
  ): Workflow => ({
    ...wf,
    nodes: wf.nodes.map((n, idx) =>
      idx === nodeIndex ? { ...n, ...patch } : n,
    ),
  })

  const updateChild = (
    wf: Workflow,
    nodeIndex: number,
    childIndex: number,
    patch: Partial<AgentNodeData>,
  ): Workflow => ({
    ...wf,
    nodes: wf.nodes.map((n, idx) =>
      idx === nodeIndex
        ? {
            ...n,
            children: n.children?.map((c, ci) =>
              ci === childIndex ? { ...c, ...patch } : c,
            ),
          }
        : n,
    ),
  })

  const runPipeline = useCallback(async (wf: Workflow) => {
    if (runningRef.current) return
    runningRef.current = true

    let current: Workflow = { ...wf, status: "running", currentNodeIndex: 0 }

    for (let i = 0; i < current.nodes.length; i++) {
      const node = current.nodes[i]
      current = { ...current, currentNodeIndex: i }

      if (node.children && node.children.length > 0) {
        // Run children sequentially
        current = updateNode(current, i, { status: "running" })
        setWorkflow({ ...current })

        for (let ci = 0; ci < node.children.length; ci++) {
          const child = node.children[ci]
          const sim = CHILDREN_SIM[child.id]
          if (!sim) continue

          current = updateChild(current, i, ci, { status: "running" })
          setWorkflow({ ...current })

          await simulateNode(sim.duration, (elapsed) => {
            current = updateChild(current, i, ci, { duration: elapsed })
            setWorkflow({ ...current })
          })

          current = updateChild(current, i, ci, {
            status: "completed",
            duration: sim.duration,
            outputPreview: sim.preview,
            metric: sim.metric,
          })
          setWorkflow({ ...current })
        }

        // Mark parent completed with summary
        current = updateNode(current, i, {
          status: "completed",
          duration: node.children.reduce(
            (sum, c) => sum + (CHILDREN_SIM[c.id]?.duration ?? 0),
            0,
          ),
          outputPreview:
            "All filters complete. 39 accepted, 5 margin, 4 rejected.",
          metric: { label: "ACCEPT RATE", value: "81.3%" },
        })
        setWorkflow({ ...current })
      } else {
        // Flat node
        const sim = FLAT_SIM[node.id]
        if (!sim) continue

        current = updateNode(current, i, { status: "running" })
        setWorkflow({ ...current })

        await simulateNode(sim.duration, (elapsed) => {
          current = updateNode(current, i, { duration: elapsed })
          setWorkflow({ ...current })
        })

        current = updateNode(current, i, {
          status: "completed",
          duration: sim.duration,
          outputPreview: sim.preview,
          metric: sim.metric,
        })
        setWorkflow({ ...current })
      }
    }

    current = { ...current, status: "completed" }
    setWorkflow({ ...current })
    runningRef.current = false
  }, [])

  const handleCreate = () => {
    const wf = createWorkflow(description, parseInt(duration))
    setWorkflow(wf)
    setOpen(false)
    setDescription("")
    setDuration("")
    runPipeline(wf)
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
                disabled={!description.trim() || !duration}
                onClick={handleCreate}
              >
                <Play className="size-4 fill-current" />
                Begin Workflow
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
