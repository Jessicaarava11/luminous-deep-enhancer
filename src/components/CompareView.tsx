import { useEffect, useRef, useState } from "react";

interface Props {
  /** The original (low-light) media element to render on the left. */
  original: ReactNode;
  /** The enhanced canvas to render on the right. */
  enhanced: ReactNode;
}

import { ReactNode } from "react";

export const CompareView = ({ original, enhanced }: Props) => {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const move = (clientX: number) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const p = ((clientX - rect.left) / rect.width) * 100;
      setPos(Math.max(0, Math.min(100, p)));
    };
    const onMove = (e: MouseEvent) => dragging.current && move(e.clientX);
    const onTouch = (e: TouchEvent) => dragging.current && e.touches[0] && move(e.touches[0].clientX);
    const stop = () => (dragging.current = false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", onTouch);
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", stop);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="relative w-full aspect-video overflow-hidden rounded-2xl bg-black select-none shadow-elegant"
    >
      <div className="absolute inset-0 flex items-center justify-center">{original}</div>
      <div
        className="absolute inset-y-0 left-0 overflow-hidden flex items-center justify-center"
        style={{ width: `${pos}%` }}
      >
        <div className="absolute inset-0 flex items-center justify-center" style={{ width: `${(100 / Math.max(pos, 0.01)) * 100}%` }}>
          {enhanced}
        </div>
      </div>

      {/* Labels */}
      <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-white/80">
        Enhanced
      </div>
      <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-white/80">
        Original
      </div>

      {/* Handle */}
      <div
        className="absolute inset-y-0 z-20 w-1 -translate-x-1/2 cursor-ew-resize bg-gradient-primary shadow-glow"
        style={{ left: `${pos}%` }}
        onMouseDown={() => (dragging.current = true)}
        onTouchStart={() => (dragging.current = true)}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary shadow-glow ring-2 ring-background">
          <svg className="h-4 w-4 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M9 6L3 12l6 6M15 6l6 6-6 6" />
          </svg>
        </div>
      </div>
    </div>
  );
};
