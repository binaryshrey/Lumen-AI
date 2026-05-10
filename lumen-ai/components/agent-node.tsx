"use client"

import {
  Brain,
  Download,
  Filter,
  Database,
  Package,
  Shield,
  Sparkles,
  GitBranch,
  Clock,
  Coins,
  Loader2,
  CheckCircle2,
  CircleAlert,
  Circle,
  ArrowDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentNodeData, AgentStatus } from "@/lib/workflow-types"

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  brain: Brain,
  download: Download,
  filter: Filter,
  database: Database,
  package: Package,
  shield: Shield,
  sparkles: Sparkles,
  "git-branch": GitBranch,
}

const TAG_STYLES: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  amber: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  rose: "bg-rose-500/15 text-rose-400 border-rose-500/20",
}

const TAG_DOT_STYLES: Record<string, string> = {
  green: "bg-emerald-400",
  blue: "bg-blue-400",
  purple: "bg-purple-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
}

const STATUS_CONFIG: Record<AgentStatus, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  idle: { label: "IDLE", className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20", icon: Circle },
  running: { label: "RUNNING", className: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: Loader2 },
  completed: { label: "COMPLETED", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  error: { label: "ERROR", className: "bg-red-500/15 text-red-400 border-red-500/20", icon: CircleAlert },
}

function NodeCard({
  node,
  onClick,
  isActive,
}: {
  node: AgentNodeData
  onClick: () => void
  isActive: boolean
}) {
  const Icon = ICONS[node.icon] ?? Brain
  const status = STATUS_CONFIG[node.status]
  const StatusIcon = status.icon

  return (
    <button
      onClick={onClick}
      data-drag-ignore="true"
      className={cn(
        "group relative flex w-[400px] flex-col rounded-2xl border bg-[#141414] p-0 text-left transition-all duration-200 hover:border-white/20 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
        isActive
          ? "border-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          : "border-white/8",
      )}
    >
      {/* Tag */}
      <div className="px-5 pt-5 pb-0">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase",
            TAG_STYLES[node.tagColor],
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              node.status === "running"
                ? "animate-pulse"
                : "",
              TAG_DOT_STYLES[node.tagColor],
            )}
          />
          {node.tag}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 px-5 pt-4 pb-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
          <Icon className="size-6 text-zinc-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-white">
            {node.title}
          </h3>
          <p className="truncate text-sm text-zinc-500">{node.subtitle}</p>
        </div>
      </div>

      {/* Output section */}
      <div className="mx-5 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-4">
        <div className="flex items-center justify-between pb-2">
          <span className="text-[11px] font-bold tracking-widest text-zinc-500 uppercase">
            {node.outputLabel}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Clock className="size-3.5" />
            {node.duration > 0 ? `${node.duration.toFixed(1)} sec` : "—"}
          </span>
        </div>
        <p className="line-clamp-2 text-sm leading-relaxed text-zinc-400">
          {node.outputPreview}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 pt-3.5 pb-5">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold tracking-widest uppercase",
            status.className,
          )}
        >
          <StatusIcon
            className={cn(
              "size-3.5",
              node.status === "running" && "animate-spin",
            )}
          />
          {status.label}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          <Coins className="size-3.5" />
          {node.metric.value} {node.metric.label}
        </span>
      </div>
    </button>
  )
}

function VerticalConnector({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div
        className={cn(
          "h-6 w-px transition-colors duration-500",
          active ? "bg-emerald-500/60" : "bg-white/10",
        )}
      />
      <ArrowDown
        className={cn(
          "size-3.5 -mt-0.5 transition-colors duration-500",
          active ? "text-emerald-500/60" : "text-white/10",
        )}
      />
    </div>
  )
}

export function AgentNode({
  node,
  onClick,
  isActive,
  onChildClick,
  activeChildId,
}: {
  node: AgentNodeData
  onClick: () => void
  isActive: boolean
  onChildClick?: (childId: string) => void
  activeChildId?: string | null
}) {
  if (!node.children || node.children.length === 0) {
    return <NodeCard node={node} onClick={onClick} isActive={isActive} />
  }

  return (
    <div className="relative rounded-[32px] border border-dashed border-white/12 bg-white/[0.04] px-6 pb-8 pt-12">
      {/* Group label */}
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-[#141414] px-4 py-1.5 text-xs font-bold tracking-widest text-amber-400 uppercase">
          <span
            className={cn(
              "size-2 rounded-full bg-amber-400",
              node.status === "running" && "animate-pulse",
            )}
          />
          {node.tag}
        </span>
      </div>

      <div className="flex flex-col items-center">
        {node.children.map((child, i) => (
          <div key={child.id} className="flex flex-col items-center">
            {i > 0 && (
              <VerticalConnector
                active={
                  child.status === "completed" || child.status === "running"
                }
              />
            )}
            <NodeCard
              node={child}
              onClick={() => onChildClick?.(child.id)}
              isActive={activeChildId === child.id}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
