"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/page-shell"
import { WorkflowCanvas } from "@/components/workflow-canvas"
import {
  PIPELINE_NODES,
  type AgentNodeData,
  type AgentStatus,
  type Workflow,
} from "@/lib/workflow-types"
import { getWorkflow } from "@/lib/api"
import { supabase } from "@/lib/supabase"

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
  const { id } = useParams<{ id: string }>()
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const subscribe = useCallback((orderId: string) => {
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          setWorkflow(orderToWorkflow(payload.new))
        },
      )
      .subscribe()

    channelRef.current = channel

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
    }, 3000)
  }, [])

  useEffect(() => {
    if (!id) return

    // Initial fetch
    getWorkflow(id).then((order) => {
      setWorkflow(orderToWorkflow(order))
      if (order.status !== "completed" && order.status !== "error") {
        subscribe(id)
      }
    })

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [id, subscribe])

  return (
    <PageShell
      title="Workflows"
      headerAction={
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => window.location.href = "/workflows"}
        >
          <Plus className="size-4" />
          New Workflow
        </Button>
      }
    >
      <div className="flex flex-1 flex-col overflow-hidden p-4 pt-0">
        <WorkflowCanvas workflow={workflow} />
      </div>
    </PageShell>
  )
}
