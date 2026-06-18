"use client";

import { useEffect, useRef } from "react";

type Node = {
  id: number;
  x: number;
  y: number;
  unlockedAt: number;
  connections: number[];
};

const NODES: Node[] = [
  { id: 0, x: 38, y: 40, unlockedAt: 0, connections: [] },
  { id: 1, x: 92, y: 78, unlockedAt: 0, connections: [0] },
  { id: 2, x: 30, y: 124, unlockedAt: 1, connections: [0, 1] },
  { id: 3, x: 86, y: 168, unlockedAt: 2, connections: [1, 2] },
  { id: 4, x: 34, y: 214, unlockedAt: 3, connections: [2, 3] },
  { id: 5, x: 92, y: 36, unlockedAt: 3, connections: [0, 1] },
  { id: 6, x: 58, y: 250, unlockedAt: 4, connections: [3, 4] },
];

const MINT = "143, 220, 176";
const LAV = "184, 160, 216";

export function ThinkingMap({
  completedCount,
  pasted,
}: {
  completedCount: number;
  pasted: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const birthRef = useRef<Record<number, number>>({});

  useEffect(() => {
    const now = performance.now();
    for (const node of NODES) {
      if (
        node.unlockedAt <= completedCount &&
        birthRef.current[node.id] === undefined
      ) {
        birthRef.current[node.id] = now - 2000;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const now = performance.now();
    for (const node of NODES) {
      if (
        node.unlockedAt <= completedCount &&
        birthRef.current[node.id] === undefined
      ) {
        birthRef.current[node.id] = now;
      }
    }
  }, [completedCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const render = () => {
      const now = performance.now();
      ctx.clearRect(0, 0, rect.width, rect.height);
      const globalA = pasted ? 0.32 : 1;

      const pos = NODES.map((n, i) => {
        const fx = reduce ? 0 : Math.sin(now / 900 + i * 1.5) * 2.4;
        const fy = reduce ? 0 : Math.cos(now / 1100 + i * 2.1) * 2.4;
        return { x: n.x + fx, y: n.y + fy };
      });

      for (const n of NODES) {
        if (n.unlockedAt > completedCount) continue;
        for (const c of n.connections) {
          if (NODES[c].unlockedAt > completedCount) continue;
          const birth = birthRef.current[n.id] ?? now;
          const p = Math.min(1, Math.max(0, (now - birth) / 650));
          const sx = pos[n.id].x;
          const sy = pos[n.id].y;
          const ex = sx + (pos[c].x - sx) * p;
          const ey = sy + (pos[c].y - sy) * p;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.strokeStyle = pasted
            ? `rgba(${MINT}, 0.1)`
            : `rgba(${MINT}, ${0.4 * p})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      NODES.forEach((n, i) => {
        if (n.unlockedAt > completedCount) return;
        const birth = birthRef.current[n.id] ?? 0;
        const age = now - birth;
        let scale = 1;
        let glowA = 0.35;
        if (age < 1000 && !reduce) {
          const p = age / 1000;
          scale = 1 + Math.sin(p * Math.PI) * 1.7;
          glowA = Math.sin(p * Math.PI) * 0.85;
        } else if (!reduce) {
          scale = 1 + Math.sin(now / 500 + i * 1.3) * 0.08;
          glowA = 0.3 + Math.sin(now / 800 + i * 0.7) * 0.12;
        }
        const r = 3.6 * scale;
        const tint = i % 3 === 2 ? LAV : MINT;

        if (!pasted) {
          const g = ctx.createRadialGradient(
            pos[n.id].x,
            pos[n.id].y,
            r * 0.2,
            pos[n.id].x,
            pos[n.id].y,
            r * 3.4,
          );
          g.addColorStop(0, `rgba(${tint}, ${0.6 * glowA * globalA})`);
          g.addColorStop(1, `rgba(${tint}, 0)`);
          ctx.beginPath();
          ctx.arc(pos[n.id].x, pos[n.id].y, r * 3.4, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(pos[n.id].x, pos[n.id].y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${tint}, ${globalA})`;
        ctx.fill();
      });

      raf = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(raf);
  }, [completedCount, pasted]);

  return (
    <div className="relative flex h-[280px] w-full items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--border-soft)] bg-white/10">
      <canvas
        ref={canvasRef}
        className="h-[280px] w-[120px]"
        aria-hidden="true"
      />
    </div>
  );
}
