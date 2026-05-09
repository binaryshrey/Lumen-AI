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
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <h4 className="pb-3 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                  Status
                </h4>
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">State</span>
                    <span className="text-sm font-medium capitalize text-zinc-400">
                      {node.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Duration</span>
                    <span className="text-sm font-mono text-zinc-400">
                      {node.duration > 0
                        ? `${node.duration.toFixed(1)}s`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">{node.metric.label}</span>
                    <span className="text-sm font-mono text-zinc-400">
                      {node.metric.value}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <h4 className="pb-3 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                  Preview
                </h4>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {node.outputPreview}
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
