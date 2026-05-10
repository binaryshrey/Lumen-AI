"use client"

import { useState } from "react"
import {
  Brain,
  Download,
  Filter,
  Database,
  Package,
  Box,
  Wrench,
  FileOutput,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import type { AgentNodeData } from "@/lib/workflow-types"

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  brain: Brain,
  download: Download,
  filter: Filter,
  database: Database,
  package: Package,
}

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Overview: Box,
  Config: Wrench,
  Output: FileOutput,
}

// ── Log types ───────────────────────────────────────────────────────────────

type LogEntry = {
  prefix: "$" | ">" | "✓" | "✗" | "→" | "•" | "⚡" | ""
  text: string
  color?: "green" | "blue" | "red" | "amber" | "zinc" | "cyan" | "purple"
  dim?: boolean
  indent?: boolean
  divider?: boolean
}

const COLOR_MAP: Record<string, string> = {
  green: "text-emerald-400",
  blue: "text-blue-400",
  red: "text-red-400",
  amber: "text-amber-400",
  zinc: "text-zinc-400",
  cyan: "text-cyan-400",
  purple: "text-purple-400",
}

function LogLine({ prefix, text, color = "zinc", dim, indent, divider }: LogEntry) {
  if (divider) {
    return <div className="my-1 border-t border-white/5" />
  }
  return (
    <div className={cn("flex gap-2", indent && "pl-4")}>
      {prefix && (
        <span className={cn("select-none", dim ? "text-zinc-700" : "text-zinc-600")}>
          {prefix}
        </span>
      )}
      <span className={cn(COLOR_MAP[color] || "text-zinc-400", dim && "opacity-50")}>
        {text}
      </span>
    </div>
  )
}

