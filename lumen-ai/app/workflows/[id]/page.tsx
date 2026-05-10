"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { Download, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/page-shell"
import { WorkflowCanvas } from "@/components/workflow-canvas"
import {
  PIPELINE_NODES,
  type AgentNodeData,
  type AgentStatus,
  type Workflow,
} from "@/lib/workflow-types"
import { getWorkflow, getExportUrl } from "@/lib/api"

// ── Transform backend order → frontend Workflow ─────────────────────────────

type NodeTemplate = (typeof PIPELINE_NODES)[number]

function applyNodeState(
  template: NodeTemplate | Omit<AgentNodeData, "status" | "duration">,
  nodeStates: Record<string, Record<string, unknown>>,
  description?: string,
): AgentNodeData {
  const state = nodeStates[template.id] || {}
  const hasState = Object.keys(state).length > 0

  const idlePreviews: Record<string, string> = description
    ? {
        "order-parsing": `Waiting to parse: "${description}"`,
        ingest: "Waiting for parsed keywords to search Pexels...",
        "ml-hard-gates": "Waiting for clips to run sharpness, safety, logo, and watermark gates...",
        "ml-quality-scoring": "Waiting for gated clips to score aesthetic, semantic, and motion...",
        "ml-decision": "Waiting for quality scores to apply accept/margin/reject thresholds...",
        "search-index": "Waiting for accepted clips to generate embeddings and build index...",
        deliver: "Waiting for indexed clips to package manifest and generate signed URLs...",
      }
    : {}

  return {
    ...template,
    status: (state.status as AgentStatus) || "idle",
    duration: (state.duration as number) || 0,
    outputPreview: hasState
      ? (state.outputPreview as string) || template.outputPreview
      : idlePreviews[template.id] || template.outputPreview,
    metric:
      (state.metric as { label: string; value: string }) || template.metric,
    children: ("children" in template && template.children)
      ? template.children.map((child) => applyNodeState(child, nodeStates, description))
      : undefined,
  }
}

function orderToWorkflow(order: Record<string, unknown>): Workflow {
  const nodeStates = (order.node_states as Record<string, Record<string, unknown>>) || {}
  const description = order.description as string
  const nodes = PIPELINE_NODES.map((t) => applyNodeState(t, nodeStates, description))

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
  const { id } = useParams<{ id: string }>()
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevNodeStatesRef = useRef<Record<string, string>>({})

  const NODE_LABELS: Record<string, string> = {
    "order-parsing": "Order Parsing",
    ingest: "Ingest",
    "ml-hard-gates": "Hard Gates",
    "ml-quality-scoring": "Quality Scoring",
    "ml-decision": "Decision Split",
    "ml-filters": "ML Filters",
    "search-index": "Search & Index",
    deliver: "Deliver",
  }

  const notifyNodeChanges = useCallback(
    (order: Record<string, unknown>) => {
      const ns = (order.node_states as Record<string, Record<string, unknown>>) || {}
      const prev = prevNodeStatesRef.current

      for (const [nodeId, state] of Object.entries(ns)) {
        const status = state.status as string
        const prevStatus = prev[nodeId]
        if (status === prevStatus) continue

        const label = NODE_LABELS[nodeId] || nodeId

        if (status === "running" && prevStatus !== "running") {
          toast.loading(`${label} is running...`, { id: nodeId })
        } else if (status === "completed") {
          toast.success(`${label} completed`, {
            id: nodeId,
            description: (state.outputPreview as string)?.slice(0, 80),
          })
        } else if (status === "error") {
          toast.error(`${label} failed`, { id: nodeId })
        }

        prev[nodeId] = status
      }

      if (order.status === "completed") {
        toast.success("Workflow completed", {
          description: "All nodes finished. Export is ready.",
        })
      }

      prevNodeStatesRef.current = { ...prev }
    },
    [],
  )

  const startPolling = useCallback((orderId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)

    pollRef.current = setInterval(async () => {
      try {
        const order = await getWorkflow(orderId)
        notifyNodeChanges(order)
        setWorkflow(orderToWorkflow(order))
        if (order.status === "completed" || order.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch {
        // ignore
      }
    }, 2000)
  }, [notifyNodeChanges])

  useEffect(() => {
    if (!id) return

    getWorkflow(id)
      .then((order) => {
        setWorkflow(orderToWorkflow(order))
        if (order.status !== "completed" && order.status !== "error") {
          startPolling(id)
        }
      })
      .catch(console.error)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [id, startPolling])

  return (
    <PageShell
      title="Workflows"
      headerAction={
        <div className="flex items-center gap-2">
          {workflow?.status === "completed" && (
            <a
              href={getExportUrl(workflow.id)}
              download
              onClick={() =>
                toast.success("Downloading dataset", {
                  description: "Zipping clips and manifest...",
                })
              }
            >
              <Button variant="ghost" size="sm" className="gap-2">
                <Download className="size-4" />
                Export
              </Button>
            </a>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => (window.location.href = "/workflows")}
          >
            <Plus className="size-4" />
            New Workflow
          </Button>
        </div>
      }
    >
      <div className="flex flex-1 flex-col overflow-hidden p-4 pt-0">
        <WorkflowCanvas workflow={workflow} />
      </div>
    </PageShell>
  )
}
