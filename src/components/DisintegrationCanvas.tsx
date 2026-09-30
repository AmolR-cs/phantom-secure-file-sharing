"use client";

import React, { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
}

interface DisintegrationCanvasProps {
  trigger: boolean;
  onComplete?: () => void;
  className?: string;
}

export function DisintegrationCanvas({
  trigger,
  onComplete,
  className = "",
}: DisintegrationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!trigger) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = (canvas.width = canvas.parentElement?.clientWidth || 600);
    const height = (canvas.height = canvas.parentElement?.clientHeight || 400);

    const particles: Particle[] = [];
    const colors = ["#00F0FF", "#BD00FF", "#FF003C", "#FFFFFF", "#00FF66"];

    // Spawn 350 digital particles across the bounding area
    const PARTICLE_COUNT = 350;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 8 + (Math.random() > 0.5 ? 2 : -2),
        vy: -Math.random() * 6 - 1, // Float upwards
        size: Math.random() * 3 + 1,
        alpha: 1,
        decay: Math.random() * 0.015 + 0.008,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      let activeParticles = 0;
      for (const p of particles) {
        if (p.alpha > 0) {
          activeParticles++;
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.98; // Friction
          p.vy *= 0.98;
          p.alpha -= p.decay;

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      if (activeParticles > 0) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        if (onComplete) onComplete();
      }
    };

    render();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [trigger, onComplete]);

  if (!trigger) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 z-50 w-full h-full ${className}`}
    />
  );
}