function generateLogs(node: AgentNodeData): LogEntry[] {
  const { id, status, duration, metric, outputPreview } = node
  const logs: LogEntry[] = []
  const dur = duration > 0 ? `${duration.toFixed(1)}s` : "—"
  const isIdle = status === "idle"

  if (isIdle) {
    logs.push({ prefix: "$", text: "Waiting for upstream node...", color: "zinc", dim: true })
    return logs
  }

  // ── Node-specific logs ──────────────────────────────────────────────────

  if (id === "order-parsing") {
    logs.push({ prefix: "$", text: "gemini-flash --parse-order", color: "cyan" })
    logs.push({ prefix: ">", text: "Initializing Vertex AI client...", color: "zinc", dim: true })
    logs.push({ prefix: ">", text: "Model: gemini-2.5-flash", color: "zinc" })
    logs.push({ prefix: ">", text: "Sending prompt to Gemini Flash...", color: "zinc" })
    if (status === "completed" || status === "running") {
      logs.push({ prefix: "", text: "", divider: true })
      logs.push({ prefix: "⚡", text: outputPreview, color: "green" })
      logs.push({ prefix: "", text: "", divider: true })
      logs.push({ prefix: "•", text: `Tokens used: ${metric.value}`, color: "purple" })
      logs.push({ prefix: "•", text: `Duration: ${dur}`, color: "zinc" })
    }
  }

  else if (id === "ingest") {
    logs.push({ prefix: "$", text: "pexels-fetch --keywords [...] --per-page 5", color: "cyan" })
    logs.push({ prefix: ">", text: "Connecting to Pexels API...", color: "zinc", dim: true })
    logs.push({ prefix: ">", text: "Searching videos by keyword...", color: "zinc" })
    if (status === "completed" || status === "running") {
      logs.push({ prefix: "✓", text: `Fetched ${metric.value} clips from Pexels`, color: "green" })
      logs.push({ prefix: "", text: "", divider: true })
      logs.push({ prefix: "$", text: "ffmpeg -i clip.mp4 -vf fps=1 frame_%04d.jpg", color: "cyan" })
      logs.push({ prefix: ">", text: "Extracting frames at 1fps...", color: "zinc" })
      logs.push({ prefix: ">", text: "Uploading clips to GCS...", color: "zinc" })
      logs.push({ prefix: ">", text: "Uploading frames to GCS...", color: "zinc" })
      logs.push({ prefix: "", text: "", divider: true })
      logs.push({ prefix: "⚡", text: outputPreview, color: "green" })
      logs.push({ prefix: "•", text: `Duration: ${dur}`, color: "zinc" })
    }
  }

  else if (id === "ml-hard-gates") {
    logs.push({ prefix: "$", text: "run-gates --sharpness --safety --logo --watermark", color: "cyan" })
    logs.push({ prefix: "", text: "", divider: true })
    logs.push({ prefix: ">", text: "[1/4] Gemini Flash Vision → sharpness scoring...", color: "zinc" })
    logs.push({ prefix: ">", text: "[2/4] Video Intelligence → explicit content check...", color: "zinc" })
    logs.push({ prefix: ">", text: "[3/4] Cloud Vision → logo detection...", color: "zinc" })
    logs.push({ prefix: ">", text: "[4/4] Cloud Vision → watermark/text detection...", color: "zinc" })
    if (status === "completed" || status === "running") {
      logs.push({ prefix: "", text: "", divider: true })
      const rejected = parseInt(metric.value) || 0
      if (rejected > 0) {
        logs.push({ prefix: "✗", text: `${rejected} clips rejected by gates`, color: "red" })
      } else {
        logs.push({ prefix: "✓", text: "All clips passed gates", color: "green" })
      }
      logs.push({ prefix: "⚡", text: outputPreview, color: "green" })
      logs.push({ prefix: "•", text: `Rejected: ${metric.value}`, color: rejected > 0 ? "amber" : "green" })
      logs.push({ prefix: "•", text: `Duration: ${dur}`, color: "zinc" })
    }
  }

  else if (id === "ml-quality-scoring") {
    logs.push({ prefix: "$", text: "score-quality --model gemini-2.5-flash --frames 4", color: "cyan" })
    logs.push({ prefix: "", text: "", divider: true })
    logs.push({ prefix: ">", text: "Downloading frames from GCS...", color: "zinc", dim: true })
    logs.push({ prefix: ">", text: "Sending frames to Gemini Flash Vision...", color: "zinc" })
    logs.push({ prefix: ">", text: "Scoring: aesthetic (0-1)...", color: "zinc" })
    logs.push({ prefix: ">", text: "Scoring: semantic match (0-1)...", color: "zinc" })
    logs.push({ prefix: ">", text: "Scoring: motion intensity (0-1)...", color: "zinc" })
    logs.push({ prefix: ">", text: "Generating captions...", color: "zinc" })
    if (status === "completed" || status === "running") {
      logs.push({ prefix: "", text: "", divider: true })
      logs.push({ prefix: "⚡", text: outputPreview, color: "green" })
      logs.push({ prefix: "", text: "", divider: true })
      logs.push({ prefix: "•", text: `Combined formula: 0.35×aes + 0.30×sem + 0.20×sharp + 0.15×mot`, color: "purple", dim: true })
      logs.push({ prefix: "•", text: `Avg combined: ${metric.value}`, color: "cyan" })
      logs.push({ prefix: "•", text: `Duration: ${dur}`, color: "zinc" })
    }
  }

  else if (id === "ml-decision") {
    logs.push({ prefix: "$", text: "decision-split --accept 0.55 --margin 0.35", color: "cyan" })
    logs.push({ prefix: "", text: "", divider: true })
    logs.push({ prefix: ">", text: "Applying weighted score thresholds...", color: "zinc" })
    logs.push({ prefix: ">", text: "Routing clips → accept / margin / reject...", color: "zinc" })
    if (status === "completed" || status === "running") {
      logs.push({ prefix: "", text: "", divider: true })
      logs.push({ prefix: "⚡", text: outputPreview, color: "green" })
      logs.push({ prefix: "", text: "", divider: true })
      logs.push({ prefix: "✓", text: `Accept rate: ${metric.value}`, color: "green" })
      logs.push({ prefix: "•", text: `Duration: ${dur}`, color: "zinc" })
    }
  }

  else if (id === "search-index") {
    logs.push({ prefix: "$", text: "embed --model multimodalembedding@001 --dim 1408", color: "cyan" })
    logs.push({ prefix: ">", text: "Downloading frames from GCS...", color: "zinc", dim: true })
    logs.push({ prefix: ">", text: "Generating Vertex AI multimodal embeddings...", color: "zinc" })
    if (status === "completed" || status === "running") {
      logs.push({ prefix: "✓", text: `Embedded ${metric.value} clips → 1408-dim vectors`, color: "green" })
      logs.push({ prefix: "", text: "", divider: true })
      logs.push({ prefix: "$", text: "faiss-build --index hnsw --M 32 --ef 200", color: "cyan" })
      logs.push({ prefix: ">", text: "Building FAISS IndexHNSWFlat...", color: "zinc" })
      logs.push({ prefix: "✓", text: "FAISS index built and uploaded to GCS", color: "green" })
      logs.push({ prefix: "", text: "", divider: true })
      logs.push({ prefix: "$", text: "duckdb export --format parquet", color: "cyan" })
      logs.push({ prefix: ">", text: "Writing metadata to DuckDB...", color: "zinc" })
      logs.push({ prefix: "✓", text: "Parquet exported and uploaded to GCS", color: "green" })
      logs.push({ prefix: "", text: "", divider: true })
      logs.push({ prefix: "•", text: `Indexed: ${metric.value} clips`, color: "cyan" })
      logs.push({ prefix: "•", text: `Duration: ${dur}`, color: "zinc" })
    }
  }

  else if (id === "deliver") {
    logs.push({ prefix: "$", text: "package-manifest --signed-urls --expiry 24h", color: "cyan" })
    logs.push({ prefix: ">", text: "Generating signed GCS URLs for clips...", color: "zinc" })
    logs.push({ prefix: ">", text: "Building manifest.json...", color: "zinc" })
    logs.push({ prefix: ">", text: "Computing quality summary...", color: "zinc" })
    if (status === "completed" || status === "running") {
      logs.push({ prefix: "✓", text: "Manifest uploaded to GCS", color: "green" })
      logs.push({ prefix: "", text: "", divider: true })
      logs.push({ prefix: "⚡", text: outputPreview, color: "green" })
      logs.push({ prefix: "", text: "", divider: true })
      logs.push({ prefix: "•", text: `Total duration: ${metric.value}`, color: "cyan" })
      logs.push({ prefix: "•", text: `Duration: ${dur}`, color: "zinc" })
      logs.push({ prefix: "✓", text: "Order status → COMPLETED", color: "green" })
    }
  }

  // Fallback for unknown nodes (parent ml-filters etc)
  else {
    logs.push({ prefix: "$", text: `run ${id}`, color: "cyan" })
    if (status === "completed" || status === "running") {
      logs.push({ prefix: "⚡", text: outputPreview, color: "green" })
      logs.push({ prefix: "•", text: `${metric.label}: ${metric.value}`, color: "zinc" })
      logs.push({ prefix: "•", text: `Duration: ${dur}`, color: "zinc" })
    }
  }

  // Final status line
  if (status === "completed") {
    logs.push({ prefix: "", text: "", divider: true })
    logs.push({ prefix: "✓", text: `Process exited with code 0 (${dur})`, color: "green" })
  } else if (status === "error") {
    logs.push({ prefix: "", text: "", divider: true })
    logs.push({ prefix: "✗", text: "Process exited with code 1", color: "red" })
  }

  return logs
}

