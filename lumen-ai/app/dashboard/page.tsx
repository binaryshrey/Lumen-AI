"use client"

import { useEffect, useState } from "react"
import {
  ArrowUpRight,
  ArrowDownRight,
  Search,
  SlidersHorizontal,
  Download,
  Clock,
  Video,
  Zap,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PageShell } from "@/components/page-shell"
const API_BASE = process.env.NEXT_PUBLIC_API_URL!

// ── Types ───────────────────────────────────────────────────────────────────

type OrderRow = {
  id: string
  description: string
  target_minutes: number
  status: string
  node_states: Record<string, Record<string, unknown>>
  created_at: string
}

// ── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  change,
  positive,
  icon: Icon,
}: {
  label: string
  value: string
  change: string
  positive: boolean
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/8 bg-[#1A1A1A] p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">{label}</span>
        <Icon className="size-4 text-zinc-600" />
      </div>
      <span className="text-3xl font-semibold tracking-tight text-white">
        {value}
      </span>
      <div className="flex items-center gap-1 text-xs">
        {positive ? (
          <ArrowUpRight className="size-3 text-emerald-400" />
        ) : (
          <ArrowDownRight className="size-3 text-red-400" />
        )}
        <span className={positive ? "text-emerald-400" : "text-red-400"}>
          {change}
        </span>
        <span className="text-zinc-600">vs last month</span>
      </div>
    </div>
  )
}

// ── Funnel Chart ────────────────────────────────────────────────────────────

const FUNNEL_STAGES = [
  { key: "fetched", label: "Clips Fetched" },
  { key: "gated", label: "Gates Passed" },
  { key: "scored", label: "Quality Scored" },
  { key: "accepted", label: "Accepted" },
  { key: "delivered", label: "Delivered" },
]

