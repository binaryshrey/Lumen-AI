"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  Layers3,
  Maximize,
  Minus,
  RotateCcw,
  Undo2,
  ZoomIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────────────────────────────────

type ViewState = {
  x: number;
  y: number;
  scale: number;
};

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_VIEW: ViewState = { x: 0, y: 0, scale: 1 };
const MIN_SCALE = 0.75;
const MAX_SCALE = 1.65;

const DOT_PATTERN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22'%3E%3Ccircle cx='11' cy='11' r='1' fill='%235F5C6C' /%3E%3C/svg%3E\")";

// ── Helpers ──────────────────────────────────────────────────────────────────

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function isSameView(a: ViewState, b: ViewState) {
  return a.x === b.x && a.y === b.y && a.scale === b.scale;
}

// ── Control Button ───────────────────────────────────────────────────────────

function WorkspaceControlButton({
  active = false,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { active?: boolean }) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      className={cn(
        "h-10 w-10 rounded-xl border-white/10 bg-white/5 text-zinc-200 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur hover:bg-white/10 hover:text-white",
        active && "border-white/16 bg-black/40 text-white",
        className,
      )}
      {...props}
    />
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function WorkflowCanvas() {
  const [view, setView] = useState(DEFAULT_VIEW);
  const [history, setHistory] = useState<ViewState[]>([DEFAULT_VIEW]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showGrid] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    pointerId: number;
    pointerX: number;
    pointerY: number;
    startView: ViewState;
  } | null>(null);

  // ── View history ─────────────────────────────────────────────────────────

  const commitView = (nextView: ViewState) => {
    setView(nextView);
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIndex + 1);
      const last = truncated.at(-1);
      if (last && isSameView(last, nextView)) return prev;
      const updated = [...truncated, nextView];
      setHistoryIndex(updated.length - 1);
      return updated;
    });
  };

  const restoreHistory = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= history.length) return;
    setHistoryIndex(nextIndex);
    setView(history[nextIndex]);
  };

  const adjustScale = (delta: number) => {
    commitView({
      ...view,
      scale: clampScale(Number((view.scale + delta).toFixed(2))),
    });
  };

  // ── Pointer events (pan) ─────────────────────────────────────────────────

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (
      e.target instanceof HTMLElement &&
      e.target.closest('[data-drag-ignore="true"]')
    )
      return;

    dragRef.current = {
      pointerId: e.pointerId,
      pointerX: e.clientX,
      pointerY: e.clientY,
      startView: view,
    };
    setIsDragging(true);
  };

  const handlePointerMove = useEffectEvent((e: PointerEvent) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const { pointerX, pointerY, startView } = dragRef.current;
    setView({
      ...startView,
      x: startView.x + e.clientX - pointerX,
      y: startView.y + e.clientY - pointerY,
    });
  });

  const handlePointerUp = useEffectEvent((e: PointerEvent) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const { pointerX, pointerY, startView } = dragRef.current;
    const nextView = {
      ...startView,
      x: startView.x + e.clientX - pointerX,
      y: startView.y + e.clientY - pointerY,
    };
    dragRef.current = null;
    setIsDragging(false);
    commitView(nextView);
  });

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section
      className={cn(
        "relative flex h-[calc(100vh-72px)] min-h-[680px] overflow-hidden rounded-[28px] border border-white/8 bg-[#171717] shadow-[0_30px_80px_rgba(0,0,0,0.45)]",
        isDragging ? "cursor-grabbing" : "cursor-grab",
      )}
      onPointerDown={handleCanvasPointerDown}
    >
      {/* Dot grid background */}
      <div
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={
          showGrid
            ? {
                backgroundImage: DOT_PATTERN,
                backgroundSize: "22px 22px",
                backgroundPosition: `${view.x % 22}px ${view.y % 22}px`,
              }
            : undefined
        }
      />

      {/* Controls */}
      <div
        className="absolute top-1/2 left-5 z-20 flex -translate-y-1/2 cursor-default flex-col items-center gap-3"
        data-drag-ignore="true"
      >
        <div className="flex flex-col gap-2 rounded-[18px] border border-white/10 bg-[#16141B]/85 p-2 shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur">
          <WorkspaceControlButton
            aria-label="Zoom in"
            onClick={() => adjustScale(0.1)}
          >
            <ZoomIn className="size-4" />
          </WorkspaceControlButton>
          <WorkspaceControlButton
            aria-label="Zoom out"
            onClick={() => adjustScale(-0.1)}
          >
            <Minus className="size-4" />
          </WorkspaceControlButton>
          <WorkspaceControlButton
            aria-label="Center canvas"
            onClick={() => commitView(DEFAULT_VIEW)}
          >
            <Maximize className="size-4" />
          </WorkspaceControlButton>
          <WorkspaceControlButton
            aria-label="Undo last view change"
            disabled={historyIndex === 0}
            onClick={() => restoreHistory(historyIndex - 1)}
          >
            <Undo2 className="size-4" />
          </WorkspaceControlButton>
          <WorkspaceControlButton
            aria-label="Redo last view change"
            disabled={historyIndex === history.length - 1}
            onClick={() => restoreHistory(historyIndex + 1)}
          >
            <RotateCcw className="size-4 scale-x-[-1]" />
          </WorkspaceControlButton>
        </div>

        <WorkspaceControlButton
          active={showGuides}
          aria-label={showGuides ? "Hide guides" : "Show guides"}
          onClick={() => setShowGuides((v) => !v)}
        >
          <Layers3 className="size-4" />
        </WorkspaceControlButton>
      </div>

      {/* Canvas content area */}
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden px-20 py-8"
        style={{
          transform: `translate(${view.x}px, ${view.y}px)`,
          transition: isDragging ? "none" : "transform 180ms ease-out",
        }}
      >
        <div
          className="relative cursor-default touch-none select-none"
          data-drag-ignore="true"
          style={{
            transform: `scale(${view.scale})`,
            transition: isDragging ? "none" : "transform 180ms ease-out",
          }}
        >
          {/* Empty canvas — pipeline cards will go here */}
        </div>
      </div>
    </section>
  );
}