// ── Drawer Component ────────────────────────────────────────────────────────

export function AgentDrawer({
  node,
  open,
  onClose,
}: {
  node: AgentNodeData | null
  open: boolean
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState("Overview")

  if (!node) return null

  const Icon = ICONS[node.icon] ?? Brain

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-white/8 bg-[#141414] sm:max-w-md"
      >
        <SheetHeader className="gap-1 pb-2">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
            <Icon className="size-3.5" />
            {node.tag}
          </div>
          <SheetTitle className="text-xl font-semibold text-white">
            {node.title}
          </SheetTitle>
          <SheetDescription className="text-sm text-zinc-500">
            {node.subtitle}
          </SheetDescription>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/8 px-4">
          {node.drawer.tabs.map((tab) => {
            const TabIcon = TAB_ICONS[tab]
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  activeTab === tab
                    ? "border-white text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-300",
                )}
              >
                {TabIcon && <TabIcon className="size-4" />}
                {tab}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div className="px-4 pt-4 pb-8">
          {activeTab === "Overview" && (
            <div className="flex flex-col gap-6">
              <p className="text-sm leading-relaxed text-zinc-400">
                {node.drawer.overview.description}
              </p>

              <section className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <h4 className="pb-3 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                  Inputs
                </h4>
                <div className="flex flex-col gap-2.5">
                  {node.drawer.overview.inputs.map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-4">
                      <span className="text-sm font-medium text-zinc-300">
                        {item.label}
                      </span>
                      <span className="text-right text-sm text-zinc-500">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <h4 className="pb-3 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                  Outputs
                </h4>
                <div className="flex flex-col gap-2.5">
                  {node.drawer.overview.outputs.map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-4">
                      <span className="text-sm font-medium text-zinc-300">
                        {item.label}
                      </span>
                      <span className="text-right text-sm text-zinc-500">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === "Config" && (
            <div className="flex flex-col gap-5">
              {node.drawer.config.map((field) => (
                <div
                  key={field.label}
                  className="rounded-xl border border-white/8 bg-white/[0.02] p-4"
                >
                  <div className="flex items-center justify-between pb-1">
                    <h4 className="text-sm font-semibold text-white">
                      {field.label}
                    </h4>
                    {field.type === "toggle" && (
                      <div
                        className={cn(
                          "h-5 w-9 rounded-full transition-colors",
                          field.value === "true"
                            ? "bg-emerald-500"
                            : "bg-zinc-600",
                        )}
                      >
                        <div
                          className={cn(
                            "mt-0.5 size-4 rounded-full bg-white shadow transition-transform",
                            field.value === "true"
                              ? "translate-x-4"
                              : "translate-x-0.5",
                          )}
                        />
                      </div>
                    )}
                    {field.type === "slider" && (
                      <span className="text-sm font-medium text-zinc-400">
                        {field.value}
                      </span>
                    )}
                    {field.type === "text" && (
                      <span className="text-sm font-mono text-zinc-400">
                        {field.value}
                      </span>
                    )}
                    {field.type === "select" && (
                      <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm text-zinc-300">
                        {field.value}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] leading-relaxed text-zinc-500">
                    {field.description}
                  </p>
                  {field.type === "slider" && (
                    <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-700">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{
                          width: `${Math.min(parseFloat(field.value) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "Output" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-white/8 bg-[#0d0d0d] p-4 font-mono text-xs">
                <div className="flex items-center gap-2 pb-3 border-b border-white/5 mb-3">
                  <div className="flex gap-1.5">
                    <span className="size-2.5 rounded-full bg-red-500/70" />
                    <span className="size-2.5 rounded-full bg-amber-500/70" />
                    <span className="size-2.5 rounded-full bg-emerald-500/70" />
                  </div>
                  <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                    {node.id} — output
                  </span>
                </div>

                <div className="flex flex-col gap-0 text-[13px] leading-[1.7]">
                  {generateLogs(node).map((line, i) => (
                    <LogLine key={i} {...line} />
                  ))}

                  {node.status === "running" && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-zinc-600 select-none">$</span>
                      <span className="inline-block h-3.5 w-1.5 animate-pulse bg-zinc-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