function FunnelChart({ orders }: { orders: OrderRow[] }) {
  // Aggregate funnel data from completed orders
  const totals = { fetched: 0, gated: 0, scored: 0, accepted: 0, delivered: 0 }

  for (const order of orders) {
    const ns = order.node_states || {}
    const ingest = ns["ingest"] as Record<string, unknown> | undefined
    const gates = ns["ml-hard-gates"] as Record<string, unknown> | undefined
    const scoring = ns["ml-quality-scoring"] as Record<string, unknown> | undefined
    const decision = ns["ml-decision"] as Record<string, unknown> | undefined
    const deliver = ns["deliver"] as Record<string, unknown> | undefined

    const clipsStr = (ingest?.metric as Record<string, string>)?.value
    const clips = parseInt(clipsStr || "0") || 0
    const rejectedStr = (gates?.metric as Record<string, string>)?.value
    const rejected = parseInt(rejectedStr || "0") || 0

    totals.fetched += clips
    totals.gated += Math.max(clips - rejected, 0)
    totals.scored += Math.max(clips - rejected, 0)

    const rateStr = (decision?.metric as Record<string, string>)?.value
    const rate = parseFloat(rateStr || "0") || 0
    const accepted = Math.round((clips - rejected) * rate / 100)
    totals.accepted += accepted
    totals.delivered += deliver?.status === "completed" ? accepted : 0
  }

  const max = Math.max(totals.fetched, 1)
  const values = FUNNEL_STAGES.map((s) => totals[s.key as keyof typeof totals])

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-[#1A1A1A] p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          Pipeline Performance Funnel
        </h3>
        <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
          All time
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {FUNNEL_STAGES.map((stage, i) => {
          const pct = max > 0 ? Math.round((values[i] / max) * 100) : 0
          return (
            <div key={stage.key} className="flex items-center gap-3">
              <span className="w-24 text-right text-xs text-zinc-500 shrink-0">
                {stage.label}
              </span>
              <div className="flex-1 h-8 rounded-lg bg-white/[0.03] overflow-hidden">
                <div
                  className="h-full rounded-lg transition-all duration-700"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    backgroundColor: `rgba(59, 130, 246, ${0.15 + (pct / 100) * 0.85})`,
                  }}
                />
              </div>
              <span className="w-12 text-right text-sm font-mono text-zinc-300">
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── AI Performance Gauge ────────────────────────────────────────────────────

function AIPerformance({ orders }: { orders: OrderRow[] }) {
  // Calculate avg quality score across all completed orders
  let totalScore = 0
  let count = 0

  for (const order of orders) {
    const ns = order.node_states || {}
    const scoring = ns["ml-quality-scoring"] as Record<string, unknown> | undefined
    const scoreStr = (scoring?.metric as Record<string, string>)?.value
    const score = parseFloat(scoreStr || "0")
    if (score > 0) {
      totalScore += score
      count++
    }
  }

  const avgScore = count > 0 ? totalScore / count : 0
  const pct = Math.round(avgScore * 100)
  const rotation = -90 + (pct / 100) * 180

  let label = "Getting Started"
  let sublabel = "Run more workflows to improve scoring calibration"
  if (pct >= 80) {
    label = "Excellent"
    sublabel = "Pipeline is producing high-quality, relevant datasets"
  } else if (pct >= 60) {
    label = "Almost There"
    sublabel = "Quality scores are above average across workflows"
  } else if (pct >= 40) {
    label = "Good Progress"
    sublabel = "Filters are working — tune thresholds for better results"
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/8 bg-[#1A1A1A] p-6">
      <h3 className="self-start text-sm font-semibold text-white">
        AI Performance
      </h3>

      {/* Gauge */}
      <div className="relative flex items-center justify-center py-4">
        <svg width="160" height="90" viewBox="0 0 160 90" className="overflow-visible">
          {/* Background arc */}
          <path
            d="M 15 80 A 65 65 0 0 1 145 80"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className="text-white/5"
          />
          {/* Filled arc */}
          <path
            d="M 15 80 A 65 65 0 0 1 145 80"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${pct * 2.04} 204`}
            className="text-blue-500"
          />
          {/* Tick marks */}
          {Array.from({ length: 11 }).map((_, i) => {
            const angle = -180 + i * 18
            const rad = (angle * Math.PI) / 180
            const x1 = 80 + 55 * Math.cos(rad)
            const y1 = 80 + 55 * Math.sin(rad)
            const x2 = 80 + 62 * Math.cos(rad)
            const y2 = 80 + 62 * Math.sin(rad)
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className={i <= pct / 10 ? "text-blue-500" : "text-white/10"}
              />
            )
          })}
        </svg>
        <div className="absolute bottom-0 flex flex-col items-center">
          <span className="text-2xl font-bold text-white">{pct}%</span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-1 text-xs text-zinc-500">{sublabel}</p>
      </div>
    </div>
  )
}

// ── Workflow Table ───────────────────────────────────────────────────────────

function WorkflowTable({ orders }: { orders: OrderRow[] }) {
  const [search, setSearch] = useState("")

  const filtered = orders.filter(
    (o) =>
      o.description.toLowerCase().includes(search.toLowerCase()) ||
      o.id.includes(search),
  )

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-[#1A1A1A] p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Workflow Run Data</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
            <Search className="size-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-32 bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-600"
            />
          </div>
          <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/8">
            <SlidersHorizontal className="size-3" />
            Filter
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/8">
            <Download className="size-3" />
            Export
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/5 text-zinc-500">
              <th className="pb-3 pr-4 font-medium">Run ID</th>
              <th className="pb-3 pr-4 font-medium">Description</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 pr-4 font-medium">Clips</th>
              <th className="pb-3 pr-4 font-medium">Accept Rate</th>
              <th className="pb-3 pr-4 font-medium">Duration</th>
              <th className="pb-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => {
              const ns = order.node_states || {}
              const ingestMetric = (ns["ingest"]?.metric as Record<string, string>)?.value || "—"
              const rateMetric = (ns["ml-decision"]?.metric as Record<string, string>)?.value || "—"
              const deliverMetric = (ns["deliver"]?.metric as Record<string, string>)?.value || "—"

              const statusColor =
                order.status === "completed"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                  : order.status === "running"
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/20"
                    : order.status === "error"
                      ? "bg-red-500/15 text-red-400 border-red-500/20"
                      : "bg-zinc-500/15 text-zinc-400 border-zinc-500/20"

              return (
                <tr
                  key={order.id}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer"
                  onClick={() => window.location.href = `/workflows/${order.id}`}
                >
                  <td className="py-3 pr-4 font-mono text-zinc-400">
                    {order.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="py-3 pr-4 text-zinc-300 max-w-[200px] truncate">
                    {order.description}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        statusColor,
                      )}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-zinc-400">
                    {ingestMetric}
                  </td>
                  <td className="py-3 pr-4 font-mono text-zinc-400">
                    {rateMetric}
                  </td>
                  <td className="py-3 pr-4 font-mono text-zinc-400">
                    {deliverMetric}
                  </td>
                  <td className="py-3 text-zinc-500">
                    {new Date(order.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-zinc-600">
                  No workflows found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Page() {
  const [orders, setOrders] = useState<OrderRow[]>([])

  useEffect(() => {
    fetch(`${API_BASE}/workflows`)
      .then((res) => res.json())
      .then((data) => setOrders(data as OrderRow[]))
      .catch(console.error)
  }, [])

  const completedCount = orders.filter((o) => o.status === "completed").length
  const runningCount = orders.filter((o) => o.status === "running").length

  // Compute totals
  let totalClips = 0
  let totalAccepted = 0
  let totalDuration = 0

  for (const order of orders) {
    const ns = order.node_states || {}
    const clips = parseInt((ns["ingest"]?.metric as Record<string, string>)?.value || "0") || 0
    const rejected = parseInt((ns["ml-hard-gates"]?.metric as Record<string, string>)?.value || "0") || 0
    const rate = parseFloat((ns["ml-decision"]?.metric as Record<string, string>)?.value || "0") || 0
    totalClips += clips
    totalAccepted += Math.round((clips - rejected) * rate / 100)

    // Sum all node durations
    for (const key of Object.keys(ns)) {
      const dur = (ns[key]?.duration as number) || 0
      totalDuration += dur
    }
  }

  const successRate = totalClips > 0 ? ((totalAccepted / totalClips) * 100).toFixed(1) : "0"

  return (
    <PageShell title="Dashboard">
      <div className="flex flex-col gap-6 p-6 pt-2">
        {/* Top row: Funnel + AI Performance */}
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <FunnelChart orders={orders} />
          <AIPerformance orders={orders} />
        </div>

        {/* Metric cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Workflows"
            value={orders.length.toString()}
            change={`${runningCount} active`}
            positive={runningCount > 0}
            icon={Zap}
          />
          <MetricCard
            label="Clips Processed"
            value={totalClips.toLocaleString()}
            change={`${totalAccepted} accepted`}
            positive
            icon={Video}
          />
          <MetricCard
            label="Tasks Completed"
            value={completedCount.toString()}
            change={`of ${orders.length} total`}
            positive={completedCount > 0}
            icon={CheckCircle2}
          />
          <MetricCard
            label="Acceptance Rate"
            value={`${successRate}%`}
            change={`${totalAccepted}/${totalClips} clips`}
            positive={parseFloat(successRate) > 50}
            icon={Clock}
          />
        </div>

        {/* Workflow table */}
        <WorkflowTable orders={orders} />
      </div>
    </PageShell>
  )
}
